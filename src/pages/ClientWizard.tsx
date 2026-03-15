import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle2, ChevronDown, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { getCase, updateCase, addActivityEntry, CATEGORIES, STEP_MOTIVATIONS, calculateProgress, type Case, type ChecklistItem } from '@/lib/store';
import { toast } from 'sonner';

const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: [0.2, 0, 0, 1] },
};

const MILESTONE_THRESHOLDS = [25, 50, 75, 100];
const MILESTONE_MESSAGES = [
  "Great start! Every document you upload brings you closer to a fresh start.",
  "You're halfway there. Every document you've added helps your attorney fight for you.",
  "Almost there! Your attorney will have nearly everything they need.",
  "You're done. Your attorney has everything they need. We'll be in touch soon.",
];

const ClientWizard = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [currentCategoryIdx, setCurrentCategoryIdx] = useState(0);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showMilestone, setShowMilestone] = useState<number | null>(null);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [checkpointConfirmed, setCheckpointConfirmed] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const lastMilestoneRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!caseId) return;
    const c = getCase(caseId);
    if (!c) {
      toast.error('Case not found');
      navigate('/');
      return;
    }
    setCaseData(c);
    // Restore wizard position
    const catIdx = Math.min(c.wizardStep, CATEGORIES.length - 1);
    setCurrentCategoryIdx(catIdx);
    // Find first incomplete item in this category
    const items = c.checklist.filter(i => i.category === CATEGORIES[catIdx]);
    const firstIncomplete = items.findIndex(i => !i.completed);
    setCurrentItemIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
    lastMilestoneRef.current = Math.floor(calculateProgress(c) / 25) * 25;
  }, [caseId, navigate]);

  const refreshCase = useCallback(() => {
    if (!caseId) return null;
    const c = getCase(caseId);
    if (c) setCaseData(c);
    return c;
  }, [caseId]);

  if (!caseData) return null;

  const categoryItems = caseData.checklist.filter(i => i.category === CATEGORIES[currentCategoryIdx]);
  const currentItem = categoryItems[currentItemIdx];
  const progress = calculateProgress(caseData);
  const totalItems = caseData.checklist.length;
  const completedItems = caseData.checklist.filter(i => i.completed).length;

  // Check if this is a checkpoint item (confirmation items in Step 6)
  const isCheckpointItem = currentItem && currentItem.category === 'Agreements & Confirmation' &&
    currentItem.label.includes('Confirmation');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentItem) return;

    const reader = new FileReader();
    reader.onload = () => {
      const updated = updateCase(caseData.id, c => {
        const item = c.checklist.find(i => i.id === currentItem.id);
        if (item) {
          item.files = [{
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            dataUrl: reader.result as string,
            uploadedAt: new Date().toISOString(),
            reviewStatus: 'pending',
            uploadedBy: 'client',
          }];
          item.completed = true;
        }
        c.lastClientActivity = new Date().toISOString();
        return c;
      });

      addActivityEntry(caseData.id, {
        eventType: 'file_upload',
        actorRole: 'client',
        actorName: caseData.clientName,
        description: `${caseData.clientName.split(' ')[0]} uploaded ${currentItem.label}`,
        itemId: currentItem.id,
      });

      if (updated) {
        setCaseData(updated);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          checkMilestoneAndAdvance(updated);
        }, 1500);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCheckpointConfirm = () => {
    const updated = updateCase(caseData.id, c => {
      const item = c.checklist.find(i => i.id === currentItem.id);
      if (item) item.completed = true;
      c.lastClientActivity = new Date().toISOString();
      c.checkpointsCompleted = [...c.checkpointsCompleted, currentItem.id];
      return c;
    });

    addActivityEntry(caseData.id, {
      eventType: 'checkpoint_completed',
      actorRole: 'client',
      actorName: caseData.clientName,
      description: `${caseData.clientName.split(' ')[0]} completed the ${currentItem.label}`,
      itemId: currentItem.id,
    });

    if (updated) {
      setCaseData(updated);
      setCheckpointConfirmed(false);
      checkMilestoneAndAdvance(updated);
    }
  };

  const checkMilestoneAndAdvance = (updated: Case) => {
    const newProgress = calculateProgress(updated);
    const milestoneHit = MILESTONE_THRESHOLDS.find(t => newProgress >= t && lastMilestoneRef.current < t);
    if (milestoneHit) {
      lastMilestoneRef.current = milestoneHit;
      setShowMilestone(milestoneHit);
    } else {
      advanceToNext();
    }
  };

  const advanceToNext = () => {
    setWhyOpen(false);
    if (currentItemIdx < categoryItems.length - 1) {
      setCurrentItemIdx(currentItemIdx + 1);
    } else if (currentCategoryIdx < CATEGORIES.length - 1) {
      const nextCat = currentCategoryIdx + 1;
      setCurrentCategoryIdx(nextCat);
      setCurrentItemIdx(0);
      updateCase(caseData.id, c => ({ ...c, wizardStep: nextCat }));
      refreshCase();
    }
  };

  const goBack = () => {
    setWhyOpen(false);
    if (currentItemIdx > 0) {
      setCurrentItemIdx(currentItemIdx - 1);
    } else if (currentCategoryIdx > 0) {
      const prevCat = currentCategoryIdx - 1;
      setCurrentCategoryIdx(prevCat);
      const prevItems = caseData.checklist.filter(i => i.category === CATEGORIES[prevCat]);
      setCurrentItemIdx(prevItems.length - 1);
    }
  };

  const handleSkip = () => {
    toast('No worries — you can come back to this later.', { duration: 2000 });
    advanceToNext();
  };

  const handleDismissMilestone = () => {
    setShowMilestone(null);
    if (lastMilestoneRef.current === 100) return; // Don't advance past completion
    advanceToNext();
  };

  // Overall position across all items
  const flatIdx = caseData.checklist.findIndex(i => i.id === currentItem?.id);

  // Urgency banner
  const showUrgencyBanner = caseData.urgency !== 'normal' && !showMilestone;
  const daysLeft = Math.max(0, Math.ceil((new Date(caseData.filingDeadline).getTime() - Date.now()) / 86400000));

  // Completion screen
  if (progress === 100 && !showMilestone && !showSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <WizardHeader progress={100} step={6} totalSteps={6} stepName="Complete" />
        <div className="flex-1 flex items-center justify-center px-6">
          <motion.div {...pageTransition} className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="font-display text-3xl font-bold text-foreground mb-4">You're done!</h2>
            <p className="text-muted-foreground text-lg mb-8">
              Your attorney has everything they need. We'll be in touch soon.
            </p>
            <div className="surface-card p-6 text-left space-y-2">
              <p className="text-sm text-muted-foreground">Questions? Contact your legal team:</p>
              <p className="text-foreground font-medium">{caseData.assignedAttorney}</p>
              <p className="text-foreground font-medium">{caseData.assignedParalegal}</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <WizardHeader
        progress={progress}
        step={currentCategoryIdx + 1}
        totalSteps={CATEGORIES.length}
        stepName={CATEGORIES[currentCategoryIdx]}
      />

      {showUrgencyBanner && (
        <div className={`px-4 py-3 text-center text-sm font-medium ${
          caseData.urgency === 'critical'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-warning/10 text-warning'
        }`}>
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {caseData.urgency === 'critical'
            ? `Your filing date is in ${daysLeft} days. Please complete your documents today.`
            : 'Your filing date is coming up. Finishing soon keeps everything on track.'}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 pb-32">
        <AnimatePresence mode="wait">
          {showMilestone !== null ? (
            <motion.div key="milestone" {...pageTransition} className="max-w-md mx-auto text-center">
              <div className="text-6xl mb-6">{showMilestone === 100 ? '🎉' : showMilestone >= 75 ? '🚀' : showMilestone >= 50 ? '💪' : '⭐'}</div>
              <h2 className="font-display text-3xl font-bold text-foreground mb-4">
                {showMilestone}% Complete
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                {MILESTONE_MESSAGES[MILESTONE_THRESHOLDS.indexOf(showMilestone)]}
              </p>
              {showMilestone < 100 && (
                <Button onClick={handleDismissMilestone} size="lg" className="w-full max-w-xs">
                  Keep going →
                </Button>
              )}
            </motion.div>
          ) : showSuccess ? (
            <motion.div key="success" {...pageTransition} className="max-w-md mx-auto text-center">
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-success animate-scale-check" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                {currentItem?.label} saved
              </h2>
              <p className="text-muted-foreground">
                {currentItemIdx < categoryItems.length - 1
                  ? `Next up: ${categoryItems[currentItemIdx + 1]?.label}`
                  : currentCategoryIdx < CATEGORIES.length - 1
                    ? `Next: ${CATEGORIES[currentCategoryIdx + 1]}`
                    : 'Almost done!'}
              </p>
            </motion.div>
          ) : currentItem ? (
            <motion.div key={currentItem.id} {...pageTransition} className="max-w-md mx-auto w-full">
              <header className="mb-8">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2 leading-tight">
                  {currentItem.label}
                </h2>
                <p className="text-muted-foreground text-lg font-body leading-relaxed">
                  {currentItem.description}
                </p>
              </header>

              {/* Why accordion */}
              <button
                onClick={() => setWhyOpen(!whyOpen)}
                className="flex items-center gap-1 text-primary/80 text-sm mb-6 hover:text-primary transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${whyOpen ? 'rotate-180' : ''}`} />
                Why do we need this?
              </button>
              <AnimatePresence>
                {whyOpen && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="text-muted-foreground text-sm leading-relaxed mb-6 overflow-hidden"
                  >
                    {currentItem.whyWeNeedThis}
                  </motion.p>
                )}
              </AnimatePresence>

              {isCheckpointItem ? (
                /* Checkpoint confirmation */
                <div className="space-y-6">
                  <div className="surface-card p-6">
                    <p className="text-foreground leading-relaxed">
                      {currentItem.whyWeNeedThis}
                    </p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg hover:bg-[hsl(var(--surface-hover))] transition-colors">
                    <input
                      type="checkbox"
                      checked={checkpointConfirmed}
                      onChange={e => setCheckpointConfirmed(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded accent-primary"
                    />
                    <span className="text-foreground">
                      I confirm this is accurate to the best of my knowledge
                    </span>
                  </label>
                </div>
              ) : currentItem.files.length > 0 && currentItem.completed ? (
                /* Already uploaded */
                <div className="surface-card glow-success p-6 flex items-center gap-4">
                  <CheckCircle2 className="w-8 h-8 text-success flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">{currentItem.files[0].name}</p>
                    <p className="text-sm text-muted-foreground">Uploaded</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm text-primary hover:underline flex-shrink-0"
                  >
                    Replace
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
                </div>
              ) : (
                /* Upload zone */
                <div
                  className="upload-zone p-12 flex flex-col items-center justify-center cursor-pointer relative"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-12 h-12 text-primary mb-4" />
                  <span className="text-foreground font-medium">Tap to upload or drag file</span>
                  <span className="text-sm text-muted-foreground mt-1">PDF, JPG, or PNG · Max 25MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                  />
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Bottom buttons */}
      {!showSuccess && !showMilestone && currentItem && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border px-6 py-4">
          <div className="max-w-md mx-auto flex flex-col gap-3">
            {isCheckpointItem ? (
              <Button
                onClick={handleCheckpointConfirm}
                size="lg"
                className="w-full"
                disabled={!checkpointConfirmed}
              >
                Continue →
              </Button>
            ) : (
              <Button
                onClick={advanceToNext}
                size="lg"
                className="w-full"
                disabled={!currentItem.completed && currentItem.required}
              >
                Continue →
              </Button>
            )}
            {!currentItem.required && !currentItem.completed && (
              <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                I don't have this yet
              </Button>
            )}
            {(currentItemIdx > 0 || currentCategoryIdx > 0) && (
              <Button variant="ghost" onClick={goBack} size="sm" className="text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const WizardHeader = ({ progress, step, totalSteps, stepName }: { progress: number; step: number; totalSteps: number; stepName: string }) => (
  <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-sm">
    <div className="flex items-center justify-between px-4 py-3">
      <Logo size="sm" />
      <span className="text-sm text-muted-foreground font-body">
        Step {step} of {totalSteps} — {stepName}
      </span>
    </div>
    <div className="h-1 bg-secondary">
      <motion.div
        className="h-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      />
    </div>
    <p className="text-center text-xs text-muted-foreground py-2 font-body">
      {STEP_MOTIVATIONS[Math.min(step - 1, STEP_MOTIVATIONS.length - 1)]}
    </p>
  </div>
);

export default ClientWizard;
