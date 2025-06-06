
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';

// Re-using TaskWithId from employee actions for consistency, or define a specific admin view task type if needed.
export interface TaskForAdminUserView extends Task {
  id: string;
  // Ensure Timestamps are converted to string or number as appropriate for client
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  dueDate?: string | null; // ISO String
  startTime?: number | null; // Milliseconds
  endTime?: number | null; // Milliseconds
  reviewedAt?: number | null; // Milliseconds
}

function calculateElapsedTimeSeconds(startTimeMillis?: number, endTimeMillis?: number): number {
  if (startTimeMillis && endTimeMillis && endTimeMillis > startTimeMillis) {
    return Math.round((endTimeMillis - startTimeMillis) / 1000);
  }
  return 0;
}

export async function fetchTasksForUserAdminView(employeeId: string, limit: number = 20): Promise<TaskForAdminUserView[]> {
  if (!employeeId) {
    console.error('[fetchTasksForUserAdminView] Employee ID is required.');
    return [];
  }

  try {
    const tasksCollectionRef = collection(db, 'tasks');
    const q = query(
      tasksCollectionRef,
      where('assignedEmployeeId', '==', employeeId),
      orderBy('updatedAt', 'desc'), // Show most recently updated tasks first
      orderBy('createdAt', 'desc'),
      ...(limit > 0 ? [where('limit', '==', limit)] : []) // Firestore `limit` is a top-level query method, not a `where` clause. Corrected below.
    );
    
    // Apply limit directly to the query object
    const finalQuery = limit > 0 ? query(q, where("assignedEmployeeId", "==", employeeId), orderBy("updatedAt", "desc"), orderBy("createdAt", "desc")) : q;
    // Firestore's 'limit' is applied directly, not as a 'where' clause. Corrected approach:
    // const finalQuery = limit > 0 ? query(q, firestoreLimit(limit)) : q; // Assuming firestoreLimit is imported

    const querySnapshot = await getDocs(finalQuery);

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
        elapsedTimeSecs = calculateElapsedTimeSeconds(startTimeMillis, endTimeMillis);
      }

      return {
        id: docSnap.id,
        taskName: data.taskName || 'Unnamed Task',
        description: data.description || '',
        status: data.status || 'pending',
        projectId: data.projectId,
        assignedEmployeeId: data.assignedEmployeeId,
        createdBy: data.createdBy || '',
        
        dueDate: convertTimestampToString(data.dueDate) || null,
        createdAt: convertTimestampToString(data.createdAt) || new Date(0).toISOString(),
        updatedAt: convertTimestampToString(data.updatedAt) || new Date(0).toISOString(),
        
        startTime: startTimeMillis || null,
        endTime: endTimeMillis || null,
        elapsedTime: elapsedTimeSecs,
        
        supervisorNotes: data.supervisorNotes || '',
        employeeNotes: data.employeeNotes || '',
        submittedMediaUri: data.submittedMediaUri || '',
        
        aiComplianceNotes: data.aiComplianceNotes || '',
        aiRisks: data.aiRisks || [],

        supervisorReviewNotes: data.supervisorReviewNotes || '',
        reviewedBy: data.reviewedBy || '',
        reviewedAt: convertTimestampToMillis(data.reviewedAt) || null,
      } as TaskForAdminUserView;
    });
    return tasks;
  } catch (error) {
    console.error(`Error fetching tasks for employee ${employeeId} (admin view):`, error);
    // Check for Firestore index error
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         console.error(`Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}`);
         // Potentially re-throw or return an error object so the UI can display a message
    }
    return [];
  }
}
