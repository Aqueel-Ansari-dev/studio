
'use server';

import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query as firestoreQuery, where, QueryConstraint } from 'firebase/firestore';
import type { UserRole } from '@/types/database';

// Re-using the same filter interface from fetchUsersForAdmin
export interface FetchUsersForAdminFilters {
  role?: UserRole | 'all';
  status?: 'active' | 'inactive' | 'all';
  searchTerm?: string | null;
}

export interface CountResult {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Counts users based on the provided filters within the admin's organization.
 */
export async function countUsers(
    adminId: string, 
    organizationId: string, 
    filters: FetchUsersForAdminFilters = { role: 'all', status: 'all', searchTerm: null }
): Promise<CountResult> {
  if (!organizationId) {
    return { success: false, error: 'Organization ID was not provided.' };
  }

  try {
    const usersCollectionRef = collection(db, 'organizations', organizationId, 'users');
    const queryConstraints: QueryConstraint[] = [];

    const { role, status, searchTerm } = filters;

    if (role && role !== 'all') {
      queryConstraints.push(where('role', '==', role));
    }
    if (status && status !== 'all') {
      queryConstraints.push(where('isActive', '==', status === 'active'));
    }
    
    if (searchTerm && searchTerm.trim() !== '') {
      queryConstraints.push(where('displayName', '>=', searchTerm.trim()));
      queryConstraints.push(where('displayName', '<=', searchTerm.trim() + '\uf8ff'));
    }

    const q = firestoreQuery(usersCollectionRef, ...queryConstraints);
    const snapshot = await getCountFromServer(q);
    return { success: true, count: snapshot.data().count };
  } catch (error) {
    console.error('Error counting users:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to count users: ${errorMessage}` };
  }
}
