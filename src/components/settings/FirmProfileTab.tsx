import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sun, Moon, ExternalLink } from 'lucide-react';
import { getDefaultFirmSettings, type FirmSettings } from '@/lib/store';
import { fetchFirmProfileSettings, saveFirmProfileSettings, fetchCounselingSettings, saveCounselingSettings } from '@/lib/dashboard-data';
import { useAuth } from '@/lib/auth';
import { useThemePreference } from '@/hooks/use-theme';
import { toast } from 'sonner';

const COUNSELING_KEY = 'cp_counseling_provider';

interface CounselingProvider {
  providerName: string;
  providerLink: string;
  attorneyCode: string;
}

const loadCounseling = (): CounselingProvider => {
  try {
    const raw = localStorage.getItem(COUNSELING_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { providerName: '', providerLink: '', attorneyCode: '' };
};

const saveCounselingProvider = (data: CounselingProvider) => {
  localStorage.setItem(COUNSELING_KEY, JSON.stringify(data));
};

const FirmProfileTab = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useThemePreference();
  const [form, setForm] = useState<FirmSettings>(getDefaultFirmSettings());
  const [loading, setLoading] = useState(true);
  const [counseling, setCounseling] = useState<CounselingProvider>(loadCounseling);

  useEffect(() => {
    const loadPersistedCounseling = async () => {
      if (!user?.firmId) return;
      try {
        setCounseling(await fetchCounselingSettings(user.firmId));
      } catch {
        toast.error('Failed to load credit counseling settings.');
      }
    };
    void loadPersistedCounseling();
  }, [user?.firmId]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.firmId) {
        setLoading(false);
        return;
      }

      try {
        setForm(await fetchFirmProfileSettings(user.firmId));
      } catch {
        toast.error('Failed to load firm profile.');
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, [user?.firmId]);

  const handleSave = async () => {
    if (!user?.firmId) return;

    try {
      await saveFirmProfileSettings(user.firmId, form);
      toast.success('Firm profile saved.');
    } catch {
      toast.error('Failed to save firm profile.');
    }
  };

  const update = (field: keyof FirmSettings, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground font-body animate-pulse">Loading firm profile…</div>;
  }

  return (
    <div className="surface-card p-6">
      <h2 className="font-display font-bold text-lg text-foreground mb-4">Firm Profile</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm">Firm Name</Label>
          <Input value={form.firmName} onChange={e => update('firmName', e.target.value)} className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Primary Contact Name</Label>
          <Input value={form.primaryContactName} onChange={e => update('primaryContactName', e.target.value)} className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Primary Contact Email</Label>
          <Input value={form.primaryContactEmail} onChange={e => update('primaryContactEmail', e.target.value)} type="email" className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Phone Number</Label>
          <Input value={form.phone} onChange={e => update('phone', e.target.value)} className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Default Assigned Paralegal</Label>
          <Input value={form.defaultParalegal} onChange={e => update('defaultParalegal', e.target.value)} className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm">Default Assigned Attorney</Label>
          <Input value={form.defaultAttorney} onChange={e => update('defaultAttorney', e.target.value)} className="mt-1 bg-input border-border rounded-[10px]" />
        </div>
      </div>

      {/* Inline theme toggle — replaces the standalone Display settings page */}
      <div className="mt-6 pt-6 border-t border-border/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Label className="text-foreground text-sm font-medium">Interface theme</Label>
            <p className="text-xs text-muted-foreground font-body mt-0.5">Applies to staff dashboard and the client portal.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setTheme('dark'); toast.success('Switched to dark mode'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-body transition-colors ${
                theme === 'dark'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/30'
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Dark
            </button>
            <button
              type="button"
              onClick={() => { setTheme('light'); toast.success('Switched to light mode'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-body transition-colors ${
                theme === 'light'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/30'
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Light
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button onClick={handleSave}>Save</Button>
      </div>
    </div>
  );
};

export default FirmProfileTab;
