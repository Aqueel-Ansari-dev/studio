
'use server';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import type { UserRole, User } from '@/types/database';
import { getOrganizationId } from './getOrganizationId';

export interface UserForSelection {
  id: string; // Firebase UID
  name: string; 
  avatar?: string; // Optional avatar URL
  role: UserRole; 
}

export interface FetchUsersByRoleResult {
  success: boolean;
  users?: UserForSelection[];
  error?: string;
}

export async function fetchUsersByRole(actorId: string, role: UserRole): Promise<FetchUsersByRoleResult> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization for the current user.' };
  }

  try {
    const usersCollectionRef = collection(db, 'organizations', organizationId, 'users');
    const q = query(
        usersCollectionRef, 
        where('role', '==', role)
    );
    const querySnapshot = await getDocs(q);

    const users = querySnapshot.docs.map(doc => {
        const data = doc.data() as User;
        return {
          id: doc.id,
          name: data.displayName || data.email || 'Unnamed User',
          avatar: data.photoURL || `https://placehold.co/40x40.png?text=${(data.displayName || data.email || 'UU').substring(0,2).toUpperCase()}`,
          role: data.role,
        };
      });

    return { success: true, users };
  } catch (error) {
    console.error(`Error fetching users with role ${role}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition')) {
      return { success: false, error: `Query requires a Firestore index on 'role'. Please create it.` };
    }
    return { success: false, error: `Failed to fetch users by role: ${errorMessage}` };
  }
}
