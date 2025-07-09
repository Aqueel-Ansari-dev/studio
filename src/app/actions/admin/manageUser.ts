
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import type { UserRole, PayMode } from '@/types/database';
import { logAudit } from '../auditLog';
import { getOrganizationId } from '../common/getOrganizationId';

const UserUpdateSchema = z.object({
  displayName: z.string().min(1, { message: 'Display name cannot be empty.' }).max(50),
  role: z.custom<UserRole>((val) => ['employee', 'supervisor', 'admin'].includes(val as UserRole), {
    message: 'Invalid user role.',
  }),
  payMode: z.custom<PayMode>((val) => ['hourly', 'daily', 'monthly', 'not_set'].includes(val as PayMode), {
    message: 'Invalid pay mode.',
  }).optional(),
  rate: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? parseFloat(val) : val),
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
  const organizationId = await getOrganizationId(adminUserId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for the current admin.' };
  }
  
  const adminUserDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', adminUserId));
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
    const orgUserDocRef = doc(db, 'organizations', organizationId, 'users', targetUserId);
    const topLevelUserDocRef = doc(db, 'users', targetUserId);

    const orgUserSnap = await getDoc(orgUserDocRef);
    if (!orgUserSnap.exists()) {
        return { success: false, message: 'User to update not found.' };
    }

    const updates: Partial<any> = {
      displayName,
      role,
      updatedAt: serverTimestamp(),
    };
    
    // For top-level doc, we only sync a few key fields.
    const topLevelUpdates: Partial<any> = {
        displayName,
        role
    };

    if (isActive !== undefined) {
      updates.isActive = isActive;
      topLevelUpdates.isActive = isActive;
    }

    if (role === 'employee') {
      updates.payMode = payMode || 'not_set';
      updates.rate = rate ?? 0; 
    } else {
      updates.payMode = 'not_set';
      updates.rate = 0;
    }

    const batch = writeBatch(db);
    batch.update(orgUserDocRef, updates);
    batch.update(topLevelUserDocRef, topLevelUpdates);
    
    await batch.commit();

    await logAudit(
      adminUserId,
      organizationId, 
      'user_update', 
      `Updated user profile for ${displayName}. Set role to ${role} and status to ${isActive ? 'active' : 'inactive'}.`,
      targetUserId,
      'user',
      updates
    );

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
  const organizationId = await getOrganizationId(adminUserId);
  if (!organizationId) {
    return { success: false, message: 'Could not determine organization for the current admin.' };
  }
   
  const adminUserDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', adminUserId));
  if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
      return { success: false, message: 'Action not authorized. Requester is not an admin.' };
  }

  if (adminUserId === targetUserId) {
    return { success: false, message: 'Admins cannot delete their own accounts through this interface.' };
  }

  try {
    const userDocRef = doc(db, 'organizations', organizationId, 'users', targetUserId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
        return { success: false, message: 'User to delete not found.' };
    }
    const userData = userDocSnap.data();
    
    // Deletes the user profile from the org subcollection.
    // NOTE: This does NOT delete the user from Firebase Auth.
    await deleteDoc(userDocRef);
    
    // Also delete the top-level user-to-org mapping document.
    await deleteDoc(doc(db, 'users', targetUserId));
    
    await logAudit(
      adminUserId,
      organizationId,
      'user_delete',
      `Deleted Firestore user data for ${userData.displayName || userData.email}.`,
      targetUserId,
      'user',
      { userId: targetUserId }
    );

    return { success: true, message: 'User Firestore data deleted successfully. Auth record may still exist.' };
  } catch (error) {
    console.error('Error deleting user Firestore data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to delete user data: ${errorMessage}` };
  }
}


export async function bulkUpdateUsersStatus(
    adminUserId: string,
    userIds: string[],
    isActive: boolean
): Promise<ManageUserResult> {
    const organizationId = await getOrganizationId(adminUserId);
    if (!organizationId) {
        return { success: false, message: 'Could not determine organization for the current admin.' };
    }

    const adminUserDoc = await getDoc(doc(db, 'organizations', organizationId, 'users', adminUserId));
    if (!adminUserDoc.exists() || adminUserDoc.data()?.role !== 'admin') {
        return { success: false, message: 'Action not authorized. Requester is not an admin.' };
    }

    if (!userIds || userIds.length === 0) {
        return { success: false, message: 'No user IDs provided for bulk update.' };
    }

    if (isActive === false && userIds.includes(adminUserId)) {
        return { success: false, message: 'Bulk action cannot deactivate the currently logged-in admin.' };
    }

    try {
        const batch = writeBatch(db);
        userIds.forEach(userId => {
            const orgUserRef = doc(db, 'organizations', organizationId, 'users', userId);
            const topLevelUserRef = doc(db, 'users', userId);
            batch.update(orgUserRef, { isActive, updatedAt: serverTimestamp() });
            batch.update(topLevelUserRef, { isActive });
        });
        await batch.commit();
        
        const statusText = isActive ? 'activated' : 'deactivated';
        await logAudit(
            adminUserId,
            organizationId,
            'user_update',
            `Bulk ${statusText} ${userIds.length} user(s).`,
            'multiple',
            'user',
            { userIds, status: statusText }
        );

        return { success: true, message: `${userIds.length} user(s) have been successfully ${statusText}.` };

    } catch (error) {
        console.error('Error during bulk user status update:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return { success: false, message: `Failed to update users: ${errorMessage}` };
    }
}
