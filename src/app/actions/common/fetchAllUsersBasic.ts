
'use server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getOrganizationId } from './getOrganizationId';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/lib/firebase-admin';

export interface UserBasic {
  id: string;
  name: string;
}

export interface FetchAllUsersBasicResult {
  success: boolean;
  users?: UserBasic[];
  error?: string;
}

// Overloaded function signatures
export async function fetchAllUsersBasic(): Promise<FetchAllUsersBasicResult>;
export async function fetchAllUsersBasic(actorId: string): Promise<FetchAllUsersBasicResult>;

export async function fetchAllUsersBasic(actorId?: string): Promise<FetchAllUsersBasicResult> {
  let organizationId: string | null = null;
  
  if (actorId) {
      organizationId = await getOrganizationId(actorId);
      if (!organizationId) {
        return { success: false, error: 'Could not determine organization for the current user.' };
      }
  }

  try {
    let usersSnapshot;
    if(organizationId) {
        const usersRef = collection(db, 'organizations', organizationId, 'users');
        const q = query(usersRef, orderBy('displayName', 'asc'));
        usersSnapshot = await getDocs(q);
    } else {
        // This is for the owner view, fetching ALL users across the platform
        const app = initializeAdminApp();
        const auth = getAuth(app);
        const userRecords = await auth.listUsers(1000); // Get up to 1000 users
        const allUsers = userRecords.users.map(u => ({ id: u.uid, name: u.displayName || u.email || 'Unnamed' }));
        return { success: true, users: allUsers };
    }

    const users = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.displayName || data.email || 'Unnamed',
      } as UserBasic;
    });

    return { success: true, users };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('fetchAllUsersBasic error', err);
    return { success: false, error: msg };
  }
}
