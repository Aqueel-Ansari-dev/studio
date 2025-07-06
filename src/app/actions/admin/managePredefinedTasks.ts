
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
import type { PredefinedTask, UserRole } from '@/types/database';

async function verifyAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return false;
  const userRole = userDocSnap.data()?.role as UserRole;
  return userRole === 'admin';
}

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
  const isAuthorized = await verifyAdmin(adminId);
  if (!isAuthorized) {
    return { success: false, message: "Action not authorized." };
  }

  const validationResult = PredefinedTaskSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }

  try {
    const docRef = await addDoc(collection(db, 'predefinedTasks'), {
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
  const isAuthorized = await verifyAdmin(adminId);
  if (!isAuthorized) {
    return { success: false, message: "Action not authorized." };
  }
  if (!taskId) {
    return { success: false, message: 'Task ID is required.' };
  }
  try {
    await deleteDoc(doc(db, 'predefinedTasks', taskId));
    return { success: true, message: 'Predefined task deleted successfully.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to delete task: ${errorMessage}` };
  }
}

export async function fetchPredefinedTasks(): Promise<{ success: boolean; tasks?: PredefinedTask[]; error?: string }> {
  try {
    const q = query(collection(db, 'predefinedTasks'));
    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
      return {
        id: docSnap.id,
        name: data.name,
        description: data.description,
        targetRole: data.targetRole || 'all',
        createdBy: data.createdBy,
        createdAt: createdAt,
      } as PredefinedTask;
    });
    // Sort client-side to avoid needing a composite index
    tasks.sort((a, b) => a.name.localeCompare(b.name));
    return { success: true, tasks };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: `Failed to fetch predefined tasks: ${errorMessage}` };
  }
}
