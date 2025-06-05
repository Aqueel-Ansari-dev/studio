
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import type { UserRole, PayMode } from '@/types/database';

const UserUpdateSchema = z.object({
  displayName: z.string().min(1, { message: 'Display name cannot be empty.' }).max(50),
  role: z.custom<UserRole>((val) => ['employee', 'supervisor', 'admin'].includes(val as UserRole), {
    message: 'Invalid user role.',
  }),
  payMode: z.custom<PayMode>((val) => ['hourly', 'daily', 'monthly', 'not_set'].includes(val as PayMode), {
    message: 'Invalid pay mode.',
  }),
  rate: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(0, { message: 'Rate must be a non-negative number.' }).optional()
  ),
});

export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;

export interface ManageUserResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
}

export async function updateUserByAdmin(
  adminUserId: string,
  targetUserId: string,
  data: UserUpdateInput
): Promise<ManageUserResult> {
  if (!adminUserId) {
    return { success: false, message: 'Admin user ID not provided. Authentication issue.' };
  }
  // In a real app, verify adminUserId corresponds to an actual admin user from 'users' collection.
  const adminUserDoc = await getDoc(doc(db, 'users', adminUserId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
      return { success: false, message: 'Action not authorized. Requester is not an admin.' };
  }


  const validationResult = UserUpdateSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }

  const { displayName, role, payMode, rate } = validationResult.data;

  try {
    const userDocRef = doc(db, 'users', targetUserId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
        return { success: false, message: 'User to update not found.' };
    }

    const updates: Partial<any> = {
      displayName,
      role,
    };

    if (role === 'employee') {
      updates.payMode = payMode;
      updates.rate = rate ?? 0; // Default to 0 if rate is undefined
    } else {
      // If role is admin or supervisor, reset payMode and rate
      updates.payMode = 'not_set';
      updates.rate = 0;
    }
    // Note: Email is not updated here as it's usually tied to Firebase Auth identity.

    await updateDoc(userDocRef, updates);
    return { success: true, message: 'User updated successfully!' };
  } catch (error) {
    console.error('Error updating user:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update user: ${errorMessage}` };
  }
}

export async function deleteUserByAdmin(
  adminUserId: string,
  targetUserId: string
): Promise<ManageUserResult> {
  if (!adminUserId) {
    return { success: false, message: 'Admin user ID not provided. Authentication issue.' };
  }
   // In a real app, verify adminUserId corresponds to an actual admin user from 'users' collection.
  const adminUserDoc = await getDoc(doc(db, 'users', adminUserId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
      return { success: false, message: 'Action not authorized. Requester is not an admin.' };
  }

  if (adminUserId === targetUserId) {
    return { success: false, message: 'Admins cannot delete their own accounts through this interface.' };
  }

  try {
    const userDocRef = doc(db, 'users', targetUserId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
        return { success: false, message: 'User to delete not found.' };
    }
    
    // IMPORTANT: This only deletes the Firestore document.
    // It does NOT delete the user from Firebase Authentication.
    // True user deletion (Auth + Firestore) requires Firebase Admin SDK, usually in a Cloud Function.
    await deleteDoc(userDocRef);
    return { success: true, message: 'User Firestore data deleted successfully. Auth record still exists.' };
  } catch (error) {
    console.error('Error deleting user Firestore data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to delete user data: ${errorMessage}` };
  }
}

