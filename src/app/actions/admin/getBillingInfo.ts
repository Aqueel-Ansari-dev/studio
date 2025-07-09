
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getOrganizationId } from '../common/getOrganizationId';
import { countUsers } from './countUsers';
import { getPlanById, type PlanDetails } from '@/lib/plans';
import type { Organization } from '@/types/database';

export interface BillingInfo {
    plan: PlanDetails | null;
    subscriptionStatus: Organization['subscriptionStatus'];
    userCount: number;
    userLimit: number;
}

export interface GetBillingInfoResult {
    success: boolean;
    info?: BillingInfo;
    error?: string;
}

export async function getBillingInfo(adminId: string): Promise<GetBillingInfoResult> {
    const organizationId = await getOrganizationId(adminId);
    if (!organizationId) {
        return { success: false, error: "Could not determine organization." };
    }

    try {
        const orgDocRef = doc(db, 'organizations', organizationId);
        const [orgDocSnap, userCountResult] = await Promise.all([
            getDoc(orgDocRef),
            countUsers(adminId, {})
        ]);

        if (!orgDocSnap.exists()) {
            return { success: false, error: "Organization data not found." };
        }

        const orgData = orgDocSnap.data() as Organization;
        const plan = getPlanById(orgData.planId);

        return {
            success: true,
            info: {
                plan: plan || null,
                subscriptionStatus: orgData.subscriptionStatus || 'active',
                userCount: userCountResult.success ? userCountResult.count ?? 0 : 0,
                userLimit: plan?.userLimit || 0,
            }
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        console.error("Error fetching billing info:", error);
        return { success: false, error: message };
    }
}
