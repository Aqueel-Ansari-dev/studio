import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserRole } from '@/types/database';

/**
 * Utility to verify that a user has one of the allowed roles.
 * Returns true if the user's role matches, false otherwise.
 */
export async function verifyRole(userId: string, roles: UserRole[]): Promise<boolean> {
  if (!userId) return false;
  const userDocRef = doc(db, 'users', userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return false;
  const userRole = userDocSnap.data()?.role as UserRole;
  return roles.includes(userRole);
}
