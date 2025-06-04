
'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Project, Task } from '@/types/database';

export interface ProjectWithId extends Project {
  id: string;
  // createdAt will now be string from Project type
}

export interface TaskWithId extends Task {
  id: string;
  // Timestamps from Task type should already be ISO strings if converted correctly by actions like assignTask
  // We'll ensure conversion here if they are Timestamps from DB
}

export async function fetchMyAssignedProjects(employeeId: string): Promise<ProjectWithId[]> {
  if (!employeeId) {
    console.error('No employee ID provided to fetchMyAssignedProjects');
    return [];
  }

  try {
    const userDocRef = doc(db, 'users', employeeId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.warn('User document not found for UID:', employeeId);
      return [];
    }

    const userData = userDocSnap.data();
    const assignedProjectIds = userData.assignedProjectIds as string[] | undefined;

    if (!assignedProjectIds || assignedProjectIds.length === 0) {
      console.log('No assignedProjectIds found or array is empty for user:', employeeId);
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
        return {
          ...data,
          id: projectDocSnap.id,
          createdAt: createdAt,
        } as ProjectWithId;
      } else {
        console.warn(`Project with ID ${projectId} not found, but was listed in user's assignedProjectIds.`);
        return null;
      }
    });

    const resolvedProjects = await Promise.all(projectPromises);
    return resolvedProjects.filter(project => project !== null) as ProjectWithId[];

  } catch (error) {
    console.error('Error fetching assigned projects for employeeId', employeeId, ':', error);
    return [];
  }
}

export async function fetchMyTasksForProject(employeeId: string, projectId: string): Promise<TaskWithId[]> {
  if (!employeeId) {
    console.error('No employee ID provided to fetchMyTasksForProject');
    return [];
  }
  if (!projectId) {
    console.error('Project ID is required to fetch tasks.');
    return [];
  }

  try {
    const tasksCollectionRef = collection(db, 'tasks');
    const q = query(
      tasksCollectionRef,
      where('assignedEmployeeId', '==', employeeId),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc') // Consider ordering by dueDate or status as well
    );

    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // Ensure all timestamp fields are converted to ISO strings
      const convertTimestamp = (fieldValue: any): string | undefined => {
        if (fieldValue instanceof Timestamp) {
          return fieldValue.toDate().toISOString();
        }
        if (typeof fieldValue === 'string') {
          return fieldValue; // Already a string
        }
        if (typeof fieldValue === 'number') { // If startTime/endTime are numbers
          return new Date(fieldValue).toISOString();
        }
        return undefined;
      };
      
      const startTime = data.startTime instanceof Timestamp ? data.startTime.toMillis() : data.startTime;
      const endTime = data.endTime instanceof Timestamp ? data.endTime.toMillis() : data.endTime;


      return {
        id: docSnap.id,
        ...data,
        dueDate: convertTimestamp(data.dueDate),
        createdAt: convertTimestamp(data.createdAt) || new Date(0).toISOString(), // Fallback for createdAt
        updatedAt: convertTimestamp(data.updatedAt) || new Date(0).toISOString(), // Fallback for updatedAt
        startTime: startTime, // Keep as number (milliseconds)
        endTime: endTime,     // Keep as number (milliseconds)
      } as TaskWithId;
    });
    return tasks;
  } catch (error) {
    console.error(`Error fetching tasks for employee ${employeeId} and project ${projectId}:`, error);
    return [];
  }
}

export async function fetchProjectDetails(projectId: string): Promise<ProjectWithId | null> {
  if (!projectId) {
    console.error('Project ID is required to fetch project details.');
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
      return {
        ...data,
        id: projectDocSnap.id,
        createdAt: createdAt,
      } as ProjectWithId;
    } else {
      console.warn(`Project details not found for ID ${projectId}.`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching project details for ${projectId}:`, error);
    return null;
  }
}
