
'use server';

// A simple type definition for a plan's features and limits.
// In a real app, this might be more complex.
export interface PlanDetails {
  id: 'free' | 'pro' | 'business' | 'enterprise';
  name: string;
  priceMonthly: number;
  priceYearly: number;
  userLimit: number;
  features: ('Tasks' | 'Attendance' | 'Expenses' | 'Payroll' | 'Invoicing' | 'Advanced Reporting' | 'Priority Support')[];
  recommended?: boolean;
  contactUs?: boolean;
}

// Single source of truth for all plan information.
export const plans: Record<string, PlanDetails> = {
  free: {
    id: 'free',
    name: "Free Trial",
    priceMonthly: 0,
    priceYearly: 0,
    userLimit: 5,
    features: ["Tasks", "Attendance", "Expenses"],
  },
  pro: {
    id: 'pro',
    name: "Pro",
    priceMonthly: 999,
    priceYearly: 9999,
    userLimit: 50,
    features: ["Tasks", "Attendance", "Expenses", "Payroll", "Invoicing"],
    recommended: true,
  },
  business: {
    id: 'business',
    name: "Business",
    priceMonthly: 2499,
    priceYearly: 24999,
    userLimit: 200,
    features: ["Tasks", "Attendance", "Expenses", "Payroll", "Invoicing", "Advanced Reporting", "Priority Support"],
  },
  enterprise: {
    id: 'enterprise',
    name: "Enterprise",
    priceMonthly: 0,
    priceYearly: 0,
    userLimit: Infinity, // Or a very high number
    features: ["Tasks", "Attendance", "Expenses", "Payroll", "Invoicing", "Advanced Reporting", "Priority Support"],
    contactUs: true,
  },
};

/**
 * Retrieves the details for a given plan ID.
 * @param planId The ID of the plan.
 * @returns The plan details, or undefined if not found.
 */
export function getPlanById(planId?: string): PlanDetails | undefined {
  if (!planId) return undefined;
  return Object.values(plans).find(p => p.id === planId);
}

/**
 * Checks if a specific feature is allowed under a given plan.
 * @param planId The organization's current plan ID.
 * @param feature The feature to check for.
 * @returns True if the feature is allowed, false otherwise.
 */
export function isFeatureAllowed(planId: string | undefined, feature: PlanDetails['features'][number]): boolean {
  const plan = getPlanById(planId);
  if (!plan) return false; // Default to not allowed if plan is unknown
  return plan.features.includes(feature);
}
