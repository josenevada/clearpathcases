import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, ThumbsUp, FileText, Search, Eye } from 'lucide-react';
import { getDocumentHelp, getValidationHelpMessage, type DocumentHelpContent } from '@/lib/document-help';
import { supabase } from '@/integrations/supabase/client';

interface DocumentHelpPanelProps {
  itemLabel: string;
  caseId: string;
  caseName: string;
  /** Latest validation status from any file on this item */
  validationStatus?: string;
  validationSuggestion?: string;
  /** Whether the item has any files uploaded */
  hasFiles: boolean;
  /** External signal to force-open the panel */
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
}

const DocumentHelpPanel = ({
  itemLabel,
  caseId,
  caseName,
  validationStatus,
  validationSuggestion,
  hasFiles,
  forceOpen,
  onForceOpenHandled,
}: DocumentHelpPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const helpContent = getDocumentHelp(itemLabel);
  const hasLoggedOpen = useRef(false);

  // Reset state when item changes
  useEffect(() => {
    setIsOpen(false);
    setFeedbackGiven(false);
    hasLoggedOpen.current = false;
  }, [itemLabel]);

  // Handle force-open from parent (inactivity, validation, soft-block)
  useEffect(() => {
    if (forceOpen && !isOpen) {
      setIsOpen(true);
      onForceOpenHandled?.();
    }
  }, [forceOpen, isOpen, onForceOpenHandled]);

  const logOpen = useCallback(() => {
    if (!hasLoggedOpen.current) {
      hasLoggedOpen.current = true;
      addActivityEntry(caseId, {
        eventType: 'checkpoint_completed',
        actorRole: 'client',
        actorName: caseName,
        description: `${caseName.split(' ')[0]} opened help for ${itemLabel}`,
        itemId: undefined,
      });
    }
  }, [caseId, caseName, itemLabel]);

  const handleToggle = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) logOpen();
  };

  const handleFeedback = (helpful: boolean) => {
    setFeedbackGiven(true);
    if (!helpful) {
      addActivityEntry(caseId, {
        eventType: 'checkpoint_completed',
        actorRole: 'client',
        actorName: caseName,
        description: `${caseName.split(' ')[0]} indicated confusion on ${itemLabel}`,
        itemId: undefined,
      });
    }
  };

  if (!helpContent) return null;

  const validationMessage = validationStatus
    ? getValidationHelpMessage(validationStatus, validationSuggestion)
    : null;

  return (
    <div className="mb-4">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-primary text-sm hover:text-primary/80 transition-colors font-body"
      >
        <HelpCircle className="w-4 h-4" />
        Not sure what this is or where to find it? We can help.
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 surface-card p-5 rounded-xl border border-primary/10 space-y-4">
              {/* Validation-aware contextual message */}
              {validationMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-warning bg-warning/5 border border-warning/15 rounded-lg px-3 py-2.5 font-body leading-relaxed"
                >
                  {validationMessage}
                </motion.div>
              )}

              <HelpSection
                icon={<FileText className="w-4 h-4 text-primary flex-shrink-0" />}
                title="What is this?"
                content={helpContent.whatIsThis}
              />
              <HelpSection
                icon={<Search className="w-4 h-4 text-primary flex-shrink-0" />}
                title="Where to find it"
                content={helpContent.whereToFind}
              />
              <HelpSection
                icon={<Eye className="w-4 h-4 text-primary flex-shrink-0" />}
                title="What it looks like"
                content={helpContent.whatItLooksLike}
              />

              {/* Feedback */}
              <div className="pt-2 border-t border-[hsl(var(--surface-border))]">
                {feedbackGiven ? (
                  <p className="text-xs text-muted-foreground font-body">Thanks for the feedback.</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleFeedback(true)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-body"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      This helped
                    </button>
                    <button
                      onClick={() => handleFeedback(false)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-body"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      Still confused
                    </button>
                  </div>
                )}
                {feedbackGiven && (
                  <AnimatePresence>
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-xs text-muted-foreground mt-2 font-body"
                    >
                      Your attorney's office can help — they'll reach out if your case gets stuck.
                    </motion.p>
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HelpSection = ({
  icon,
  title,
  content,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      {icon}
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed font-body pl-6">
      {content}
    </p>
  </div>
);

export default DocumentHelpPanel;
