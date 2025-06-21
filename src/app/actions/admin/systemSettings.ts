'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { SystemSettings } from '@/types/database';

const SETTINGS_DOC_ID = 'companySettings'; // A fixed ID for the single settings document

interface ServerActionResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function getSystemSettings(): Promise<{ settings: SystemSettings | null; success: boolean; message?: string; error?: string }> {
  try {
    const docRef = doc(db, 'systemSettings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const settings: SystemSettings = {
        id: docSnap.id,
        companyName: data.companyName || '',
        companyLogoUrl: data.companyLogoUrl || null,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
      };
      return { settings, success: true };
    } else {
      return { settings: null, success: true, message: 'No system settings found.' };
    }
  } catch (error) {
    console.error('Error fetching system settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { settings: null, success: false, message: `Failed to fetch settings: ${errorMessage}`, error: errorMessage };
  }
}

export async function setSystemSettings(
  companyName: string,
  companyLogoUrl?: string | null
): Promise<ServerActionResult> {
  try {
    const docRef = doc(db, 'systemSettings', SETTINGS_DOC_ID);
    const settingsToSave: Partial<SystemSettings> = {
      companyName,
      updatedAt: Timestamp.now(),
    };

    if (companyLogoUrl !== undefined) {
      settingsToSave.companyLogoUrl = companyLogoUrl;
    }

    await setDoc(docRef, settingsToSave, { merge: true });

    return { success: true, message: 'System settings updated successfully.' };
  } catch (error) {
    console.error('Error setting system settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update settings: ${errorMessage}`, error: errorMessage };
  }
}
