
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import type { UserRole, PayMode } from '@/types/database';

export interface UserForAdminList {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  createdAt: string; // ISO string
  payMode?: PayMode;
  rate?: number;
  assignedProjectIds?: string[];
}

export interface FetchUsersForAdminResult {
  success: boolean;
  users?: UserForAdminList[];
  error?: string;
}

export async function fetchUsersForAdmin(): Promise<FetchUsersForAdminResult> {
  // TODO: Add robust admin role verification here in a production app

  try {
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, orderBy('createdAt', 'desc')); 
    const querySnapshot = await getDocs(q);

    const users = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const displayName = data.displayName || data.email?.split('@')[0] || 'N/A';
      const createdAt = data.createdAt instanceof Timestamp 
                          ? data.createdAt.toDate().toISOString() 
                          : (typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString());

      return {
        id: doc.id,
        displayName: displayName,
        email: data.email || 'N/A',
        role: data.role || 'employee', 
        avatarUrl: data.photoURL || data.avatarUrl || `https://placehold.co/40x40.png?text=${displayName.substring(0,2).toUpperCase()}`,
        createdAt: createdAt,
        payMode: data.payMode || 'not_set',
        rate: typeof data.rate === 'number' ? data.rate : 0,
        assignedProjectIds: data.assignedProjectIds || [],
      };
    });
    return { success: true, users };
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch users: ${errorMessage}` };
  }
}
