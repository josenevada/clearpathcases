import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionState {
  subscribed: boolean;
  status: string; // trial, active, trial_expired, canceled, inactive
  plan: string | null;
  daysLeft: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState>({
  subscribed: true,
  status: 'loading',
  plan: null,
  daysLeft: null,
  loading: true,
  refresh: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<Omit<SubscriptionState, 'refresh' | 'loading'>>({
    subscribed: true,
    status: 'loading',
    plan: null,
    daysLeft: null,
  });
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState({ subscribed: true, status: 'no_session', plan: null, daysLeft: null });
        setLoading(false);
        return;
      }

      // Try reading directly from the firms table first (fast, no edge function needed)
      const userEmail = session.user.email;
      if (userEmail) {
        const { data: userRow } = await supabase
          .from('users')
          .select('firm_id')
          .eq('email', userEmail)
          .maybeSingle();

        if (userRow?.firm_id) {
          const { data: firm } = await supabase
            .from('firms')
            .select('subscription_status, trial_ends_at, plan_name')
            .eq('id', userRow.firm_id)
            .maybeSingle();

          if (firm) {
            // Trial check
            if (firm.subscription_status === 'trial') {
              const trialEnd = firm.trial_ends_at ? new Date(firm.trial_ends_at) : null;
              const now = new Date();
              if (trialEnd && trialEnd > now) {
                const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                setState({
                  subscribed: true,
                  status: 'trial',
                  plan: firm.plan_name || 'solo',
                  daysLeft,
                });
                setLoading(false);
                return;
              }
              // Trial expired
              setState({ subscribed: false, status: 'trial_expired', plan: firm.plan_name, daysLeft: null });
              setLoading(false);
              return;
            }

            if (firm.subscription_status === 'active') {
              setState({
                subscribed: true,
                status: 'active',
                plan: firm.plan_name || 'solo',
                daysLeft: null,
              });
              setLoading(false);
              return;
            }

            // Inactive / canceled
            setState({
              subscribed: false,
              status: firm.subscription_status || 'inactive',
              plan: firm.plan_name,
              daysLeft: null,
            });
            setLoading(false);
            return;
          }
        }
      }

      // Fallback: call edge function
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;

      setState({
        subscribed: data.subscribed ?? false,
        status: data.status ?? 'inactive',
        plan: data.plan ?? null,
        daysLeft: data.days_left ?? null,
      });
    } catch {
      // Default to subscribed on error to avoid blocking
      setState({ subscribed: true, status: 'error', plan: null, daysLeft: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  return (
    <SubscriptionContext.Provider value={{ ...state, loading, refresh: checkSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
