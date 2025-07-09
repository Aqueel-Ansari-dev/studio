
'use server';

import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query as firestoreQuery } from 'firebase/firestore';
import { getOrganizationId } from '../common/getOrganizationId';

export interface CountResult {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Counts all documents in the projects subcollection for the admin's organization.
 */
export async function countProjects(adminId: string): Promise<CountResult> {
  const organizationId = await getOrganizationId(adminId);
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for the current admin.' };
  }
  
  try {
    const projectsCollectionRef = collection(db, 'organizations', organizationId, 'projects');
    const q = firestoreQuery(projectsCollectionRef);
    const snapshot = await getCountFromServer(q);
    return { success: true, count: snapshot.data().count };
  } catch (error) {
    console.error('Error counting projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to count projects: ${errorMessage}` };
  }
}
