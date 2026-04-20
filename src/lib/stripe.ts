// Stripe product/price mapping
export const PLANS = {
  starter: {
    name: 'Starter',
    price: '$199',
    priceAmount: 19900,
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
    priceId: 'price_1TNEA2RwKiGRq1RZUMm0Cksg',
    productId: 'prod_UBrP1XrK2mDP5N',
    popular: true,
    features: [
      'Up to 25 active cases',
      'Everything in Starter',
      'Plaid bank connection',
      'Document retrieval guidance',
      'Priority support',
      '14-day free trial',
    ],
  },
  firm: {
    name: 'Firm',
    price: '$699',
    priceAmount: 69900,
    priceId: 'price_1TDTp5RwKiGRq1RZaqvm4t1U',
    productId: 'prod_UDoTIzLjHd2WEo',
    features: [
      'Up to 60 active cases',
      'Everything in Professional',
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
