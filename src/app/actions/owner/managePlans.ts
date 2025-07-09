
'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import type { Plan, PlanFeature } from '@/types/database';

let serverPlansCache: Plan[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Default plans to seed the database on first run
const defaultPlans: Plan[] = [
  {
    id: 'free',
    name: 'Free Trial',
    priceMonthly: 0,
    priceYearly: 0,
    userLimit: 5,
    features: ['Tasks', 'Attendance', 'Expenses'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 999,
    priceYearly: 9999,
    userLimit: 50,
    features: ['Tasks', 'Attendance', 'Expenses', 'Payroll', 'Invoicing'],
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 2499,
    priceYearly: 24999,
    userLimit: 200,
    features: ['Tasks', 'Attendance', 'Expenses', 'Payroll', 'Invoicing', 'Advanced Reporting', 'Priority Support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 0,
    priceYearly: 0,
    userLimit: Infinity,
    features: ['Tasks', 'Attendance', 'Expenses', 'Payroll', 'Invoicing', 'Advanced Reporting', 'Priority Support'],
    contactUs: true,
  },
];

async function seedDefaultPlans(): Promise<Plan[]> {
    const batch = writeBatch(db);
    const plansCollectionRef = collection(db, 'plans');
    defaultPlans.forEach(plan => {
        const planRef = doc(plansCollectionRef, plan.id);
        batch.set(planRef, plan);
    });
    await batch.commit();
    console.log('[OwnerAction] Seeded default plans into Firestore.');
    return defaultPlans;
}

/**
 * Fetches all subscription plans from Firestore.
 * Caches the result in memory for a short duration.
 * Seeds the database with default plans if the collection is empty.
 * @returns An array of all available plans.
 */
export async function getPlans(): Promise<Plan[]> {
  const now = Date.now();
  if (serverPlansCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION_MS)) {
    return serverPlansCache;
  }

  try {
    const plansCollectionRef = collection(db, 'plans');
    const snapshot = await getDocs(plansCollectionRef);

    if (snapshot.empty) {
        // First time running, seed the plans
        const seededPlans = await seedDefaultPlans();
        serverPlansCache = seededPlans;
        cacheTimestamp = now;
        return seededPlans;
    }

    const plans = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }) as Plan);
    serverPlansCache = plans;
    cacheTimestamp = now;
    return plans;
  } catch (error) {
    console.error("Error fetching plans from Firestore:", error);
    // Fallback to default plans in case of error, but don't cache
    return defaultPlans;
  }
}

/**
 * Retrieves the details for a given plan ID.
 * @param planId The ID of the plan.
 * @returns The plan details, or undefined if not found.
 */
export async function getPlanById(planId?: string): Promise<Plan | undefined> {
  if (!planId) return undefined;
  const plans = await getPlans();
  return plans.find(p => p.id === planId);
}

/**
 * Checks if a specific feature is allowed under a given plan.
 * @param planId The organization's current plan ID.
 * @param feature The feature to check for.
 * @returns True if the feature is allowed, false otherwise.
 */
export async function isFeatureAllowed(planId: string | undefined, feature: PlanFeature): Promise<boolean> {
  const plan = await getPlanById(planId);
  if (!plan) return false;
  return plan.features.includes(feature);
}

/**
 * Updates a subscription plan in Firestore. Only callable by an owner.
 * Note: No explicit owner check here, should be handled by route/page security.
 */
export async function updatePlan(planId: string, data: Partial<Omit<Plan, 'id'>>): Promise<{ success: boolean; message: string }> {
  try {
    const planRef = doc(db, 'plans', planId);
    await setDoc(planRef, data, { merge: true });
    // Invalidate cache
    serverPlansCache = null;
    cacheTimestamp = null;
    return { success: true, message: `Plan '${planId}' updated successfully.` };
  } catch (error) {
    console.error(`Error updating plan ${planId}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, message };
  }
}
