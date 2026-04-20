import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Lock, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/lib/subscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ACCENT_SWATCHES = [
  { value: '#00C2A8', name: 'Teal' },
  { value: '#2563EB', name: 'Blue' },
  { value: '#7C3AED', name: 'Purple' },
  { value: '#DC2626', name: 'Red' },
  { value: '#D97706', name: 'Amber' },
  { value: '#059669', name: 'Green' },
];

const DEFAULT_ACCENT = '#00C2A8';

interface BrandingState {
  logoUrl: string | null;
  displayName: string;
  accentColor: string;
}

const BrandingTab = () => {
  const { user } = useAuth();
  const { plan, loading: planLoading } = useSubscription();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<BrandingState>({
    logoUrl: null,
    displayName: '',
    accentColor: DEFAULT_ACCENT,
  });
  const [savedDisplayName, setSavedDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const isFirmPlan = plan === 'firm';

  // Load existing branding
  useEffect(() => {
    if (!user?.firmId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('firms')
        .select('name, branding_logo_url, branding_display_name, branding_accent_color')
        .eq('id', user.firmId)
        .maybeSingle();

      if (cancelled || !data) {
        setLoading(false);
        return;
      }

      const display = (data as any).branding_display_name || data.name || '';
      setState({
        logoUrl: (data as any).branding_logo_url || null,
        displayName: display,
        accentColor: (data as any).branding_accent_color || DEFAULT_ACCENT,
      });
      setSavedDisplayName(display);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.firmId]);

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.firmId) return;

    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      toast.error('Logo must be PNG, JPEG, or SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.firmId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('firm-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('firm-assets').getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('firms')
        .update({ branding_logo_url: publicUrl } as any)
        .eq('id', user.firmId);
      if (updateError) throw updateError;

      setState(prev => ({ ...prev, logoUrl: publicUrl }));
      toast.success('Logo updated');
    } catch (err: any) {
      console.error('Logo upload error:', err);
      toast.error('Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user?.firmId) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('firms')
        .update({ branding_display_name: state.displayName.trim() } as any)
        .eq('id', user.firmId);
      if (error) throw error;
      setSavedDisplayName(state.displayName.trim());
      toast.success('Display name updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save display name.');
    } finally {
      setSavingName(false);
    }
  };

  const persistAccent = (hex: string) => {
    if (!user?.firmId) return;
    if (accentDebounceRef.current) clearTimeout(accentDebounceRef.current);
    accentDebounceRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('firms')
        .update({ branding_accent_color: hex } as any)
        .eq('id', user.firmId);
      if (!error) toast.success('Brand color updated');
      else toast.error('Failed to save brand color.');
    }, 800);
  };

  const handleSwatch = (hex: string) => {
    setState(prev => ({ ...prev, accentColor: hex }));
    persistAccent(hex);
  };

  const handleHexChange = (val: string) => {
    setState(prev => ({ ...prev, accentColor: val }));
    if (/^#[0-9a-fA-F]{6}$/.test(val)) persistAccent(val);
  };

  // ── Locked state (non-Firm plans) ──
  if (!planLoading && !isFirmPlan) {
    return (
      <div className="max-w-md mx-auto mt-12 surface-card p-8 text-center rounded-xl">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
        <h2 className="font-display font-bold text-lg text-foreground mb-2">Available on Firm plan</h2>
        <p className="text-sm text-muted-foreground font-body mb-6 leading-relaxed">
          Upgrade to Firm to white-label the client portal with your firm's logo and colors.
        </p>
        <Button onClick={() => navigate('/paralegal/settings?tab=billing')}>
          Upgrade to Firm
        </Button>
      </div>
    );
  }

  if (loading || planLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h2 className="font-display font-bold text-lg text-foreground">Firm Branding</h2>
            <span className="bg-primary/10 text-primary text-[11px] font-semibold px-3 py-1 rounded-full">
              Firm plan only
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-body max-w-xl">
            Customize how your clients experience ClearPath. Your logo and colors replace ClearPath defaults in the client portal.
          </p>
        </div>
      </div>

      {/* Logo */}
      <div className="surface-card p-6 space-y-4">
        <div>
          <label className="text-sm font-bold font-body text-foreground">Firm Logo</label>
          <p className="text-xs text-muted-foreground font-body mt-1">PNG, JPEG, or SVG. Up to 2MB.</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="w-32 h-32 rounded-xl bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
            {state.logoUrl ? (
              <img src={state.logoUrl} alt="Firm logo" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center">
                <Building className="w-7 h-7 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-[11px] text-muted-foreground font-body px-2 leading-tight">No logo uploaded</p>
              </div>
            )}
          </div>
          <div>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} variant="outline">
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Upload Logo</>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={handleLogoSelect}
            />
          </div>
        </div>
      </div>

      {/* Display name */}
      <div className="surface-card p-6 space-y-4">
        <div>
          <label className="text-sm font-bold font-body text-foreground">Client Portal Display Name</label>
          <p className="text-xs text-muted-foreground font-body mt-1">
            This name appears in the client wizard header instead of "ClearPath".
          </p>
        </div>
        <div className="flex items-end gap-3">
          <Input
            value={state.displayName}
            onChange={e => setState(prev => ({ ...prev, displayName: e.target.value }))}
            placeholder="e.g. Smith & Associates"
            className="bg-input border-border max-w-md"
          />
          <Button
            onClick={handleSaveDisplayName}
            disabled={savingName || state.displayName.trim() === savedDisplayName}
          >
            {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>

      {/* Accent color */}
      <div className="surface-card p-6 space-y-4">
        <div>
          <label className="text-sm font-bold font-body text-foreground">Brand Color</label>
          <p className="text-xs text-muted-foreground font-body mt-1">
            Used for buttons and highlights in the client portal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {ACCENT_SWATCHES.map(s => {
            const active = state.accentColor.toLowerCase() === s.value.toLowerCase();
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => handleSwatch(s.value)}
                title={s.name}
                aria-label={s.name}
                className={`w-9 h-9 rounded-full transition-transform hover:scale-110 ${
                  active ? 'ring-2 ring-offset-2 ring-current ring-offset-background' : ''
                }`}
                style={{ backgroundColor: s.value, color: s.value }}
              />
            );
          })}
          <div className="flex items-center gap-2 ml-1">
            <span className="text-xs text-muted-foreground font-body">Custom</span>
            <Input
              value={state.accentColor}
              onChange={e => handleHexChange(e.target.value)}
              placeholder="#00C2A8"
              className="bg-input border-border w-32 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <label className="text-sm font-bold font-body text-foreground">Portal Preview</label>
        <div
          className="rounded-2xl p-6 border border-border"
          style={{ background: 'hsl(var(--surface))' }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0"
              >
                {state.logoUrl ? (
                  <img src={state.logoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Building className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <span
                className="font-display font-bold text-base truncate"
                style={{ color: state.accentColor }}
              >
                {state.displayName || 'Your Firm Name'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-body flex-shrink-0">
              Step 1 of 6
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full mt-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: '16%', backgroundColor: state.accentColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingTab;
