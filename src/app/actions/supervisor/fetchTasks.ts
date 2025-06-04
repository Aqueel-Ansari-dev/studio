
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase'; // Removed auth import
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';

const FetchTasksFiltersSchema = z.object({
  status: z.custom<TaskStatus>().optional(),
  projectId: z.string().optional(),
});

export type FetchTasksFilters = z.infer<typeof FetchTasksFiltersSchema>;

export interface FetchTasksResult {
  success: boolean;
  message?: string;
  tasks?: Task[];
  errors?: z.ZodIssue[];
}

export async function fetchTasksForSupervisor(supervisorId: string, filters?: FetchTasksFilters): Promise<FetchTasksResult> {
  if (!supervisorId) {
    return { success: false, message: 'Supervisor ID not provided. Authentication issue.' };
  }
  // In a real app, you'd verify supervisorId belongs to a user with 'supervisor' role.

  const validationResult = FetchTasksFiltersSchema.safeParse(filters || {});
  if (!validationResult.success) {
    return { success: false, message: 'Invalid filter input.', errors: validationResult.error.issues };
  }
  
  const validatedFilters = validationResult.data;

  try {
    const tasksCollectionRef = collection(db, 'tasks');
    let q = query(tasksCollectionRef, where('createdBy', '==', supervisorId));

    if (validatedFilters?.status) {
      q = query(q, where('status', '==', validatedFilters.status));
    }
    if (validatedFilters?.projectId && validatedFilters.projectId !== 'all') {
      q = query(q, where('projectId', '==', validatedFilters.projectId));
    }

    q = query(q, orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as Task;
    });

    return { success: true, tasks };
  } catch (error) {
    console.error('Error fetching tasks for supervisor:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to fetch tasks: ${errorMessage}` };
  }
}
