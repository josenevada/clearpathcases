import { useState } from 'react';
import { X, LogOut, Lock, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Logo from '@/components/Logo';
import { PLANS, type PlanKey } from '@/lib/stripe';
import { useSubscription } from '@/lib/subscription';
import { toast } from 'sonner';

interface EmbeddedCheckoutModalProps {
  plan: PlanKey;
  onClose?: () => void;
  allowClose?: boolean;
}

const EmbeddedCheckoutModal = ({ plan, onClose, allowClose = true }: EmbeddedCheckoutModalProps) => {
  const planInfo = PLANS[plan];
  const { refresh } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan },
      });
      if (fnError) throw new Error(fnError.message || 'Failed to create checkout session');

      const { url } = data;
      if (!url) throw new Error('No checkout URL returned');

      // Redirect to Stripe-hosted checkout
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[hsl(var(--card))]/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <div>
            <p className="font-display font-bold text-foreground text-lg">{planInfo.name} Plan</p>
            <p className="text-sm text-muted-foreground font-body">{planInfo.price}/month</p>
          </div>
        </div>
        {allowClose && onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-[480px] mx-auto space-y-6">
          {/* Plan summary */}
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-foreground">
              Subscribe to {planInfo.name}
            </h2>
            <ul className="space-y-2">
              {planInfo.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground font-body">
                  <span className="text-primary mt-0.5">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p className="text-sm text-destructive font-body">{error}</p>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold rounded-full py-4 px-6 text-base font-body hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Continue to Checkout
                <ExternalLink className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground font-body flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" />
            You'll be redirected to a secure Stripe checkout page
          </p>
        </div>
      </div>

      {/* Sign out link for forced modal */}
      {!allowClose && (
        <div className="py-4 text-center border-t border-border/30">
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default EmbeddedCheckoutModal;
