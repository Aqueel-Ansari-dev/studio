
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp, limit as firestoreLimit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';
import { fetchAllProjects } from '@/app/actions/common/fetchAllProjects'; // Import fetchAllProjects

const TASKS_PER_PAGE = 10;

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
  projectName?: string; // Add projectName
}

function calculateElapsedTimeSeconds(startTimeMillis?: number, endTimeMillis?: number): number {
  if (startTimeMillis && endTimeMillis && endTimeMillis > startTimeMillis) {
    return Math.round((endTimeMillis - startTimeMillis) / 1000);
  }
  return 0;
}

export interface FetchTasksForUserAdminViewResult {
  success: boolean;
  tasks?: TaskForAdminUserView[];
  error?: string;
  lastVisibleTaskTimestamps?: { updatedAt: string; createdAt: string } | null;
  hasMore?: boolean;
}

export async function fetchTasksForUserAdminView(
    employeeId: string, 
    limitNum: number = TASKS_PER_PAGE,
    startAfterTimestamps?: { updatedAt: string; createdAt: string } | null
): Promise<FetchTasksForUserAdminViewResult> {
  if (!employeeId) {
    console.error('[fetchTasksForUserAdminView] Employee ID is required.');
    return { success: false, error: 'Employee ID is required.' };
  }

  try {
    // Fetch all projects once to create a lookup map
    const projectsResult = await fetchAllProjects();
    const projectsMap = new Map<string, string>();
    if (projectsResult.success && projectsResult.projects) {
        projectsResult.projects.forEach(p => projectsMap.set(p.id, p.name));
    }

    const tasksCollectionRef = collection(db, 'tasks');
    let q = query(
      tasksCollectionRef,
      where('assignedEmployeeId', '==', employeeId),
      orderBy('updatedAt', 'desc'),
      orderBy('createdAt', 'desc')
    );
    
    if (startAfterTimestamps?.updatedAt && startAfterTimestamps?.createdAt) {
        const updatedAtCursor = Timestamp.fromDate(new Date(startAfterTimestamps.updatedAt));
        const createdAtCursor = Timestamp.fromDate(new Date(startAfterTimestamps.createdAt));
        q = query(q, startAfter(updatedAtCursor, createdAtCursor));
    }
    
    q = query(q, firestoreLimit(limitNum + 1));

    const querySnapshot = await getDocs(q);
    
    const hasMore = querySnapshot.docs.length > limitNum;
    const tasksToReturn = hasMore ? querySnapshot.docs.slice(0, limitNum) : querySnapshot.docs;

    const tasks = tasksToReturn.map(docSnap => {
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
        projectName: projectsMap.get(data.projectId) || data.projectId, // Use the map here
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

     let lastVisibleTaskTimestampsResult: { updatedAt: string; createdAt: string } | null = null;
    if (tasksToReturn.length > 0) {
        const lastTaskDoc = tasksToReturn[tasksToReturn.length - 1];
        const lastTaskData = lastTaskDoc.data();
        if (lastTaskData.updatedAt instanceof Timestamp && lastTaskData.createdAt instanceof Timestamp) {
            lastVisibleTaskTimestampsResult = {
                updatedAt: lastTaskData.updatedAt.toDate().toISOString(),
                createdAt: lastTaskData.createdAt.toDate().toISOString()
            };
        }
    }
    
    return { success: true, tasks, hasMore, lastVisibleTaskTimestamps: lastVisibleTaskTimestampsResult };
  } catch (error) {
    console.error(`Error fetching tasks for employee ${employeeId} (admin view):`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         console.error(`Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}`);
         return { success: false, error: `Query requires a Firestore index. Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch tasks: ${errorMessage}` };
  }
}
