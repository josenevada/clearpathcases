import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UploadedFile } from '@/lib/store';

interface MultiUploadConfig {
  singularLabel: string; // e.g. "pay stub"
  pluralLabel: string;   // e.g. "pay stubs"
  helperText: string;    // guidance text above upload zone
  minRecommended: number;
  confirmationMessage: (count: number) => string;
}

interface MultiUploadZoneProps {
  files: UploadedFile[];
  config: MultiUploadConfig;
  onFileAdd: (file: File) => void;
  onFileDelete: (fileId: string) => void;
}

const MultiUploadZone = ({ files, config, onFileAdd, onFileDelete }: MultiUploadZoneProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileAdd(file);
    e.target.value = '';
  };

  const hasFiles = files.length > 0;

  return (
    <div className="space-y-3">
      {/* Helper text */}
      <p className="text-xs text-muted-foreground font-body">
        {config.helperText}
      </p>

      {/* Uploaded files list */}
      <AnimatePresence>
        {files.map(f => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[hsl(var(--surface-card))] border border-[hsl(var(--surface-border))]"
          >
            <span className="flex-1 text-sm text-foreground truncate font-body">{f.name}</span>
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
            <button
              onClick={() => onFileDelete(f.id)}
              className="p-1 rounded-full hover:bg-destructive/10 transition-colors flex-shrink-0"
              aria-label={`Remove ${f.name}`}
            >
              <X className="w-3.5 h-3.5 text-destructive" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Upload zone - always visible */}
      <div
        className="upload-zone p-8 flex flex-col items-center justify-center cursor-pointer relative"
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className="w-10 h-10 text-primary mb-3" />
        <span className="text-foreground font-medium text-sm">
          {hasFiles
            ? `Add another ${config.singularLabel} or drag it here`
            : `Tap to upload or drag file`}
        </span>
        <span className="text-xs text-muted-foreground mt-1">PDF, JPG, or PNG · Max 25MB</span>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

// ─── Inline confirmation for low file count ──────────────────────────
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

export default MultiUploadZone;
