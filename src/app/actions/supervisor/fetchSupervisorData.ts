
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { ProjectForSelection } from '@/app/actions/common/fetchAllProjects'; // Reusing this type
import { getOrganizationId } from '../common/getOrganizationId';

export interface FetchSupervisorProjectsResult {
  success: boolean;
  projects?: ProjectForSelection[];
  error?: string;
}

export async function fetchSupervisorAssignedProjects(supervisorId: string): Promise<FetchSupervisorProjectsResult> {
  const organizationId = await getOrganizationId(supervisorId);
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for supervisor.' };
  }

  try {
    const projectsCollectionRef = collection(db, 'organizations', organizationId, 'projects');
    const q = query(
      projectsCollectionRef,
      where('assignedSupervisorIds', 'array-contains', supervisorId)
    );

    const querySnapshot = await getDocs(q);
    const projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Project',
      };
    });

    projects.sort((a, b) => a.name.localeCompare(b.name));
    
    return { success: true, projects };
  } catch (error) {
    console.error(`Error fetching projects for supervisor ${supervisorId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, error: `Query requires a Firestore index on 'assignedSupervisorIds'. Please check server logs for a link to create it. Details: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch supervisor projects: ${errorMessage}` };
  }
}
