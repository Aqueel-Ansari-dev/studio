
'use server';

import { z } from 'zod';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';

const FetchTasksFiltersSchema = z.object({
  status: z.custom<TaskStatus>().optional(),
  projectId: z.string().optional(),
  // Add other filters like date range if needed
});

export type FetchTasksFilters = z.infer<typeof FetchTasksFiltersSchema>;

export interface FetchTasksResult {
  success: boolean;
  message?: string;
  tasks?: Task[];
  errors?: z.ZodIssue[];
}

export async function fetchTasksForSupervisor(filters?: FetchTasksFilters): Promise<FetchTasksResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, message: 'User not authenticated.' };
  }
  const supervisorId = currentUser.uid;

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
    if (validatedFilters?.projectId && validatedFilters.projectId !== 'all') { // Assuming 'all' means no project filter
      q = query(q, where('projectId', '==', validatedFilters.projectId));
    }

    q = query(q, orderBy('createdAt', 'desc')); // Default sort by creation date

    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Ensure timestamps are converted correctly if needed, or handled by frontend
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
