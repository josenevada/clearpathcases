// Stripe product/price mapping
export const PLANS = {
  starter: {
    name: 'Starter',
    price: '$99',
    priceAmount: 9900,
    priceId: 'price_1TDTgBRwKiGRq1RZ89pOglAI',
    productId: 'prod_UBrOqV2pBAYROP',
    features: [
      'Up to 10 active cases',
      '2 staff users',
      'Full client wizard',
      'Document export',
      '14-day free trial',
    ],
  },
  professional: {
    name: 'Professional',
    price: '$249',
    priceAmount: 24900,
    priceId: 'price_1TDThARwKiGRq1RZPOq2AsKy',
    productId: 'prod_UBrP1XrK2mDP5N',
    popular: true,
    features: [
      'Unlimited active cases',
      '10 staff users',
      'SMS & email notifications',
      'Priority support',
      '14-day free trial',
    ],
  },
  firm: {
    name: 'Firm',
    price: '$499',
    priceAmount: 49900,
    priceId: 'price_1TDTp5RwKiGRq1RZaqvm4t1U',
    productId: 'prod_UBrYfLz4vub0FG',
    features: [
      'Unlimited everything',
      'White-label client portal',
      'Custom document templates',
      'Dedicated onboarding call',
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
