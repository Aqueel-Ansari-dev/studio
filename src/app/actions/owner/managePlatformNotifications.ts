'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp, getDocs, query, where } from 'firebase/firestore';
import type { PlatformNotification, User } from '@/types/database';
import { notifyUserByWhatsApp } from '@/lib/notify';

export async function createPlatformNotification(ownerId: string, message: string, sendWhatsApp = false, daysActive = 3): Promise<{ success: boolean; message: string }> {
  try {
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + daysActive * 24 * 60 * 60 * 1000));
    await addDoc(collection(db, 'platformNotifications'), {
      message,
      createdAt: Timestamp.now(),
      expiresAt,
      sendWhatsApp,
    });

    if (sendWhatsApp) {
      const usersSnap = await getDocs(collection(db, 'users'));
      const sendTasks: Promise<void>[] = [];
      usersSnap.forEach(docSnap => {
        const data = docSnap.data() as User;
        if (data.whatsappOptIn && data.phoneNumber && data.organizationId) {
          sendTasks.push(notifyUserByWhatsApp(docSnap.id, data.organizationId, message));
        }
      });
      await Promise.all(sendTasks);
    }

    return { success: true, message: 'Notification created.' };
  } catch (error) {
    console.error('Error creating platform notification:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getActivePlatformNotifications(): Promise<PlatformNotification[]> {
  try {
    const now = Timestamp.now();
    const q = query(collection(db, 'platformNotifications'), where('expiresAt', '>=', now));
    const snap = await getDocs(q);
    const result: PlatformNotification[] = [];
    snap.forEach(d => {
      result.push({ id: d.id, ...d.data() } as PlatformNotification);
    });
    return result;
  } catch (error) {
    console.error('Error fetching platform notifications:', error);
    return [];
  }
}
