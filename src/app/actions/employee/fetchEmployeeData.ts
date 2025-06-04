
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

export async function fetchMyAssignedProjects(employeeId: string): Promise<ProjectWithId[]> {
  console.log(`[fetchMyAssignedProjects] Called for employeeId: ${employeeId}`);
  if (!employeeId) {
    console.error('[fetchMyAssignedProjects] No employee ID provided');
    return [];
  }

  try {
    const userDocRef = doc(db, 'users', employeeId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.warn(`[fetchMyAssignedProjects] User document not found for UID: ${employeeId}`);
      return [];
    }

    const userData = userDocSnap.data();
    const assignedProjectIds = userData.assignedProjectIds as string[] | undefined;
    console.log(`[fetchMyAssignedProjects] User ${employeeId} assignedProjectIds:`, assignedProjectIds);

    if (!assignedProjectIds || assignedProjectIds.length === 0) {
      console.log(`[fetchMyAssignedProjects] No assignedProjectIds found or array is empty for user: ${employeeId}`);
      return [];
    }

    const projectPromises = assignedProjectIds.map(async (projectId) => {
      const projectDocRef = doc(db, 'projects', projectId);
      const projectDocSnap = await getDoc(projectDocRef);
      if (projectDocSnap.exists()) {
        const data = projectDocSnap.data();
        const createdAt = data.createdAt instanceof Timestamp
                            ? data.createdAt.toDate().toISOString()
                            : (typeof data.createdAt === 'string' ? data.createdAt : undefined);
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
        } as ProjectWithId;
      } else {
        console.warn(`[fetchMyAssignedProjects] Project with ID ${projectId} not found, but was listed in user's assignedProjectIds.`);
        return null;
      }
    });

    const resolvedProjects = await Promise.all(projectPromises);
    const validProjects = resolvedProjects.filter(project => project !== null) as ProjectWithId[];
    console.log(`[fetchMyAssignedProjects] Returning ${validProjects.length} projects for employee ${employeeId}`);
    return validProjects;

  } catch (error) {
    console.error('[fetchMyAssignedProjects] Error fetching assigned projects for employeeId', employeeId, ':', error);
    return [];
  }
}

export async function fetchMyTasksForProject(employeeId: string, projectId: string): Promise<TaskWithId[]> {
  console.log(`[fetchMyTasksForProject] Called with employeeId: '${employeeId}', projectId: '${projectId}'`);
  if (!employeeId) {
    console.error('[fetchMyTasksForProject] No employee ID provided.');
    return [];
  }
  if (!projectId) {
    console.error('[fetchMyTasksForProject] Project ID is required.');
    return [];
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
        console.log(`[fetchMyTasksForProject] No tasks found matching criteria. Verify employeeId and projectId in Firestore 'tasks' collection match the query parameters. Also ensure composite indexes are set up in Firestore if complex queries are used (e.g. multiple where clauses + orderBy).`);
    }

    const tasks = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      console.log(`[fetchMyTasksForProject] Raw task data for doc ID ${docSnap.id}:`, JSON.parse(JSON.stringify(data)));
      
      const convertTimestampToString = (fieldValue: any): string | undefined => {
        if (fieldValue instanceof Timestamp) return fieldValue.toDate().toISOString();
        if (typeof fieldValue === 'string') return fieldValue; // Already a string
        if (fieldValue && typeof fieldValue.seconds === 'number' && typeof fieldValue.nanoseconds === 'number') { // Handle plain {seconds, nanoseconds} objects if they slip through
             return new Timestamp(fieldValue.seconds, fieldValue.nanoseconds).toDate().toISOString();
        }
        return undefined;
      };
      
      const convertTimestampToMillis = (fieldValue: any): number | undefined => {
        if (fieldValue instanceof Timestamp) return fieldValue.toMillis();
        if (typeof fieldValue === 'number') return fieldValue; // Already millis
         if (fieldValue && typeof fieldValue.seconds === 'number' && typeof fieldValue.nanoseconds === 'number') {
             return new Timestamp(fieldValue.seconds, fieldValue.nanoseconds).toMillis();
        }
        return undefined;
      };

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
      console.log(`[fetchMyTasksForProject] Mapped task (doc ID ${docSnap.id}):`, mappedTask);
      return mappedTask;
    });
    console.log(`[fetchMyTasksForProject] Returning ${tasks.length} mapped tasks.`);
    return tasks;
  } catch (error) {
    console.error(`[fetchMyTasksForProject] Error fetching tasks for employee ${employeeId} and project ${projectId}:`, error);
    return [];
  }
}

export async function fetchProjectDetails(projectId: string): Promise<ProjectWithId | null> {
  console.log(`[fetchProjectDetails] Called for projectId: ${projectId}`);
  if (!projectId) {
    console.error('[fetchProjectDetails] Project ID is required.');
    return null;
  }
  try {
    const projectDocRef = doc(db, 'projects', projectId);
    const projectDocSnap = await getDoc(projectDocRef);

    if (projectDocSnap.exists()) {
      const data = projectDocSnap.data();
      const createdAt = data.createdAt instanceof Timestamp
                          ? data.createdAt.toDate().toISOString()
                          : (typeof data.createdAt === 'string' ? data.createdAt : undefined);
      const projectDetails: ProjectWithId = {
        id: projectDocSnap.id,
        name: data.name || 'Unnamed Project',
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        dataAiHint: data.dataAiHint || '',
        assignedEmployeeIds: data.assignedEmployeeIds || [],
        createdAt: createdAt,
        createdBy: data.createdBy || '',
      };
      console.log(`[fetchProjectDetails] Found project ${projectId}:`, projectDetails.name);
      return projectDetails;
    } else {
      console.warn(`[fetchProjectDetails] Project details not found for ID ${projectId}.`);
      return null;
    }
  } catch (error) {
    console.error(`[fetchProjectDetails] Error fetching project details for ${projectId}:`, error);
    return null;
  }
}
