
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
  }).optional(),
  rate: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(0, { message: 'Rate must be a non-negative number.' }).optional().nullable()
  ),
  isActive: z.boolean().optional(),
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
  
  const adminUserDoc = await getDoc(doc(db, 'users', adminUserId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
      return { success: false, message: 'Action not authorized. Requester is not an admin.' };
  }

  const validationResult = UserUpdateSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, message: 'Invalid input.', errors: validationResult.error.issues };
  }

  const { displayName, role, payMode, rate, isActive } = validationResult.data;

  if (adminUserId === targetUserId && isActive === false) {
    return { success: false, message: 'Admins cannot deactivate their own account.' };
  }

  try {
    const userDocRef = doc(db, 'users', targetUserId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
        return { success: false, message: 'User to update not found.' };
    }

    const updates: Partial<any> = { // Use Partial<any> or a more specific type that includes all possible fields
      displayName,
      role,
    };

    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    if (role === 'employee') {
      updates.payMode = payMode || 'not_set';
      updates.rate = rate ?? 0; 
    } else {
      updates.payMode = 'not_set';
      updates.rate = 0;
    }

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
    
    await deleteDoc(userDocRef);
    return { success: true, message: 'User Firestore data deleted successfully. Auth record still exists.' };
  } catch (error) {
    console.error('Error deleting user Firestore data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to delete user data: ${errorMessage}` };
  }
}
