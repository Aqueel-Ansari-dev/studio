
'use server';

import { z } from 'zod';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
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

export async function assignTask(input: AssignTaskInput): Promise<AssignTaskResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, message: 'User not authenticated.' };
  }
  // In a real app, you'd also verify the user's role here (e.g., using custom claims)
  // For now, we assume if they call this action, they have supervisor privileges.
  const supervisorId = currentUser.uid;

  const validationResult = AssignTaskSchema.safeParse(input);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }

  const { employeeId, projectId, taskName, description, dueDate, supervisorNotes } = validationResult.data;

  try {
    // TODO: Validate if employeeId and projectId actually exist in their respective collections.
    // This requires having 'employees' and 'projects' collections and querying them.
    // Example (simplified, needs actual implementation):
    // const employeeRef = doc(db, 'employees', employeeId);
    // const employeeSnap = await getDoc(employeeRef);
    // if (!employeeSnap.exists()) {
    //   return { success: false, message: `Employee with ID ${employeeId} not found.` };
    // }
    // const projectRef = doc(db, 'projects', projectId);
    // const projectSnap = await getDoc(projectRef);
    // if (!projectSnap.exists()) {
    //   return { success: false, message: `Project with ID ${projectId} not found.` };
    // }

    const newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { 
      createdAt: any, 
      updatedAt: any, 
      status: TaskStatus,
      assignedEmployeeId: string, // Explicitly adding this as it's in Task interface
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
    return { success: true, message: 'Task assigned successfully!', taskId: docRef.id };
  } catch (error) {
    console.error('Error assigning task:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to assign task: ${errorMessage}` };
  }
}
