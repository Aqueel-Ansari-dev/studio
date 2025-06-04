
'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { Project, Task, Employee, PayMode, TaskStatus } from '@/types/database';

// --- Helper Functions ---
function calculateElapsedTime(startTime?: number, endTime?: number): number {
  if (startTime && endTime && endTime > startTime) {
    return Math.round((endTime - startTime) / 1000); // Convert ms to seconds
  }
  return 0;
}

async function getProjectDoc(projectId: string): Promise<Project | null> {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    console.warn(`[projectDetailsActions] Project with ID ${projectId} not found.`);
    return null;
  }
  const data = projectSnap.data();
  return {
    id: projectSnap.id,
    name: data.name || 'Unnamed Project',
    description: data.description || '',
    imageUrl: data.imageUrl || '',
    dataAiHint: data.dataAiHint || '',
    assignedEmployeeIds: data.assignedEmployeeIds || [],
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
    createdBy: data.createdBy || '',
    dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate,
    budget: typeof data.budget === 'number' ? data.budget : 0,
    materialCost: typeof data.materialCost === 'number' ? data.materialCost : 0,
  } as Project;
}

async function getTasksForProject(projectId: string): Promise<Task[]> {
  const tasksCollectionRef = collection(db, 'tasks');
  const q = query(tasksCollectionRef, where('projectId', '==', projectId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    const task: Task = {
      id: docSnap.id,
      projectId: data.projectId,
      assignedEmployeeId: data.assignedEmployeeId,
      taskName: data.taskName || 'Unnamed Task',
      description: data.description || '',
      status: data.status || 'pending',
      dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate,
      startTime: data.startTime instanceof Timestamp ? data.startTime.toMillis() : (typeof data.startTime === 'number' ? data.startTime : undefined),
      endTime: data.endTime instanceof Timestamp ? data.endTime.toMillis() : (typeof data.endTime === 'number' ? data.endTime : undefined),
      elapsedTime: data.elapsedTime || calculateElapsedTime(
        data.startTime instanceof Timestamp ? data.startTime.toMillis() : data.startTime,
        data.endTime instanceof Timestamp ? data.endTime.toMillis() : data.endTime
      ),
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date(0).toISOString()),
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date(0).toISOString()),
      createdBy: data.createdBy || '',
      supervisorNotes: data.supervisorNotes || '',
      employeeNotes: data.employeeNotes || '',
      submittedMediaUri: data.submittedMediaUri || '',
      aiComplianceNotes: data.aiComplianceNotes || '',
      aiRisks: data.aiRisks || [],
      supervisorReviewNotes: data.supervisorReviewNotes || '',
      reviewedBy: data.reviewedBy || '',
      reviewedAt: data.reviewedAt instanceof Timestamp ? data.reviewedAt.toMillis() : (typeof data.reviewedAt === 'number' ? data.reviewedAt : undefined),
    };
    // Ensure elapsedTime is explicitly calculated if not stored
    if (!task.elapsedTime && task.startTime && task.endTime) {
        task.elapsedTime = calculateElapsedTime(task.startTime, task.endTime);
    }
    return task;
  });
}

async function getEmployeeDetails(employeeId: string): Promise<Partial<Employee> | null> {
  const userRef = doc(db, 'users', employeeId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return null;
  }
  const data = userSnap.data();
  return {
    id: userSnap.id,
    displayName: data.displayName || data.email?.split('@')[0] || 'N/A',
    payMode: data.payMode || 'not_set',
    rate: typeof data.rate === 'number' ? data.rate : 0,
    photoURL: data.photoURL || data.avatarUrl || `https://placehold.co/40x40.png?text=${(data.displayName || data.email || 'EE').substring(0,2).toUpperCase()}`
  };
}


// --- Exported Types ---
export interface ProjectSummaryData {
  project: Project | null;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  needsReviewTasks: number;
  verifiedTasks: number;
  rejectedTasks: number;
  taskCompletionPercentage: number;
  totalAssignedEmployees: number;
}

export interface ProjectTimesheetEntry {
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  totalTimeSpentSeconds: number; // Total time in seconds
  payMode: PayMode;
  rate: number;
  calculatedLaborCost: number;
  taskCount: number;
}

export interface ProjectCostBreakdownData {
  projectId: string;
  projectName: string;
  budget: number;
  materialCost: number;
  totalLaborCost: number;
  totalProjectCost: number;
  remainingBudget: number;
  budgetUsedPercentage: number;
  timesheet: ProjectTimesheetEntry[];
}

// --- Server Actions ---

/**
 * Fetches summary information for a given project.
 * TODO: Implement proper access control for requestingUserId.
 */
export async function getProjectSummary(projectId: string, requestingUserId: string): Promise<ProjectSummaryData | { error: string }> {
  // Placeholder for access control: verify requestingUserId has rights to see this project
  if (!requestingUserId) return { error: "User not authenticated." };

  const project = await getProjectDoc(projectId);
  if (!project) return { error: "Project not found." };

  const tasks = await getTasksForProject(projectId);

  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const completedOrVerifiedTasks = (statusCounts.completed || 0) + (statusCounts.verified || 0);
  const taskCompletionPercentage = tasks.length > 0 ? (completedOrVerifiedTasks / tasks.length) * 100 : 0;

  const assignedEmployeeIds = new Set<string>();
  tasks.forEach(task => assignedEmployeeIds.add(task.assignedEmployeeId));
  (project.assignedEmployeeIds || []).forEach(id => assignedEmployeeIds.add(id));

  return {
    project,
    totalTasks: tasks.length,
    completedTasks: statusCounts.completed || 0,
    pendingTasks: statusCounts.pending || 0,
    inProgressTasks: statusCounts['in-progress'] || 0,
    needsReviewTasks: statusCounts['needs-review'] || 0,
    verifiedTasks: statusCounts.verified || 0,
    rejectedTasks: statusCounts.rejected || 0,
    taskCompletionPercentage: parseFloat(taskCompletionPercentage.toFixed(1)),
    totalAssignedEmployees: assignedEmployeeIds.size,
  };
}

/**
 * Fetches timesheet information for a project, including labor costs.
 * TODO: Implement proper access control and more sophisticated cost calculation for daily/monthly.
 */
export async function getProjectTimesheet(projectId: string, requestingUserId: string): Promise<ProjectTimesheetEntry[] | { error: string }> {
  if (!requestingUserId) return { error: "User not authenticated." };

  const tasks = await getTasksForProject(projectId);
  const employeeTimeMap = new Map<string, { totalTimeSpentSeconds: number; taskCount: number }>();

  tasks.forEach(task => {
    // Only consider tasks that have a recorded elapsedTime or can be calculated
    let timeForTask = task.elapsedTime || 0;
    if (!timeForTask && task.startTime && task.endTime) {
        timeForTask = calculateElapsedTime(task.startTime, task.endTime);
    }

    if (timeForTask > 0) {
      const current = employeeTimeMap.get(task.assignedEmployeeId) || { totalTimeSpentSeconds: 0, taskCount: 0 };
      current.totalTimeSpentSeconds += timeForTask;
      current.taskCount += 1;
      employeeTimeMap.set(task.assignedEmployeeId, current);
    }
  });

  const timesheetEntries: ProjectTimesheetEntry[] = [];
  for (const [employeeId, timeData] of employeeTimeMap.entries()) {
    const empDetails = await getEmployeeDetails(employeeId);
    if (empDetails) {
      let calculatedLaborCost = 0;
      const payMode = empDetails.payMode || 'not_set';
      const rate = empDetails.rate || 0;

      if (payMode === 'hourly' && rate > 0) {
        const hoursWorked = timeData.totalTimeSpentSeconds / 3600;
        calculatedLaborCost = hoursWorked * rate;
      } else if (payMode === 'daily' && rate > 0) {
        // Simplified: assume each task an employee worked on, on a distinct day, counts as one day.
        // This needs refinement for tasks spanning multiple days or multiple tasks on the same day.
        const distinctDays = new Set<string>();
        tasks.filter(t => t.assignedEmployeeId === employeeId && t.startTime).forEach(t => {
            distinctDays.add(new Date(t.startTime!).toISOString().split('T')[0]);
        });
        calculatedLaborCost = distinctDays.size * rate;

      } else if (payMode === 'monthly' && rate > 0) {
        // Monthly proration is complex. For MVP, could be a placeholder or simple division.
        // Example: if rate is monthly, and project duration is 15 days, cost = rate / 2 (approx)
        // This is highly dependent on project duration and employee involvement.
        // For now, we can put a placeholder or not calculate for monthly.
        calculatedLaborCost = 0; // Placeholder for monthly
      }

      timesheetEntries.push({
        employeeId,
        employeeName: empDetails.displayName || 'N/A',
        employeeAvatar: empDetails.photoURL,
        totalTimeSpentSeconds: timeData.totalTimeSpentSeconds,
        payMode,
        rate,
        calculatedLaborCost: parseFloat(calculatedLaborCost.toFixed(2)),
        taskCount: timeData.taskCount
      });
    }
  }
  return timesheetEntries;
}

/**
 * Fetches cost breakdown for a project.
 * TODO: Implement proper access control.
 */
export async function getProjectCostBreakdown(projectId: string, requestingUserId: string): Promise<ProjectCostBreakdownData | { error: string }> {
  if (!requestingUserId) return { error: "User not authenticated." };

  const project = await getProjectDoc(projectId);
  if (!project) return { error: "Project not found." };

  const timesheetResult = await getProjectTimesheet(projectId, requestingUserId);
  if ('error' in timesheetResult) {
    // If timesheet fetch fails, we might still want to return partial cost data or the error
    console.warn(`[getProjectCostBreakdown] Error fetching timesheet for ${projectId}: ${timesheetResult.error}`);
     return { // Return partial data or propagate error, depending on desired behavior
        projectId,
        projectName: project.name,
        budget: project.budget || 0,
        materialCost: project.materialCost || 0,
        totalLaborCost: 0,
        totalProjectCost: project.materialCost || 0,
        remainingBudget: (project.budget || 0) - (project.materialCost || 0),
        budgetUsedPercentage: project.budget && project.budget > 0 ? (((project.materialCost || 0) / project.budget) * 100) : 0,
        timesheet: []
     };
  }
  
  const timesheet = timesheetResult; // Now it's ProjectTimesheetEntry[]

  const totalLaborCost = timesheet.reduce((sum, entry) => sum + entry.calculatedLaborCost, 0);
  const materialCost = project.materialCost || 0;
  const totalProjectCost = totalLaborCost + materialCost;
  const budget = project.budget || 0;
  const remainingBudget = budget - totalProjectCost;
  const budgetUsedPercentage = budget > 0 ? (totalProjectCost / budget) * 100 : (totalProjectCost > 0 ? Infinity : 0) ;


  return {
    projectId,
    projectName: project.name,
    budget,
    materialCost,
    totalLaborCost: parseFloat(totalLaborCost.toFixed(2)),
    totalProjectCost: parseFloat(totalProjectCost.toFixed(2)),
    remainingBudget: parseFloat(remainingBudget.toFixed(2)),
    budgetUsedPercentage: parseFloat(budgetUsedPercentage.toFixed(1)),
    timesheet,
  };
}
