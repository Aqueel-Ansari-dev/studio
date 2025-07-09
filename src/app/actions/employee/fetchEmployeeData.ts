
'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Project, Task, User } from '@/types/database';

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


export async function fetchMyAssignedProjects(employeeId: string, organizationId: string): Promise<FetchMyAssignedProjectsResult> {
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for user.' };
  }

  try {
    const userDocRef = doc(db, 'organizations', organizationId, 'users', employeeId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return { success: true, projects: [] }; 
    }

    const userData = userDocSnap.data();
    const assignedProjectIds = userData.assignedProjectIds as string[] | undefined;

    if (!assignedProjectIds || assignedProjectIds.length === 0) {
      return { success: true, projects: [] };
    }

    const projectPromises = assignedProjectIds.map(async (projectId) => {
      const projectDocRef = doc(db, 'organizations', organizationId, 'projects', projectId);
      const projectDocSnap = await getDoc(projectDocRef);
      if (projectDocSnap.exists()) {
        const data = projectDocSnap.data();
        const createdAt = data.createdAt instanceof Timestamp
                            ? data.createdAt.toDate().toISOString()
                            : (typeof data.createdAt === 'string' ? data.createdAt : undefined);
        const dueDate = data.dueDate instanceof Timestamp
                            ? data.dueDate.toDate().toISOString()
                            : (typeof data.dueDate === 'string' ? data.dueDate : undefined);
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
        return null;
      }
    });

    const resolvedProjects = await Promise.all(projectPromises);
    const validProjects = resolvedProjects.filter(project => project !== null) as ProjectWithId[];
    return { success: true, projects: validProjects };

  } catch (error) {
    console.error('[fetchMyAssignedProjects] Error fetching assigned projects for employeeId', employeeId, ':', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch assigned projects: ${errorMessage}` };
  }
}

export async function fetchMyTasksForProject(employeeId: string, projectId: string): Promise<FetchMyTasksForProjectResult> {
  // This action implies an organization context, but it's derived from the user's projects.
  // For a stricter multi-tenant model, passing organizationId would be better.
  // Assuming for now that employeeId and projectId are sufficient to scope.
  const userMappingDoc = await getDoc(doc(db, 'users', employeeId));
  if (!userMappingDoc.exists()) {
    return { success: false, error: "Could not find user mapping." };
  }
  const organizationId = userMappingDoc.data()?.organizationId;
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for user.' };
  }

  try {
    const tasksCollectionRef = collection(db, 'organizations', organizationId, 'tasks');
    const q = query(
      tasksCollectionRef,
      where('assignedEmployeeId', '==', employeeId),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.docs.length === 0) {
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

export async function fetchProjectDetails(userId: string, projectId: string): Promise<FetchProjectDetailsResult> {
  const userMappingDoc = await getDoc(doc(db, 'users', userId));
  if (!userMappingDoc.exists()) {
    return { success: false, error: "Could not find user mapping." };
  }
  const organizationId = userMappingDoc.data()?.organizationId;
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for user.' };
  }
  
  try {
    const projectDocRef = doc(db, 'organizations', organizationId, 'projects', projectId);
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
      return { success: true, project: projectDetails };
    } else {
      return { success: true, project: null }; // Project not found is not a server error
    }
  } catch (error) {
    console.error(`[fetchProjectDetails] Error fetching project details for ${projectId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch project details: ${errorMessage}` };
  }
}

export interface FetchMyActiveTasksResult {
  success: boolean;
  tasks?: TaskWithId[];
  error?: string;
}

export async function fetchMyActiveTasks(employeeId: string): Promise<FetchMyActiveTasksResult> {
  const userMappingDoc = await getDoc(doc(db, 'users', employeeId));
  if (!userMappingDoc.exists()) {
    return { success: false, error: "Could not find user mapping." };
  }
  const organizationId = userMappingDoc.data()?.organizationId;
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for user.' };
  }

  try {
    const tasksCollectionRef = collection(db, 'organizations', organizationId, 'tasks');
    const q = query(
      tasksCollectionRef,
      where('assignedEmployeeId', '==', employeeId),
      where('status', '==', 'in-progress')
    );

    const querySnapshot = await getDocs(q);

    const tasks = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();

      const startTimeMillis = data.startTime instanceof Timestamp
        ? data.startTime.toMillis()
        : (typeof data.startTime === 'number' ? data.startTime : undefined);

      return {
        id: docSnap.id,
        taskName: data.taskName || 'Unnamed Task',
        description: data.description || '',
        status: data.status || 'pending',
        projectId: data.projectId,
        assignedEmployeeId: data.assignedEmployeeId,
        createdBy: data.createdBy || '',
        startTime: startTimeMillis,
        elapsedTime: typeof data.elapsedTime === 'number' ? data.elapsedTime : 0,
        isImportant: data.isImportant || false,
      } as TaskWithId;
    });

    return { success: true, tasks };
  } catch (error) {
    console.error('[fetchMyActiveTasks] Error fetching active tasks:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('firestore/failed-precondition') && message.includes('requires an index')) {
      return { success: false, error: `Query requires a Firestore index. Details: ${message}` };
    }
    return { success: false, error: `Failed to fetch active tasks: ${message}` };
  }
}
