// ─── Subscription Plan Limits ─────────────────────────────────────────
export type PlanName = 'solo' | 'starter' | 'professional' | 'firm';

export interface PlanLimits {
  activeCases: number;
  staffUsers: number;
  advancedNotifications: boolean;
  bulkActions: boolean;
  whiteLabel: boolean;
  customTemplatesUnlimited: boolean;
  prioritySupport: boolean;
  dedicatedOnboarding: boolean;
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  solo: {
    activeCases: 3,
    staffUsers: 1,
    advancedNotifications: false,
    bulkActions: false,
    whiteLabel: false,
    customTemplatesUnlimited: false,
    prioritySupport: false,
    dedicatedOnboarding: false,
  },
  starter: {
    activeCases: 10,
    staffUsers: 2,
    advancedNotifications: false,
    bulkActions: false,
    whiteLabel: false,
    customTemplatesUnlimited: false,
    prioritySupport: false,
    dedicatedOnboarding: false,
  },
  professional: {
    activeCases: Infinity,
    staffUsers: 10,
    advancedNotifications: true,
    bulkActions: true,
    whiteLabel: false,
    customTemplatesUnlimited: false,
    prioritySupport: true,
    dedicatedOnboarding: false,
  },
  firm: {
    activeCases: Infinity,
    staffUsers: Infinity,
    advancedNotifications: true,
    bulkActions: true,
    whiteLabel: true,
    customTemplatesUnlimited: true,
    prioritySupport: true,
    dedicatedOnboarding: true,
  },
};

export const PLAN_DISPLAY_NAMES: Record<PlanName, string> = {
  solo: 'Solo',
  starter: 'Starter',
  professional: 'Pro',
  firm: 'Firm',
};

export function getPlanLimits(plan: string | null): PlanLimits {
  const key = (plan || 'solo').toLowerCase() as PlanName;
  return PLAN_LIMITS[key] || PLAN_LIMITS.solo;
}

export function getPlanDisplayName(plan: string | null): string {
  const key = (plan || 'solo').toLowerCase() as PlanName;
  return PLAN_DISPLAY_NAMES[key] || 'Solo';
}
