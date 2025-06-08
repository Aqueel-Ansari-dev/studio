
'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Project, Task } from '@/types/database';

export interface ProjectWithId extends Project {
  id: string;
  createdAt?: string; 
}

export interface TaskWithId extends Task {
  id: string;
}

export interface FetchMyAssignedProjectsResult {
  success: boolean;
  projects?: ProjectWithId[];
  error?: string;
}

export interface FetchMyTasksForProjectResult {
  success: boolean;
  tasks?: TaskWithId[];
  error?: string;
}

export interface FetchProjectDetailsResult {
  success: boolean;
  project?: ProjectWithId | null; // Allow null if project not found
  error?: string;
}


// Helper function to calculate elapsed time in seconds
function calculateElapsedTime(startTime?: number, endTime?: number): number {
  if (typeof startTime === 'number' && typeof endTime === 'number' && endTime > startTime) {
    return Math.round((endTime - startTime) / 1000); // Convert ms to seconds
  }
  return 0;
}


export async function fetchMyAssignedProjects(employeeId: string): Promise<FetchMyAssignedProjectsResult> {
  console.log(`[fetchMyAssignedProjects] Called for employeeId: ${employeeId}`);
  if (!employeeId) {
    console.error('[fetchMyAssignedProjects] No employee ID provided');
    return { success: false, error: 'No employee ID provided.' };
  }

  try {
    const userDocRef = doc(db, 'users', employeeId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.warn(`[fetchMyAssignedProjects] User document not found for UID: ${employeeId}`);
      return { success: true, projects: [] }; // Not an error, user just has no data or doesn't exist
    }

    const userData = userDocSnap.data();
    const assignedProjectIds = userData.assignedProjectIds as string[] | undefined;
    console.log(`[fetchMyAssignedProjects] User ${employeeId} assignedProjectIds:`, assignedProjectIds);

    if (!assignedProjectIds || assignedProjectIds.length === 0) {
      console.log(`[fetchMyAssignedProjects] No assignedProjectIds found or array is empty for user: ${employeeId}`);
      return { success: true, projects: [] };
    }

    const projectPromises = assignedProjectIds.map(async (projectId) => {
      const projectDocRef = doc(db, 'projects', projectId);
      const projectDocSnap = await getDoc(projectDocRef);
      if (projectDocSnap.exists()) {
        const data = projectDocSnap.data();
        const createdAt = data.createdAt instanceof Timestamp
                            ? data.createdAt.toDate().toISOString()
                            : (typeof data.createdAt === 'string' ? data.createdAt : undefined);
        const dueDate = data.dueDate instanceof Timestamp
                            ? data.dueDate.toDate().toISOString()
                            : (typeof data.dueDate === 'string' ? data.dueDate : undefined);
        console.log(`[fetchMyAssignedProjects] Fetched project ${projectId}:`, data.name);
        return {
          id: projectDocSnap.id,
          name: data.name || 'Unnamed Project',
          description: data.description || '',
          imageUrl: data.imageUrl || '',
          dataAiHint: data.dataAiHint || '',
          assignedEmployeeIds: data.assignedEmployeeIds || [],
          createdAt: createdAt,
          createdBy: data.createdBy || '',
          dueDate: dueDate,
          budget: typeof data.budget === 'number' ? data.budget : 0,
          materialCost: typeof data.materialCost === 'number' ? data.materialCost : 0,
        } as ProjectWithId;
      } else {
        console.warn(`[fetchMyAssignedProjects] Project with ID ${projectId} not found, but was listed in user's assignedProjectIds.`);
        return null;
      }
    });

    const resolvedProjects = await Promise.all(projectPromises);
    const validProjects = resolvedProjects.filter(project => project !== null) as ProjectWithId[];
    console.log(`[fetchMyAssignedProjects] Returning ${validProjects.length} projects for employee ${employeeId}`);
    return { success: true, projects: validProjects };

  } catch (error) {
    console.error('[fetchMyAssignedProjects] Error fetching assigned projects for employeeId', employeeId, ':', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch assigned projects: ${errorMessage}` };
  }
}

export async function fetchMyTasksForProject(employeeId: string, projectId: string): Promise<FetchMyTasksForProjectResult> {
  console.log(`[fetchMyTasksForProject] Called with employeeId: '${employeeId}', projectId: '${projectId}'`);
  if (!employeeId) {
    console.error('[fetchMyTasksForProject] No employee ID provided.');
    return { success: false, error: 'No employee ID provided.' };
  }
  if (!projectId) {
    console.error('[fetchMyTasksForProject] Project ID is required.');
    return { success: false, error: 'Project ID is required.' };
  }

  try {
    const tasksCollectionRef = collection(db, 'tasks');
    const q = query(
      tasksCollectionRef,
      where('assignedEmployeeId', '==', employeeId),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );
    console.log(`[fetchMyTasksForProject] Querying tasks with: assignedEmployeeId == '${employeeId}', projectId == '${projectId}'`);

    const querySnapshot = await getDocs(q);
    console.log(`[fetchMyTasksForProject] Firestore query returned ${querySnapshot.docs.length} task documents.`);

    if (querySnapshot.docs.length === 0) {
        console.log(`[fetchMyTasksForProject] No tasks found matching criteria.`);
        return { success: true, tasks: [] };
    }

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

      const mappedTask: TaskWithId = {
        id: docSnap.id,
        taskName: data.taskName || 'Unnamed Task',
        description: data.description || '',
        status: data.status || 'pending',
        projectId: data.projectId,
        assignedEmployeeId: data.assignedEmployeeId,
        createdBy: data.createdBy || '',
        
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

        isImportant: data.isImportant || false,

        supervisorReviewNotes: data.supervisorReviewNotes || '',
        reviewedBy: data.reviewedBy || '',
        reviewedAt: convertTimestampToMillis(data.reviewedAt),
      };
      return mappedTask;
    });
    console.log(`[fetchMyTasksForProject] Returning ${tasks.length} mapped tasks.`);
    return { success: true, tasks };
  } catch (error) {
    console.error(`[fetchMyTasksForProject] Error fetching tasks for employee ${employeeId} and project ${projectId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, error: `Query requires a Firestore index. Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch tasks: ${errorMessage}` };
  }
}

export async function fetchProjectDetails(projectId: string): Promise<FetchProjectDetailsResult> {
  console.log(`[fetchProjectDetails] Called for projectId: ${projectId}`);
  if (!projectId) {
    console.error('[fetchProjectDetails] Project ID is required.');
    return { success: false, error: 'Project ID is required.' };
  }
  try {
    const projectDocRef = doc(db, 'projects', projectId);
    const projectDocSnap = await getDoc(projectDocRef);

    if (projectDocSnap.exists()) {
      const data = projectDocSnap.data();
      const createdAt = data.createdAt instanceof Timestamp
                          ? data.createdAt.toDate().toISOString()
                          : (typeof data.createdAt === 'string' ? data.createdAt : undefined);
      const dueDate = data.dueDate instanceof Timestamp
                            ? data.dueDate.toDate().toISOString()
                            : (typeof data.dueDate === 'string' ? data.dueDate : undefined);

      const projectDetails: ProjectWithId = {
        id: projectDocSnap.id,
        name: data.name || 'Unnamed Project',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        dataAiHint: data.dataAiHint || '',
        assignedEmployeeIds: data.assignedEmployeeIds || [],
        createdAt: createdAt,
        createdBy: data.createdBy || '',
        dueDate: dueDate,
        budget: typeof data.budget === 'number' ? data.budget : 0,
        materialCost: typeof data.materialCost === 'number' ? data.materialCost : 0,
      };
      console.log(`[fetchProjectDetails] Found project ${projectId}:`, projectDetails.name);
      return { success: true, project: projectDetails };
    } else {
      console.warn(`[fetchProjectDetails] Project details not found for ID ${projectId}.`);
      return { success: true, project: null }; // Project not found is not a server error
    }
  } catch (error) {
    console.error(`[fetchProjectDetails] Error fetching project details for ${projectId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch project details: ${errorMessage}` };
  }
}
