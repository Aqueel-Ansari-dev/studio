
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { differenceInHours } from 'date-fns';
import type { Organization } from '@/types/database';

export interface CheckTrialResult {
  success: boolean;
  message: string;
  expiringSoonCount: number;
  expiredCount: number;
}

/**
 * Simulates a cron job to check for trial statuses.
 * In a real application, this would be triggered by a scheduler.
 * Here, an admin can trigger it manually for demonstration.
 */
export async function checkTrialStatuses(adminId: string): Promise<CheckTrialResult> {
  // In a real multi-tenant app, you'd want to ensure this admin has super-admin rights.
  // For this prototype, any admin can run it.

  try {
    const orgsRef = collection(db, 'organizations');
    const q = query(orgsRef, where('subscriptionStatus', '==', 'trialing'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: true, message: "No organizations are currently in a trial period.", expiringSoonCount: 0, expiredCount: 0 };
    }

    let expiringSoonCount = 0;
    let expiredCount = 0;

    const now = new Date();

    snapshot.forEach(docSnap => {
      const org = docSnap.data() as Organization;
      const trialEndsAt = (org.trialEndsAt as Timestamp)?.toDate();
      if (trialEndsAt) {
        const hoursLeft = differenceInHours(trialEndsAt, now);
        
        if (hoursLeft <= 0) {
          // Trial has expired. The app logic handles downgrade on next login.
          console.log(`[TRIAL_EXPIRED] Org ${docSnap.id} (${org.name}) trial has expired. Will be downgraded on next user login.`);
          expiredCount++;
        } else if (hoursLeft <= 48) {
          // Trial is expiring soon. Simulate sending a notification.
          console.log(`[TRIAL_EXPIRY_ALERT] SIMULATING NOTIFICATION: Org ${docSnap.id} (${org.name}) trial is ending soon. Notifying owner ${org.ownerId}.`);
          // In a real app: await sendWhatsAppMessage(owner.phoneNumber, `Your FieldOps Pro trial for ${org.name} is ending in less than 2 days. Upgrade now to keep your features!`);
          expiringSoonCount++;
        }
      }
    });

    return { 
        success: true, 
        message: `Check complete. Found ${expiringSoonCount} trial(s) ending soon and ${expiredCount} expired trial(s). Check server logs for details.`, 
        expiringSoonCount, 
        expiredCount 
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Error checking trial statuses:", error);
    return { success: false, message: errorMessage, expiringSoonCount: 0, expiredCount: 0 };
  }
}
