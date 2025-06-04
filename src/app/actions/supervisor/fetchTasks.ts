
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase'; 
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

  const validationResult = FetchTasksFiltersSchema.safeParse(filters || {});
  if (!validationResult.success) {
    return { success: false, message: 'Invalid filter input.', errors: validationResult.error.issues };
  }
  
  const validatedFilters = validationResult.data;

  try {
    const tasksCollectionRef = collection(db, 'tasks');
    // Query tasks created by this supervisor.
    // In a more complex scenario, you might query tasks for employees managed by this supervisor,
    // or tasks within projects the supervisor oversees.
    // For MVP, 'createdBy' links task assignment to a supervisor.
    let q = query(tasksCollectionRef, where('createdBy', '==', supervisorId));


    if (validatedFilters?.status && validatedFilters.status !== 'all') {
      q = query(q, where('status', '==', validatedFilters.status));
    }
    if (validatedFilters?.projectId && validatedFilters.projectId !== 'all') {
      q = query(q, where('projectId', '==', validatedFilters.projectId));
    }

    // Default ordering
    q = query(q, orderBy('updatedAt', 'desc'), orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      
      const convertTimestampToString = (fieldValue: any): string | undefined => {
        if (fieldValue instanceof Timestamp) return fieldValue.toDate().toISOString();
        if (typeof fieldValue === 'string') return fieldValue;
         if (fieldValue && typeof fieldValue.seconds === 'number' && typeof fieldValue.nanoseconds === 'number') {
             return new Timestamp(fieldValue.seconds, fieldValue.nanoseconds).toDate().toISOString();
        }
        return undefined;
      };
      
      const convertTimestampToMillis = (fieldValue: any): number | undefined => {
        if (fieldValue instanceof Timestamp) return fieldValue.toMillis();
        if (typeof fieldValue === 'number') return fieldValue;
         if (fieldValue && typeof fieldValue.seconds === 'number' && typeof fieldValue.nanoseconds === 'number') {
             return new Timestamp(fieldValue.seconds, fieldValue.nanoseconds).toMillis();
        }
        return undefined;
      };

      // Explicitly map fields to ensure serializable types and include all necessary fields
      const taskResult: Task = {
        id: docSnap.id,
        taskName: data.taskName || 'Unnamed Task',
        description: data.description || '',
        status: data.status || 'pending',
        projectId: data.projectId,
        assignedEmployeeId: data.assignedEmployeeId,
        createdBy: data.createdBy, // UID of supervisor who created it
        
        dueDate: convertTimestampToString(data.dueDate),
        createdAt: convertTimestampToString(data.createdAt) || new Date(0).toISOString(),
        updatedAt: convertTimestampToString(data.updatedAt) || new Date(0).toISOString(),
        
        startTime: convertTimestampToMillis(data.startTime),
        endTime: convertTimestampToMillis(data.endTime),
        elapsedTime: typeof data.elapsedTime === 'number' ? data.elapsedTime : 0,
        
        supervisorNotes: data.supervisorNotes || '',
        employeeNotes: data.employeeNotes || '',
        submittedMediaUri: data.submittedMediaUri || '',
        
        aiComplianceNotes: data.aiComplianceNotes || '',
        aiRisks: data.aiRisks || [],

        supervisorReviewNotes: data.supervisorReviewNotes || '',
        reviewedBy: data.reviewedBy || '',
        reviewedAt: convertTimestampToMillis(data.reviewedAt),
      };
      return taskResult;
    });

    return { success: true, tasks };
  } catch (error) {
    console.error('Error fetching tasks for supervisor:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    // Check for Firestore index error specifically
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, message: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { success: false, message: `Failed to fetch tasks: ${errorMessage}` };
  }
}
