
'use server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { UserRole } from '@/types/database';

export interface UserForSelection {
  id: string; // Firebase UID
  name: string; 
  avatar?: string; // Optional avatar URL
}

export async function fetchUsersByRole(role: UserRole): Promise<UserForSelection[]> {
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
    return users;
  } catch (error)
    {
    console.error(`Error fetching users with role ${role}:`, error);
    // In a real app, you might want to throw the error or handle it more gracefully
    return []; 
  }
}
