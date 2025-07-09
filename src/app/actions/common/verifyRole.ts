
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserRole } from '@/types/database';
import { getOrganizationId } from './getOrganizationId';

/**
 * Utility to verify that a user has one of the allowed roles within their organization.
 * Returns true if the user's role matches, false otherwise.
 */
export async function verifyRole(userId: string, roles: UserRole[]): Promise<boolean> {
  const organizationId = await getOrganizationId(userId);
  if (!userId || !organizationId) return false;
  
  const userDocRef = doc(db, 'organizations', organizationId, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return false;
  const userRole = userDocSnap.data()?.role as UserRole;
  return roles.includes(userRole);
}
