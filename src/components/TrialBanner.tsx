import { Button } from '@/components/ui/button';
import { useState } from 'react';
import EmbeddedCheckoutModal from '@/components/EmbeddedCheckoutModal';
import type { PlanKey } from '@/lib/stripe';

interface TrialBannerProps {
  daysLeft: number;
}

const TrialBanner = ({ daysLeft }: TrialBannerProps) => {
  const [checkoutPlan, setCheckoutPlan] = useState<PlanKey | null>(null);

  const handleAddPayment = () => {
    const plan = (sessionStorage.getItem('selected_plan') || 'starter') as PlanKey;
    setCheckoutPlan(plan);
  };

  return (
    <>
      <div className="bg-warning/10 border border-warning/20 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-warning text-sm font-body font-medium">
          Your free trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — add a payment method to keep access.
        </p>
        <Button size="sm" variant="warning" onClick={handleAddPayment}>
          Add Payment Method
        </Button>
      </div>

      {checkoutPlan && (
        <EmbeddedCheckoutModal
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          allowClose
        />
      )}
    </>
  );
};

export default TrialBanner;
