import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  CalendarIcon, ArrowRight, ArrowLeft, ChevronDown, ChevronRight, Plus, Copy, Check,
} from 'lucide-react';
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
  createCase, updateCase, getFirmSettings, getDocTemplates, getNamedTemplatesForChapter,
  buildDefaultTemplates, saveDocTemplates,
  CATEGORIES, type ChapterType, type Case, type ChecklistItem, type TemplateItem, type NamedTemplate,
} from '@/lib/store';
import { useAuth } from '@/lib/auth';

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
}

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  email: string;
}

const buildClientName = (first: string, last: string) =>
  [first, last].filter(Boolean).join(' ').trim();

const templateToChecklistItem = (t: TemplateItem): ChecklistItem => ({
  id: crypto.randomUUID(),
  category: t.category,
  label: t.label,
  description: t.description,
  whyWeNeedThis: t.whyWeNeedThis,
  required: t.required,
  files: [],
  flaggedForAttorney: false,
  completed: false,
  isCustom: t.isCustom,
});

const NewCaseModal = ({ open, onOpenChange, onCreated }: NewCaseModalProps) => {
  const firmSettings = getFirmSettings();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);

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

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());
  const [createdPortalLink, setCreatedPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [availableNamedTemplates, setAvailableNamedTemplates] = useState<NamedTemplate[]>([]);

  const loadChecklistFromTemplate = (templateId: string) => {
    if (templateId === 'default') {
      let items = getDocTemplates().filter(t => t.active);
      if (items.length === 0) items = buildDefaultTemplates().filter(t => t.active);
      setChecklist(items.map(templateToChecklistItem));
    } else {
      const named = availableNamedTemplates.find(t => t.id === templateId);
      const items = (named?.items || []).filter(t => t.active);
      setChecklist(items.map(templateToChecklistItem));
    }
    setExcludedItems(new Set());
  };

  // Load templates when entering step 2
  useEffect(() => {
    if (step === 2 && checklist.length === 0) {
      const named = getNamedTemplatesForChapter(info.chapterType);
      setAvailableNamedTemplates(named);
      let items = getDocTemplates().filter(t => t.active);
      // Safety net: if the firm's stored templates yield no active items,
      // fall back to ClearPath defaults so cases are never created empty.
      if (items.length === 0) {
        const defaults = buildDefaultTemplates();
        saveDocTemplates(defaults);
        items = defaults.filter(t => t.active);
      }
      setChecklist(items.map(templateToChecklistItem));
      setExcludedItems(new Set());
      setSelectedTemplateId('default');
    }
  }, [step, checklist.length, info.chapterType]);

  const clientName = buildClientName(info.firstName, info.lastName);
  const isDirty = !!(info.firstName || info.lastName || info.clientEmail);

  const step1Valid = info.firstName && info.lastName && info.clientEmail && info.filingDeadline;

  const includedCount = checklist.length - excludedItems.size;

  const groupedChecklist = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {};
    checklist.forEach(item => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    const cats = (CATEGORIES as readonly string[]).filter(cat => map[cat]);
    // include any non-standard categories (from custom-added items) at the end
    Object.keys(map).forEach(cat => {
      if (!cats.includes(cat)) cats.push(cat);
    });
    return cats.map(cat => ({ category: cat, items: map[cat] }));
  }, [checklist]);

  const handleClose = () => {
    if (createdPortalLink) {
      resetAndClose();
      return;
    }
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
    });
    setChecklist([]);
    setExcludedItems(new Set());
    setSelectedTemplateId('default');
    setAvailableNamedTemplates([]);
    setShowConfirmClose(false);
    setCreatedPortalLink(null);
    setCopied(false);
    setCreating(false);
    onOpenChange(false);
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

  const addCustomItem = (category: string, label: string, description: string) => {
    const id = crypto.randomUUID();
    const newItem: ChecklistItem = {
      id,
      category,
      label,
      description,
      whyWeNeedThis: '',
      required: false,
      files: [],
      flaggedForAttorney: false,
      completed: false,
      isCustom: true,
    };
    setChecklist(prev => [...prev, newItem]);
  };

  const setQuickDeadline = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setInfo(prev => ({ ...prev, filingDeadline: d }));
    setDeadlineOpen(false);
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    const displayName = clientName;
    const caseCode = generateCaseCode(displayName);

    const includedChecklist = checklist.filter(item => !excludedItems.has(item.id));

    const newCase = createCase({
      clientName: displayName,
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
    }));

    try {
      const { error: caseInsertError } = await supabase.from('cases').upsert({
        id: newCase.id,
        firm_id: user?.firmId || null,
        client_name: displayName,
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
        court_case_number: null,
        urgency: 'normal',
        wizard_step: 0,
        ready_to_file: false,
      } as any);

      if (caseInsertError) throw caseInsertError;

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

      const excludedChecklist = checklist.filter(item => excludedItems.has(item.id));
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
        const { error: checklistInsertError } = await supabase.from('checklist_items').insert(allRows);
        if (checklistInsertError) throw checklistInsertError;
      }
    } catch (err) {
      console.error('Failed to sync case to database:', err);
      toast.error('Failed to create case — please try again.');
      setCreating(false);
      return;
    }

    const portalLink = `${window.location.origin}/client/${caseCode}`;
    setCreatedPortalLink(portalLink);
    toast.success('Case created successfully.');
    onCreated(updatedCase);
    setCreating(false);
  };

  const handleCopyLink = () => {
    if (!createdPortalLink) return;
    navigator.clipboard?.writeText(createdPortalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stepProgress = createdPortalLink ? 100 : (step / 3) * 100;
  const stepTitle = createdPortalLink
    ? 'Case Created'
    : step === 1
      ? 'Step 1 of 3 — Debtor Info'
      : step === 2
        ? 'Step 2 of 3 — Review & Confirm Documents'
        : 'Step 3 of 3 — Confirm & Create';
  const stepDescription = createdPortalLink
    ? 'Share the portal link with your client to begin intake.'
    : step === 1
      ? 'Enter the basic details for this new case.'
      : step === 2
        ? 'Review the document checklist for this case. Uncheck anything you don\'t need or add custom items.'
        : 'Review and create the case.';

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
        <DialogContent
          className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto border-border bg-background p-0"
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          <div className="h-1 bg-secondary w-full">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${stepProgress}%` }}
            />
          </div>

          <div className="px-6 pt-4 pb-6">
            <DialogHeader>
              <DialogTitle className="font-display font-bold text-xl text-foreground">
                {stepTitle}
              </DialogTitle>
              <DialogDescription className="font-body text-muted-foreground">
                {stepDescription}
              </DialogDescription>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {!createdPortalLink && step === 1 && (
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
                    deadlineOpen={deadlineOpen}
                    setDeadlineOpen={setDeadlineOpen}
                    onQuickDeadline={setQuickDeadline}
                  />
                  <div className="flex justify-end mt-6">
                    <Button onClick={() => setStep(2)} disabled={!step1Valid}>
                      Next <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {!createdPortalLink && step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4"
                >
                  {availableNamedTemplates.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider mb-2 block">
                        Template
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'default', name: 'Default' },
                          ...availableNamedTemplates.map(t => ({ id: t.id, name: t.name })),
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setSelectedTemplateId(opt.id);
                              loadChecklistFromTemplate(opt.id);
                            }}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-xs font-body border transition-all',
                              selectedTemplateId === opt.id
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-secondary text-muted-foreground border-border hover:border-primary/50',
                            )}
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <span className="font-display font-bold text-foreground">
                      {includedCount} documents requested
                    </span>
                    {excludedItems.size > 0 && (
                      <span className="text-xs text-muted-foreground font-body">
                        {excludedItems.size} excluded
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {groupedChecklist.map(({ category, items }) => (
                      <ChecklistCategorySection
                        key={category}
                        category={category}
                        items={items}
                        excludedItems={excludedItems}
                        onToggle={toggleExcluded}
                        onAddItem={(label, description) => addCustomItem(category, label, description)}
                      />
                    ))}
                  </div>

                  <div className="flex justify-between mt-6">
                    <Button variant="ghost" onClick={() => setStep(1)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button onClick={() => setStep(3)}>
                      Next <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {!createdPortalLink && step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="mt-6"
                >
                  <div className="surface-card rounded-xl p-5 space-y-3">
                    <SummaryRow label="Client" value={clientName} />
                    <SummaryRow label="Email" value={info.clientEmail} />
                    {info.clientPhone && <SummaryRow label="Phone" value={info.clientPhone} />}
                    <SummaryRow label="Chapter" value={`Chapter ${info.chapterType}`} />
                    <SummaryRow
                      label="Filing Deadline"
                      value={info.filingDeadline ? format(info.filingDeadline, 'PPP') : '—'}
                    />
                    <SummaryRow label="Documents" value={`${includedCount} requested`} />
                  </div>

                  <div className="flex justify-between mt-6">
                    <Button variant="ghost" onClick={() => setStep(2)} disabled={creating}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button onClick={handleCreate} disabled={creating}>
                      {creating ? 'Creating…' : 'Create Case'}
                    </Button>
                  </div>
                </motion.div>
              )}

              {createdPortalLink && (
                <motion.div
                  key="created"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-6"
                >
                  <div className="surface-card rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-display font-bold text-foreground">
                        {clientName}'s case is ready
                      </span>
                    </div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                      Client portal link
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        readOnly
                        value={createdPortalLink}
                        className="bg-input border-border rounded-[10px] font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyLink}
                        className="flex-shrink-0"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 font-body">
                      Share this link with your client so they can verify their identity and start uploading documents.
                    </p>
                  </div>

                  <div className="flex justify-end mt-6">
                    <Button onClick={resetAndClose}>Done</Button>
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

// ── Summary Row ──────────────────────────────────────────────────────
const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-xs uppercase tracking-wider text-muted-foreground font-body">{label}</span>
    <span className="text-sm text-foreground font-body text-right">{value}</span>
  </div>
);

// ── Checklist Category Section ───────────────────────────────────────
const ChecklistCategorySection = ({ category, items, excludedItems, onToggle, onAddItem }: {
  category: string;
  items: { id: string; label: string }[];
  excludedItems: Set<string>;
  onToggle: (id: string) => void;
  onAddItem: (label: string, description: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
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
                {item.label}
              </span>
            </label>
          ))}

          {adding ? (
            <AddItemInline
              onCancel={() => setAdding(false)}
              onAdd={(label, description) => {
                onAddItem(label, description);
                setAdding(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 mt-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Inline Add Item Form ─────────────────────────────────────────────
const AddItemInline = ({ onAdd, onCancel }: {
  onAdd: (label: string, description: string) => void;
  onCancel: () => void;
}) => {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div className="mt-2 p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2">
      <Input
        autoFocus
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Document label *"
        className="bg-input border-border rounded-[8px] h-9 text-sm"
      />
      <Input
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="bg-input border-border rounded-[8px] h-9 text-sm"
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!label.trim()} onClick={() => onAdd(label.trim(), description.trim())}>
          Add
        </Button>
      </div>
    </div>
  );
};

// ── Step 1 Form Component ────────────────────────────────────────────
const Step1Form = ({ info, setInfo, deadlineOpen, setDeadlineOpen, onQuickDeadline }: {
  info: BasicInfo;
  setInfo: (i: BasicInfo) => void;
  deadlineOpen: boolean;
  setDeadlineOpen: (o: boolean) => void;
  onQuickDeadline: (days: number) => void;
}) => {
  const update = <K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) => {
    setInfo({ ...info, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="sm:col-span-2">
        <Label className="text-muted-foreground text-sm">Client Date of Birth</Label>
        <div className="flex gap-2 mt-1">
          {/* Month */}
          <select
            value={info.clientDob ? info.clientDob.split('/')[0] || '' : ''}
            onChange={e => {
              const parts = (info.clientDob || '').split('/');
              update('clientDob', `${e.target.value}/${parts[1] || ''}/${parts[2] || ''}`);
            }}
            className="flex-1 h-10 px-3 rounded-[10px] bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Month</option>
            {['January','February','March','April','May','June',
              'July','August','September','October','November','December']
              .map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
              ))}
          </select>
          {/* Day */}
          <select
            value={info.clientDob ? info.clientDob.split('/')[1] || '' : ''}
            onChange={e => {
              const parts = (info.clientDob || '').split('/');
              update('clientDob', `${parts[0] || ''}/${e.target.value}/${parts[2] || ''}`);
            }}
            className="w-20 h-10 px-3 rounded-[10px] bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {/* Year */}
          <select
            value={info.clientDob ? info.clientDob.split('/')[2] || '' : ''}
            onChange={e => {
              const parts = (info.clientDob || '').split('/');
              update('clientDob', `${parts[0] || ''}/${parts[1] || ''}/${e.target.value}`);
            }}
            className="w-24 h-10 px-3 rounded-[10px] bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Year</option>
            {Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - 18 - i)).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Used for client portal verification</p>
      </div>

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

      <div className="sm:col-span-2">
        <Label className="text-muted-foreground text-sm">Filing Deadline *</Label>
        <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
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
              onSelect={(d) => { update('filingDeadline', d); if (d) setDeadlineOpen(false); }}
              disabled={(date) => date < new Date()}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
        <div className="flex gap-2 mt-2">
          {[30, 60, 90].map(days => (
            <Button
              key={days}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onQuickDeadline(days)}
              className="rounded-full h-7 px-3 text-xs"
            >
              {days} days
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Required for case tracking</p>
      </div>
    </div>
  );
};

export default NewCaseModal;
