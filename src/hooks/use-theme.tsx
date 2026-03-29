import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
});

const STORAGE_KEY = 'cp_theme';

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored === 'light' ? 'light' : 'dark';
  });

  // Apply on mount and change
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Load from Supabase on mount (firm-level preference)
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Get user's firm
        const { data: userData } = await supabase
          .from('users')
          .select('firm_id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!userData?.firm_id) return;

        const { data: firm } = await supabase
          .from('firms')
          .select('slug')
          .eq('id', userData.firm_id)
          .maybeSingle();

        // We store theme preference in a localStorage key scoped by firm
        // and sync it. The slug field doubles as theme storage for simplicity.
        // Actually, let's use a dedicated approach: store in localStorage
        // keyed by firm_id, and read from there.
        const firmThemeKey = `cp_theme_${userData.firm_id}`;
        const firmTheme = localStorage.getItem(firmThemeKey) as Theme | null;
        if (firmTheme) {
          setThemeState(firmTheme);
          localStorage.setItem(STORAGE_KEY, firmTheme);
        }
      } catch {
        // Ignore - use default
      }
    })();
  }, []);

  const setTheme = useCallback(async (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);

    // Persist to firm-scoped localStorage
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userData } = await supabase
        .from('users')
        .select('firm_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (userData?.firm_id) {
        localStorage.setItem(`cp_theme_${userData.firm_id}`, t);
      }
    } catch {
      // Ignore
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemePreference = () => useContext(ThemeContext);
