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
