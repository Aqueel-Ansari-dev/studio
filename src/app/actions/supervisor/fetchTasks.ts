
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase'; 
import { collection, query, where, getDocs, orderBy, Timestamp, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { Task, TaskStatus } from '@/types/database';
import { fetchSupervisorAssignedProjects } from './fetchSupervisorData'; // Import new action

const TASK_PAGE_LIMIT = 15; // Define page size

const FetchTasksFiltersSchema = z.object({
  status: z.custom<TaskStatus | "all">().optional(), 
  projectId: z.string().optional(), // This will be used to filter within assigned projects
});

export type FetchTasksFilters = z.infer<typeof FetchTasksFiltersSchema>;

export interface FetchTasksResult {
  success: boolean;
  message?: string;
  tasks?: Task[];
  errors?: z.ZodIssue[];
  lastVisibleTaskTimestamps?: { updatedAt: string; createdAt: string } | null; 
  hasMore?: boolean;
}

// Helper function to calculate elapsed time in seconds
function calculateElapsedTime(startTime?: number, endTime?: number): number {
  if (typeof startTime === 'number' && typeof endTime === 'number' && endTime > startTime) {
    return Math.round((endTime - startTime) / 1000); 
  }
  return 0;
}

function mapDbTaskToTaskType(docSnap: QueryDocumentSnapshot<DocumentData>): Task {
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
      isImportant: data.isImportant || false,
      
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
}

export async function fetchTasksForSupervisor(
  supervisorId: string, 
  filters?: FetchTasksFilters,
  limitNum: number = TASK_PAGE_LIMIT,
  startAfterTimestamps?: { updatedAt: string; createdAt: string } | null
): Promise<FetchTasksResult> {
  if (!supervisorId) {
    return { success: false, message: 'Supervisor ID not provided. Authentication issue.' };
  }

  const validationResult = FetchTasksFiltersSchema.safeParse(filters || {});
  if (!validationResult.success) {
    return { success: false, message: 'Invalid filter input.', errors: validationResult.error.issues };
  }
  
  const validatedFilters = validationResult.data;

  try {
    const assignedProjectsResult = await fetchSupervisorAssignedProjects(supervisorId);
    if (!assignedProjectsResult.success || !assignedProjectsResult.projects || assignedProjectsResult.projects.length === 0) {
      return { success: true, tasks: [], message: 'No projects assigned to this supervisor or failed to fetch them.' };
    }
    const assignedProjectIds = assignedProjectsResult.projects.map(p => p.id);

    if (assignedProjectIds.length === 0) {
        return { success: true, tasks: [], message: 'Supervisor has no projects assigned.' };
    }

    const tasksCollectionRef = collection(db, 'tasks');
    let q = query(tasksCollectionRef, where('projectId', 'in', assignedProjectIds));


    if (validatedFilters?.status && validatedFilters.status !== 'all') {
      q = query(q, where('status', '==', validatedFilters.status));
    }
    // If a specific project ID is provided in filters, and it's one of the supervisor's assigned projects, apply it.
    // Otherwise, the query already filters by all assigned projects.
    if (validatedFilters?.projectId && validatedFilters.projectId !== 'all' && assignedProjectIds.includes(validatedFilters.projectId)) {
      q = query(q, where('projectId', '==', validatedFilters.projectId));
    } else if (validatedFilters?.projectId && validatedFilters.projectId !== 'all' && !assignedProjectIds.includes(validatedFilters.projectId)){
      // Supervisor is trying to filter by a project they are not assigned to - return empty.
      return { success: true, tasks: [], message: "Filter project ID is not one of the supervisor's assigned projects."}
    }


    q = query(q, orderBy('updatedAt', 'desc'), orderBy('createdAt', 'desc'));

    if (startAfterTimestamps?.updatedAt && startAfterTimestamps?.createdAt) {
      const updatedAtCursor = Timestamp.fromDate(new Date(startAfterTimestamps.updatedAt));
      const createdAtCursor = Timestamp.fromDate(new Date(startAfterTimestamps.createdAt));
      q = query(q, startAfter(updatedAtCursor, createdAtCursor));
    }
    
    q = query(q, limit(limitNum + 1)); 

    const querySnapshot = await getDocs(q);
    const fetchedDocs = querySnapshot.docs;

    const hasMore = fetchedDocs.length > limitNum;
    const tasksToReturn = hasMore ? fetchedDocs.slice(0, limitNum) : fetchedDocs;
    
    const tasks = tasksToReturn.map(mapDbTaskToTaskType);

    let lastVisibleTaskTimestampsResult: { updatedAt: string; createdAt: string } | null = null;
    if (tasksToReturn.length > 0) {
        const lastDocData = tasksToReturn[tasksToReturn.length - 1].data();
        if (lastDocData.updatedAt instanceof Timestamp && lastDocData.createdAt instanceof Timestamp) {
            lastVisibleTaskTimestampsResult = {
                updatedAt: lastDocData.updatedAt.toDate().toISOString(),
                createdAt: lastDocData.createdAt.toDate().toISOString()
            };
        }
    }
    
    return { success: true, tasks, lastVisibleTaskTimestamps: lastVisibleTaskTimestampsResult, hasMore };

  } catch (error) {
    console.error('Error fetching tasks for supervisor:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, message: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { success: false, message: `Failed to fetch tasks: ${errorMessage}` };
  }
}


export interface TaskForAssignment {
  id: string;
  taskName: string;
  description?: string;
  isImportant: boolean;
}
export interface FetchAssignableTasksResult {
    success: boolean;
    tasks?: TaskForAssignment[];
    error?: string;
}

export async function fetchAssignableTasksForProject(projectId: string): Promise<FetchAssignableTasksResult> {
    if (!projectId) {
        return { success: false, error: "Project ID is required to fetch assignable tasks." };
    }
    try {
        const tasksCollectionRef = collection(db, 'tasks');
        const q = query(
            tasksCollectionRef,
            where('projectId', '==', projectId),
            where('status', '==', 'pending') 
        );
        const querySnapshot = await getDocs(q);
        const assignableTasks = querySnapshot.docs
            .filter(doc => !doc.data().assignedEmployeeId) 
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    taskName: data.taskName || 'Unnamed Task',
                    description: data.description || '',
                    isImportant: data.isImportant || false,
                } as TaskForAssignment;
            });
        
        return { success: true, tasks: assignableTasks };
    } catch (error) {
        console.error(`Error fetching assignable tasks for project ${projectId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
            return { success: false, error: `Query requires a Firestore index. Details: ${errorMessage}` };
        }
        return { success: false, error: `Failed to fetch assignable tasks: ${errorMessage}` };
    }
}

