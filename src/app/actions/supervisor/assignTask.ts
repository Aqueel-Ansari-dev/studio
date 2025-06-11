
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc, serverTimestamp } from 'firebase/firestore';
import { notifyUserByWhatsApp } from '@/lib/notify';
import { getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import type { Task, TaskStatus } from '@/types/database';

const AssignExistingTaskInputSchema = z.object({
  taskId: z.string().min(1, { message: 'Task selection is required.' }),
  employeeId: z.string().min(1, { message: 'Employee selection is required.' }),
  projectId: z.string().min(1, { message: 'Project ID is required (should be derived from selected task).'}),
  dueDate: z.date({ required_error: 'Due date is required.' }),
  supervisorNotes: z.string().max(500).optional(),
  isImportant: z.boolean().optional().default(false),
});

export type AssignExistingTaskInput = z.infer<typeof AssignExistingTaskInputSchema>;

export interface AssignTaskResult {
  success: boolean;
  message: string;
  taskId?: string; // Still useful to confirm which task was affected
  errors?: z.ZodIssue[];
}

export async function assignExistingTaskToEmployee(supervisorId: string, input: AssignExistingTaskInput): Promise<AssignTaskResult> {
  if (!supervisorId) {
    return { success: false, message: 'Supervisor ID not provided. User might not be authenticated properly on the client.' };
  }

  const validationResult = AssignExistingTaskInputSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }

  const { taskId, employeeId, projectId, dueDate, supervisorNotes, isImportant } = validationResult.data;

  try {
    const taskDocRef = doc(db, 'tasks', taskId);
    const taskSnap = await getDoc(taskDocRef);
    if (!taskSnap.exists()) {
      return { success: false, message: `Task with ID ${taskId} not found.` };
    }
    const taskData = taskSnap.data();
    if (taskData.projectId !== projectId) {
        return { success: false, message: `Task's project ID (${taskData.projectId}) does not match provided project ID (${projectId}).`};
    }

    const employeeRef = doc(db, 'users', employeeId);
    const employeeSnap = await getDoc(employeeRef);
    if (!employeeSnap.exists()) {
      console.warn(`Employee with ID ${employeeId} not found. Task assignment will proceed, but ensure user exists.`);
    } else if (employeeSnap.data()?.role !== 'employee') {
       console.warn(`User ${employeeId} is not an 'employee'. Task assignment will proceed.`);
    }

    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      return { success: false, message: `Project with ID ${projectId} not found.` };
    }

    const taskUpdates: Partial<Task> & { updatedAt: any, status: TaskStatus, assignedEmployeeId: string } = {
      assignedEmployeeId: employeeId,
      dueDate: dueDate.toISOString(),
      supervisorNotes: supervisorNotes || taskData.supervisorNotes || '', // Preserve existing notes if new ones aren't provided
      isImportant: !!isImportant,
      status: 'pending', // Ensure task is set to pending upon assignment/re-assignment
      updatedAt: serverTimestamp(),
      // createdBy should remain as the original creator of the task
    };

    await updateDoc(taskDocRef, taskUpdates);

    // Update employee's assignedProjectIds
    if (employeeSnap.exists()) {
        await updateDoc(employeeRef, {
            assignedProjectIds: arrayUnion(projectId)
        });
    }

    // Update project's assignedEmployeeIds
    await updateDoc(projectRef, {
      assignedEmployeeIds: arrayUnion(employeeId)
    });

    const supervisorName = await getUserDisplayName(supervisorId);
    const projectNameStr = await getProjectName(projectId);
    const taskNameStr = taskData.taskName || 'Unnamed Task';
    
    const waMessage = `\ud83d\udccb Task Assigned to You\nProject: ${projectNameStr}\nTask: ${taskNameStr}\nDue: ${format(dueDate, "PP")}\nBy: ${supervisorName}\nNotes: ${supervisorNotes || 'None'}`;
    
    console.log(`[AssignExistingTask] Attempting to notify employee ${employeeId} via WhatsApp with message: "${waMessage}"`);
    
    await notifyUserByWhatsApp(employeeId, waMessage);

    return { success: true, message: `Task "${taskNameStr}" assigned successfully to employee!`, taskId: taskId };
  } catch (error) {
    console.error('Error assigning existing task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to assign task: ${errorMessage}` };
  }
}
