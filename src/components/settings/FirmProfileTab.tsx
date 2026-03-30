import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDefaultFirmSettings, type FirmSettings } from '@/lib/store';
import { fetchFirmProfileSettings, saveFirmProfileSettings } from '@/lib/dashboard-data';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const FirmProfileTab = () => {
  const { user } = useAuth();
  const [form, setForm] = useState<FirmSettings>(getDefaultFirmSettings());
  const [loading, setLoading] = useState(true);

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
      <div className="flex justify-end mt-6">
        <Button onClick={handleSave}>Save</Button>
      </div>
    </div>
  );
};

export default FirmProfileTab;
