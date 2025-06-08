
'use server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { UserRole } from '@/types/database';

export interface UserForSelection {
  id: string; // Firebase UID
  name: string; 
  avatar?: string; // Optional avatar URL
}

export interface FetchUsersByRoleResult {
  success: boolean;
  users?: UserForSelection[];
  error?: string;
}

export async function fetchUsersByRole(role: UserRole): Promise<FetchUsersByRoleResult> {
  try {
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, where('role', '==', role));
    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.displayName || data.email || 'Unnamed User',
        avatar: data.avatarUrl || `https://placehold.co/40x40.png?text=${(data.displayName || data.email || 'UU').substring(0,2).toUpperCase()}`,
      };
    });
    return { success: true, users };
  } catch (error) {
    console.error(`Error fetching users with role ${role}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: `Failed to fetch users by role: ${errorMessage}` };
  }
}
