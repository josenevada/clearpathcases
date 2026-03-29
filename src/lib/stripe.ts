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
    price: '$599',
    priceAmount: 59900,
    annualPrice: '$499',
    annualPriceAmount: 49900,
    annualTotal: '$5,990/yr',
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
    price: '$1,499',
    priceAmount: 149900,
    annualPrice: '$1,249',
    annualPriceAmount: 124900,
    annualTotal: '$14,990/yr',
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
