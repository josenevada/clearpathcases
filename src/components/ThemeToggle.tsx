import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemePreference } from '@/hooks/use-theme';

const ThemeToggle = () => {
  const { theme, setTheme } = useThemePreference();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
};

export default ThemeToggle;
