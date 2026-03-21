import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  createCase, updateCase, getFirmSettings, buildCustomChecklist,
  CATEGORIES, type ChapterType, type IntakeAnswers, type Case,
} from '@/lib/store';
import { sendClientWelcome } from '@/lib/notifications';
import { toast } from 'sonner';

interface NewCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (c: Case) => void;
}

interface BasicInfo {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDob: string;
  chapterType: ChapterType;
  filingDeadline: Date | undefined;
  assignedParalegal: string;
  assignedAttorney: string;
}

const INTAKE_QUESTIONS = [
  { key: 'ownsRealEstate' as const, question: 'Does this client own real estate?' },
  { key: 'ownsVehicle' as const, question: 'Does this client own a vehicle?' },
  { key: 'selfEmployed' as const, question: 'Is this client self-employed or do they own a business?' },
  { key: 'hasRetirement' as const, question: 'Does this client have retirement or investment accounts?' },
  { key: 'hasStudentLoans' as const, question: 'Does this client have student loans?' },
  { key: 'filingJointly' as const, question: 'Is this client filing jointly with a spouse?' },
];

const NewCaseModal = ({ open, onOpenChange, onCreated }: NewCaseModalProps) => {
  const firmSettings = getFirmSettings();
  const [step, setStep] = useState(1);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const [info, setInfo] = useState<BasicInfo>({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientDob: '',
    chapterType: '7',
    filingDeadline: undefined,
    assignedParalegal: firmSettings.defaultParalegal || 'Sarah Johnson',
    assignedAttorney: firmSettings.defaultAttorney || 'David Park',
  });

  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});
  const [questionIdx, setQuestionIdx] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const isDirty = info.clientName || info.clientEmail || Object.keys(answers).length > 0;

  const step1Valid = info.clientName && info.clientEmail && info.filingDeadline;

  const allAnswered = INTAKE_QUESTIONS.every(q => answers[q.key] !== undefined);

  const intakeAnswers: IntakeAnswers = {
    ownsRealEstate: answers.ownsRealEstate ?? false,
    ownsVehicle: answers.ownsVehicle ?? false,
    selfEmployed: answers.selfEmployed ?? false,
    hasRetirement: answers.hasRetirement ?? false,
    hasStudentLoans: answers.hasStudentLoans ?? false,
    filingJointly: answers.filingJointly ?? false,
  };

  const customChecklist = useMemo(() => {
    if (!allAnswered) return [];
    return buildCustomChecklist(intakeAnswers);
  }, [allAnswered, ...Object.values(answers)]);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    customChecklist.forEach(item => {
      map[item.category] = (map[item.category] || 0) + 1;
    });
    return (CATEGORIES as readonly string[])
      .filter(cat => map[cat])
      .map(cat => ({ category: cat, count: map[cat] }));
  }, [customChecklist]);

  const handleClose = () => {
    if (isDirty) {
      setShowConfirmClose(true);
    } else {
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setInfo({
      clientName: '', clientEmail: '', clientPhone: '', clientDob: '',
      chapterType: '7', filingDeadline: undefined,
      assignedParalegal: firmSettings.defaultParalegal || 'Sarah Johnson',
      assignedAttorney: firmSettings.defaultAttorney || 'David Park',
    });
    setAnswers({});
    setQuestionIdx(0);
    setShowSummary(false);
    setShowConfirmClose(false);
    onOpenChange(false);
  };

  const handleAnswer = (key: string, value: boolean) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
    if (questionIdx < INTAKE_QUESTIONS.length - 1) {
      setTimeout(() => setQuestionIdx(questionIdx + 1), 300);
    } else {
      setTimeout(() => setShowSummary(true), 300);
    }
  };

  const generateCaseCode = (name: string) => {
    const parts = name.trim().split(' ');
    const last = parts[parts.length - 1] || 'Client';
    const first = parts[0]?.[0] || '';
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${first}${last}-${year}-${rand}`;
  };

  const handleCreate = async () => {
    const caseCode = generateCaseCode(info.clientName);
    const newCase = createCase({
      clientName: info.clientName,
      clientEmail: info.clientEmail,
      clientPhone: info.clientPhone || undefined,
      chapterType: info.chapterType,
      filingDeadline: info.filingDeadline!.toISOString(),
      assignedParalegal: info.assignedParalegal,
      assignedAttorney: info.assignedAttorney,
      checklist: customChecklist,
    });

    // Update case with case_code and client_dob
    const updatedCase = updateCase(newCase.id, (c) => ({
      ...c,
      caseCode,
      clientDob: info.clientDob || undefined,
    }));

    const portalLink = `${window.location.origin}/client/${caseCode}`;
    navigator.clipboard?.writeText(portalLink);
    toast.success('Case created! Client portal link copied to clipboard.');
    onCreated(newCase);
    resetAndClose();

    // Send welcome notification (fire-and-forget)
    if (updatedCase) {
      sendClientWelcome(updatedCase).then(result => {
        const channels = [];
        if (result.email.status === 'sent') channels.push('email');
        if (result.sms.status === 'sent') channels.push('SMS');
        if (channels.length > 0) {
          toast.success(`Welcome notification sent via ${channels.join(' and ')}`);
        }
      }).catch(() => {
        // Silently fail — notifications are best-effort
      });
    }
  };

  const currentQ = INTAKE_QUESTIONS[questionIdx];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto border-border bg-background p-0">
          {/* Progress bar */}
          <div className="h-1 bg-secondary w-full">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>

          <div className="px-6 pt-4 pb-6">
            <DialogHeader>
              <DialogTitle className="font-display font-bold text-xl text-foreground">
                {step === 1 ? 'Step 1 of 2 — Client Info' : 'Step 2 of 2 — Customize Their Checklist'}
              </DialogTitle>
              <DialogDescription className="font-body text-muted-foreground">
                {step === 1
                  ? 'Enter the basic details for this new case.'
                  : 'Answer a few questions about this client and we\'ll set up their document checklist automatically.'}
              </DialogDescription>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="mt-6"
                >
                  <Step1Form info={info} setInfo={setInfo} />
                  <div className="flex justify-end mt-6">
                    <Button onClick={() => { setStep(2); setQuestionIdx(0); setShowSummary(false); }} disabled={!step1Valid}>
                      Next <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 2 && !showSummary && (
                <motion.div
                  key={`q-${questionIdx}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="mt-8"
                >
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground font-body mb-2">
                      Question {questionIdx + 1} of {INTAKE_QUESTIONS.length}
                    </p>
                    <h3 className="font-display font-bold text-xl text-foreground mb-8">
                      {currentQ.question}
                    </h3>
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => handleAnswer(currentQ.key, true)}
                        className={cn(
                          'w-32 h-16 rounded-2xl text-lg font-bold font-display transition-all border-2',
                          answers[currentQ.key] === true
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary text-foreground border-border hover:border-primary/50'
                        )}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleAnswer(currentQ.key, false)}
                        className={cn(
                          'w-32 h-16 rounded-2xl text-lg font-bold font-display transition-all border-2',
                          answers[currentQ.key] === false
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary text-foreground border-border hover:border-primary/50'
                        )}
                      >
                        No
                      </button>
                    </div>

                    {/* Dot indicators */}
                    <div className="flex justify-center gap-2 mt-8">
                      {INTAKE_QUESTIONS.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => { if (answers[INTAKE_QUESTIONS[i].key] !== undefined || i <= questionIdx) setQuestionIdx(i); }}
                          className={cn(
                            'w-2 h-2 rounded-full transition-all',
                            i === questionIdx ? 'bg-primary w-6' : answers[INTAKE_QUESTIONS[i].key] !== undefined ? 'bg-primary/50' : 'bg-secondary'
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between mt-8">
                    <Button variant="ghost" onClick={() => {
                      if (questionIdx > 0) setQuestionIdx(questionIdx - 1);
                      else setStep(1);
                    }}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    {allAnswered && (
                      <Button onClick={() => setShowSummary(true)}>
                        View Summary <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 2 && showSummary && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-6"
                >
                  <div className="surface-card p-5 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Check className="w-5 h-5 text-success" />
                      <h4 className="font-display font-bold text-foreground">Checklist Preview</h4>
                    </div>
                    <p className="text-sm text-muted-foreground font-body mb-4">
                      This checklist has been personalized for {info.clientName || 'this client'}.
                    </p>
                    <div className="space-y-2">
                      {categorySummary.map(({ category, count }) => (
                        <div key={category} className="flex items-center justify-between py-2 px-3 rounded-xl bg-secondary/50">
                          <span className="font-body text-sm text-foreground">{category}</span>
                          <span className="text-sm font-bold text-primary">{count} {count === 1 ? 'item' : 'items'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex justify-between">
                      <span className="text-sm text-muted-foreground font-body">Total</span>
                      <span className="text-sm font-bold text-foreground">{customChecklist.length} items</span>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => {
                      setShowSummary(false);
                      setQuestionIdx(INTAKE_QUESTIONS.length - 1);
                    }}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Edit Answers
                    </Button>
                    <Button onClick={handleCreate}>
                      Create Case <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this case?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved information. Are you sure you want to close?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={resetAndClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const Step1Form = ({ info, setInfo }: { info: BasicInfo; setInfo: (i: BasicInfo) => void }) => {
  const update = <K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) => {
    setInfo({ ...info, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <Label className="text-muted-foreground text-sm">Client Full Name *</Label>
        <Input
          value={info.clientName}
          onChange={e => update('clientName', e.target.value)}
          placeholder="e.g. Maria Rodriguez"
          className="mt-1 bg-input border-border rounded-[10px]"
        />
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Client Email *</Label>
        <Input
          value={info.clientEmail}
          onChange={e => update('clientEmail', e.target.value)}
          type="email"
          placeholder="client@email.com"
          className="mt-1 bg-input border-border rounded-[10px]"
        />
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Client Phone</Label>
        <Input
          value={info.clientPhone}
          onChange={e => update('clientPhone', e.target.value)}
          placeholder="(555) 000-0000"
          className="mt-1 bg-input border-border rounded-[10px]"
        />
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Client Date of Birth</Label>
        <Input
          type="date"
          value={info.clientDob}
          onChange={e => update('clientDob', e.target.value)}
          className="mt-1 bg-input border-border rounded-[10px]"
        />
        <p className="text-xs text-muted-foreground mt-1">Used for client portal verification</p>
      </div>
      <div className="sm:col-span-2">
        <Label className="text-muted-foreground text-sm">Chapter Type *</Label>
        <div className="flex gap-3 mt-1">
          {(['7', '13'] as ChapterType[]).map(ch => (
            <button
              key={ch}
              type="button"
              onClick={() => update('chapterType', ch)}
              className={cn(
                'flex-1 h-12 rounded-2xl text-base font-bold font-display transition-all border-2',
                info.chapterType === ch
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
              )}
            >
              Chapter {ch}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Filing Deadline *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full mt-1 justify-start text-left font-normal bg-input border-border rounded-[10px] h-10',
                !info.filingDeadline && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              {info.filingDeadline ? format(info.filingDeadline, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={info.filingDeadline}
              onSelect={(d) => update('filingDeadline', d)}
              disabled={(date) => date < new Date()}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div />
      <div>
        <Label className="text-muted-foreground text-sm">Assigned Paralegal</Label>
        <Input
          value={info.assignedParalegal}
          onChange={e => update('assignedParalegal', e.target.value)}
          className="mt-1 bg-input border-border rounded-[10px]"
        />
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Assigned Attorney</Label>
        <Input
          value={info.assignedAttorney}
          onChange={e => update('assignedAttorney', e.target.value)}
          className="mt-1 bg-input border-border rounded-[10px]"
        />
      </div>
    </div>
  );
};

export default NewCaseModal;
