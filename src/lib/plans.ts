

// A simple type definition for a plan's features and limits.
// In a real app, this might be more complex.
import { db } from '@/lib/firebase'
import { collection, getDocs, type QueryDocumentSnapshot } from 'firebase/firestore'
import type { Plan, PlanFeature } from '@/types/database'

export type PlanDetails = Plan

let plansCache: PlanDetails[] | null = null
let cacheTimestamp: number | null = null
const CACHE_DURATION_MS = 5 * 60 * 1000

const defaultPlans: PlanDetails[] = [
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
]

export async function getPlans(): Promise<PlanDetails[]> {
  const now = Date.now()
  if (plansCache && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION_MS) {
    return plansCache
  }
  try {
    const snap = await getDocs(collection(db, 'plans'))
    if (snap.empty) {
      plansCache = defaultPlans
      cacheTimestamp = now
      return defaultPlans
    }
    const plans = snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as PlanDetails))
    plansCache = plans
    cacheTimestamp = now
    return plans
  } catch (err) {
    console.error('Error fetching plans:', err)
    return defaultPlans
  }
}

// Single source of truth for all plan information.
// Deprecated static plan map left for reference only.

/**
 * Retrieves the details for a given plan ID.
 * @param planId The ID of the plan.
 * @returns The plan details, or undefined if not found.
 */
export async function getPlanById(planId?: string): Promise<PlanDetails | undefined> {
  if (!planId) return undefined
  const plans = await getPlans()
  return plans.find(p => p.id === planId)
}

/**
 * Checks if a specific feature is allowed under a given plan.
 * @param planId The organization's current plan ID.
 * @param feature The feature to check for.
 * @returns True if the feature is allowed, false otherwise.
 */
export async function isFeatureAllowed(planId: string | undefined, feature: PlanFeature): Promise<boolean> {
  const plan = await getPlanById(planId)
  if (!plan) return false
  return plan.features.includes(feature)
}
