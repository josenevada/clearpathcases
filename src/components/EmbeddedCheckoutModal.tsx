import { useCallback } from 'react';
import { X, LogOut } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import Logo from '@/components/Logo';
import { PLANS, type PlanKey } from '@/lib/stripe';

const stripePromise = loadStripe('pk_live_51TDTMGRwKiGRq1RZOkFQ1fO5gVvTkKMbGj7bMjkBJGOaXzQPpA9vNQH3FWpNLj6pJFqUOvH0YSYDBS4XkKAFpzS00fN2VLf4a');

interface EmbeddedCheckoutModalProps {
  plan: PlanKey;
  onClose?: () => void;
  allowClose?: boolean;
}

const EmbeddedCheckoutModal = ({ plan, onClose, allowClose = true }: EmbeddedCheckoutModalProps) => {
  const planInfo = PLANS[plan];

  const fetchClientSecret = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan },
    });
    if (error) throw error;
    return data.clientSecret;
  }, [plan]);

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

      {/* Checkout */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-lg mx-auto">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
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
