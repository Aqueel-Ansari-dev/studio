

'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { getOrganizationId } from '../common/getOrganizationId';

const UpdateUserProfileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.').max(50).optional(),
  phoneNumber: z
    .string()
    .regex(/^\+\d{10,15}$/,{ message: 'Phone number is required in international format (e.g., +15551234567).' }),
  whatsappOptIn: z.boolean().optional(),
  avatarDataUri: z.string().optional(), // Changed from photoURL
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;

export interface UpdateUserProfileResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
  updatedUser?: { // Return updated fields to update context
    displayName?: string;
    phoneNumber?: string;
    whatsappOptIn?: boolean;
    photoURL?: string;
  };
}

export async function updateUserProfile(
  userId: string,
  data: UpdateUserProfileInput
): Promise<UpdateUserProfileResult> {
  const organizationId = await getOrganizationId(userId);
  if (!userId || !organizationId) {
    return { success: false, message: 'User or organization ID is required.' };
  }
  const validation = UpdateUserProfileSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      message: 'Invalid input.',
      errors: validation.error.issues,
    };
  }
  const { displayName, phoneNumber, whatsappOptIn, avatarDataUri } = validation.data;
  try {
    const orgUserRef = doc(db, 'organizations', organizationId, 'users', userId);
    const topLevelUserRef = doc(db, 'users', userId);

    const userSnap = await getDoc(orgUserRef);
    if (!userSnap.exists()) {
      return { success: false, message: 'User not found.' };
    }
    
    const updates: Record<string, any> = { updatedAt: serverTimestamp() };
    const topLevelUpdates: Record<string, any> = {};

    if (displayName !== undefined) {
        updates.displayName = displayName;
        topLevelUpdates.displayName = displayName;
    }
    if (phoneNumber !== undefined) {
        updates.phoneNumber = phoneNumber;
        topLevelUpdates.phoneNumber = phoneNumber;
    }
    if (whatsappOptIn !== undefined) updates.whatsappOptIn = whatsappOptIn;
    if (avatarDataUri !== undefined) {
        updates.photoURL = avatarDataUri; // Directly use the data URI
        topLevelUpdates.photoURL = avatarDataUri;
    }

    if (Object.keys(topLevelUpdates).length === 0 && Object.keys(updates).length <= 1) {
      return { success: true, message: 'No changes detected.' };
    }
    
    const batch = writeBatch(db);
    batch.update(orgUserRef, updates);
    if(Object.keys(topLevelUpdates).length > 0) {
      batch.update(topLevelUserRef, topLevelUpdates);
    }
    await batch.commit();

    return { 
      success: true, 
      message: 'Profile updated successfully.',
      updatedUser: {
        ...(updates.displayName && { displayName: updates.displayName }),
        ...(updates.phoneNumber && { phoneNumber: updates.phoneNumber }),
        ...(updates.whatsappOptIn !== undefined && { whatsappOptIn: updates.whatsappOptIn }),
        ...(updates.photoURL && { photoURL: updates.photoURL }),
      }
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update profile: ${message}` };
  }
}
