
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import type { UserRole } from '@/types/database';

export interface UserForAdminList {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  createdAt: string; // ISO string
}

export async function fetchUsersForAdmin(): Promise<UserForAdminList[]> {
  // TODO: Add robust admin role verification here in a production app
  // For now, we assume this action is only callable by an admin due to page routing.

  try {
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, orderBy('createdAt', 'desc')); // Order by creation date
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
        role: data.role || 'employee', // Default to employee if role is missing
        avatarUrl: data.photoURL || data.avatarUrl || `https://placehold.co/40x40.png?text=${displayName.substring(0,2).toUpperCase()}`,
        createdAt: createdAt,
      };
    });
    return users;
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    // In a real app, you might want to throw the error or return a more structured error response
    return [];
  }
}
