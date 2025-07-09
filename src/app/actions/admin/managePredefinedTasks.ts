
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  query,
  Timestamp,
} from 'firebase/firestore';
import type { PredefinedTask } from '@/types/database';
import { getOrganizationId } from '../common/getOrganizationId';

const PredefinedTaskSchema = z.object({
  name: z.string().min(3, { message: "Task name must be at least 3 characters." }).max(100),
  description: z.string().max(500).optional(),
  targetRole: z.enum(['employee', 'supervisor', 'all'], { message: "A target role must be selected."}),
});

export type AddPredefinedTaskInput = z.infer<typeof PredefinedTaskSchema>;

interface ServerActionResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
  taskId?: string;
}

export async function addPredefinedTask(adminId: string, data: AddPredefinedTaskInput): Promise<ServerActionResult> {
  const organizationId = await getOrganizationId(adminId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for the current admin.' };
  }

  const adminUserDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', adminId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
    return { success: false, message: 'Action not authorized. Requester is not an admin.' };
  }

  const validationResult = PredefinedTaskSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }

  try {
    const predefinedTasksCollectionRef = collection(db, 'organizations', organizationId, 'predefinedTasks');
    const docRef = await addDoc(predefinedTasksCollectionRef, {
      name: data.name,
      description: data.description || '',
      targetRole: data.targetRole,
      createdBy: adminId,
      createdAt: serverTimestamp(),
    });
    return { success: true, message: 'Predefined task added successfully!', taskId: docRef.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to add task: ${errorMessage}` };
  }
}

export async function deletePredefinedTask(adminId: string, taskId: string): Promise<ServerActionResult> {
  const organizationId = await getOrganizationId(adminId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for the current admin.' };
  }

  const adminUserDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', adminId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
    return { success: false, message: "Action not authorized." };
  }
  if (!taskId) {
    return { success: false, message: 'Task ID is required.' };
  }
  try {
    const taskDocRef = doc(db, 'organizations', organizationId, 'predefinedTasks', taskId);
    await deleteDoc(taskDocRef);
    return { success: true, message: 'Predefined task deleted successfully.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to delete task: ${errorMessage}` };
  }
}

export async function fetchPredefinedTasks(actorId: string): Promise<{ success: boolean; tasks?: PredefinedTask[]; error?: string }> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for the current user.' };
  }
  
  try {
    const predefinedTasksCollectionRef = collection(db, 'organizations', organizationId, 'predefinedTasks');
    const q = query(predefinedTasksCollectionRef);
    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
      return {
        id: docSnap.id,
        name: data.name || 'Unnamed Task',
        description: data.description || '',
        targetRole: data.targetRole || 'all',
        createdBy: data.createdBy || '',
        createdAt: createdAt,
      } as PredefinedTask;
    });
    tasks.sort((a, b) => a.name.localeCompare(b.name));
    return { success: true, tasks };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: `Failed to fetch predefined tasks: ${errorMessage}` };
  }
}
