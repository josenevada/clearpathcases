import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface TrialBannerProps {
  daysLeft: number;
}

const TrialBanner = ({ daysLeft }: TrialBannerProps) => {
  const [loading, setLoading] = useState(false);

  const handleAddPayment = async () => {
    const plan = sessionStorage.getItem('selected_plan') || 'starter';
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
    <div className="bg-warning/10 border border-warning/20 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-warning text-sm font-body font-medium">
        Your free trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — add a payment method to keep access.
      </p>
      <Button size="sm" variant="warning" onClick={handleAddPayment} disabled={loading}>
        {loading ? 'Opening…' : 'Add Payment Method'}
      </Button>
    </div>
  );
};

export default TrialBanner;
