// Stripe product/price mapping
export const PLANS = {
  solo: {
    name: 'Solo',
    price: '$49',
    priceAmount: 4900,
    priceId: 'price_1TFMUTRwKiGRq1RZ6uwU3yJo',
    productId: 'prod_UDo6LiCUUbiNKf',
    features: [
      'Up to 3 active cases',
      '1 staff user',
      'Full client wizard',
      'AI document validation',
      'Basic SMS & email notifications',
      'Document export',
      '14-day free trial',
    ],
  },
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
      'AI document validation',
      'Basic SMS & email notifications',
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
      'AI document validation',
      'Advanced automated notification sequences',
      'Bulk document actions',
      'Priority support',
      '14-day free trial',
    ],
  },
  firm: {
    name: 'Firm',
    price: '$799',
    priceAmount: 79900,
    priceId: 'price_1TFMr0RwKiGRq1RZqtfSMg4m',
    productId: 'prod_UDoTIzLjHd2WEo',
    features: [
      'Everything in Professional',
      'White-label client portal',
      "Your firm's logo and branding on the client portal — clients never see the ClearPath name",
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

// Plans that include advanced notification sequences
export const ADVANCED_NOTIFICATION_PLANS: PlanKey[] = ['professional', 'firm'];
