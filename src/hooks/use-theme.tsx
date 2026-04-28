import { createContext, useContext, type ReactNode } from 'react';

// Theme system removed — app is permanently dark mode.
// These exports remain as no-op shims for any lingering imports.

type Theme = 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => (
  <ThemeContext.Provider value={{ theme: 'dark', setTheme: () => {} }}>
    {children}
  </ThemeContext.Provider>
);

export const useThemePreference = () => useContext(ThemeContext);
