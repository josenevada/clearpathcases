// Stripe product/price mapping
export const PLANS = {
  starter: {
    name: 'Starter',
    price: '$199',
    priceAmount: 19900,
    priceId: 'price_1TQZZMRp5iBrDAeZWGZaVzn0',
    productId: 'prod_UPOMgVGJ0WWHTW',
    features: [
      'Up to 8 active cases',
      'Full client intake wizard',
      'Automated SMS & email reminders',
      'Basic case management',
      'Document checklist customization',
      '30-day free trial',
    ],
  },
  professional: {
    name: 'Professional',
    price: '$399',
    priceAmount: 39900,
    priceId: 'price_1TQZZSRp5iBrDAeZeSTaMzZf',
    productId: 'prod_UPOM7UCbs7EBHQ',
    popular: true,
    features: [
      'Up to 25 active cases',
      'Everything in Starter',
      'Plaid bank connection',
      'Document retrieval guidance',
      'Priority support',
      '30-day free trial',
    ],
  },
  firm: {
    name: 'Firm',
    price: '$699',
    priceAmount: 69900,
    priceId: 'price_1TQZZMRp5iBrDAeZJyIsjGnq',
    productId: 'prod_UPOMckgf9MP7nV',
    features: [
      'Up to 60 active cases',
      'Everything in Professional',
      'Dedicated onboarding call',
      'SLA support',
      '30-day free trial',
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
