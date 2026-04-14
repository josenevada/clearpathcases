import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, X, AlertTriangle, Loader2, Camera } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { UploadedFile } from '@/lib/store';

interface MultiUploadConfig {
  singularLabel: string;
  pluralLabel: string;
  helperText: string;
  minRecommended: number;
  confirmationMessage: (count: number) => string;
}

interface MultiUploadZoneProps {
  files: UploadedFile[];
  config: MultiUploadConfig;
  onFileAdd: (file: File) => void;
  onFileDelete: (fileId: string) => void;
  onFilePreview?: (file: UploadedFile) => void;
}

const MultiUploadZone = ({ files, config, onFileAdd, onFileDelete, onFilePreview }: MultiUploadZoneProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [showMobileOptions, setShowMobileOptions] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileAdd(file);
    e.target.value = '';
  };

  const handleRemoveAndRetry = (fileId: string) => {
    onFileDelete(fileId);
    setTimeout(() => uploadZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  const handleUploadZoneClick = () => {
    if (isMobile) {
      setShowMobileOptions(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const hasFiles = files.length > 0;
  const isFlagged = (vs?: string) => vs === 'warning' || vs === 'failed';

  return (
    <div className="space-y-3 w-full">

      {/* Uploaded files list */}
      <AnimatePresence>
        {files.map(f => {
          const vs = f.validationStatus;
          const vr = f.validationResult;
          const flagged = isFlagged(vs);
          const validationIcon = vs === 'passed' ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
            : vs === 'validating' ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />
            : vs === 'warning' ? <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
            : vs === 'failed' ? <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
            : <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />;

          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-0"
            >
              <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[hsl(var(--surface-card))] border border-[hsl(var(--surface-border))]">
                {f.dataUrl?.startsWith('data:image') ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onFilePreview?.(f); }}
                    className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-border hover:ring-2 hover:ring-primary/30 transition-all"
                  >
                    <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                  </button>
                ) : f.dataUrl ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onFilePreview?.(f); }}
                    className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border hover:ring-2 hover:ring-primary/30 transition-all"
                  >
                    <span className="text-[10px] font-bold text-muted-foreground">PDF</span>
                  </button>
                ) : null}
                <span className="flex-1 text-sm text-foreground truncate font-body">{f.name}</span>
                {validationIcon}
                <button
                  onClick={() => onFileDelete(f.id)}
                  className={`rounded-full transition-colors flex-shrink-0 ${
                    flagged
                      ? 'p-1.5 hover:bg-destructive/15 bg-destructive/10'
                      : 'p-1 hover:bg-destructive/10'
                  }`}
                  aria-label={`Remove ${f.name}`}
                >
                  <X className={`text-destructive ${flagged ? 'w-4 h-4' : 'w-3.5 h-3.5 opacity-60'}`} />
                </button>
              </div>
              {vs === 'validating' && (
                <p className="text-[11px] text-muted-foreground pl-3 py-1">Checking your document…</p>
              )}
              {vs === 'warning' && vr && (
                <div className="pl-3 py-1.5 space-y-1.5">
                  <p className="text-[11px] text-warning leading-relaxed">This looks like it might not be quite right. {vr.suggestion}</p>
                  <div className="flex gap-3">
                    <button onClick={() => handleRemoveAndRetry(f.id)} className="text-[11px] text-primary hover:underline font-medium">Remove and try again</button>
                    <button onClick={() => {}} className="text-[11px] text-muted-foreground hover:text-foreground">Keep it anyway</button>
                  </div>
                </div>
              )}
              {vs === 'failed' && vr && (
                <div className="pl-3 py-1.5 space-y-1.5">
                  <p className="text-[11px] text-warning leading-relaxed">This looks like it might be the wrong file. {vr.suggestion}</p>
                  <div className="flex gap-3">
                    <button onClick={() => handleRemoveAndRetry(f.id)} className="text-[11px] text-primary hover:underline font-medium">Remove and try again</button>
                    <button onClick={() => {}} className="text-[11px] text-muted-foreground hover:text-foreground">Keep it anyway</button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Upload zone - always visible */}
      <div
        ref={uploadZoneRef}
        className="upload-zone p-8 flex flex-col items-center justify-center cursor-pointer relative"
        onClick={handleUploadZoneClick}
      >
        <UploadCloud className="w-10 h-10 text-primary mb-3" />
        <span className="text-foreground font-medium text-sm">
          {hasFiles
            ? `Add another ${config.singularLabel}`
            : `Tap to upload your file`}
        </span>
        <span className="text-xs text-muted-foreground mt-1">PDF, JPG, or PNG · Up to 25MB</span>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png"
          onChange={handleChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png"
          capture="environment"
          onChange={handleChange}
        />
      </div>

      {/* Mobile helper text */}
      {isMobile && (
        <p className="text-xs text-muted-foreground text-center">
          You can photograph physical documents directly with your camera.
        </p>
      )}

      {/* Mobile action sheet */}
      <AnimatePresence>
        {showMobileOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center"
            onClick={() => setShowMobileOptions(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-background rounded-t-2xl p-4 pb-8 space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
              <button
                onClick={() => {
                  setShowMobileOptions(false);
                  cameraInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-colors"
              >
                <Camera className="w-5 h-5 text-primary" />
                <span className="text-foreground font-medium">Take a Photo</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileOptions(false);
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-colors"
              >
                <UploadCloud className="w-5 h-5 text-primary" />
                <span className="text-foreground font-medium">Choose from Library</span>
              </button>
              <button
                onClick={() => setShowMobileOptions(false)}
                className="w-full p-3 text-center text-muted-foreground text-sm"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiUploadZone;

// ─── Inline confirmation for low file count ──────────────────────────
import { Button } from '@/components/ui/button';

interface LowCountConfirmationProps {
  config: MultiUploadConfig;
  fileCount: number;
  onConfirm: () => void;
  onAddMore: () => void;
}

export const LowCountConfirmation = ({ config, fileCount, onConfirm, onAddMore }: LowCountConfirmationProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 8 }}
    className="surface-card p-4 rounded-xl border border-warning/30 space-y-3"
  >
    <p className="text-sm text-foreground font-body leading-relaxed">
      {config.confirmationMessage(fileCount)}
    </p>
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={onConfirm} className="flex-1">
        Yes, continue
      </Button>
      <Button size="sm" onClick={onAddMore} className="flex-1">
        Add more {config.pluralLabel}
      </Button>
    </div>
  </motion.div>
);

// ─── Multi-upload item configurations ────────────────────────────────
export const MULTI_UPLOAD_CONFIGS: Record<string, MultiUploadConfig> = {
  'Digital Wallet Statements': {
    singularLabel: 'statement',
    pluralLabel: 'statements',
    helperText: 'Upload statements from Venmo, PayPal, Cash App, or other digital wallets for the last 12 months.',
    minRecommended: 1,
    confirmationMessage: (count) =>
      `You've uploaded ${count} file${count === 1 ? '' : 's'}. Make sure you've included statements from all digital wallets you've used in the last 12 months.`,
  },
  'Pay Stubs (Last 2 Months)': {
    singularLabel: 'pay stub',
    pluralLabel: 'pay stubs',
    helperText: 'Most clients upload 4 to 8 pay stubs to cover the last 60 days. Upload as many as you have.',
    minRecommended: 4,
    confirmationMessage: (count) =>
      `You've uploaded ${count} pay stub${count === 1 ? '' : 's'}. Most people need 4 to 8 to cover the last 60 days. Does this cover your last 60 days of income?`,
  },
  'Checking/Savings Statements (Last 6 Months)': {
    singularLabel: 'bank statement',
    pluralLabel: 'bank statements',
    helperText: 'Upload statements for all checking and savings accounts from the last 6 months.',
    minRecommended: 6,
    confirmationMessage: (count) =>
      `You've uploaded ${count} bank statement${count === 1 ? '' : 's'}. Most clients need 6 months of statements per account. Does this cover all your accounts?`,
  },
  'Credit Card Statements (Last 3 Months)': {
    singularLabel: 'credit card statement',
    pluralLabel: 'credit card statements',
    helperText: 'Upload the last 3 months of statements for each credit card you have.',
    minRecommended: 3,
    confirmationMessage: (count) =>
      `You've uploaded ${count} credit card statement${count === 1 ? '' : 's'}. Most clients need 3 months per card. Does this cover all your cards?`,
  },
  'Tax Returns (Last 2 Years)': {
    singularLabel: 'tax return',
    pluralLabel: 'tax returns',
    helperText: 'Upload your federal tax returns from the last 2 years.',
    minRecommended: 2,
    confirmationMessage: (count) =>
      `You've uploaded ${count} tax return${count === 1 ? '' : 's'}. The court requires the last 2 years. Does this cover both years?`,
  },
  'W-2s (Last 2 Years)': {
    singularLabel: 'W-2',
    pluralLabel: 'W-2s',
    helperText: 'Upload W-2s from all employers for the last 2 years.',
    minRecommended: 2,
    confirmationMessage: (count) =>
      `You've uploaded ${count} W-2${count === 1 ? '' : 's'}. The court requires 2 years from each employer. Does this cover everything?`,
  },
};

export const isMultiUploadItem = (label: string): boolean => label in MULTI_UPLOAD_CONFIGS;
