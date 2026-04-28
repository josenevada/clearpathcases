import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink } from 'lucide-react';
import { getDefaultFirmSettings, type FirmSettings } from '@/lib/store';
import { fetchFirmProfileSettings, saveFirmProfileSettings, fetchCounselingSettings, saveCounselingSettings } from '@/lib/dashboard-data';
import { useAuth } from '@/lib/auth';
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

  const handleSaveCounseling = async () => {
    try {
      saveCounselingProvider(counseling);
      if (user?.firmId) {
        await saveCounselingSettings(user.firmId, counseling);
      }
      toast.success('Credit counseling provider saved.');
    } catch {
      toast.error('Failed to save credit counseling provider.');
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

      <div className="flex justify-end mt-6">
        <Button onClick={handleSave}>Save</Button>
      </div>

      {/* Credit Counseling Provider */}
      <div className="mt-8 pt-6 border-t border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <ExternalLink className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-foreground">Credit Counseling Provider</h3>
        </div>
        <p className="text-xs text-muted-foreground font-body mb-4">
          This link is shown to clients in their intake portal when they reach the Credit Counseling Certificate step. Use an EOUST-approved provider.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Provider name</Label>
            <Input
              value={counseling.providerName}
              onChange={e => setCounseling(prev => ({ ...prev, providerName: e.target.value }))}
              placeholder="e.g. Evergreen Financial Counseling"
              className="bg-input border-border rounded-[10px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Provider link</Label>
            <Input
              type="url"
              value={counseling.providerLink}
              onChange={e => setCounseling(prev => ({ ...prev, providerLink: e.target.value }))}
              placeholder="https://evergreenclass.com"
              className="bg-input border-border rounded-[10px]"
            />
          </div>
        </div>
        <div className="space-y-1.5 mb-4 max-w-sm">
          <Label className="text-sm text-muted-foreground">Attorney code (optional)</Label>
          <Input
            value={counseling.attorneyCode}
            onChange={e => setCounseling(prev => ({ ...prev, attorneyCode: e.target.value }))}
            placeholder="e.g. ATT-12345"
            className="bg-input border-border rounded-[10px]"
          />
        </div>
        <Button size="sm" onClick={handleSaveCounseling}>Save Provider</Button>
      </div>
    </div>
  );
};

export default FirmProfileTab;
