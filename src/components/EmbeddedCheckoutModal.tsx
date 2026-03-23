import { useState, useRef, useCallback } from 'react';
import { X, LogOut, Lock, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import Logo from '@/components/Logo';
import { PLANS, type PlanKey } from '@/lib/stripe';
import { useSubscription } from '@/lib/subscription';
import { toast } from 'sonner';

const stripePromise = loadStripe('pk_live_51TDTMGRwKiGRq1RZOkFQ1fO5gVvTkKMbGj7bMjkBJGOaXzQPpA9vNQH3FWpNLj6pJFqUOvH0YSYDBS4XkKAFpzS00fN2VLf4a');

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#f0f4f8',
      fontSize: '15px',
      fontFamily: 'DM Sans, sans-serif',
      iconColor: '#00c2a8',
      '::placeholder': { color: '#8aa3b8' },
    },
    invalid: { color: '#ff6b6b' },
  },
};

const ERROR_MAP: Record<string, string> = {
  card_declined: 'Your card was declined. Please try a different card.',
  insufficient_funds: 'Insufficient funds. Please try a different card.',
  expired_card: 'Your card has expired. Please use a different card.',
  incorrect_cvc: 'The CVC code is incorrect. Please check and try again.',
  incorrect_number: 'The card number is incorrect. Please check and try again.',
  processing_error: 'A processing error occurred. Please try again.',
};

function humanError(stripeError: any): string {
  const code = stripeError?.decline_code || stripeError?.code || '';
  return ERROR_MAP[code] || stripeError?.message || 'Payment failed. Please try again.';
}

interface CheckoutFormProps {
  plan: PlanKey;
  onSuccess: () => void;
}

const CheckoutForm = ({ plan, onSuccess }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const planInfo = PLANS[plan];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan },
      });
      if (fnError) throw new Error(fnError.message || 'Failed to create subscription');

      const { clientSecret } = data;
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (stripeError) {
        setError(humanError(stripeError));
        setLoading(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Confirm on backend
        await supabase.functions.invoke('confirm-checkout-session', {
          body: { payment_intent_id: paymentIntent.id, plan },
        });
        toast.success('You are all set — welcome to ClearPath!');
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-body mb-3">
          Payment Information
        </p>
        <div
          className="transition-colors duration-200"
          style={{
            background: '#1a2e45',
            border: focused ? '1px solid rgba(0,194,168,0.4)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '18px 16px',
          }}
        >
          <CardElement
            options={CARD_ELEMENT_OPTIONS}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={() => setError(null)}
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-[#ff6b6b] font-body">{error}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: '#00c2a8',
          color: '#0d1b2a',
          fontWeight: 700,
          borderRadius: '50px',
          padding: '16px',
          fontSize: '16px',
          fontFamily: 'DM Sans, sans-serif',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          `Subscribe to ${planInfo.name} Plan`
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground font-body flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3" />
        Secured by Stripe
      </p>
    </form>
  );
};

interface EmbeddedCheckoutModalProps {
  plan: PlanKey;
  onClose?: () => void;
  allowClose?: boolean;
}

const EmbeddedCheckoutModal = ({ plan, onClose, allowClose = true }: EmbeddedCheckoutModalProps) => {
  const planInfo = PLANS[plan];
  const { refresh } = useSubscription();

  const handleSuccess = async () => {
    await refresh();
    onClose?.();
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

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-[480px] mx-auto">
          <Elements stripe={stripePromise} options={{ fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap' }] }}>
            <CheckoutForm plan={plan} onSuccess={handleSuccess} />
          </Elements>
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
