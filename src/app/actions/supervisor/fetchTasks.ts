
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase'; 
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';

const FetchTasksFiltersSchema = z.object({
  status: z.custom<TaskStatus | "all">().optional(), // Allow "all" for status filter
  projectId: z.string().optional(),
});

export type FetchTasksFilters = z.infer<typeof FetchTasksFiltersSchema>;

export interface FetchTasksResult {
  success: boolean;
  message?: string;
  tasks?: Task[];
  errors?: z.ZodIssue[];
}

// Helper function to calculate elapsed time in seconds
function calculateElapsedTime(startTime?: number, endTime?: number): number {
  if (typeof startTime === 'number' && typeof endTime === 'number' && endTime > startTime) {
    return Math.round((endTime - startTime) / 1000); // Convert ms to seconds
  }
  return 0;
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
    let q = query(tasksCollectionRef, where('createdBy', '==', supervisorId));


    if (validatedFilters?.status && validatedFilters.status !== 'all') {
      q = query(q, where('status', '==', validatedFilters.status));
    }
    if (validatedFilters?.projectId && validatedFilters.projectId !== 'all') {
      q = query(q, where('projectId', '==', validatedFilters.projectId));
    }

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
      
      const startTimeMillis = convertTimestampToMillis(data.startTime);
      const endTimeMillis = convertTimestampToMillis(data.endTime);
      let elapsedTimeSecs = typeof data.elapsedTime === 'number' ? data.elapsedTime : 0;
      if (!elapsedTimeSecs && startTimeMillis && endTimeMillis) {
        elapsedTimeSecs = calculateElapsedTime(startTimeMillis, endTimeMillis);
      }

      const taskResult: Task = {
        id: docSnap.id,
        taskName: data.taskName || 'Unnamed Task',
        description: data.description || '',
        status: data.status || 'pending',
        projectId: data.projectId,
        assignedEmployeeId: data.assignedEmployeeId,
        createdBy: data.createdBy, 
        
        dueDate: convertTimestampToString(data.dueDate),
        createdAt: convertTimestampToString(data.createdAt) || new Date(0).toISOString(),
        updatedAt: convertTimestampToString(data.updatedAt) || new Date(0).toISOString(),
        
        startTime: startTimeMillis,
        endTime: endTimeMillis,
        elapsedTime: elapsedTimeSecs,
        
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
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, message: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { success: false, message: `Failed to fetch tasks: ${errorMessage}` };
  }
}

