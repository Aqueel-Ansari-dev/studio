
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
 * Fetches projects assigned to the currently authenticated employee.
 * Assumes the user document in 'users' collection has an 'assignedProjectIds' array.
 */
export async function fetchMyAssignedProjects(): Promise<ProjectWithId[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('No authenticated user found');
    return [];
  }

  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.error('User document not found for UID:', currentUser.uid);
      return [];
    }

    const userData = userDocSnap.data();
    const assignedProjectIds = userData.assignedProjectIds as string[] | undefined;

    if (!assignedProjectIds || assignedProjectIds.length === 0) {
      return []; // No projects assigned
    }

    const projects: ProjectWithId[] = [];
    for (const projectId of assignedProjectIds) {
      const projectDocRef = doc(db, 'projects', projectId);
      const projectDocSnap = await getDoc(projectDocRef);
      if (projectDocSnap.exists()) {
        projects.push({ id: projectDocSnap.id, ...projectDocSnap.data() } as ProjectWithId);
      } else {
        console.warn(`Project with ID ${projectId} not found, but was listed in user's assignedProjectIds.`);
      }
    }
    return projects;
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    return [];
  }
}

/**
 * Fetches tasks for a specific project assigned to the currently authenticated employee.
 */
export async function fetchMyTasksForProject(projectId: string): Promise<TaskWithId[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('No authenticated user found');
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
      where('assignedEmployeeId', '==', currentUser.uid),
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
    console.error(`Error fetching tasks for project ${projectId}:`, error);
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
