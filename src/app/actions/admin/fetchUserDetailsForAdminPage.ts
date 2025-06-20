
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { UserRole, PayMode } from '@/types/database';

export interface UserDetailsForAdminPage {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  createdAt: string; // ISO string
  payMode?: PayMode;
  rate?: number;
  assignedProjectIds?: string[];
  isActive?: boolean;
}

export async function fetchUserDetailsForAdminPage(userId: string): Promise<UserDetailsForAdminPage | null> {
  if (!userId) {
    console.error('[fetchUserDetailsForAdminPage] User ID not provided.');
    return null;
  }

  try {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.warn(`[fetchUserDetailsForAdminPage] User document not found for UID: ${userId}`);
      return null;
    }

    const data = userDocSnap.data();
    const displayName = data.displayName || data.email?.split('@')[0] || 'N/A';
    const createdAt = data.createdAt instanceof Timestamp 
                        ? data.createdAt.toDate().toISOString() 
                        : (typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString());

    return {
      id: userDocSnap.id,
      displayName: displayName,
      email: data.email || 'N/A',
      role: data.role || 'employee', 
      avatarUrl: data.photoURL || data.avatarUrl || `https://placehold.co/40x40.png?text=${displayName.substring(0,2).toUpperCase()}`,
      createdAt: createdAt,
      payMode: data.payMode || 'not_set',
      rate: typeof data.rate === 'number' ? data.rate : 0,
      assignedProjectIds: data.assignedProjectIds || [],
      isActive: data.isActive === undefined ? true : data.isActive, // Default to true if not set
    };
  } catch (error) {
    console.error(`[fetchUserDetailsForAdminPage] Error fetching user details for ${userId}:`, error);
    return null;
  }
}
