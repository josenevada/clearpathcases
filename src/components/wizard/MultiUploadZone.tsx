import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, X, AlertTriangle, Loader2 } from 'lucide-react';
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
  const uploadZoneRef = useRef<HTMLDivElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileAdd(file);
    e.target.value = '';
  };

  const handleRemoveAndRetry = (fileId: string) => {
    onFileDelete(fileId);
    setTimeout(() => uploadZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  const hasFiles = files.length > 0;
  const isFlagged = (vs?: string) => vs === 'warning' || vs === 'failed';

  return (
    <div className="space-y-3">
      {/* Helper text */}
      <p className="text-xs text-muted-foreground font-body">
        {config.helperText}
      </p>

      {/* Uploaded files list */}
      <AnimatePresence>
        {files.map(f => {
          const vs = f.validationStatus;
          const vr = f.validationResult;
          const flagged = isFlagged(vs);
          const validationIcon = vs === 'passed' ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
            : vs === 'validating' ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />
            : vs === 'warning' ? <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
            : vs === 'failed' ? <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
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
                  <p className="text-[11px] text-destructive leading-relaxed">This looks like it might be the wrong file. {vr.suggestion}</p>
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

export default MultiUploadZone;
