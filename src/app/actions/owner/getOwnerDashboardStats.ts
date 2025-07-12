
'use server';

import { db } from '@/lib/firebase';
import { collection, collectionGroup, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { UserRole } from '@/types/database';
import { getPlans } from '@/lib/plans';
import { subDays } from 'date-fns';

export interface OwnerDashboardStats {
  totalOrgs: number;
  newOrgsLastWeek: number;
  totalUsers: number;
  newUsersLastWeek: number;
  weeklyGrowthPercentage: number;
  userRoleCounts: {
    admin: number;
    supervisor: number;
    employee: number;
  };
  mrr: number;
  activity: {
    date: string;
    signIns: number;
    tasksCreated: number;
  }[];
}

export interface GetOwnerDashboardStatsResult {
  success: boolean;
  stats?: OwnerDashboardStats;
  error?: string;
}

export async function getOwnerDashboardStats(): Promise<GetOwnerDashboardStatsResult> {
  try {
    const sevenDaysAgo = Timestamp.fromDate(subDays(new Date(), 7));

    // --- Organization Stats ---
    const orgsRef = collection(db, 'organizations');
    const orgsSnapshot = await getDocs(orgsRef);
    const totalOrgs = orgsSnapshot.size;
    
    const newOrgsQuery = query(orgsRef, where('createdAt', '>=', sevenDaysAgo));
    const newOrgsSnapshot = await getDocs(newOrgsQuery);
    const newOrgsLastWeek = newOrgsSnapshot.size;

    // --- User Stats ---
    const usersRef = collectionGroup(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const totalUsers = usersSnapshot.size;
    
    const newUsersQuery = query(usersRef, where('createdAt', '>=', sevenDaysAgo));
    const newUsersSnapshot = await getDocs(newUsersQuery);
    const newUsersLastWeek = newUsersSnapshot.size;

    const previousTotalUsers = totalUsers - newUsersLastWeek;
    const weeklyGrowthPercentage = previousTotalUsers > 0 
      ? parseFloat(((newUsersLastWeek / previousTotalUsers) * 100).toFixed(1))
      : (newUsersLastWeek > 0 ? 100 : 0);

    const userRoleCounts: OwnerDashboardStats['userRoleCounts'] = {
      admin: 0,
      supervisor: 0,
      employee: 0,
    };
    usersSnapshot.forEach(doc => {
      const role = doc.data().role as UserRole;
      if (role && userRoleCounts.hasOwnProperty(role)) {
        userRoleCounts[role]++;
      }
    });
    
    // --- Financials (MRR Simulation) ---
    const plans = await getPlans();
    let mrr = 0;
    orgsSnapshot.forEach(orgDoc => {
        const planId = orgDoc.data().planId;
        const plan = plans.find(p => p.id === planId);
        if(plan && orgDoc.data().subscriptionStatus === 'active') {
            mrr += plan.priceMonthly;
        }
    });


    // --- Activity (Simulated) ---
    // In a real app, this would come from an analytics service or aggregated logs.
    const activity = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), i);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        signIns: 500 + Math.floor(Math.random() * 200) - (i * 20),
        tasksCreated: 1200 + Math.floor(Math.random() * 500) - (i * 50),
      };
    }).reverse();

    const stats: OwnerDashboardStats = {
      totalOrgs,
      newOrgsLastWeek,
      totalUsers,
      newUsersLastWeek,
      weeklyGrowthPercentage,
      userRoleCounts,
      mrr,
      activity,
    };

    return { success: true, stats };
  } catch (error) {
    console.error("Error fetching owner dashboard stats:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    if (errorMessage.includes('requires an index')) {
        return { success: false, error: `Firestore query requires an index. Please check your Firebase console for a link to create it. Details: ${errorMessage}` };
    }
    return { success: false, error: errorMessage };
  }
}
