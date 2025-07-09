
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { SystemSettings } from '@/types/database';
import { getOrganizationId } from '../common/getOrganizationId';

const SETTINGS_DOC_ID = 'companySettings'; // A fixed ID for the single settings document within an org

interface ServerActionResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function getSystemSettings(actorId: string): Promise<{ settings: SystemSettings | null; success: boolean; message?: string; error?: string }> {
  const organizationId = await getOrganizationId(actorId);
  if (!organizationId) {
    return { settings: null, success: false, error: 'Could not determine organization.' };
  }
  
  try {
    const docRef = doc(db, 'organizations', organizationId, 'settings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const settings: SystemSettings = {
        id: docSnap.id,
        organizationId: data.organizationId,
        companyName: data.companyName || '',
        companyLogoUrl: data.companyLogoUrl || null,
        paidLeaves: typeof data.paidLeaves === 'number' ? data.paidLeaves : 0,
        primaryColor: data.primaryColor || null,
        customHeaderTitle: data.customHeaderTitle || null,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
      };
      return { settings, success: true };
    } else {
      // Return default settings if none exist
      const defaultSettings: SystemSettings = {
        id: SETTINGS_DOC_ID,
        organizationId: organizationId,
        companyName: 'Your Company',
        paidLeaves: 14,
        primaryColor: null,
        customHeaderTitle: null,
        updatedAt: new Date().toISOString(),
      };
      return { settings: defaultSettings, success: true, message: 'No system settings found; returning defaults.' };
    }
  } catch (error) {
    console.error('Error fetching system settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { settings: null, success: false, message: `Failed to fetch settings: ${errorMessage}`, error: errorMessage };
  }
}

export async function setSystemSettings(
  adminId: string,
  settings: Partial<Omit<SystemSettings, 'id' | 'organizationId' | 'updatedAt'>>
): Promise<ServerActionResult> {
  const organizationId = await getOrganizationId(adminId);
  if (!organizationId) {
    return { success: false, error: 'Could not determine organization.' };
  }

  try {
    const docRef = doc(db, 'organizations', organizationId, 'settings', SETTINGS_DOC_ID);
    const settingsToSave: Partial<SystemSettings> & { updatedAt: any } = {
      organizationId,
      ...settings,
      updatedAt: Timestamp.now(),
    };

    await setDoc(docRef, settingsToSave, { merge: true });

    return { success: true, message: 'System settings updated successfully.' };
  } catch (error) {
    console.error('Error setting system settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update settings: ${errorMessage}`, error: errorMessage };
  }
}
