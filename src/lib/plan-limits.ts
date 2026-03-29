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
  // Feature gating
  courtPackets: boolean;
  aiFormFilling: boolean;
  plaidBank: boolean;
  meansTest: boolean;
  exemptionOptimizer: boolean;
  batchExport: boolean;
  eSignatures: boolean;
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
    courtPackets: false,
    aiFormFilling: false,
    plaidBank: false,
    meansTest: false,
    exemptionOptimizer: false,
    batchExport: false,
    eSignatures: false,
  },
  starter: {
    activeCases: 8,
    staffUsers: 2,
    advancedNotifications: false,
    bulkActions: false,
    whiteLabel: false,
    customTemplatesUnlimited: false,
    prioritySupport: false,
    dedicatedOnboarding: false,
    courtPackets: false,
    aiFormFilling: false,
    plaidBank: false,
    meansTest: false,
    exemptionOptimizer: false,
    batchExport: false,
    eSignatures: false,
  },
  professional: {
    activeCases: 25,
    staffUsers: 10,
    advancedNotifications: true,
    bulkActions: true,
    whiteLabel: false,
    customTemplatesUnlimited: false,
    prioritySupport: true,
    dedicatedOnboarding: false,
    courtPackets: true,
    aiFormFilling: true,
    plaidBank: true,
    meansTest: true,
    exemptionOptimizer: true,
    batchExport: true,
    eSignatures: true,
  },
  firm: {
    activeCases: 60,
    staffUsers: Infinity,
    advancedNotifications: true,
    bulkActions: true,
    whiteLabel: true,
    customTemplatesUnlimited: true,
    prioritySupport: true,
    dedicatedOnboarding: true,
    courtPackets: true,
    aiFormFilling: true,
    plaidBank: true,
    meansTest: true,
    exemptionOptimizer: true,
    batchExport: true,
    eSignatures: true,
  },
};

export const PLAN_DISPLAY_NAMES: Record<PlanName, string> = {
  solo: 'Solo',
  starter: 'Starter',
  professional: 'Professional',
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

/** Feature gating info for upgrade cards */
export const FEATURE_GATE_INFO: Record<string, { name: string; minTier: string; roi: string }> = {
  'form-data': { name: 'AI Form Filling', minTier: 'Professional', roi: 'Saves 3-4 hours of paralegal time per case' },
  'means-test': { name: 'Means Test Engine', minTier: 'Professional', roi: 'Eliminates 45 minutes of manual calculation per case' },
  'exemptions': { name: 'Exemption Optimizer', minTier: 'Professional', roi: 'Protects clients from missed exemptions worth thousands' },
  'packet': { name: 'Court Packet Generation', minTier: 'Professional', roi: 'Replaces 1-2 hours of manual packet assembly per case' },
  'plaid': { name: 'Plaid Bank Connection', minTier: 'Professional', roi: 'Bank statements delivered instantly — no scanning required' },
  'white-label': { name: 'White Label Portal', minTier: 'Firm', roi: 'Your brand on every client touchpoint' },
  'signatures': { name: 'E-Signatures', minTier: 'Professional', roi: 'Eliminates DocuSign — clients sign directly in ClearPath' },
};
