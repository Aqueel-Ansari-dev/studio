
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const UpdateUserProfileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.').max(50).optional(),
  phoneNumber: z
    .string()
    .regex(/^\+\d{10,15}$/,{ message: 'Phone number is required in international format (e.g., +15551234567).' }),
  whatsappOptIn: z.boolean().optional(),
  photoURL: z.string().url().optional(), // Changed from avatarDataUri
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
  if (!userId) {
    return { success: false, message: 'User ID is required.' };
  }
  const validation = UpdateUserProfileSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      message: 'Invalid input.',
      errors: validation.error.issues,
    };
  }
  const { displayName, phoneNumber, whatsappOptIn, photoURL } = validation.data;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, message: 'User not found.' };
    }
    
    const updates: Record<string, any> = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (whatsappOptIn !== undefined) updates.whatsappOptIn = whatsappOptIn;
    if (photoURL !== undefined) updates.photoURL = photoURL; // Directly use the URL provided by the client

    if (Object.keys(updates).length === 0) {
      return { success: true, message: 'No changes detected.' };
    }
    
    await updateDoc(userRef, updates);
    return { 
      success: true, 
      message: 'Profile updated successfully.',
      updatedUser: { // Return the fields that were actually updated
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
