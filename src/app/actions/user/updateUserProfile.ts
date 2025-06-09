
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const UpdateUserProfileSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+\d{10,15}$/,{ message: 'Invalid phone number format. Use + followed by country code and number (e.g., +15551234567).' })
    .optional()
    .or(z.literal('')), // Allow empty string to clear phone number
  whatsappOptIn: z.boolean().optional(),
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;

export interface UpdateUserProfileResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
  updatedUser?: { // Return updated fields to update context
    phoneNumber?: string;
    whatsappOptIn?: boolean;
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
  const { phoneNumber, whatsappOptIn } = validation.data;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, message: 'User not found.' };
    }
    const updates: Record<string, any> = {};
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (whatsappOptIn !== undefined) updates.whatsappOptIn = whatsappOptIn;
    
    if (Object.keys(updates).length === 0) {
      return { success: true, message: 'No changes detected.' };
    }
    
    await updateDoc(userRef, updates);
    return { 
      success: true, 
      message: 'Profile updated successfully.',
      updatedUser: { // Return the fields that were actually updated
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(whatsappOptIn !== undefined && { whatsappOptIn }),
      }
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update profile: ${message}` };
  }
}
