
'use server';

import { auth, db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Project, Task } from '@/types/database';

export interface ProjectWithId extends Project {
  id: string;
}

export interface TaskWithId extends Task {
  id: string;
}

/**
 * Fetches projects assigned to the specified employee.
 * Assumes the user document in 'users' collection has an 'assignedProjectIds' array.
 */
export async function fetchMyAssignedProjects(employeeId: string): Promise<ProjectWithId[]> {
  if (!employeeId) {
    console.error('No employee ID provided to fetchMyAssignedProjects');
    return [];
  }

  try {
    const userDocRef = doc(db, 'users', employeeId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.error('User document not found for UID:', employeeId);
      return [];
    }

    const userData = userDocSnap.data();
    const assignedProjectIds = userData.assignedProjectIds as string[] | undefined;

    if (!assignedProjectIds || assignedProjectIds.length === 0) {
      console.log('No assignedProjectIds found or array is empty for user:', employeeId);
      return []; // No projects assigned
    }

    const projectPromises = assignedProjectIds.map(async (projectId) => {
      const projectDocRef = doc(db, 'projects', projectId);
      const projectDocSnap = await getDoc(projectDocRef);
      if (projectDocSnap.exists()) {
        return { id: projectDocSnap.id, ...projectDocSnap.data() } as ProjectWithId;
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

/**
 * Fetches tasks for a specific project assigned to the specified employee.
 */
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
      orderBy('createdAt', 'desc') // Or 'dueDate' or 'name'
    );

    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as TaskWithId;
    });
    return tasks;
  } catch (error) {
    console.error(`Error fetching tasks for employee ${employeeId} and project ${projectId}:`, error);
    return [];
  }
}

/**
 * Fetches details for a single project by its ID.
 */
export async function fetchProjectDetails(projectId: string): Promise<ProjectWithId | null> {
  if (!projectId) {
    console.error('Project ID is required to fetch project details.');
    return null;
  }
  try {
    const projectDocRef = doc(db, 'projects', projectId);
    const projectDocSnap = await getDoc(projectDocRef);

    if (projectDocSnap.exists()) {
      return { id: projectDocSnap.id, ...projectDocSnap.data() } as ProjectWithId;
    } else {
      console.warn(`Project details not found for ID ${projectId}.`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching project details for ${projectId}:`, error);
    return null;
  }
}
