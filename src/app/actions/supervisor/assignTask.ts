
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { notifyUserByWhatsApp } from '@/lib/notify';
import { getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';
import type { Task, TaskStatus } from '@/types/database';

const AssignTaskSchema = z.object({
  employeeId: z.string().min(1, { message: 'Employee selection is required.' }),
  projectId: z.string().min(1, { message: 'Project selection is required.' }),
  taskName: z.string().min(3, { message: 'Task name must be at least 3 characters.' }).max(100),
  description: z.string().max(500).optional(),
  dueDate: z.date({ required_error: 'Due date is required.' }),
  supervisorNotes: z.string().max(500).optional(),
});

export type AssignTaskInput = z.infer<typeof AssignTaskSchema>;

export interface AssignTaskResult {
  success: boolean;
  message: string;
  taskId?: string;
  errors?: z.ZodIssue[];
}

export async function assignTask(supervisorId: string, input: AssignTaskInput): Promise<AssignTaskResult> {
  if (!supervisorId) {
    return { success: false, message: 'Supervisor ID not provided. User might not be authenticated properly on the client.' };
  }

  const validationResult = AssignTaskSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }

  const { employeeId, projectId, taskName, description, dueDate, supervisorNotes } = validationResult.data;

  try {
    // Optional: Validate if employeeId and projectId actually exist
    const employeeRef = doc(db, 'users', employeeId);
    const employeeSnap = await getDoc(employeeRef);
    if (!employeeSnap.exists() || employeeSnap.data()?.role !== 'employee') {
      // Do not return error for now if employee doesn't exist, as user creation is separate.
      // In a stricter system, this would be an error.
      console.warn(`Employee with ID ${employeeId} not found or not an employee. Task assignment will proceed.`);
    }
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      return { success: false, message: `Project with ID ${projectId} not found.` };
    }

    const newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { 
      createdAt: any, 
      updatedAt: any, 
      status: TaskStatus,
      assignedEmployeeId: string, 
      createdBy: string 
    } = {
      taskName,
      description: description || '',
      projectId,
      assignedEmployeeId: employeeId, 
      dueDate: dueDate.toISOString(),
      supervisorNotes: supervisorNotes || '',
      status: 'pending',
      createdBy: supervisorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'tasks'), newTask);

    // Update employee's assignedProjectIds
    await updateDoc(employeeRef, {
      assignedProjectIds: arrayUnion(projectId)
    });

    // Update project's assignedEmployeeIds
    await updateDoc(projectRef, {
      assignedEmployeeIds: arrayUnion(employeeId)
    });

    const supervisorName = await getUserDisplayName(supervisorId);
    const projectName = await getProjectName(projectId);
    const waMessage = `\ud83d\udccb New Task Assigned\nProject: ${projectName}\nTask: ${taskName}\nAssigned by: ${supervisorName}\nPlease start when ready.`;
    await notifyUserByWhatsApp(employeeId, waMessage);

    return { success: true, message: 'Task assigned successfully!', taskId: docRef.id };
  } catch (error) {
    console.error('Error assigning task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to assign task: ${errorMessage}` };
  }
}
