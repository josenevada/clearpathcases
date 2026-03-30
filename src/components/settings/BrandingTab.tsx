import { useEffect, useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { fetchBrandingSettings, saveBrandingSettings } from '@/lib/dashboard-data';
import { toast } from 'sonner';

const BRANDING_KEY = 'cp_branding';

interface BrandingData {
  firmLogoUrl?: string;
  letterheadUrl?: string;
  firmName: string;
  attorneyName: string;
  barNumber: string;
  certificationLanguage: string;
}

const defaultCertification = `I certify that the documents contained herein are true and accurate copies submitted in connection with the above-referenced bankruptcy matter.`;

const loadBranding = (): BrandingData => {
  try {
    const raw = localStorage.getItem(BRANDING_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    firmName: '',
    attorneyName: '',
    barNumber: '',
    certificationLanguage: defaultCertification,
  };
};

const saveBranding = (data: BrandingData) => {
  localStorage.setItem(BRANDING_KEY, JSON.stringify(data));
};

const BrandingTab = () => {
  const { user } = useAuth();
  const [data, setData] = useState<BrandingData>(loadBranding);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadPersistedBranding = async () => {
      if (!user?.firmId) return;

      try {
        const persisted = await fetchBrandingSettings(user.firmId);
        setData(prev => ({
          ...prev,
          attorneyName: persisted.attorneyName,
          barNumber: persisted.barNumber,
        }));
      } catch {
        toast.error('Failed to load branding settings.');
      }
    };

    void loadPersistedBranding();
  }, [user?.firmId]);

  const handleFileUpload = (field: 'firmLogoUrl' | 'letterheadUrl', file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please upload a PNG, JPG, or PDF file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setData(prev => ({ ...prev, [field]: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      saveBranding(data);
      if (user?.firmId) {
        await saveBrandingSettings(user.firmId, {
          attorneyName: data.attorneyName,
          barNumber: data.barNumber,
        });
      }
      toast.success('Branding settings saved');
    } catch {
      toast.error('Failed to save branding settings.');
    }
  };

  const handleClearFile = (field: 'firmLogoUrl' | 'letterheadUrl') => {
    setData(prev => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-lg text-foreground mb-1">Packet Branding</h2>
        <p className="text-sm text-muted-foreground font-body">Customize how your court-ready filing packets look.</p>
      </div>

      <div className="surface-card p-5 space-y-6">
        {/* Firm logo */}
        <div className="space-y-2">
          <label className="text-sm font-bold font-body text-foreground">Firm Logo</label>
          <p className="text-xs text-muted-foreground font-body">Appears on packet cover page. PNG or JPG, max 5MB.</p>
          <div className="flex items-center gap-4">
            {data.firmLogoUrl ? (
              <div className="relative w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted">
                <img src={data.firmLogoUrl} alt="Firm logo" className="w-full h-full object-contain" />
                <button
                  onClick={() => handleClearFile('firmLogoUrl')}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => logoInputRef.current?.click()}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-primary/30 transition-colors"
              >
                <Upload className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload('firmLogoUrl', f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* Letterhead */}
        <div className="space-y-2">
          <label className="text-sm font-bold font-body text-foreground">Letterhead</label>
          <p className="text-xs text-muted-foreground font-body">Used as header background on packet cover page. PNG, JPG, or PDF, max 5MB.</p>
          <div className="flex items-center gap-4">
            {data.letterheadUrl ? (
              <div className="relative w-24 h-16 rounded-lg border border-border overflow-hidden bg-muted">
                {data.letterheadUrl.startsWith('data:image') ? (
                  <img src={data.letterheadUrl} alt="Letterhead" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <button
                  onClick={() => handleClearFile('letterheadUrl')}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => letterheadInputRef.current?.click()}
                className="w-24 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-primary/30 transition-colors"
              >
                <Upload className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <input
              ref={letterheadInputRef}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload('letterheadUrl', f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* Firm name */}
        <div className="space-y-2">
          <label className="text-sm font-bold font-body text-foreground">Firm Name</label>
          <Input
            value={data.firmName}
            onChange={e => setData(prev => ({ ...prev, firmName: e.target.value }))}
            placeholder="e.g. Smith & Associates LLC"
            className="bg-input border-border"
          />
        </div>

        {/* Attorney name + bar number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold font-body text-foreground">Attorney Name</label>
            <Input
              value={data.attorneyName}
              onChange={e => setData(prev => ({ ...prev, attorneyName: e.target.value }))}
              placeholder="e.g. Jane Smith, Esq."
              className="bg-input border-border"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold font-body text-foreground">Bar Number</label>
            <Input
              value={data.barNumber}
              onChange={e => setData(prev => ({ ...prev, barNumber: e.target.value }))}
              placeholder="e.g. 12345"
              className="bg-input border-border"
            />
          </div>
        </div>

        {/* Certification language */}
        <div className="space-y-2">
          <label className="text-sm font-bold font-body text-foreground">Certification Language</label>
          <p className="text-xs text-muted-foreground font-body">This text appears on the packet cover page.</p>
          <Textarea
            value={data.certificationLanguage}
            onChange={e => setData(prev => ({ ...prev, certificationLanguage: e.target.value }))}
            rows={3}
            className="bg-input border-border font-body text-sm"
          />
        </div>

        <Button onClick={handleSave}>Save Branding</Button>
      </div>
    </div>
  );
};

export default BrandingTab;
