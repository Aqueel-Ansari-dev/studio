'use server';

import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';

export const UpdateSystemConfigSchema = z.object({
  mapboxApiKey: z.string().optional(),
  openAiApiKey: z.string().optional(),
});

export type UpdateSystemConfigInput = z.infer<typeof UpdateSystemConfigSchema>;

export interface UpdateSystemConfigResult {
  success: boolean;
  message: string;
  errors?: z.ZodIssue[];
}

export async function updateSystemConfig(
  input: UpdateSystemConfigInput
): Promise<UpdateSystemConfigResult> {
  const parsed = UpdateSystemConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid input.',
      errors: parsed.error.issues,
    };
  }

  try {
    const configDocRef = doc(db, 'config', 'system');
    await setDoc(
      configDocRef,
      { ...parsed.data, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return { success: true, message: 'Configuration updated successfully.' };
  } catch (error) {
    console.error('Error updating system config:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Failed to update config: ${msg}` };
  }
}
