import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { CalendarIcon, ArrowRight, ArrowLeft, Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
import { sendWelcomeSms } from '@/lib/sms';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

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
  courtCaseNumber: string;
  chapterType: ChapterType;
  filingDeadline: Date | undefined;
  assignedParalegal: string;
  assignedAttorney: string;
  // Joint filing spouse fields
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

const BASE_INTAKE_QUESTIONS = [
  { key: 'ownsRealEstate' as const, question: 'Does this client own real estate?' },
  { key: 'ownsVehicle' as const, question: 'Does this client own a vehicle?' },
  { key: 'selfEmployed' as const, question: 'Is this client self-employed or do they own a business?' },
  { key: 'hasRetirement' as const, question: 'Does this client have retirement or investment accounts?' },
  { key: 'hasStudentLoans' as const, question: 'Does this client have student loans?' },
  { key: 'filingJointly' as const, question: 'Is this client filing jointly with a spouse?' },
];

const CH13_EXTRA_QUESTIONS = [
  { key: 'mortgageInArrears' as const, question: 'Is this client\'s mortgage currently in arrears or behind on payments?' },
];

const NewCaseModal = ({ open, onOpenChange, onCreated }: NewCaseModalProps) => {
  const firmSettings = getFirmSettings();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);

  // PROMPT 4: Load team members from database
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

  // Auto-select if only one member
  const defaultParalegal = paralegals.length === 1 ? paralegals[0].full_name : (firmSettings.defaultParalegal || '');
  const defaultAttorney = attorneys.length === 1 ? attorneys[0].full_name : (firmSettings.defaultAttorney || '');

  const [info, setInfo] = useState<BasicInfo>({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientDob: '',
    courtCaseNumber: '',
    chapterType: '7',
    filingDeadline: undefined,
    assignedParalegal: defaultParalegal,
    assignedAttorney: defaultAttorney,
    spouseName: '',
    spouseEmail: '',
    spousePhone: '',
    spouseDob: '',
  });

  // Update defaults when team loads
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

  // Build chapter-aware question list
  const INTAKE_QUESTIONS = useMemo(() => {
    const base = [...BASE_INTAKE_QUESTIONS];
    if (info.chapterType === '13') {
      // Insert CH.13 questions after the real estate question
      const realEstateIdx = base.findIndex(q => q.key === 'ownsRealEstate');
      base.splice(realEstateIdx + 1, 0, ...CH13_EXTRA_QUESTIONS);
    }
    return base;
  }, [info.chapterType]);

  const isDirty = info.clientName || info.clientEmail || Object.keys(answers).length > 0;

  const isJointFiling = answers.filingJointly === true;
  const step1Valid = info.clientName && info.clientEmail && info.filingDeadline &&
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
      clientName: '', clientEmail: '', clientPhone: '', clientDob: '', courtCaseNumber: '',
      chapterType: '7', filingDeadline: undefined,
      assignedParalegal: defaultParalegal,
      assignedAttorney: defaultAttorney,
      spouseName: '', spouseEmail: '', spousePhone: '', spouseDob: '',
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
    const displayName = isJointFiling && info.spouseName
      ? `${info.clientName.split(' ')[0]} & ${info.spouseName.split(' ')[0]} ${info.clientName.split(' ').slice(-1)[0]}`
      : info.clientName;
    const newCase = createCase({
      clientName: displayName,
      clientEmail: info.clientEmail,
      clientPhone: info.clientPhone || undefined,
      chapterType: info.chapterType,
      filingDeadline: info.filingDeadline!.toISOString(),
      assignedParalegal: info.assignedParalegal,
      assignedAttorney: info.assignedAttorney,
      checklist: customChecklist,
    });

    const updatedCase = updateCase(newCase.id, (c) => ({
      ...c,
      caseCode,
      clientDob: info.clientDob || undefined,
    }));

    try {
      await supabase.from('cases').upsert({
        id: newCase.id,
        client_name: info.clientName,
        client_email: info.clientEmail,
        client_phone: info.clientPhone || null,
        client_dob: info.clientDob || null,
        chapter_type: info.chapterType,
        filing_deadline: info.filingDeadline!.toISOString().split('T')[0],
        assigned_paralegal: info.assignedParalegal,
        assigned_attorney: info.assignedAttorney,
        case_code: caseCode,
        court_case_number: info.courtCaseNumber || null,
        urgency: 'normal',
        wizard_step: 0,
        ready_to_file: false,
      });

      const checklistRows = newCase.checklist.map((item, idx) => ({
        id: item.id,
        case_id: newCase.id,
        category: item.category,
        label: item.label,
        description: item.description,
        why_we_need_this: item.whyWeNeedThis,
        required: item.required,
        completed: false,
        sort_order: idx,
        input_type: item.label === 'Employer Name & Address' ? 'text' : 'file',
      }));
      await supabase.from('checklist_items').insert(checklistRows);
    } catch (err) {
      console.error('Failed to sync case to database:', err);
    }

    const portalLink = `${window.location.origin}/client/${caseCode}`;
    navigator.clipboard?.writeText(portalLink);
    toast.success('Case created! Client portal link copied to clipboard.');
    onCreated(newCase);
    resetAndClose();

    const caseForNotification = updatedCase || { ...newCase, caseCode };
    sendClientWelcome(caseForNotification).then(result => {
      const channels = [];
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

    sendWelcomeSms(
      info.clientPhone || undefined,
      info.clientName,
      caseCode,
      newCase.id,
      firmSettings.firmName || 'your attorney\'s office',
    ).catch((err) => console.error('Welcome SMS error:', err));
  };

  const currentQ = INTAKE_QUESTIONS[questionIdx];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto border-border bg-background p-0">
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
                    paralegals={paralegals}
                    attorneys={attorneys}
                    currentUserId={user?.id}
                    currentUserName={user?.fullName}
                    currentUserRole={user?.role}
                    isJointFiling={isJointFiling}
                    onToggleJoint={(v) => setAnswers(prev => ({ ...prev, filingJointly: v }))}
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

// PROMPT 4 + PROMPT 6: Step1Form with live team member dropdowns and joint filing spouse fields
const Step1Form = ({ info, setInfo, paralegals, attorneys, currentUserId, currentUserName, currentUserRole, isJointFiling, onToggleJoint }: {
  info: BasicInfo;
  setInfo: (i: BasicInfo) => void;
  paralegals: TeamMember[];
  attorneys: TeamMember[];
  currentUserId?: string;
  currentUserName?: string;
  currentUserRole?: string;
  isJointFiling?: boolean;
  onToggleJoint?: (v: boolean) => void;
}) => {
  const update = <K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) => {
    setInfo({ ...info, [key]: value });
  };

  const renderTeamSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    members: TeamMember[],
    role: string,
  ) => {
    if (members.length === 0) {
      return (
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-sm">{label}</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input disabled placeholder={`No ${role}s on the team yet`} className="bg-input border-border rounded-[10px] flex-1" />
            <Link to="/paralegal/settings/firm/team" className="text-xs text-primary hover:underline whitespace-nowrap flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add team member
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-sm">{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="mt-1 bg-input border-border rounded-[10px]">
            <SelectValue placeholder={`Select ${role}`} />
          </SelectTrigger>
          <SelectContent>
            {/* Current user first with (You) label */}
            {members
              .sort((a, b) => {
                if (a.id === currentUserId) return -1;
                if (b.id === currentUserId) return 1;
                return a.full_name.localeCompare(b.full_name);
              })
              .map(m => (
                <SelectItem key={m.id} value={m.full_name}>
                  {m.full_name}{m.id === currentUserId ? ' (You)' : ''}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <Label className="text-muted-foreground text-sm">Client Full Name *</Label>
        <Input
          value={info.clientName}
          onChange={e => update('clientName', e.target.value)}
          placeholder="Full name"
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
        <p className="text-xs text-muted-foreground mt-1">Required for case tracking</p>
      </div>
      <div>
        <Label className="text-muted-foreground text-sm">Court Case Number</Label>
        <Input
          value={info.courtCaseNumber}
          onChange={e => update('courtCaseNumber', e.target.value)}
          placeholder="Assigned by court after filing — e.g. 24-12345-ABC"
          className="mt-1 bg-input border-border rounded-[10px]"
        />
        <p className="text-xs text-muted-foreground mt-1">You can add this later once the court assigns it.</p>
      </div>
      <div />
      {renderTeamSelect('Assigned Paralegal', info.assignedParalegal, v => update('assignedParalegal', v), paralegals, 'paralegal')}
      {renderTeamSelect('Assigned Attorney', info.assignedAttorney, v => update('assignedAttorney', v), attorneys, 'attorney')}

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

      {/* Spouse Fields — shown when joint filing */}
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
