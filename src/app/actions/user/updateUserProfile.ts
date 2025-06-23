
'use server';

import { z } from 'zod';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

const UpdateUserProfileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.').max(50).optional(),
  phoneNumber: z
    .string()
    .regex(/^\+\d{10,15}$/,{ message: 'Invalid phone number format. Use + followed by country code and number (e.g., +15551234567).' })
    .optional()
    .or(z.literal('')), // Allow empty string to clear phone number
  whatsappOptIn: z.boolean().optional(),
  avatarDataUri: z.string().optional(),
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
  const { displayName, phoneNumber, whatsappOptIn, avatarDataUri } = validation.data;
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
    
    if (avatarDataUri) {
      try {
        const storageRef = ref(storage, `avatars/${userId}`);
        const uploadResult = await uploadString(storageRef, avatarDataUri, 'data_url');
        const photoURL = await getDownloadURL(uploadResult.ref);
        updates.photoURL = photoURL;
      } catch (storageError: any) {
          console.error("Error uploading avatar to Firebase Storage:", storageError);
          
          let errorMessage = "Failed to upload new profile picture.";
          if (storageError.code === 'storage/unauthorized') {
            errorMessage = "Permission denied. Please check your Firebase Storage security rules to allow writes to the 'avatars/' path for authenticated users.";
          } else if (storageError.code) {
            errorMessage = `Storage error: ${storageError.code}`;
          }

          return { success: false, message: errorMessage };
      }
    }


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
