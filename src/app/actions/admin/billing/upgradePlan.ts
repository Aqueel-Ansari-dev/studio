
'use server';

import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import type { PlanDetails } from '@/lib/plans';

export interface UpgradePlanResult {
  success: boolean;
  message: string;
}

/**
 * Simulates a plan upgrade after a successful payment.
 * In a real app, this would be triggered by a payment webhook.
 */
export async function upgradeOrganizationPlan(adminId: string, organizationId: string, newPlan: PlanDetails): Promise<UpgradePlanResult> {
    if (!adminId || !organizationId || !newPlan) {
        return { success: false, message: "Required information is missing." };
    }

    // In a real app, you'd verify the admin belongs to the organization.
    // We assume this is handled correctly by the caller for this prototype.

    try {
        const orgDocRef = doc(db, 'organizations', organizationId);
        const orgDocSnap = await getDoc(orgDocRef);
        if (!orgDocSnap.exists()) {
            return { success: false, message: "Organization not found." };
        }

        await updateDoc(orgDocRef, {
            planId: newPlan.id,
            subscriptionStatus: 'active',
            trialEndsAt: null, // Clear trial end date on upgrade
            updatedAt: serverTimestamp(),
        });

        // Simulate sending a notification to the admin
        console.log(`[PLAN_UPGRADED] SIMULATING NOTIFICATION: Org ${organizationId} has upgraded to the ${newPlan.name} plan. Notifying admin ${adminId}.`);
        // In a real app: await sendEmail(admin.email, 'Plan Upgraded!', `Your organization has successfully upgraded to the ${newPlan.name} plan.`);

        return { success: true, message: `Successfully upgraded to the ${newPlan.name} plan!` };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error(`Error upgrading plan for organization ${organizationId}:`, error);
        return { success: false, message: errorMessage };
    }
}
