import { useState } from 'react';
import Logo from '@/components/Logo';
import PricingCards from '@/components/PricingCards';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PlanKey } from '@/lib/stripe';
import { PLANS } from '@/lib/stripe';

const SubscriptionGate = () => {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (plan: PlanKey) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch {
      toast.error('Failed to open checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <Logo size="lg" />
      <h1 className="font-display font-bold text-3xl text-foreground mt-8 mb-2">Your free trial has ended</h1>
      <p className="text-muted-foreground font-body mb-10">
        Choose a plan to keep your cases and continue where you left off.
      </p>
      <PricingCards onSelectPlan={handleSubscribe} buttonLabel="Subscribe Now" />
    </div>
  );
};

export default SubscriptionGate;
