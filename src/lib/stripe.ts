// Stripe product/price mapping
export const PLANS = {
  starter: {
    name: 'Starter',
    price: '$199',
    priceAmount: 19900,
    annualPrice: '$166',
    annualPriceAmount: 16600,
    annualTotal: '$1,990/yr',
    priceId: 'price_1TDTgBRwKiGRq1RZ89pOglAI',
    productId: 'prod_UBrOqV2pBAYROP',
    features: [
      'Up to 8 active cases',
      'Full client intake wizard',
      'AI document validation',
      'Automated SMS & email reminders',
      'Basic case management',
      'Document checklist customization',
      '14-day free trial',
    ],
  },
  professional: {
    name: 'Professional',
    price: '$399',
    priceAmount: 39900,
    annualPrice: '$332',
    annualPriceAmount: 33200,
    annualTotal: '$3,990/yr',
    priceId: 'price_1TDThARwKiGRq1RZPOq2AsKy',
    productId: 'prod_UBrP1XrK2mDP5N',
    popular: true,
    features: [
      'Up to 25 active cases',
      'Everything in Starter',
      'AI form filling — all 15 federal forms',
      'Means test engine — Ch.7 eligibility auto-calculated',
      'Exemption optimizer — maximize client asset protection',
      'Court packet generation — one click',
      'Plaid bank connection',
      'Priority support',
      '14-day free trial',
    ],
  },
  firm: {
    name: 'Firm',
    price: '$699',
    priceAmount: 69900,
    annualPrice: '$582',
    annualPriceAmount: 58200,
    annualTotal: '$6,990/yr',
    priceId: 'price_1TFMr0RwKiGRq1RZqtfSMg4m',
    productId: 'prod_UDoTIzLjHd2WEo',
    features: [
      'Up to 60 active cases',
      'Everything in Professional',
      'White-label client portal',
      'Custom firm branding',
      'Dedicated onboarding call',
      'SLA support',
      '14-day free trial',
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export const getPlanByProductId = (productId: string): PlanKey | null => {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.productId === productId) return key as PlanKey;
  }
  return null;
};

// Plans that include advanced notification sequences
export const ADVANCED_NOTIFICATION_PLANS: PlanKey[] = ['professional', 'firm'];
