
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase'; 
import { collection, query, where, getDocs, orderBy, Timestamp, limit, startAfter, QueryDocumentSnapshot, DocumentData, doc, getDoc } from 'firebase/firestore';
import type { Task, TaskStatus, UserRole } from '@/types/database';
import { fetchSupervisorAssignedProjects } from './fetchSupervisorData'; 
import { fetchAllProjects as fetchAllSystemProjects } from '@/app/actions/common/fetchAllProjects';

const TASK_PAGE_LIMIT = 15; 

const FetchTasksFiltersSchema = z.object({
  status: z.custom<TaskStatus | "all">().optional(), 
  projectId: z.string().optional(), 
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
  requestingUserId: string, // This can be a supervisorId or an adminId
  filters?: FetchTasksFilters,
  limitNum: number = TASK_PAGE_LIMIT,
  startAfterTimestamps?: { updatedAt: string; createdAt: string } | null
): Promise<FetchTasksResult> {
  if (!requestingUserId) {
    return { success: false, message: 'Requesting user ID not provided.' };
  }

  const validationResult = FetchTasksFiltersSchema.safeParse(filters || {});
  if (!validationResult.success) {
    return { success: false, message: 'Invalid filter input.', errors: validationResult.error.issues };
  }
  
  const validatedFilters = validationResult.data;

  try {
    const userDocRef = doc(db, 'users', requestingUserId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
        return { success: false, message: `User ${requestingUserId} not found.`};
    }
    const userRole = userDocSnap.data()?.role as UserRole;

    let projectIdsToQuery: string[] = [];

    if (userRole === 'admin') {
        if (validatedFilters?.projectId && validatedFilters.projectId !== 'all') {
            // Admin filtering by a specific project
            projectIdsToQuery = [validatedFilters.projectId];
        } else {
            // Admin wants all projects, or no specific project filter
            const allProjectsResult = await fetchAllSystemProjects();
            if (allProjectsResult.success && allProjectsResult.projects) {
                projectIdsToQuery = allProjectsResult.projects.map(p => p.id);
            } else {
                 return { success: true, tasks: [], message: 'Admin view: Could not fetch system projects to filter tasks.' };
            }
        }
    } else if (userRole === 'supervisor') {
        const assignedProjectsResult = await fetchSupervisorAssignedProjects(requestingUserId);
        if (!assignedProjectsResult.success || !assignedProjectsResult.projects || assignedProjectsResult.projects.length === 0) {
            return { success: true, tasks: [], message: 'Supervisor has no projects assigned or failed to fetch them.' };
        }
        const supervisorAssignedProjectIds = assignedProjectsResult.projects.map(p => p.id);

        if (validatedFilters?.projectId && validatedFilters.projectId !== 'all') {
            if (supervisorAssignedProjectIds.includes(validatedFilters.projectId)) {
                projectIdsToQuery = [validatedFilters.projectId];
            } else {
                 // Supervisor trying to filter by a project they are not assigned to - return empty.
                 return { success: true, tasks: [], message: "Filter project ID is not one of the supervisor's assigned projects."}
            }
        } else {
            projectIdsToQuery = supervisorAssignedProjectIds;
        }
    } else {
        return { success: false, message: 'User role not authorized to fetch these tasks.' };
    }

    if (projectIdsToQuery.length === 0) {
        return { success: true, tasks: [], message: 'No projects to query tasks for.' };
    }
    
    // Firestore 'in' queries are limited to 30 items per query.
    // If projectIdsToQuery can exceed this, batching logic would be needed.
    // For now, assuming it won't exceed or this limit is handled if it arises.
    if (projectIdsToQuery.length > 30) {
        console.warn(`[fetchTasksForSupervisor] Warning: Number of project IDs (${projectIdsToQuery.length}) for 'in' query exceeds Firestore's recommended limit of 30. This may lead to errors or degraded performance.`);
        // Potentially truncate or handle with multiple queries if necessary
        // For now, proceed with the query, but be aware of this limitation.
    }


    const tasksCollectionRef = collection(db, 'tasks');
    let q = query(tasksCollectionRef, where('projectId', 'in', projectIdsToQuery));


    if (validatedFilters?.status && validatedFilters.status !== 'all') {
      q = query(q, where('status', '==', validatedFilters.status));
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
        const lastTaskData = tasksToReturn[tasksToReturn.length - 1].data(); 
        if (lastTaskData.updatedAt instanceof Timestamp && lastTaskData.createdAt instanceof Timestamp) {
            lastVisibleTaskTimestampsResult = {
                updatedAt: lastTaskData.updatedAt.toDate().toISOString(),
                createdAt: lastTaskData.createdAt.toDate().toISOString()
            };
        } else if (typeof lastTaskData.updatedAt === 'string' && typeof lastTaskData.createdAt === 'string') {
             lastVisibleTaskTimestampsResult = {
                updatedAt: lastTaskData.updatedAt,
                createdAt: lastTaskData.createdAt
            };
        }
    }
    
    return { success: true, tasks, lastVisibleTaskTimestamps: lastVisibleTaskTimestampsResult, hasMore };

  } catch (error) {
    console.error('Error fetching tasks:', error);
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
            .filter(docSnap => !docSnap.data().assignedEmployeeId) 
            .map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
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

    
