
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { UserRole, PayMode } from '@/types/database';
import { getOrganizationId } from '../common/getOrganizationId';

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

export async function fetchUserDetailsForAdminPage(adminId: string, targetUserId: string): Promise<UserDetailsForAdminPage | null> {
  const organizationId = await getOrganizationId(adminId);
  if (!organizationId) {
    console.error('[fetchUserDetailsForAdminPage] Could not determine organization.');
    return null;
  }
  
  if (!targetUserId) {
    console.error('[fetchUserDetailsForAdminPage] Target User ID not provided.');
    return null;
  }

  try {
    const userDocRef = doc(db, 'organizations', organizationId, 'users', targetUserId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.warn(`[fetchUserDetailsForAdminPage] User document not found for UID: ${targetUserId} in organization ${organizationId}`);
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
      isActive: data.isActive === undefined ? true : data.isActive,
    };
  } catch (error) {
    console.error(`[fetchUserDetailsForAdminPage] Error fetching user details for ${targetUserId}:`, error);
    return null;
  }
}
