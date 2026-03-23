import { useState } from 'react';
import Logo from '@/components/Logo';
import PricingCards from '@/components/PricingCards';
import EmbeddedCheckoutModal from '@/components/EmbeddedCheckoutModal';
import type { PlanKey } from '@/lib/stripe';

const SubscriptionGate = () => {
  const [checkoutPlan, setCheckoutPlan] = useState<PlanKey | null>(null);

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <Logo size="lg" />
        <h1 className="font-display font-bold text-3xl text-foreground mt-8 mb-2">Your free trial has ended</h1>
        <p className="text-muted-foreground font-body mb-10">
          Choose a plan to keep your cases and continue where you left off.
        </p>
        <PricingCards onSelectPlan={(plan) => setCheckoutPlan(plan)} buttonLabel="Subscribe Now" />
      </div>

      {checkoutPlan && (
        <EmbeddedCheckoutModal
          plan={checkoutPlan}
          allowClose={false}
        />
      )}
    </>
  );
};

export default SubscriptionGate;
