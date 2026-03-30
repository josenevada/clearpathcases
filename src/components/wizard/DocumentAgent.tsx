import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ExternalLink, ChevronDown, Sparkles, MessageCircle, Send } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { DOCUMENT_PLATFORMS, getDocumentCategory, CATEGORY_LABELS, type Platform } from '@/data/document-platforms';
import { supabase } from '@/integrations/supabase/client';

interface DocumentAgentProps {
  documentCategory: string;
  documentLabel: string;
  caseId: string;
  onDocumentUploaded?: () => void;
}

const getDeviceType = (): 'mobile' | 'desktop' => {
  return window.innerWidth < 768 || /Android|iPhone|iPad/i.test(navigator.userAgent)
    ? 'mobile'
    : 'desktop';
};

const DocumentAgent = ({ documentCategory, documentLabel, caseId, onDocumentUploaded }: DocumentAgentProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [gifError, setGifError] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [otherQuery, setOtherQuery] = useState('');
  const [otherResponse, setOtherResponse] = useState('');
  const [otherLoading, setOtherLoading] = useState(false);
  const isMobile = useIsMobile();

  const category = getDocumentCategory(documentLabel);
  const platforms = category ? DOCUMENT_PLATFORMS[category] : null;
  const categoryLabel = category ? CATEGORY_LABELS[category] : documentLabel;

  // Close on upload
  useEffect(() => {
    if (onDocumentUploaded && !isOpen) return;
  }, [onDocumentUploaded, isOpen]);

  const logInteraction = useCallback(async (platformId: string) => {
    try {
      const { data } = await supabase
        .from('agent_interactions')
        .insert({
          case_id: caseId,
          document_category: category || documentCategory,
          platform_selected: platformId,
          device_type: getDeviceType(),
        })
        .select('id')
        .single();
      if (data) setInteractionId(data.id);
    } catch (e) {
      console.warn('Agent interaction log failed:', e);
    }
  }, [caseId, category, documentCategory]);

  const updateInteraction = useCallback(async (updates: Record<string, boolean>) => {
    if (!interactionId) return;
    try {
      await supabase
        .from('agent_interactions')
        .update(updates)
        .eq('id', interactionId);
    } catch (e) {
      console.warn('Agent interaction update failed:', e);
    }
  }, [interactionId]);

  const handlePlatformSelect = (platform: Platform) => {
    setSelectedPlatform(platform);
    setGifError(false);
    setShowInstructions(false);
    setOtherQuery('');
    setOtherResponse('');
    logInteraction(platform.id);
  };

  const handleDeepLinkClick = () => {
    if (!selectedPlatform) return;
    const link = isMobile ? selectedPlatform.deep_link_mobile : selectedPlatform.deep_link_desktop;
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      updateInteraction({ deep_link_clicked: true });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedPlatform(null);
    setInteractionId(null);
    setGifError(false);
    setShowInstructions(false);
  };

  const handleOtherSubmit = async () => {
    if (!otherQuery.trim() || otherLoading) return;
    setOtherLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('document-agent-help', {
        body: {
          document_category: categoryLabel,
          client_message: otherQuery.trim(),
        },
      });
      if (error) throw error;
      setOtherResponse(data?.response || "I'm sorry, I couldn't find specific instructions. Please contact your attorney's office for help.");
    } catch {
      setOtherResponse("I'm having trouble right now. Please try the written steps above, or contact your attorney's office for help.");
    } finally {
      setOtherLoading(false);
    }
  };

  if (!platforms || platforms.length === 0) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const isOtherPlatform = selectedPlatform && !selectedPlatform.deep_link_desktop && !selectedPlatform.deep_link_mobile;
  const deepLink = selectedPlatform
    ? (isMobile ? selectedPlatform.deep_link_mobile : selectedPlatform.deep_link_desktop)
    : '';

  const agentContent = (
    <div className="space-y-4">
      {!selectedPlatform ? (
        // Step 1: Platform selection
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Where do you get your {categoryLabel}?
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tap your provider and we'll show you exactly where to find it.
              </p>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-hover))] transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handlePlatformSelect(platform)}
                className="flex items-center gap-2 px-3 py-3 rounded-lg border transition-all text-left hover:brightness-110"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderColor: 'rgba(255,255,255,0.08)',
                  borderWidth: '0.5px',
                }}
              >
                <span className="text-xl flex-shrink-0">{platform.logo_emoji}</span>
                <span className="text-[13px] font-medium text-foreground truncate">{platform.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        // Step 2: Instructions + GIF + Deep link
        <>
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setSelectedPlatform(null); setInteractionId(null); }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-[hsl(var(--surface-hover))] transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* GIF — desktop only, with graceful fallback */}
          {!isMobile && !gifError && (
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: 'hsl(210 40% 8%)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                maxHeight: 220,
              }}
            >
              <img
                src={`${supabaseUrl}/storage/v1/object/public/${selectedPlatform.gif_url}`}
                alt={`How to find your ${categoryLabel} in ${selectedPlatform.name}`}
                className="w-full object-contain"
                style={{ maxHeight: 220 }}
                onError={() => setGifError(true)}
                onLoad={() => updateInteraction({ gif_viewed: true })}
              />
            </div>
          )}

          {/* Mobile suggestion */}
          {isMobile && (
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              For the easiest experience, do this step on a computer — then come back here to upload.
            </p>
          )}

          {/* Written instructions — always on mobile, toggled on desktop */}
          {isMobile ? (
            <InstructionsList steps={selectedPlatform.instructions} />
          ) : (
            <>
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
                {showInstructions ? 'Hide written steps' : 'Show written steps'}
              </button>
              <AnimatePresence>
                {(showInstructions || gifError) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <InstructionsList steps={selectedPlatform.instructions} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Deep link button */}
          {deepLink && (
            <button
              onClick={handleDeepLinkClick}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-all hover:shadow-[0_0_16px_rgba(0,194,168,0.25)]"
              style={{
                background: 'hsl(var(--primary))',
                color: 'hsl(210 40% 10%)',
              }}
            >
              Open {selectedPlatform.name}
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          {/* Tip pill */}
          {selectedPlatform.tip && (
            <div
              className="flex items-start gap-2 px-3.5 py-2 rounded-full text-xs leading-relaxed"
              style={{
                background: 'rgba(245,166,35,0.1)',
                border: '0.5px solid rgba(245,166,35,0.2)',
                color: '#f5a623',
                borderRadius: 100,
              }}
            >
              <span>💡</span>
              <span>{selectedPlatform.tip}</span>
            </div>
          )}

          {/* "Other" AI help */}
          {isOtherPlatform && (
            <div className="space-y-2 pt-2 border-t border-[hsl(var(--surface-border))]">
              <p className="text-xs text-muted-foreground">Still stuck? Describe what you're seeing and we'll help.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={otherQuery}
                  onChange={(e) => setOtherQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOtherSubmit()}
                  placeholder="e.g. I use a credit union..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleOtherSubmit}
                  disabled={otherLoading || !otherQuery.trim()}
                  className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 transition-opacity"
                >
                  {otherLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              {otherResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg text-sm text-foreground leading-relaxed"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-primary inline mr-1.5 -mt-0.5" />
                  {otherResponse}
                </motion.div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="mb-4">
      {/* Trigger link */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 text-[13px] hover:underline transition-colors"
          style={{ color: 'hsl(var(--primary))' }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Need help finding this?
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Desktop: inline panel */}
            {!isMobile ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                className="overflow-hidden"
              >
                <div
                  className="mt-3 p-5 rounded-xl"
                  style={{
                    background: 'hsl(210 40% 10%)',
                    border: '0.5px solid rgba(0,194,168,0.15)',
                    borderRadius: 12,
                  }}
                >
                  {agentContent}
                </div>
              </motion.div>
            ) : (
              // Mobile: bottom sheet
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[80] bg-black/40"
                  onClick={handleClose}
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed inset-x-0 bottom-0 z-[81] overflow-y-auto"
                  style={{
                    maxHeight: '70vh',
                    background: 'hsl(210 40% 10%)',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                  }}
                >
                  <div className="w-10 h-1 rounded-full bg-muted mx-auto mt-3 mb-1" />
                  <div className="p-5">
                    {agentContent}
                  </div>
                </motion.div>
              </>
            )}
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const InstructionsList = ({ steps }: { steps: string[] }) => (
  <ol className="space-y-2 pl-1">
    {steps.map((step, i) => (
      <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: '#f0f4f8' }}>
        <span className="text-primary font-semibold flex-shrink-0 w-5 text-right">{i + 1}.</span>
        <span>{step}</span>
      </li>
    ))}
  </ol>
);

export default DocumentAgent;
