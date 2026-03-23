import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/lib/subscription';
import { PLANS, type PlanKey } from '@/lib/stripe';
import { toast } from 'sonner';
import EmbeddedCheckoutModal from '@/components/EmbeddedCheckoutModal';

const BillingTab = () => {
  const { plan, status, daysLeft } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanKey | null>(null);

  const currentPlan = plan ? PLANS[plan as PlanKey] : null;

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch {
      toast.error('Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="surface-card p-6">
          <h3 className="font-display font-bold text-lg text-foreground mb-4">Current Plan</h3>
          <div className="flex items-center gap-3 mb-4">
            <span className="font-display font-bold text-2xl text-foreground">
              {currentPlan?.name || 'Starter'}
            </span>
            <Badge className={status === 'trial' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}>
              {status === 'trial' ? `Trial — ${daysLeft} days left` : status === 'active' ? 'Active' : status}
            </Badge>
          </div>
          {currentPlan && (
            <p className="text-sm text-muted-foreground font-body mb-4">
              {currentPlan.price}/month
            </p>
          )}
          <div className="flex gap-3">
            {status === 'active' && (
              <Button variant="outline" onClick={handleManageBilling} disabled={loading}>
                Manage Billing
              </Button>
            )}
            {plan !== 'firm' && (
              <Button
                onClick={() => setCheckoutPlan(plan === 'starter' ? 'professional' : 'firm')}
                disabled={loading}
              >
                Upgrade Plan
              </Button>
            )}
          </div>
        </div>
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

export default BillingTab;
