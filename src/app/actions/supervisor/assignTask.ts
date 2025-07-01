
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { notifyUserByWhatsApp } from '@/lib/notify';
import { getUserDisplayName, getProjectName, createSingleNotification } from '@/app/actions/notificationsUtils';
import type { Task, TaskStatus } from '@/types/database';
import { format } from 'date-fns';
import { createQuickTaskForAssignment, CreateQuickTaskInput, CreateQuickTaskResult } from './createTask'; // Import createQuickTask
import { logAudit } from '../auditLog';

// Define the structure for processing individual tasks (both existing and new)
const TaskToProcessSchema = z.object({
  taskId: z.string().min(1), // ID of existing task, or ID of newly created task
  isImportant: z.boolean(), // Final desired importance status
});

// Define the structure for new tasks to be created
const NewTaskDataSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  isImportant: z.boolean(),
});

const AssignTasksInputSchema = z.object({
  existingTasksToAssign: z.array(TaskToProcessSchema).optional(), // Existing tasks to assign/update
  newTasksToCreateAndAssign: z.array(NewTaskDataSchema).optional(), // New tasks to create and then assign
  employeeId: z.string().min(1, { message: 'Employee selection is required.' }),
  projectId: z.string().min(1, { message: 'Project ID is required.'}),
  dueDate: z.date({ required_error: 'Due date is required.' }),
  supervisorNotes: z.string().max(500).optional(),
}).refine(data => (data.existingTasksToAssign && data.existingTasksToAssign.length > 0) || (data.newTasksToCreateAndAssign && data.newTasksToCreateAndAssign.length > 0), {
  message: "At least one existing task must be selected or one new task defined for assignment.",
});


export type AssignTasksInput = z.infer<typeof AssignTasksInputSchema>;

export interface AssignTasksResult {
  success: boolean;
  message: string;
  assignedCount: number;
  createdCount: number;
  failedCount: number;
  errors?: z.ZodIssue[];
  individualTaskErrors?: { taskId?: string, taskName?: string, error: string }[];
}

export async function assignTasksToEmployee(supervisorId: string, input: AssignTasksInput): Promise<AssignTasksResult> {
  if (!supervisorId) {
    return { success: false, message: 'Supervisor ID not provided.', assignedCount: 0, createdCount: 0, failedCount: 0 };
  }

  const validationResult = AssignTasksInputSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input: ' + validationResult.error.issues.map(e => e.message).join(', '), assignedCount: 0, createdCount: 0, failedCount: 0, errors: validationResult.error.issues };
  }

  const { existingTasksToAssign = [], newTasksToCreateAndAssign = [], employeeId, projectId, dueDate, supervisorNotes } = validationResult.data;

  let assignedCount = 0;
  let createdCount = 0;
  let failedCount = 0;
  const individualTaskErrors: { taskId?: string, taskName?: string, error: string }[] = [];
  
  const allTaskIdsToFinalizeAssignment: { taskId: string; isImportant: boolean; taskName: string }[] = [];


  try {
    const employeeRef = doc(db, 'users', employeeId);
    const employeeSnap = await getDoc(employeeRef);
    if (!employeeSnap.exists()) {
      return { success: false, message: `Employee with ID ${employeeId} not found.`, assignedCount: 0, createdCount: 0, failedCount: existingTasksToAssign.length + newTasksToCreateAndAssign.length };
    } else if (employeeSnap.data()?.role !== 'employee') {
       console.warn(`User ${employeeId} is not an 'employee'. Task assignment will proceed.`);
    }

    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      return { success: false, message: `Project with ID ${projectId} not found.`, assignedCount: 0, createdCount: 0, failedCount: existingTasksToAssign.length + newTasksToCreateAndAssign.length };
    }
    
    const supervisorName = await getUserDisplayName(supervisorId);
    const projectNameStr = projectSnap.data()?.name || projectId;

    // Step 1: Create new tasks if any
    for (const newTk of newTasksToCreateAndAssign) {
      const createTaskInput: CreateQuickTaskInput = {
        projectId,
        taskName: newTk.name,
        description: newTk.description,
        isImportant: newTk.isImportant,
      };
      const createTaskResult: CreateQuickTaskResult = await createQuickTaskForAssignment(supervisorId, createTaskInput);
      if (createTaskResult.success && createTaskResult.taskId) {
        allTaskIdsToFinalizeAssignment.push({ taskId: createTaskResult.taskId, isImportant: newTk.isImportant, taskName: newTk.name });
        createdCount++;
      } else {
        individualTaskErrors.push({ taskName: newTk.name, error: `Failed to create: ${createTaskResult.message}` });
        failedCount++;
      }
    }

    // Step 2: Add existing tasks to the list for final assignment processing
    for (const existingTk of existingTasksToAssign) {
        const taskSnap = await getDoc(doc(db, 'tasks', existingTk.taskId));
        if (taskSnap.exists()) {
            allTaskIdsToFinalizeAssignment.push({ taskId: existingTk.taskId, isImportant: existingTk.isImportant, taskName: taskSnap.data()?.taskName || 'Unnamed Task' });
        } else {
            individualTaskErrors.push({ taskId: existingTk.taskId, error: `Existing task ID ${existingTk.taskId} not found.` });
            failedCount++;
        }
    }
    
    if (allTaskIdsToFinalizeAssignment.length === 0 && failedCount > 0) {
         return { success: false, message: `No tasks could be processed for assignment. ${failedCount} initial failures.`, assignedCount: 0, createdCount, failedCount, individualTaskErrors };
    }
    if (allTaskIdsToFinalizeAssignment.length === 0) {
         return { success: false, message: `No tasks to assign.`, assignedCount: 0, createdCount, failedCount, individualTaskErrors };
    }


    // Step 3: Assign all tasks (newly created and existing ones)
    for (const taskToProcess of allTaskIdsToFinalizeAssignment) {
      try {
        const taskDocRef = doc(db, 'tasks', taskToProcess.taskId);
        // Fetch again to ensure task exists, especially for newly created ones (though createQuickTask should ensure this)
        const taskSnap = await getDoc(taskDocRef); 
        if (!taskSnap.exists()) {
          individualTaskErrors.push({ taskId: taskToProcess.taskId, error: `Task ${taskToProcess.taskId} not found for final assignment.` });
          failedCount++;
          continue;
        }
        const taskData = taskSnap.data();
         if (taskData.projectId !== projectId) { // Should not happen if new tasks are created with correct projectId
            individualTaskErrors.push({ taskId: taskToProcess.taskId, error: `Task's project ID (${taskData.projectId}) mismatch with assignment project ID (${projectId}).`});
            failedCount++;
            continue;
        }

        const taskUpdates: Partial<Task> & { updatedAt: any, status: TaskStatus, assignedEmployeeId: string, isImportant: boolean } = {
          assignedEmployeeId: employeeId,
          dueDate: dueDate.toISOString(),
          supervisorNotes: supervisorNotes || taskData.supervisorNotes || '', // Retain old notes if new ones aren't provided
          status: 'pending', 
          isImportant: taskToProcess.isImportant, // Set the final importance
          updatedAt: serverTimestamp(),
        };

        await updateDoc(taskDocRef, taskUpdates);
        assignedCount++;
        
        const taskNameStr = taskToProcess.taskName;
        const waMessage = `\ud83d\udccb Task Assigned\nProject: ${projectNameStr}\nTask: ${taskNameStr}${taskToProcess.isImportant ? ' (\u26a0\ufe0f Important)' : ''}\nDue: ${format(dueDate, "PP")}\nBy: ${supervisorName}\nNotes: ${supervisorNotes || 'None'}`;
        await notifyUserByWhatsApp(employeeId, waMessage);
        await createSingleNotification(
          employeeId,
          'task-assigned',
          `Task Assigned: ${taskNameStr}`,
          `You have been assigned the task "${taskNameStr}" in project "${projectNameStr}" due ${format(dueDate, 'PP')}.`,
          taskToProcess.taskId,
          'task'
        );

      } catch (taskError: any) {
        console.error(`Error assigning task ${taskToProcess.taskId}:`, taskError);
        individualTaskErrors.push({ taskId: taskToProcess.taskId, error: taskError.message || `Failed to assign task ${taskToProcess.taskId}.` });
        failedCount++;
      }
    }

    if (assignedCount > 0 && employeeSnap.exists()) {
        await updateDoc(employeeRef, {
            assignedProjectIds: arrayUnion(projectId)
        });
    }

    if (assignedCount > 0) {
        await updateDoc(projectRef, {
          assignedEmployeeIds: arrayUnion(employeeId)
        });
    }
    
    let finalMessage = "";
    if (assignedCount > 0 && failedCount === 0) {
        finalMessage = `${assignedCount} task(s) (including ${createdCount} new) assigned successfully!`;
    } else if (assignedCount > 0 && failedCount > 0) {
        finalMessage = `Partially successful: ${assignedCount} task(s) (including ${createdCount} new) assigned. ${failedCount} task(s) failed.`;
    } else if (assignedCount === 0 && failedCount > 0) {
        finalMessage = `All ${failedCount} task operations failed.`;
    } else if (assignedCount === 0 && createdCount === 0 && existingTasksToAssign.length === 0 && newTasksToCreateAndAssign.length === 0) {
        finalMessage = "No tasks were selected or defined for assignment.";
    } else {
         finalMessage = "Task assignment process completed with mixed results.";
    }
    
    // Audit Log
    if (assignedCount > 0) {
      const employeeName = employeeSnap.data()?.displayName || employeeId;
      await logAudit(
        supervisorId,
        'task_assign',
        `Assigned ${assignedCount} task(s) to ${employeeName} for project "${projectNameStr}".`,
        projectId,
        'project',
        { ...input, assignedTaskIds: allTaskIdsToFinalizeAssignment.map(t => t.taskId) }
      );
    }

    return { 
        success: failedCount === 0 && assignedCount > 0, 
        message: finalMessage, 
        assignedCount, 
        createdCount,
        failedCount, 
        individualTaskErrors: individualTaskErrors.length > 0 ? individualTaskErrors : undefined 
    };

  } catch (batchError: any) {
    console.error('Critical error during batch task assignment:', batchError);
    return { success: false, message: `Failed to assign tasks: ${batchError.message || 'An unexpected batch error occurred.'}`, assignedCount, createdCount, failedCount, individualTaskErrors };
  }
}
