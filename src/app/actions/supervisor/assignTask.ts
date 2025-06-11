
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { notifyUserByWhatsApp } from '@/lib/notify';
import { getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import type { Task, TaskStatus } from '@/types/database';
import { format } from 'date-fns';

const AssignTasksInputSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1, { message: 'At least one task ID is required.' }),
  employeeId: z.string().min(1, { message: 'Employee selection is required.' }),
  projectId: z.string().min(1, { message: 'Project ID is required.'}),
  dueDate: z.date({ required_error: 'Due date is required.' }),
  supervisorNotes: z.string().max(500).optional(),
  // isImportant is removed from here; it's handled at task creation or remains unchanged for existing tasks
});

export type AssignTasksInput = z.infer<typeof AssignTasksInputSchema>;

export interface AssignTasksResult {
  success: boolean;
  message: string;
  assignedCount: number;
  failedCount: number;
  errors?: z.ZodIssue[]; // For initial schema validation
  individualTaskErrors?: { taskId: string, error: string }[];
}

export async function assignTasksToEmployee(supervisorId: string, input: AssignTasksInput): Promise<AssignTasksResult> {
  if (!supervisorId) {
    return { success: false, message: 'Supervisor ID not provided.', assignedCount: 0, failedCount: 0 };
  }

  const validationResult = AssignTasksInputSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', assignedCount: 0, failedCount: 0, errors: validationResult.error.issues };
  }

  const { taskIds, employeeId, projectId, dueDate, supervisorNotes } = validationResult.data;

  let assignedCount = 0;
  let failedCount = 0;
  const individualTaskErrors: { taskId: string, error: string }[] = [];

  try {
    const employeeRef = doc(db, 'users', employeeId);
    const employeeSnap = await getDoc(employeeRef);
    if (!employeeSnap.exists()) {
      return { success: false, message: `Employee with ID ${employeeId} not found.`, assignedCount: 0, failedCount: taskIds.length };
    } else if (employeeSnap.data()?.role !== 'employee') {
       console.warn(`User ${employeeId} is not an 'employee'. Task assignment will proceed.`);
    }

    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      return { success: false, message: `Project with ID ${projectId} not found.`, assignedCount: 0, failedCount: taskIds.length };
    }
    
    const supervisorName = await getUserDisplayName(supervisorId);
    const projectNameStr = projectSnap.data()?.name || projectId;

    for (const taskId of taskIds) {
      try {
        const taskDocRef = doc(db, 'tasks', taskId);
        const taskSnap = await getDoc(taskDocRef);

        if (!taskSnap.exists()) {
          individualTaskErrors.push({ taskId, error: `Task with ID ${taskId} not found.` });
          failedCount++;
          continue;
        }
        const taskData = taskSnap.data();
        if (taskData.projectId !== projectId) {
            individualTaskErrors.push({ taskId, error: `Task's project ID (${taskData.projectId}) does not match provided project ID (${projectId}).`});
            failedCount++;
            continue;
        }

        // isImportant is NOT set here. For new tasks, it's set at creation. For existing, it's unchanged.
        const taskUpdates: Partial<Task> & { updatedAt: any, status: TaskStatus, assignedEmployeeId: string } = {
          assignedEmployeeId: employeeId,
          dueDate: dueDate.toISOString(),
          supervisorNotes: supervisorNotes || taskData.supervisorNotes || '',
          status: 'pending', // Always set to pending upon assignment/re-assignment
          updatedAt: serverTimestamp(),
        };

        await updateDoc(taskDocRef, taskUpdates);
        assignedCount++;

        const taskNameStr = taskData.taskName || 'Unnamed Task';
        const waMessage = `\ud83d\udccb Task Assigned to You\nProject: ${projectNameStr}\nTask: ${taskNameStr}\nDue: ${format(dueDate, "PP")}\nBy: ${supervisorName}\nNotes: ${supervisorNotes || 'None'}`;
        await notifyUserByWhatsApp(employeeId, waMessage);

      } catch (taskError: any) {
        console.error(`Error assigning task ${taskId}:`, taskError);
        individualTaskErrors.push({ taskId, error: taskError.message || `Failed to assign task ${taskId}.` });
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
        finalMessage = `${assignedCount} task(s) assigned successfully to employee!`;
    } else if (assignedCount > 0 && failedCount > 0) {
        finalMessage = `Partially successful: ${assignedCount} task(s) assigned. ${failedCount} task(s) failed.`;
    } else if (assignedCount === 0 && failedCount > 0) {
        finalMessage = `All ${failedCount} task assignments failed.`;
    } else {
         finalMessage = "No tasks were processed for assignment.";
    }

    return { 
        success: failedCount === 0, 
        message: finalMessage, 
        assignedCount, 
        failedCount, 
        individualTaskErrors: individualTaskErrors.length > 0 ? individualTaskErrors : undefined 
    };

  } catch (batchError: any) {
    console.error('Critical error during batch task assignment:', batchError);
    return { success: false, message: `Failed to assign tasks: ${batchError.message || 'An unexpected batch error occurred.'}`, assignedCount, failedCount, individualTaskErrors };
  }
}

