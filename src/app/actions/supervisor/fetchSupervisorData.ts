
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import type { ProjectForSelection } from '@/app/actions/common/fetchAllProjects'; // Reusing this type

export interface FetchSupervisorProjectsResult {
  success: boolean;
  projects?: ProjectForSelection[];
  error?: string;
}

export async function fetchSupervisorAssignedProjects(supervisorId: string): Promise<FetchSupervisorProjectsResult> {
  if (!supervisorId) {
    return { success: false, error: 'Supervisor ID not provided.' };
  }

  try {
    const projectsCollectionRef = collection(db, 'projects');
    const q = query(
      projectsCollectionRef,
      where('assignedSupervisorIds', 'array-contains', supervisorId),
      orderBy('name', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Project',
      };
    });
    return { success: true, projects };
  } catch (error) {
    console.error(`Error fetching projects for supervisor ${supervisorId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, error: `Query requires a Firestore index on 'assignedSupervisorIds' and 'name'. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch supervisor projects: ${errorMessage}` };
  }
}
