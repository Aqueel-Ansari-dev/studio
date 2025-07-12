
'use server';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where, getCountFromServer } from 'firebase/firestore';
import type { UserRole, User } from '@/types/database';
import { getOrganizationId } from './getOrganizationId';

export interface UserWithTaskCount extends User {
  activeTaskCount: number;
}

export interface FetchUsersWithTaskCountsResult {
  success: boolean;
  users?: UserWithTaskCount[];
  error?: string;
}

/**
 * Fetches users of specified roles and includes a count of their active tasks.
 * Active tasks are defined as those with status 'pending' or 'in-progress'.
 */
export async function fetchUsersWithTaskCounts(
  actorId: string,
  roles: UserRole[]
): Promise<FetchUsersWithTaskCountsResult> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for the current user.' };
  }

  if (!roles || roles.length === 0) {
    return { success: false, error: 'At least one role must be specified.' };
  }

  try {
    const usersCollectionRef = collection(db, 'organizations', organizationId, 'users');
    const tasksCollectionRef = collection(db, 'organizations', organizationId, 'tasks');
    
    const q = query(
        usersCollectionRef, 
        where('role', 'in', roles)
    );
    const querySnapshot = await getDocs(q);

    const usersWithCounts: UserWithTaskCount[] = await Promise.all(
      querySnapshot.docs.map(async (docSnap) => {
        const userData = docSnap.data() as User;
        const taskCountQuery = query(
          tasksCollectionRef,
          where('assignedEmployeeId', '==', docSnap.id),
          where('status', 'in', ['pending', 'in-progress'])
        );
        const taskCountSnap = await getCountFromServer(taskCountQuery);
        const activeTaskCount = taskCountSnap.data().count;
        
        const displayName = userData.displayName || userData.email || 'Unnamed User';

        return {
          id: docSnap.id,
          ...userData,
          displayName: roles.includes('supervisor') && userData.role === 'supervisor' ? `${displayName} (Supervisor)` : displayName,
          activeTaskCount: activeTaskCount,
        } as UserWithTaskCount;
      })
    );

    // Sort users by task count (ascending) and then by name
    usersWithCounts.sort((a, b) => {
        if (a.activeTaskCount < b.activeTaskCount) return -1;
        if (a.activeTaskCount > b.activeTaskCount) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
    });

    return { success: true, users: usersWithCounts };
  } catch (error) {
    console.error(`Error fetching users with task counts for roles ${roles.join(', ')}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition')) {
      return { success: false, error: `Query requires a Firestore index. Please check server logs for details.` };
    }
    return { success: false, error: `Failed to fetch users: ${errorMessage}` };
  }
}
