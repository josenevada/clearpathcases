import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription';
import { getPlanLimits } from '@/lib/plan-limits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Paintbrush, Upload, Lock } from 'lucide-react';
import { toast } from 'sonner';

const WhiteLabelTab = () => {
  const { user } = useAuth();
  const { plan } = useSubscription();
  const limits = getPlanLimits(plan);

  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#00c2a8');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load existing white-label settings from localStorage (could be DB in future)
    const stored = localStorage.getItem('clearpath_whitelabel');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.logoUrl) setLogoUrl(parsed.logoUrl);
        if (parsed.primaryColor) setPrimaryColor(parsed.primaryColor);
      } catch {}
    }
  }, []);

  if (!limits.whiteLabel) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display font-bold text-lg text-foreground mb-1">White Label</h2>
          <p className="text-sm text-muted-foreground font-body">Customize the client portal with your firm's branding.</p>
        </div>
        <div className="surface-card p-8 text-center">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground font-body mb-1">White label branding is available on the Firm plan.</p>
          <a href="/paralegal/settings/account/billing" className="text-sm text-primary hover:underline font-body">Upgrade to Firm</a>
        </div>
      </div>
    );
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `firm-logos/${user?.firmId || 'default'}/logo.${ext}`;
      const { error } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('clearpath_whitelabel', JSON.stringify({ logoUrl, primaryColor }));
    toast.success('White label settings saved');
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-lg text-foreground mb-1">White Label</h2>
        <p className="text-sm text-muted-foreground font-body">Customize the client portal with your firm's branding.</p>
      </div>

      <div className="surface-card p-5 space-y-5">
        <div>
          <Label className="font-body text-sm">Firm Logo</Label>
          <p className="text-xs text-muted-foreground font-body mb-2">
            Replaces the ClearPath logo on the client portal. Recommended: 200×60px PNG with transparent background.
          </p>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Firm logo" className="h-10 max-w-[200px] object-contain rounded border border-border p-1" />
            ) : (
              <div className="h-10 w-[200px] rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                No logo uploaded
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span>
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  {uploading ? 'Uploading…' : 'Upload Logo'}
                </span>
              </Button>
            </label>
          </div>
        </div>

        <div>
          <Label className="font-body text-sm">Primary Brand Color</Label>
          <p className="text-xs text-muted-foreground font-body mb-2">
            Used for buttons and accents in the client portal.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={e => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-border cursor-pointer"
            />
            <Input
              value={primaryColor}
              onChange={e => setPrimaryColor(e.target.value)}
              className="w-32 bg-input border-border"
              placeholder="#00c2a8"
            />
            <div className="flex items-center gap-2">
              <Paintbrush className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-body">Preview:</span>
              <div className="w-20 h-8 rounded-lg" style={{ backgroundColor: primaryColor }} />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save White Label Settings'}
        </Button>
      </div>
    </div>
  );
};

export default WhiteLabelTab;
