
'use server';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, limit, where, startAt, endAt } from 'firebase/firestore';
import { getOrganizationId } from './getOrganizationId';

export interface ProjectForSelection {
  id: string;
  name: string;
}

export interface SearchProjectsResult {
  success: boolean;
  projects?: ProjectForSelection[];
  error?: string;
}

const SEARCH_LIMIT = 10;

export async function searchProjects(actorId: string, searchTerm: string, searchLimit: number = SEARCH_LIMIT): Promise<SearchProjectsResult> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for the current user.' };
  }

  const projectsCollectionRef = collection(db, 'organizations', organizationId, 'projects');

  try {
    let q;
    if (!searchTerm || searchTerm.trim() === "") {
        q = query(projectsCollectionRef, orderBy('name', 'asc'), limit(searchLimit));
    } else {
        q = query(
            projectsCollectionRef, 
            orderBy('name'), 
            startAt(searchTerm), 
            endAt(searchTerm + '\uf8ff'),
            limit(searchLimit)
        );
    }
    
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
    console.error('Error searching projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('requires an index')) {
        return { success: false, error: `Query requires a Firestore index on the 'name' field for projects. Please check server logs for details. Error: ${errorMessage}`};
    }
    return { success: false, error: `Failed to search projects: ${errorMessage}` };
  }
}
