'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { PlatformSettings } from '@/types/database';

const SETTINGS_DOC_ID = 'platformSettings';

export async function getPlatformSettings(): Promise<{ settings: PlatformSettings | null; success: boolean; error?: string }> {
  try {
    const ref = doc(db, SETTINGS_DOC_ID, 'settings');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const settings: PlatformSettings = {
        id: snap.id,
        platformLogoUrl: data.platformLogoUrl || null,
        termsUrl: data.termsUrl || null,
        whatsappApiKey: data.whatsappApiKey || null,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
      };
      return { settings, success: true };
    }
    return { settings: null, success: true };
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { settings: null, success: false, error: msg };
  }
}

export async function setPlatformSettings(ownerId: string, data: Partial<Omit<PlatformSettings,'id'|'updatedAt'>>): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const ref = doc(db, SETTINGS_DOC_ID, 'settings');
    const saveData = { ...data, updatedAt: Timestamp.now() } as any;
    await setDoc(ref, saveData, { merge: true });
    return { success: true, message: 'Platform settings updated.' };
  } catch (error) {
    console.error('Error saving platform settings:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: msg, error: msg };
  }
}
