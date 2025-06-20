'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { SystemConfig } from '@/types/database';

export interface GetSystemConfigResult {
  success: boolean;
  config?: SystemConfig;
  error?: string;
}

export async function getSystemConfig(): Promise<GetSystemConfigResult> {
  try {
    const configDocRef = doc(db, 'config', 'system');
    const snap = await getDoc(configDocRef);
    if (snap.exists()) {
      return { success: true, config: { id: snap.id, ...(snap.data() as Omit<SystemConfig, 'id'>) } };
    }
    return { success: true, config: { id: configDocRef.id } };
  } catch (error) {
    console.error('Error fetching system config:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to fetch config: ${msg}` };
  }
}
