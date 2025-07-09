
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getPlans, Plan } from '@/app/actions/owner/managePlans';
import type { Organization } from '@/types/database';

export interface SubscriptionStats {
  monthly: {
    revenue: number;
    count: number;
  };
  yearly: {
    revenue: number;
    count: number;
  };
  topPayingOrgs: {
    id: string;
    name: string;
    planName: string;
    revenue: number;
  }[];
}

export interface GetSubscriptionStatsResult {
  success: boolean;
  stats?: SubscriptionStats;
  error?: string;
}

export async function getSubscriptionStats(): Promise<GetSubscriptionStatsResult> {
  try {
    const [plans, orgsSnapshot] = await Promise.all([
      getPlans(),
      getDocs(query(collection(db, 'organizations')))
    ]);

    const plansMap = new Map<string, Plan>(plans.map(p => [p.id, p]));
    const orgs = orgsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));

    const stats: SubscriptionStats = {
      monthly: { revenue: 0, count: 0 },
      yearly: { revenue: 0, count: 0 },
      topPayingOrgs: []
    };

    const allPayingOrgs: SubscriptionStats['topPayingOrgs'] = [];

    for (const org of orgs) {
      const plan = plansMap.get(org.planId || 'free');
      if (org.subscriptionStatus === 'active' && plan) {
        if (org.billingCycle === 'monthly') {
          stats.monthly.revenue += plan.priceMonthly;
          stats.monthly.count++;
          allPayingOrgs.push({ id: org.id, name: org.name, planName: plan.name, revenue: plan.priceMonthly });
        } else if (org.billingCycle === 'yearly') {
          stats.yearly.revenue += plan.priceYearly;
          stats.yearly.count++;
          // Normalize yearly revenue to monthly for sorting top orgs
          allPayingOrgs.push({ id: org.id, name: org.name, planName: plan.name, revenue: plan.priceYearly / 12 });
        }
      }
    }

    stats.topPayingOrgs = allPayingOrgs
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
      
    return { success: true, stats };

  } catch (error) {
    console.error("Error fetching subscription stats:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}
