
'use server';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, limit, where, startAt, endAt } from 'firebase/firestore';
import type { Project } from '@/types/database';

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

export async function searchProjects(searchTerm: string, searchLimit: number = SEARCH_LIMIT): Promise<SearchProjectsResult> {
  if (!searchTerm || searchTerm.trim() === "") {
    // Return a few recent projects or popular projects if search term is empty, or just empty
    // For now, let's return empty or a small default list if desired
    try {
        const projectsCollectionRef = collection(db, 'projects');
        const q = query(projectsCollectionRef, orderBy('name', 'asc'), limit(searchLimit));
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
        console.error('Error fetching default projects:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, error: `Failed to fetch projects: ${errorMessage}` };
    }
  }

  try {
    const projectsCollectionRef = collection(db, 'projects');
    // Basic prefix search (case-sensitive for Firestore unless using external search)
    // For a more robust search (case-insensitive, full-text), consider Algolia or similar.
    const q = query(
        projectsCollectionRef, 
        orderBy('name'), 
        startAt(searchTerm), 
        endAt(searchTerm + '\uf8ff'), // '\uf8ff' is a very high Unicode character often used for prefix searches
        limit(searchLimit)
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
    console.error('Error searching projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    // Firestore may require an index on 'name' for this query if it becomes complex.
    // The error message often includes a link to create the index.
    if (errorMessage.includes('requires an index')) {
        return { success: false, error: `Query requires a Firestore index on the 'name' field for projects. Please check server logs for details. Error: ${errorMessage}`};
    }
    return { success: false, error: `Failed to search projects: ${errorMessage}` };
  }
}
