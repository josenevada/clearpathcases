import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAppUser = async (authUser: User): Promise<AppUser | null> => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', authUser.email!)
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            const appUser = await fetchAppUser(session.user);
            setUser(appUser);
            setLoading(false);
          }, 0);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchAppUser(session.user).then(appUser => {
          setUser(appUser);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
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

// Client session management (localStorage-based, no Supabase Auth)
const CLIENT_SESSION_PREFIX = 'cp_client_session_';

export interface ClientSession {
  caseCode: string;
  caseId: string;
  verified: boolean;
  verifiedAt: string;
}

export const getClientSession = (caseCode: string): ClientSession | null => {
  const raw = localStorage.getItem(`${CLIENT_SESSION_PREFIX}${caseCode}`);
  if (!raw) return null;
  const session: ClientSession = JSON.parse(raw);
  // Check if session is expired (7 days)
  const verifiedAt = new Date(session.verifiedAt).getTime();
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (now - verifiedAt > sevenDays) {
    localStorage.removeItem(`${CLIENT_SESSION_PREFIX}${caseCode}`);
    return null;
  }
  return session;
};

export const setClientSession = (caseCode: string, caseId: string) => {
  const session: ClientSession = {
    caseCode,
    caseId,
    verified: true,
    verifiedAt: new Date().toISOString(),
  };
  localStorage.setItem(`${CLIENT_SESSION_PREFIX}${caseCode}`, JSON.stringify(session));
};
