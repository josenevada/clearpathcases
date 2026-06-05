import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ExternalLink, Upload, User, CircleUserRound, FileText, Calendar,
  Download, Globe, LayoutDashboard, Smartphone, Clock, MoreHorizontal, UploadCloud,
  CheckCircle2, X, AlertTriangle, Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnimatedSteps, { type StepDef } from './AnimatedSteps';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import type { UploadedFile, FileValidationResult } from '@/lib/store';

// ─── App card definitions ───────────────────────────────────────────

const VENMO_STEPS: StepDef[] = [
  { icon: User, label: 'Open Venmo', description: 'Launch the Venmo app on your phone' },
  { icon: CircleUserRound, label: 'Tap your profile photo', description: 'Bottom right corner of the home screen' },
  { icon: FileText, label: 'Tap Statements', description: 'Scroll down in your profile menu' },
  { icon: Calendar, label: 'Select last 12 months', description: 'Choose the full date range' },
  { icon: Download, label: 'Download as PDF', description: 'Tap Download and save to your phone' },
  { icon: Upload, label: 'Upload below', description: 'Come back here and upload the file' },
];

const PAYPAL_STEPS: StepDef[] = [
  { icon: Globe, label: 'Go to PayPal.com', description: 'Open your browser and log in' },
  { icon: LayoutDashboard, label: 'Click Activity', description: 'In the top navigation bar' },
  { icon: FileText, label: 'Click Statements', description: 'Then select Monthly Statements' },
  { icon: Calendar, label: 'Download last 12 months', description: 'Download each month as a PDF' },
  { icon: Upload, label: 'Upload all files below', description: 'You can upload multiple files at once' },
];

const CASHAPP_STEPS: StepDef[] = [
  { icon: Smartphone, label: 'Open Cash App', description: 'On your iPhone or Android' },
  { icon: Clock, label: 'Tap the Activity tab', description: 'The clock icon at the bottom of the screen' },
  { icon: MoreHorizontal, label: 'Tap the … menu', description: 'Top right corner of the Activity screen' },
  { icon: Download, label: 'Tap Export CSV', description: 'This downloads your full transaction history' },
  { icon: Upload, label: 'Upload the file below', description: 'Come back here and upload your CSV' },
];

interface AppCardConfig {
  name: string;
  emoji: string;
  borderColor: string;
  accentColor: string;
  steps: StepDef[];
  mobileNote?: string;
  deepLink: { label: string; url: string };
}

const APP_CARDS: AppCardConfig[] = [
  {
    name: 'Venmo',
    emoji: '🟣',
    borderColor: '#008CFF',
    accentColor: '#008CFF',
    steps: VENMO_STEPS,
    mobileNote: "You'll need to do this from the Venmo mobile app",
    deepLink: { label: 'Open Venmo →', url: 'https://account.venmo.com/sign-in' },
  },
  {
    name: 'PayPal',
    emoji: '🔵',
    borderColor: '#003087',
    accentColor: '#003087',
    steps: PAYPAL_STEPS,
    deepLink: { label: 'Open PayPal Statements →', url: 'https://www.paypal.com/reports/dlog' },
  },
  {
    name: 'Cash App',
    emoji: '🟩',
    borderColor: '#00D632',
    accentColor: '#00D632',
    steps: CASHAPP_STEPS,
    mobileNote: "You'll need to do this from the Cash App mobile app",
    deepLink: { label: 'Open Cash App Activity →', url: 'https://cash.app/account/activity' },
  },
];

// ─── Component ──────────────────────────────────────────────────────

interface DigitalWalletStepProps {
  caseId: string;
  clientName: string;
  clientPhone?: string;
  checklistItemId: string;
  files: UploadedFile[];
  onFileAdd: (file: File) => void;
  onFileDelete: (fileId: string) => void;
  onFilePreview?: (file: UploadedFile) => void;
  onMarkNA: () => void;
}

const DigitalWalletStep = ({
  caseId, clientName, clientPhone, checklistItemId,
  files, onFileAdd, onFileDelete, onFilePreview, onMarkNA,
}: DigitalWalletStepProps) => {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [getDocOpen, setGetDocOpen] = useState(false);
  const [naChecked, setNaChecked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const uploadZoneRef = useRef<HTMLDivElement>(null);

  const toggleCard = (name: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      for (let i = 0; i < selectedFiles.length; i++) {
        onFileAdd(selectedFiles[i]);
      }
    }
    e.target.value = '';
  };

  const handleUploadClick = () => {
    if (isMobile) {
      setShowMobileOptions(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleNAChange = (checked: boolean) => {
    setNaChecked(checked);
    if (checked) {
      onMarkNA();
    }
  };

  const isFlagged = (vs?: string) => vs === 'warning' || vs === 'failed';

  return (
    <div className="space-y-5">
      {/* Get this document dropdown */}
      <button
        onClick={() => setGetDocOpen(!getDocOpen)}
        className="flex items-center gap-2 text-sm text-primary/80 hover:text-primary transition-colors"
      >
        <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="font-medium">Get this document</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${getDocOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {getDocOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pb-2">
              {APP_CARDS.map(app => {
                const isOpen = expandedCards.has(app.name);

                return (
                  <div
                    key={app.name}
                    className="rounded-xl border border-border overflow-hidden"
                    style={{ borderLeftWidth: '4px', borderLeftColor: app.borderColor }}
                  >
                    <button
                      onClick={() => toggleCard(app.name)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(var(--surface-hover))] transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {app.emoji} {app.name}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3">
                            <AnimatedSteps steps={app.steps} accentColor={app.accentColor} />

                            {app.mobileNote && (
                              <p className="text-xs text-muted-foreground italic pl-1">
                                📱 {app.mobileNote}
                              </p>
                            )}

                            <a
                              href={app.deepLink.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors mt-3"
                            >
                              {app.deepLink.label}
                            </a>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uploaded files list */}
      <AnimatePresence>
        {files.map(f => {
          const flagged = false;
          const validationIcon = <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />;

          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[hsl(var(--surface-card))] border border-[hsl(var(--surface-border))]">
                {f.dataUrl?.startsWith('data:image') ? (
                  <button
                    onClick={() => onFilePreview?.(f)}
                    className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-border hover:ring-2 hover:ring-primary/30 transition-all"
                  >
                    <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                  </button>
                ) : f.dataUrl ? (
                  <button
                    onClick={() => onFilePreview?.(f)}
                    className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border hover:ring-2 hover:ring-primary/30 transition-all"
                  >
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {f.name.toLowerCase().endsWith('.csv') ? 'CSV' : 'PDF'}
                    </span>
                  </button>
                ) : null}
                <span className="flex-1 text-sm text-foreground truncate font-body">{f.name}</span>
                {validationIcon}
                <button
                  onClick={() => onFileDelete(f.id)}
                  className={`rounded-full transition-colors flex-shrink-0 ${
                    flagged ? 'p-1.5 hover:bg-destructive/15 bg-destructive/10' : 'p-1 hover:bg-destructive/10'
                  }`}
                >
                  <X className={`text-destructive ${flagged ? 'w-4 h-4' : 'w-3.5 h-3.5 opacity-60'}`} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Upload zone */}
      <div
        ref={uploadZoneRef}
        className="upload-zone p-8 flex flex-col items-center justify-center cursor-pointer relative"
        onClick={handleUploadClick}
      >
        <UploadCloud className="w-10 h-10 text-primary mb-3" />
        <span className="text-foreground font-medium text-sm">
          {files.length > 0 ? 'Add another file' : 'Tap to upload your file'}
        </span>
        <span className="text-xs text-muted-foreground mt-1">PDF or CSV · Up to 25MB</span>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.csv,application/pdf,text/csv"
          multiple
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

      {isMobile && (
        <p className="text-xs text-muted-foreground text-center">
          You can photograph physical documents directly with your camera.
        </p>
      )}

      {/* N/A checkbox */}
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[hsl(var(--surface-hover))] transition-colors mt-2">
        <input
          type="checkbox"
          checked={naChecked}
          onChange={e => handleNAChange(e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm text-muted-foreground">
          I don't use any of these apps
        </span>
      </label>

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
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
              <button
                onClick={() => { setShowMobileOptions(false); cameraInputRef.current?.click(); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-colors"
              >
                <Camera className="w-5 h-5 text-primary" />
                <span className="text-foreground font-medium">Take a Photo</span>
              </button>
              <button
                onClick={() => { setShowMobileOptions(false); fileInputRef.current?.click(); }}
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

export default DigitalWalletStep;
