'use server';

import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query as firestoreQuery } from 'firebase/firestore';

export interface CountResult {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Counts all documents in the projects collection.
 */
export async function countProjects(): Promise<CountResult> {
  try {
    const projectsCollectionRef = collection(db, 'projects');
    const q = firestoreQuery(projectsCollectionRef);
    const snapshot = await getCountFromServer(q);
    return { success: true, count: snapshot.data().count };
  } catch (error) {
    console.error('Error counting projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to count projects: ${errorMessage}` };
  }
}
