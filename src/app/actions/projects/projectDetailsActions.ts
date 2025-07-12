

'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { Project, Task, Employee, PayMode, TaskStatus, InventoryItem } from '@/types/database';
import { getInventoryByProject as fetchProjectInventoryData, type ProjectInventoryDetails } from '@/app/actions/inventory-expense/getInventoryByProject';
import { getOrganizationId } from '../common/getOrganizationId';


// --- Helper Functions ---
function calculateElapsedTime(startTime?: number, endTime?: number): number {
  if (startTime && endTime && endTime > startTime) {
    return Math.round((endTime - startTime) / 1000); // Convert ms to seconds
  }
  return 0;
}

async function getProjectDoc(projectId: string, organizationId: string): Promise<Project | null> {
  const projectRef = doc(db, 'organizations', organizationId, 'projects', projectId);
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
    materialCost: typeof data.materialCost === 'number' ? data.materialCost : 0, // This might be less used if dynamic cost is preferred
  } as Project;
}

async function getTasksForProject(projectId: string, organizationId: string): Promise<Task[]> {
  const tasksCollectionRef = collection(db, 'organizations', organizationId, 'tasks');
  const q = query(tasksCollectionRef, where('projectId', '==', projectId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    
    const startTimeMillis = data.startTime instanceof Timestamp 
                            ? data.startTime.toMillis() 
                            : (typeof data.startTime === 'number' ? data.startTime : undefined);
    const endTimeMillis = data.endTime instanceof Timestamp 
                            ? data.endTime.toMillis() 
                            : (typeof data.endTime === 'number' ? data.endTime : undefined);

    let elapsedTimeSecs = typeof data.elapsedTime === 'number' ? data.elapsedTime : 0;
    // Fallback, but server-side elapsedTime updates should be primary
    if (elapsedTimeSecs === 0 && startTimeMillis && endTimeMillis) {
        elapsedTimeSecs = calculateElapsedTime(startTimeMillis, endTimeMillis);
    }

    const task: Task = {
      id: docSnap.id,
      projectId: data.projectId,
      assignedEmployeeId: data.assignedEmployeeId,
      taskName: data.taskName || 'Unnamed Task',
      description: data.description || '',
      status: data.status || 'pending',
      dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate,
      startTime: startTimeMillis,
      endTime: endTimeMillis,
      elapsedTime: elapsedTimeSecs,
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
    return task;
  });
}

async function getEmployeeDetails(employeeId: string, organizationId: string): Promise<Partial<Employee> | null> {
  const userRef = doc(db, 'organizations', organizationId, 'users', employeeId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    console.warn(`[getEmployeeDetails] Employee with ID ${employeeId} not found in 'users' collection of org ${organizationId}.`);
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
  tasks: Task[];
  totalTasks: number;
  completedTasks: number; // Strictly 'completed' status
  verifiedTasks: number; // Strictly 'verified' status
  pendingTasks: number;
  inProgressTasks: number;
  needsReviewTasks: number;
  rejectedTasks: number;
  taskCompletionPercentage: number; // Based on (completed + verified) / total
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
  materialCost: number; // This will now be dynamically calculated
  totalLaborCost: number;
  totalProjectCost: number; // Will be recalculated based on dynamic material cost + labor
  remainingBudget: number;
  budgetUsedPercentage: number;
  timesheet: ProjectTimesheetEntry[];
}

// --- Server Actions ---

export async function getProjectSummary(projectId: string, requestingUserId: string): Promise<ProjectSummaryData | { error: string }> {
  const organizationId = await getOrganizationId(requestingUserId);
  if (!organizationId) return { error: "User or organization not found." };
  
  const project = await getProjectDoc(projectId, organizationId);
  if (!project) return { error: "Project not found." };

  const tasks = await getTasksForProject(projectId, organizationId);

  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const trulyCompletedTasks = (statusCounts.completed || 0) + (statusCounts.verified || 0);
  const taskCompletionPercentage = tasks.length > 0 ? (trulyCompletedTasks / tasks.length) * 100 : 0;

  const assignedEmployeeIdsFromTasks = new Set<string>();
  tasks.forEach(task => {
    if(task.assignedEmployeeId) assignedEmployeeIdsFromTasks.add(task.assignedEmployeeId)
  });
  (project.assignedEmployeeIds || []).forEach(id => assignedEmployeeIdsFromTasks.add(id));


  return {
    project,
    tasks,
    totalTasks: tasks.length,
    completedTasks: statusCounts.completed || 0,
    verifiedTasks: statusCounts.verified || 0,
    pendingTasks: statusCounts.pending || 0,
    inProgressTasks: statusCounts['in-progress'] || 0,
    needsReviewTasks: statusCounts['needs-review'] || 0,
    rejectedTasks: statusCounts.rejected || 0,
    taskCompletionPercentage: parseFloat(taskCompletionPercentage.toFixed(1)),
    totalAssignedEmployees: assignedEmployeeIdsFromTasks.size,
  };
}

export async function getProjectTimesheet(projectId: string, requestingUserId: string): Promise<ProjectTimesheetEntry[] | { error: string }> {
  const organizationId = await getOrganizationId(requestingUserId);
  if (!organizationId) return { error: "User or organization not found." };

  const tasks = await getTasksForProject(projectId, organizationId);
  const employeeTimeMap = new Map<string, { totalTimeSpentSeconds: number; taskCount: number }>();

  tasks.forEach(task => {
    if (!task.assignedEmployeeId) return; 

    // Primarily and directly use task.elapsedTime if it's a valid number.
    // This field should be accurately maintained by server actions during task start/pause/complete.
    let timeForTask = (typeof task.elapsedTime === 'number' && task.elapsedTime > 0) ? task.elapsedTime : 0;
    
    // Fallback: if elapsedTime is 0 but startTime and endTime exist (e.g. task never paused/completed standardly)
    // This should be rare if server logic for elapsedTime is robust.
    if (timeForTask === 0 && task.startTime && task.endTime) {
        console.warn(`[getProjectTimesheet] Fallback: Task ${task.id} (${task.taskName}) had 0 elapsedTime. Calculating from startTime/endTime.`);
        timeForTask = calculateElapsedTime(task.startTime, task.endTime);
    }

    if (timeForTask > 0) {
      const current = employeeTimeMap.get(task.assignedEmployeeId) || { totalTimeSpentSeconds: 0, taskCount: 0 };
      current.totalTimeSpentSeconds += timeForTask;
      current.taskCount += 1; // Only count tasks that contribute time
      employeeTimeMap.set(task.assignedEmployeeId, current);
    }
  });

  const timesheetEntries: ProjectTimesheetEntry[] = [];
  for (const [employeeId, timeData] of employeeTimeMap.entries()) {
    const empDetails = await getEmployeeDetails(employeeId, organizationId);
    if (empDetails) {
      let calculatedLaborCost = 0;
      const payMode = empDetails.payMode || 'not_set';
      const rate = empDetails.rate || 0;

      if (payMode === 'hourly' && rate > 0) {
        const hoursWorked = timeData.totalTimeSpentSeconds / 3600;
        calculatedLaborCost = hoursWorked * rate;
      } else if (payMode === 'daily' && rate > 0) {
        const distinctDays = new Set<string>();
        tasks
          .filter(t => t.assignedEmployeeId === employeeId && t.startTime)
          .forEach(t => {
            if (typeof t.startTime === 'number') {
                 distinctDays.add(new Date(t.startTime).toISOString().split('T')[0]);
            }
          });
        calculatedLaborCost = distinctDays.size * rate;
      } else if (payMode === 'monthly' && rate > 0) {
        // Monthly pay calculation based on timesheet is complex and typically not done this way.
        // For now, timesheet labor cost for monthly employees will be 0 here.
        // Payroll processing would handle monthly salaries.
        calculatedLaborCost = 0; 
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
  return timesheetEntries.sort((a, b) => (b.calculatedLaborCost - a.calculatedLaborCost) || (a.employeeName.localeCompare(b.employeeName)));
}


export async function getProjectCostBreakdown(projectId: string, requestingUserId: string): Promise<ProjectCostBreakdownData | { error: string }> {
  const organizationId = await getOrganizationId(requestingUserId);
  if (!organizationId) return { error: "User or organization not found." };
  
  const project = await getProjectDoc(projectId, organizationId);
  if (!project) return { error: "Project not found." };

  const timesheetResult = await getProjectTimesheet(projectId, requestingUserId);
  let timesheet: ProjectTimesheetEntry[] = [];
  if ('error' in timesheetResult) {
    console.warn(`[getProjectCostBreakdown] Error fetching timesheet for ${projectId}: ${timesheetResult.error}. Proceeding with 0 labor cost.`);
  } else {
    timesheet = timesheetResult;
  }
  
  const totalLaborCost = timesheet.reduce((sum, entry) => sum + entry.calculatedLaborCost, 0);

  // Fetch dynamic material cost from projectInventory
  const inventoryDataResult = await fetchProjectInventoryData(projectId, requestingUserId);
  let dynamicMaterialCost = 0;
  if ('error' in inventoryDataResult) {
    console.warn(`[getProjectCostBreakdown] Error fetching inventory for project ${projectId} to calculate dynamic material cost: ${inventoryDataResult.error}. Using static project.materialCost if available.`);
    dynamicMaterialCost = project.materialCost || 0; // Fallback to static if inventory fetch fails
  } else {
    dynamicMaterialCost = inventoryDataResult.totalInventoryCost;
  }
  
  const totalProjectCost = totalLaborCost + dynamicMaterialCost; // Note: This doesn't include employee expenses yet.
                                                              // Employee expenses will be added in the ProjectDetailsView.
  const budget = project.budget || 0;
  const remainingBudget = budget - totalProjectCost;
  const budgetUsedPercentage = budget > 0 
                               ? (totalProjectCost / budget) * 100 
                               : (totalProjectCost > 0 ? Infinity : 0);

  return {
    projectId,
    projectName: project.name,
    budget,
    materialCost: parseFloat(dynamicMaterialCost.toFixed(2)), // Use dynamic material cost here
    totalLaborCost: parseFloat(totalLaborCost.toFixed(2)),
    totalProjectCost: parseFloat(totalProjectCost.toFixed(2)),
    remainingBudget: parseFloat(remainingBudget.toFixed(2)),
    budgetUsedPercentage: budgetUsedPercentage === Infinity ? 100.0 : parseFloat(budgetUsedPercentage.toFixed(1)),
    timesheet,
  };
}
