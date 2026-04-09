import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Building2, ClipboardList, Paintbrush, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Logo from '@/components/Logo';
import FirmProfileTab from '@/components/settings/FirmProfileTab';
import DocumentTemplatesTab from '@/components/settings/DocumentTemplatesTab';
import IntakeQuestionsTab from '@/components/settings/IntakeQuestionsTab';
import BillingTab from '@/components/settings/BillingTab';
import TeamTab from '@/components/settings/TeamTab';
import DataRetentionTab from '@/components/settings/DataRetentionTab';
import SupportTab from '@/components/settings/SupportTab';
import WhiteLabelTab from '@/components/settings/WhiteLabelTab';
import BrandingTab from '@/components/settings/BrandingTab';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/lib/subscription';
import { useThemePreference } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// ─── Settings navigation structure ──────────────────────────────────
interface NavItem {
  key: string;
  label: string;
  path: string;
}

interface NavGroup {
  key: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const HIDDEN_KEYS = new Set(['whitelabel', 'branding', 'retention']);

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'firm',
    label: 'Firm',
    icon: Building2,
    items: [
      { key: 'profile', label: 'Firm Profile', path: '/paralegal/settings/firm/profile' },
      { key: 'team', label: 'Team', path: '/paralegal/settings/firm/team' },
    ],
  },
  {
    key: 'case',
    label: 'Case Setup',
    icon: ClipboardList,
    items: [
      { key: 'templates', label: 'Document Templates', path: '/paralegal/settings/case/templates' },
      { key: 'questions', label: 'Intake Questions', path: '/paralegal/settings/case/questions' },
    ],
  },
  {
    key: 'appearance',
    label: 'Appearance',
    icon: Paintbrush,
    items: [
      { key: 'display', label: 'Display', path: '/paralegal/settings/appearance/display' },
      { key: 'whitelabel', label: 'White Label', path: '/paralegal/settings/appearance/whitelabel' },
      { key: 'branding', label: 'Branding', path: '/paralegal/settings/appearance/branding' },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    icon: Settings,
    items: [
      { key: 'billing', label: 'Billing', path: '/paralegal/settings/account/billing' },
      { key: 'retention', label: 'Data Retention', path: '/paralegal/settings/account/retention' },
      { key: 'support', label: 'Support', path: '/paralegal/settings/account/support' },
    ],
  },
];

const VISIBLE_NAV_GROUPS = NAV_GROUPS.map(g => ({
  ...g,
  items: g.items.filter(i => !HIDDEN_KEYS.has(i.key)),
})).filter(g => g.items.length > 0);

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);

// Resolve active key from URL params or search params
function resolveActiveKey(group?: string, page?: string, searchTab?: string | null): string {
  if (group && page) {
    const found = ALL_ITEMS.find(i => i.path.includes(`/${group}/${page}`));
    if (found) return found.key;
  }
  if (searchTab) {
    const found = ALL_ITEMS.find(i => i.key === searchTab);
    if (found) return found.key;
  }
  return 'profile';
}

const FirmSettings = () => {
  const navigate = useNavigate();
  const { group, page } = useParams<{ group?: string; page?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refresh } = useSubscription();
  const { theme, setTheme } = useThemePreference();
  const isMobile = useIsMobile();

  const [activeKey, setActiveKey] = useState(() =>
    resolveActiveKey(group, page, searchParams.get('tab'))
  );

  // Sync when URL params change
  useEffect(() => {
    setActiveKey(resolveActiveKey(group, page, searchParams.get('tab')));
  }, [group, page, searchParams]);

  // Handle Stripe checkout callback
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('confirm-checkout-session', {
            body: { session_id: sessionId },
          });
          if (error) throw error;
          if (data?.confirmed) {
            toast.success('You are all set — welcome to ClearPath!');
            await refresh();
          }
        } catch {
          toast.error('Failed to confirm subscription');
        } finally {
          searchParams.delete('session_id');
          searchParams.delete('success');
          setSearchParams(searchParams, { replace: true });
        }
      })();
    } else if (searchParams.get('success') === 'true') {
      toast.success('You are all set. Welcome to ClearPath!');
      searchParams.delete('success');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const handleNav = (item: NavItem) => {
    setActiveKey(item.key);
    navigate(item.path, { replace: true });
  };

  const renderContent = () => {
    switch (activeKey) {
      case 'profile': return <FirmProfileTab />;
      case 'team': return <TeamTab />;
      case 'templates': return <DocumentTemplatesTab />;
      case 'questions': return <IntakeQuestionsTab />;
      case 'display': return <DisplayPanel theme={theme} setTheme={setTheme} />;
      case 'whitelabel': return <WhiteLabelTab />;
      case 'branding': return <BrandingTab />;
      case 'billing': return <BillingTab />;
      case 'retention': return <DataRetentionTab />;
      case 'support': return <SupportTab />;
      default: return <FirmProfileTab />;
    }
  };

  const activeItem = ALL_ITEMS.find(i => i.key === activeKey);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo size="sm" />
          <span className="text-sm text-muted-foreground font-body hidden sm:block">Settings</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/paralegal')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <h1 className="font-display font-bold text-2xl text-foreground mb-6">Settings</h1>

          {isMobile ? (
            /* Mobile: dropdown selector */
            <div className="mb-6">
              <Select value={activeKey} onValueChange={(val) => {
                const item = ALL_ITEMS.find(i => i.key === val);
                if (item) handleNav(item);
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue>{activeItem?.label || 'Select'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VISIBLE_NAV_GROUPS.map(grp => (
                    <div key={grp.key}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {grp.label}
                      </div>
                      {grp.items.map(item => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex gap-8">
            {/* Desktop: vertical nav */}
            {!isMobile && (
              <nav className="w-56 flex-shrink-0 space-y-5">
                {VISIBLE_NAV_GROUPS.map(grp => {
                  const Icon = grp.icon;
                  return (
                    <div key={grp.key}>
                      <div className="flex items-center gap-2 px-3 mb-1.5">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-body">
                          {grp.label}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {grp.items.map(item => (
                          <button
                            key={item.key}
                            onClick={() => handleNav(item)}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-lg text-sm font-body transition-colors relative',
                              activeKey === item.key
                                ? 'bg-primary/10 text-primary font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-primary before:rounded-full'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </nav>
            )}

            {/* Content panel */}
            <div className="flex-1 min-w-0">
              {renderContent()}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

// ─── Display panel (extracted from inline) ───────────────────────────
const DisplayPanel = ({ theme, setTheme }: { theme: string; setTheme: (t: 'dark' | 'light') => void }) => (
  <div className="space-y-6">
    <div>
      <h2 className="font-display font-bold text-lg text-foreground mb-1">Display Preferences</h2>
      <p className="text-sm text-muted-foreground font-body">Choose how ClearPath looks for your team and clients.</p>
    </div>
    <div className="surface-card p-5 space-y-4">
      <h3 className="font-display font-bold text-foreground">Theme</h3>
      <div className="flex gap-3">
        <button
          onClick={() => { setTheme('dark'); toast.success('Switched to dark mode'); }}
          className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${
            theme === 'dark'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30'
          }`}
        >
          <Moon className="w-5 h-5" />
          <div className="text-left">
            <span className="block text-sm font-bold font-body">Dark</span>
            <span className="block text-xs text-muted-foreground">Professional, focused</span>
          </div>
        </button>
        <button
          onClick={() => { setTheme('light'); toast.success('Switched to light mode'); }}
          className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${
            theme === 'light'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30'
          }`}
        >
          <Sun className="w-5 h-5" />
          <div className="text-left">
            <span className="block text-sm font-bold font-body">Light</span>
            <span className="block text-xs text-muted-foreground">Clean, approachable</span>
          </div>
        </button>
      </div>
      <p className="text-xs text-muted-foreground font-body">
        This setting applies to both the staff dashboard and the client portal.
      </p>
    </div>
  </div>
);

export default FirmSettings;
