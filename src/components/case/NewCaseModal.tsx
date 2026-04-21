import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { CalendarIcon, ArrowRight, ArrowLeft, Check, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  createCase, updateCase, getFirmSettings, buildCustomChecklist, buildCh13Milestones,
  CATEGORIES, type ChapterType, type IntakeAnswers, type Case,
} from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { sendClientWelcome } from '@/lib/notifications';

import { toast } from 'sonner';

interface NewCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (c: Case) => void;
}

interface BasicInfo {
  firstName: string;
  lastName: string;
  clientEmail: string;
  clientPhone: string;
  clientDob: string;
  chapterType: ChapterType;
  filingDeadline: Date | undefined;
  assignedParalegal: string;
  assignedAttorney: string;
  spouseName: string;
  spouseEmail: string;
  spousePhone: string;
  spouseDob: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  email: string;
}

interface IntakeQuestionDef {
  key: string;
  question: string;
}

const BASE_INTAKE_QUESTIONS: IntakeQuestionDef[] = [
  { key: 'ownsRealEstate', question: 'Does this client own real estate?' },
  { key: 'ownsVehicle', question: 'Does this client own a vehicle?' },
  { key: 'selfEmployed', question: 'Is this client self-employed or do they own a business?' },
  { key: 'hasRetirement', question: 'Does this client have retirement or investment accounts?' },
  { key: 'hasStudentLoans', question: 'Does this client have student loans?' },
];

const CH13_EXTRA_QUESTIONS: IntakeQuestionDef[] = [
  { key: 'mortgageInArrears', question: 'Is this client\'s mortgage currently in arrears or behind on payments?' },
];

const buildClientName = (first: string, last: string) =>
  [first, last].filter(Boolean).join(' ').trim();

const NewCaseModal = ({ open, onOpenChange, onCreated }: NewCaseModalProps) => {
  const firmSettings = getFirmSettings();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [clientLanguage, setClientLanguage] = useState<'en' | 'es'>('en');

  useEffect(() => {
    if (!open || teamLoaded) return;
    const loadTeam = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, role, email')
        .in('role', ['paralegal', 'attorney', 'admin']);
      setTeamMembers(data || []);
      setTeamLoaded(true);
    };
    loadTeam();
  }, [open, teamLoaded]);

  const paralegals = teamMembers.filter(m => m.role === 'paralegal' || m.role === 'admin');
  const attorneys = teamMembers.filter(m => m.role === 'attorney' || m.role === 'admin');

  const defaultParalegal = paralegals.length === 1 ? paralegals[0].full_name : (firmSettings.defaultParalegal || '');
  const defaultAttorney = attorneys.length === 1 ? attorneys[0].full_name : (firmSettings.defaultAttorney || '');

  const [info, setInfo] = useState<BasicInfo>({
    firstName: '',
    lastName: '',
    clientEmail: '',
    clientPhone: '',
    clientDob: '',
    chapterType: '7',
    filingDeadline: undefined,
    assignedParalegal: defaultParalegal,
    assignedAttorney: defaultAttorney,
    spouseName: '',
    spouseEmail: '',
    spousePhone: '',
    spouseDob: '',
  });

  useEffect(() => {
    if (teamLoaded) {
      setInfo(prev => ({
        ...prev,
        assignedParalegal: prev.assignedParalegal || defaultParalegal,
        assignedAttorney: prev.assignedAttorney || defaultAttorney,
      }));
    }
  }, [teamLoaded, defaultParalegal, defaultAttorney]);

  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});
  const [questionIdx, setQuestionIdx] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());

  const INTAKE_QUESTIONS = useMemo(() => {
    const base = [...BASE_INTAKE_QUESTIONS];
    if (info.chapterType === '13') {
      const realEstateIdx = base.findIndex(q => q.key === 'ownsRealEstate');
      base.splice(realEstateIdx + 1, 0, ...CH13_EXTRA_QUESTIONS);
    }
    return base;
  }, [info.chapterType]);

  const clientName = buildClientName(info.firstName, info.lastName);
  const isDirty = info.firstName || info.lastName || info.clientEmail || Object.keys(answers).length > 0;

  const isJointFiling = answers.filingJointly === true;
  const step1Valid = info.firstName && info.lastName && info.clientEmail && info.filingDeadline &&
    (!isJointFiling || (info.spouseName && info.spouseEmail && info.spouseDob));

  const allAnswered = INTAKE_QUESTIONS.every(q => answers[q.key] !== undefined);

  const intakeAnswers: IntakeAnswers = {
    ownsRealEstate: answers.ownsRealEstate ?? false,
    ownsVehicle: answers.ownsVehicle ?? false,
    selfEmployed: answers.selfEmployed ?? false,
    hasRetirement: answers.hasRetirement ?? false,
    hasStudentLoans: answers.hasStudentLoans ?? false,
    filingJointly: answers.filingJointly ?? false,
    mortgageInArrears: answers.mortgageInArrears ?? false,
  };

  const customChecklist = useMemo(() => {
    if (!allAnswered) return [];
    return buildCustomChecklist(intakeAnswers, info.chapterType);
  }, [allAnswered, info.chapterType, ...Object.values(answers)]);

  // Reset excluded items when checklist changes
  useEffect(() => {
    setExcludedItems(new Set());
  }, [customChecklist.length]);

  const includedCount = customChecklist.length - excludedItems.size;

  const groupByCategory = (list: typeof customChecklist) => {
    const map: Record<string, typeof customChecklist> = {};
    list.forEach(item => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    return (CATEGORIES as readonly string[])
      .filter(cat => map[cat])
      .map(cat => ({ category: cat, items: map[cat] }));
  };

  const groupedChecklist = useMemo(
    () => groupByCategory(customChecklist),
    [customChecklist],
  );

  const primaryItems = useMemo(
    () => customChecklist.filter(item => !item.label.includes('(Spouse)')),
    [customChecklist],
  );
  const spouseItems = useMemo(
    () => customChecklist.filter(item => item.label.includes('(Spouse)')),
    [customChecklist],
  );
  const primaryGrouped = useMemo(() => groupByCategory(primaryItems), [primaryItems]);
  const spouseGrouped = useMemo(() => groupByCategory(spouseItems), [spouseItems]);

  const primaryExcludedCount = primaryItems.filter(i => excludedItems.has(i.id)).length;
  const spouseExcludedCount = spouseItems.filter(i => excludedItems.has(i.id)).length;

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
      firstName: '', lastName: '',
      clientEmail: '', clientPhone: '', clientDob: '',
      chapterType: '7', filingDeadline: undefined,
      assignedParalegal: defaultParalegal,
      assignedAttorney: defaultAttorney,
      spouseName: '', spouseEmail: '', spousePhone: '', spouseDob: '',
    });
    setAnswers({});
    setQuestionIdx(0);
    setShowSummary(false);
    setExcludedItems(new Set());
    setShowConfirmClose(false);
    setClientLanguage('en');
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

  const toggleExcluded = (itemId: string) => {
    setExcludedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleCreate = async () => {
    const displayName = clientName;
    const caseCode = generateCaseCode(displayName);
    const spouseCaseCode = isJointFiling && info.spouseName
      ? `${generateCaseCode(info.spouseName)}-S`
      : null;
    const jointDisplayName = isJointFiling && info.spouseName
      ? `${info.firstName} & ${info.spouseName.split(' ')[0]} ${info.lastName}`
      : displayName;

    const includedChecklist = customChecklist.filter(item => !excludedItems.has(item.id));

    const newCase = createCase({
      clientName: jointDisplayName,
      clientEmail: info.clientEmail,
      clientPhone: info.clientPhone || undefined,
      chapterType: info.chapterType,
      filingDeadline: info.filingDeadline!.toISOString(),
      assignedParalegal: info.assignedParalegal,
      assignedAttorney: info.assignedAttorney,
      checklist: includedChecklist,
    });

    const updatedCase = updateCase(newCase.id, (c) => ({
      ...c,
      caseCode,
      clientDob: info.clientDob || undefined,
      isJointFiling,
      spouseName: isJointFiling ? info.spouseName : undefined,
      spouseEmail: isJointFiling ? info.spouseEmail : undefined,
      spousePhone: isJointFiling ? info.spousePhone : undefined,
      spouseDob: isJointFiling ? info.spouseDob : undefined,
      spouseCaseCode: spouseCaseCode || undefined,
      milestones: info.chapterType === '13' ? buildCh13Milestones() : undefined,
    }));

    try {
      await supabase.from('cases').upsert({
        id: newCase.id,
        firm_id: user?.firmId || null,
        client_name: jointDisplayName,
        client_first_name: info.firstName,
        client_middle_name: null,
        client_last_name: info.lastName,
        client_suffix: null,
        client_email: info.clientEmail,
        client_phone: info.clientPhone || null,
        client_dob: info.clientDob || null,
        chapter_type: info.chapterType,
        filing_deadline: info.filingDeadline!.toISOString().split('T')[0],
        assigned_paralegal: info.assignedParalegal,
        assigned_attorney: info.assignedAttorney,
        case_code: caseCode,
        spouse_case_code: spouseCaseCode,
        court_case_number: null,
        urgency: 'normal',
        wizard_step: 0,
        ready_to_file: false,
        client_language: clientLanguage,
        is_joint_filing: isJointFiling,
        spouse_name: isJointFiling ? info.spouseName : null,
        spouse_email: isJointFiling ? info.spouseEmail : null,
        spouse_phone: isJointFiling ? info.spousePhone : null,
        spouse_dob: isJointFiling ? info.spouseDob || null : null,
      } as any);

      if (isJointFiling && info.spouseName) {
        await supabase.from('client_info').upsert({
          case_id: newCase.id,
          spouse_name: info.spouseName,
          spouse_email: info.spouseEmail || null,
          spouse_phone: info.spousePhone || null,
          spouse_dob: info.spouseDob || null,
        } as any);
      }

      // Insert included items normally
      const includedRows = includedChecklist.map((item, idx) => ({
        id: item.id,
        case_id: newCase.id,
        category: item.category,
        label: item.label,
        description: item.description,
        why_we_need_this: item.whyWeNeedThis,
        required: item.required,
        completed: false,
        sort_order: idx,
        input_type: item.label === 'Employer Name' ? 'text' : 'file',
      }));

      // Insert excluded items as not_applicable
      const excludedChecklist = customChecklist.filter(item => excludedItems.has(item.id));
      const excludedRows = excludedChecklist.map((item, idx) => ({
        id: item.id,
        case_id: newCase.id,
        category: item.category,
        label: item.label,
        description: item.description,
        why_we_need_this: item.whyWeNeedThis,
        required: item.required,
        completed: false,
        sort_order: includedChecklist.length + idx,
        input_type: item.label === 'Employer Name' ? 'text' : 'file',
        not_applicable: true,
        not_applicable_marked_by: 'attorney',
      }));

      const allRows = [...includedRows, ...excludedRows];
      if (allRows.length > 0) {
        await supabase.from('checklist_items').insert(allRows);
      }
    } catch (err) {
      console.error('Failed to sync case to database:', err);
    }

    const portalLink = `${window.location.origin}/client/${caseCode}`;
    navigator.clipboard?.writeText(portalLink);
    toast.success('Case created — portal link copied to clipboard!');
    onCreated(updatedCase);
    resetAndClose();

    const caseForNotification = updatedCase || { ...newCase, caseCode };
    sendClientWelcome(caseForNotification).then(result => {
      const channels: string[] = [];
      if (result.email.status === 'sent') channels.push('email');
      if (result.sms.status === 'sent') channels.push('SMS');
      if (channels.length > 0) {
        toast.success(`Welcome notification sent via ${channels.join(' and ')} to ${info.clientEmail}`);
      } else {
        toast.info('Case created. Notification delivery is pending.');
      }
    }).catch((err) => {
      console.error('Notification error:', err);
      toast.error('Case created but welcome notification failed to send.');
    });
  };

  const currentQ = INTAKE_QUESTIONS[questionIdx];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
        <DialogContent
          className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto border-border bg-background p-0"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
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
                  <Step1Form
                    info={info}
                    setInfo={setInfo}
                    isJointFiling={isJointFiling}
                    onToggleJoint={(v) => setAnswers(prev => ({ ...prev, filingJointly: v }))}
                    clientLanguage={clientLanguage}
                    setClientLanguage={setClientLanguage}
                  />
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
                        Review Checklist <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 2 && showSummary && (
                <motion.div
                  key="checklist-editor"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-primary" />
                      <span className="font-display font-bold text-foreground">
                        {isJointFiling
                          ? `${primaryItems.length - primaryExcludedCount} for ${info.firstName} ${info.lastName} · ${spouseItems.length - spouseExcludedCount} for ${info.spouseName.split(' ')[0]}`
                          : `${includedCount} documents requested`}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-body">
                      {excludedItems.size > 0 && `${excludedItems.size} excluded`}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground font-body mb-4">
                    Uncheck any documents this client doesn't need. Excluded items will be marked as not applicable.
                  </p>

                  <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                    {!isJointFiling && groupedChecklist.map(({ category, items }) => (
                      <ChecklistCategorySection
                        key={category}
                        category={category}
                        items={items}
                        excludedItems={excludedItems}
                        onToggle={toggleExcluded}
                      />
                    ))}

                    {isJointFiling && (
                      <>
                        <div>
                          <span className="bg-primary/10 text-primary text-[11px] font-semibold px-3 py-1 rounded-full mb-3 inline-block">
                            👤 {info.firstName} {info.lastName}
                          </span>
                          <div className="space-y-3">
                            {primaryGrouped.map(({ category, items }) => (
                              <ChecklistCategorySection
                                key={`p-${category}`}
                                category={category}
                                items={items}
                                excludedItems={excludedItems}
                                onToggle={toggleExcluded}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-border/40 my-4" />

                        <div>
                          <span className="bg-secondary text-muted-foreground text-[11px] font-semibold px-3 py-1 rounded-full mb-3 inline-block">
                            👤 {info.spouseName}
                          </span>
                          <div className="space-y-3">
                            {spouseGrouped.map(({ category, items }) => (
                              <ChecklistCategorySection
                                key={`s-${category}`}
                                category={category.replace(' (Spouse)', '')}
                                items={items}
                                excludedItems={excludedItems}
                                onToggle={toggleExcluded}
                                labelTransform={(label) => label.replace(' (Spouse)', '')}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex justify-between mt-6">
                    <Button variant="ghost" onClick={() => {
                      setShowSummary(false);
                      setQuestionIdx(INTAKE_QUESTIONS.length - 1);
                    }}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Edit Answers
                    </Button>
                    <Button onClick={handleCreate}>
                      <Link2 className="w-4 h-4 mr-1" /> Create Case & Copy Link
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

// ── Checklist Category Section ───────────────────────────────────────
const ChecklistCategorySection = ({ category, items, excludedItems, onToggle, labelTransform }: {
  category: string;
  items: { id: string; label: string }[];
  excludedItems: Set<string>;
  onToggle: (id: string) => void;
  labelTransform?: (label: string) => string;
}) => {
  const [open, setOpen] = useState(true);
  const includedCount = items.filter(i => !excludedItems.has(i.id)).length;

  return (
    <div className="surface-card rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="font-body text-sm font-bold text-foreground">{category}</span>
        </div>
        <span className="text-xs text-muted-foreground font-body">{includedCount}/{items.length}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1">
          {items.map(item => (
            <label
              key={item.id}
              className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/20 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={!excludedItems.has(item.id)}
                onCheckedChange={() => onToggle(item.id)}
              />
              <span className={cn(
                'text-sm font-body transition-colors',
                excludedItems.has(item.id) ? 'text-muted-foreground line-through' : 'text-foreground'
              )}>
                {labelTransform ? labelTransform(item.label) : item.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Step 1 Form Component ────────────────────────────────────────────
const Step1Form = ({ info, setInfo, isJointFiling, onToggleJoint, clientLanguage, setClientLanguage }: {
  info: BasicInfo;
  setInfo: (i: BasicInfo) => void;
  isJointFiling?: boolean;
  onToggleJoint?: (v: boolean) => void;
  clientLanguage?: 'en' | 'es';
  setClientLanguage?: (lang: 'en' | 'es') => void;
}) => {
  const update = <K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) => {
    setInfo({ ...info, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Name fields */}
      <div>
        <Label className="text-muted-foreground text-sm">First Name *</Label>
        <Input
          value={info.firstName}
          onChange={e => update('firstName', e.target.value)}
          placeholder="First name"
          className="mt-1 bg-input border-border rounded-[10px]"
        />
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Last Name *</Label>
        <Input
          value={info.lastName}
          onChange={e => update('lastName', e.target.value)}
          placeholder="Last name"
          className="mt-1 bg-input border-border rounded-[10px]"
        />
      </div>

      {/* Contact info */}
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

      {/* Language selector */}
      {setClientLanguage && (
        <div className="sm:col-span-2">
          <Label className="text-muted-foreground text-sm">Client's preferred language</Label>
          <div className="flex gap-3 mt-1">
            {([
              { value: 'en' as const, label: 'English' },
              { value: 'es' as const, label: 'Español' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setClientLanguage(opt.value)}
                className={cn(
                  'flex-1 h-11 rounded-2xl text-sm font-bold font-display transition-all border-2',
                  clientLanguage === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* Case details */}
      <div className="sm:col-span-2 mt-2">
        <div className="h-px bg-border" />
        <p className="text-xs font-bold text-primary mt-3 mb-1 uppercase tracking-wider">Case Details</p>
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
        <p className="text-xs text-muted-foreground mt-1">Required for case tracking</p>
      </div>

      {/* Joint Filing Toggle */}
      {onToggleJoint && (
        <div className="sm:col-span-2 mt-2">
          <div className="surface-card p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground text-sm font-bold">Filing jointly with a spouse?</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Joint filings require additional spouse documents</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onToggleJoint(true)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-bold transition-all border-2',
                    isJointFiling
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => onToggleJoint(false)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-bold transition-all border-2',
                    isJointFiling === false
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
                  )}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spouse Fields */}
      {isJointFiling && (
        <>
          <div className="sm:col-span-2 mt-2">
            <div className="h-px bg-border" />
            <p className="text-xs font-bold text-primary mt-3 mb-1 uppercase tracking-wider">Spouse Information</p>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-muted-foreground text-sm">Spouse Full Legal Name *</Label>
            <Input
              value={info.spouseName}
              onChange={e => update('spouseName', e.target.value)}
              placeholder="Spouse full name"
              className="mt-1 bg-input border-border rounded-[10px]"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm">Spouse Email *</Label>
            <Input
              value={info.spouseEmail}
              onChange={e => update('spouseEmail', e.target.value)}
              type="email"
              placeholder="spouse@email.com"
              className="mt-1 bg-input border-border rounded-[10px]"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm">Spouse Phone</Label>
            <Input
              value={info.spousePhone}
              onChange={e => update('spousePhone', e.target.value)}
              placeholder="(555) 000-0000"
              className="mt-1 bg-input border-border rounded-[10px]"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm">Spouse Date of Birth *</Label>
            <Input
              type="date"
              value={info.spouseDob}
              onChange={e => update('spouseDob', e.target.value)}
              className="mt-1 bg-input border-border rounded-[10px]"
            />
            <p className="text-xs text-muted-foreground mt-1">Used for portal verification</p>
          </div>
        </>
      )}
    </div>
  );
};

export default NewCaseModal;
