import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/lib/subscription';
import { PLANS, type PlanKey } from '@/lib/stripe';
import { toast } from 'sonner';
import EmbeddedCheckoutModal from '@/components/EmbeddedCheckoutModal';
import PricingCards from '@/components/PricingCards';

const BillingTab = () => {
  const { plan, status, daysLeft, refresh } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanKey | null>(null);
  

  const currentPlan = plan ? PLANS[plan as PlanKey] : null;

  // Handle post-Stripe-checkout redirect: ?success=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      const timer = setTimeout(() => {
        refresh();
        toast.success("You're subscribed — welcome to ClearPath!");
      }, 3000);

      params.delete('success');
      params.delete('session_id');
      const newSearch = params.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', newUrl);

      return () => clearTimeout(timer);
    }
  }, [refresh]);

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

  const isTrial = status === 'trial';
  const isActive = status === 'active';
  const isInactive = !isTrial && !isActive; // trial_expired / canceled / inactive

  return (
    <>
      <div className="space-y-6">
        {/* Current plan summary */}
        <div className="surface-card p-6">
          <h3 className="font-display font-bold text-lg text-foreground mb-4">Current Plan</h3>
          <div className="flex items-center gap-3 mb-4">
            <span className="font-display font-bold text-2xl text-foreground">
              {currentPlan?.name || 'Starter'}
            </span>
            <Badge className={isTrial ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}>
              {isTrial ? `Trial — ${daysLeft} days left` : isActive ? 'Active' : status}
            </Badge>
          </div>
          {currentPlan && (
            <p className="text-sm text-muted-foreground font-body">
              {currentPlan.price}/month
            </p>
          )}
        </div>

        {/* Trial state — always show plan picker */}
        {isTrial && (
          <div className="space-y-5">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <p className="font-display font-bold text-foreground text-base">
                Your free trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}.
              </p>
              <p className="text-sm text-muted-foreground font-body mt-1">
                Choose a plan below to keep your cases and continue.
              </p>
            </div>
            <PricingCards
              onSelectPlan={(p) => setCheckoutPlan(p as PlanKey)}
              buttonLabel="Select This Plan"
              currentPlan={plan}
            />
          </div>
        )}

        {/* Active — Starter */}
        {isActive && plan === 'starter' && (
          <div className="surface-card p-6 space-y-3">
            <Button
              className="w-full sm:w-auto"
              onClick={() => setCheckoutPlan('professional')}
              disabled={loading}
            >
              Upgrade to Professional — $399/mo
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto sm:ml-3"
              onClick={() => setCheckoutPlan('firm')}
              disabled={loading}
            >
              Upgrade to Firm — $699/mo
            </Button>
            <div className="border-t border-border/40 pt-4 mt-4">
              <button
                onClick={handleManageBilling}
                disabled={loading}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
              >
                Cancel subscription →
              </button>
            </div>
          </div>
        )}

        {/* Active — Professional */}
        {isActive && plan === 'professional' && (
          <div className="surface-card p-6 space-y-3">
            <Button
              className="w-full sm:w-auto"
              onClick={() => setCheckoutPlan('firm')}
              disabled={loading}
            >
              Upgrade to Firm — $699/mo
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto sm:ml-3"
              onClick={handleManageBilling}
              disabled={loading}
            >
              Switch to Starter — $199/mo
            </Button>
            <div className="border-t border-border/40 pt-4 mt-4">
              <button
                onClick={handleManageBilling}
                disabled={loading}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
              >
                Cancel subscription →
              </button>
            </div>
          </div>
        )}

        {/* Active — Firm */}
        {isActive && plan === 'firm' && (
          <div className="surface-card p-6 space-y-3">
            <Button variant="outline" onClick={handleManageBilling} disabled={loading}>
              Downgrade Plan
            </Button>
            <div className="border-t border-border/40 pt-4 mt-4 space-y-2">
              <button
                onClick={handleManageBilling}
                disabled={loading}
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
              >
                Cancel subscription →
              </button>
              <p className="text-xs text-muted-foreground font-body">
                Plan changes take effect at the end of your current billing period.
              </p>
            </div>
          </div>
        )}

        {/* Reactivate state */}
        {isInactive && (
          <div className="space-y-5">
            <h3 className="font-display font-bold text-xl text-foreground">
              Reactivate your account
            </h3>
            <PricingCards
              onSelectPlan={(p) => setCheckoutPlan(p as PlanKey)}
              buttonLabel="Reactivate — No Card Needed"
              currentPlan={plan}
            />
          </div>
        )}
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
