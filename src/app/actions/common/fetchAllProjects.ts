
'use server';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { getOrganizationId } from './getOrganizationId';

export interface ProjectForSelection {
  id: string;
  name: string;
}

export interface FetchAllProjectsResult {
  success: boolean;
  projects?: ProjectForSelection[];
  error?: string;
}

export async function fetchAllProjects(userIdForOrg: string): Promise<FetchAllProjectsResult> {
  const organizationId = await getOrganizationId(userIdForOrg);
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for the current user.' };
  }

  try {
    const projectsCollectionRef = collection(db, 'organizations', organizationId, 'projects');
    const q = query(
        projectsCollectionRef,
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
    console.error('Error fetching all projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch projects: ${errorMessage}` };
  }
}
