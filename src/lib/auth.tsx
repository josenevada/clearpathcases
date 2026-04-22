import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { hydrateDocTemplatesFromFirm } from '@/lib/store';
import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'super_admin' | 'paralegal' | 'attorney';

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  firmId: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_SETUP_ERROR_KEY = 'cp_auth_setup_error';

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const consumeAuthSetupError = () => {
  const message = sessionStorage.getItem(AUTH_SETUP_ERROR_KEY);
  if (message) sessionStorage.removeItem(AUTH_SETUP_ERROR_KEY);
  return message;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAppUser = async (authUser: User): Promise<AppUser | null> => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role as UserRole,
      firmId: data.firm_id,
    };
  };

  const clearAuthState = () => {
    setUser(null);
    setSession(null);
  };

  const hydrateSession = async (nextSession: Session | null) => {
    setSession(nextSession);

    if (!nextSession?.user) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const appUser = await fetchAppUser(nextSession.user);

      if (!appUser?.firmId) {
        sessionStorage.setItem(AUTH_SETUP_ERROR_KEY, 'Account setup incomplete. Please sign up again.');
        await supabase.auth.signOut();
        clearAuthState();
        setLoading(false);
        return;
      }

      setUser(appUser);
      // Hydrate firm-wide document templates cache from Supabase (non-blocking).
      void hydrateDocTemplatesFromFirm(appUser.firmId);
    } catch {
      sessionStorage.setItem(AUTH_SETUP_ERROR_KEY, 'Account setup incomplete. Please sign up again.');
      await supabase.auth.signOut();
      clearAuthState();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setLoading(true);
        setTimeout(() => {
          void hydrateSession(nextSession);
        }, 0);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      void hydrateSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// Client session management (sessionStorage-based — clears when tab closes)
const CLIENT_SESSION_PREFIX = 'cp_client_session_';

export interface ClientSession {
  caseCode: string;
  caseId: string;
  verified: boolean;
  verifiedAt: string;
}

export const getClientSession = (caseCode: string): ClientSession | null => {
  const raw = sessionStorage.getItem(`${CLIENT_SESSION_PREFIX}${caseCode}`);
  if (!raw) return null;
  return JSON.parse(raw);
};

export const setClientSession = (caseCode: string, caseId: string) => {
  const session: ClientSession = {
    caseCode,
    caseId,
    verified: true,
    verifiedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(`${CLIENT_SESSION_PREFIX}${caseCode}`, JSON.stringify(session));
};
