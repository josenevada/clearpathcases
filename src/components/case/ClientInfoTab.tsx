import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Loader2, Check, Eye, EyeOff, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { type Case } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ViewRole = 'paralegal' | 'attorney';

interface ClientInfoTabProps {
  caseData: Case;
  viewRole: ViewRole;
  actorName: string;
  onRefresh: () => void;
}

interface ClientInfo {
  full_legal_name: string;
  date_of_birth: string | null;
  ssn_encrypted: string;
  current_address: string;
  phone: string;
  email: string;
  marital_status: string;
  employment_status: string;
  employer_name: string;
  employer_address: string;
  job_title: string;
  monthly_gross_income: number | null;
  pay_frequency: string;
  business_name: string;
  business_type: string;
  avg_monthly_income: number | null;
  last_employer_name: string;
  date_last_employment: string | null;
  household_size: number;
  num_dependents: number;
  expense_rent: number;
  expense_utilities: number;
  expense_food: number;
  expense_transportation: number;
  expense_insurance: number;
  expense_other: number;
  other_expenses_description: string;
  spouse_name: string;
  spouse_email: string;
  spouse_phone: string;
  spouse_dob: string | null;
}

const defaultClientInfo: ClientInfo = {
  full_legal_name: '',
  date_of_birth: null,
  ssn_encrypted: '',
  current_address: '',
  phone: '',
  email: '',
  marital_status: '',
  employment_status: 'employed',
  employer_name: '',
  employer_address: '',
  job_title: '',
  monthly_gross_income: null,
  pay_frequency: '',
  business_name: '',
  business_type: '',
  avg_monthly_income: null,
  last_employer_name: '',
  date_last_employment: null,
  household_size: 1,
  num_dependents: 0,
  expense_rent: 0,
  expense_utilities: 0,
  expense_food: 0,
  expense_transportation: 0,
  expense_insurance: 0,
  expense_other: 0,
  other_expenses_description: '',
  spouse_name: '',
  spouse_email: '',
  spouse_phone: '',
  spouse_dob: null,
};

interface AttorneyNotes {
  content: string;
}

const inputClass = 'bg-input border-border rounded-[10px]';

// ─── Section wrapper ─────────────────────────────────────────────────
interface SectionProps {
  title: string;
  children: React.ReactNode;
  saving: boolean;
  hasChanges: boolean;
  onSave: () => void;
  saveSuccess: boolean;
  defaultOpen?: boolean;
}

const Section = ({ title, children, saving, hasChanges, onSave, saveSuccess, defaultOpen = false }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="surface-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 transition-colors hover:bg-[hsl(var(--surface-hover))]"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
          <span className="font-display font-bold text-foreground">{title}</span>
        </div>
        {open && (
          <Button
            size="sm"
            disabled={!hasChanges || saving}
            onClick={e => { e.stopPropagation(); onSave(); }}
            className="rounded-full px-4 h-8 text-xs font-bold"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3 h-3" />
            ) : (
              'Save'
            )}
          </Button>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-1 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Dollar Input ────────────────────────────────────────────────────
const DollarInput = ({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
    <Input
      type="number"
      min={0}
      value={value || ''}
      onChange={e => onChange(Number(e.target.value) || 0)}
      placeholder={placeholder || '0'}
      className={`${inputClass} pl-7`}
    />
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────
const ClientInfoTab = ({ caseData, viewRole, actorName, onRefresh }: ClientInfoTabProps) => {
  const [info, setInfo] = useState<ClientInfo>({ ...defaultClientInfo, full_legal_name: caseData.clientName, email: caseData.clientEmail, phone: caseData.clientPhone || '' });
  const [savedInfo, setSavedInfo] = useState<ClientInfo>(info);
  const [attorneyNotes, setAttorneyNotes] = useState<AttorneyNotes>({ content: '' });
  const [savedAttorneyNotes, setSavedAttorneyNotes] = useState<AttorneyNotes>({ content: '' });
  const [loading, setLoading] = useState(true);

  // SSN state
  const [ssnVisible, setSsnVisible] = useState(false);
  const [ssnTimer, setSsnTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Section save states
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [successPersonal, setSuccessPersonal] = useState(false);
  const [savingEmployment, setSavingEmployment] = useState(false);
  const [successEmployment, setSuccessEmployment] = useState(false);
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [successHousehold, setSuccessHousehold] = useState(false);
  const [savingAttorney, setSavingAttorney] = useState(false);
  const [successAttorney, setSuccessAttorney] = useState(false);

  useEffect(() => {
    loadData();
  }, [caseData.id]);

  const [isJointFiling, setIsJointFiling] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [{ data }, { data: caseRow }] = await Promise.all([
      supabase.from('client_info').select('*').eq('case_id', caseData.id).maybeSingle(),
      supabase.from('cases').select('is_joint_filing, spouse_name, spouse_email').eq('id', caseData.id).maybeSingle(),
    ]);

    const caseSpouseName = (caseRow as any)?.spouse_name || '';
    const caseSpouseEmail = (caseRow as any)?.spouse_email || '';
    setIsJointFiling(Boolean((caseRow as any)?.is_joint_filing) || Boolean(caseSpouseName));

    if (data) {
      const loaded: ClientInfo = {
        full_legal_name: data.full_legal_name || caseData.clientName,
        date_of_birth: data.date_of_birth,
        ssn_encrypted: data.ssn_encrypted || '',
        current_address: data.current_address || '',
        phone: data.phone || caseData.clientPhone || '',
        email: data.email || caseData.clientEmail,
        marital_status: data.marital_status || '',
        employment_status: data.employment_status || 'employed',
        employer_name: data.employer_name || '',
        employer_address: data.employer_address || '',
        job_title: data.job_title || '',
        monthly_gross_income: data.monthly_gross_income,
        pay_frequency: data.pay_frequency || '',
        business_name: data.business_name || '',
        business_type: data.business_type || '',
        avg_monthly_income: data.avg_monthly_income,
        last_employer_name: data.last_employer_name || '',
        date_last_employment: data.date_last_employment,
        household_size: data.household_size ?? 1,
        num_dependents: data.num_dependents ?? 0,
        expense_rent: Number(data.expense_rent) || 0,
        expense_utilities: Number(data.expense_utilities) || 0,
        expense_food: Number(data.expense_food) || 0,
        expense_transportation: Number(data.expense_transportation) || 0,
        expense_insurance: Number(data.expense_insurance) || 0,
        expense_other: Number(data.expense_other) || 0,
        other_expenses_description: data.other_expenses_description || '',
        spouse_name: (data as any).spouse_name || caseSpouseName,
        spouse_email: (data as any).spouse_email || caseSpouseEmail,
        spouse_phone: (data as any).spouse_phone || '',
        spouse_dob: (data as any).spouse_dob || null,
      };
      setInfo(loaded);
      setSavedInfo(loaded);
    } else {
      const initial: ClientInfo = {
        ...defaultClientInfo,
        full_legal_name: caseData.clientName,
        email: caseData.clientEmail,
        phone: caseData.clientPhone || '',
        date_of_birth: caseData.clientDob || null,
        spouse_name: caseSpouseName,
        spouse_email: caseSpouseEmail,
      };
      setInfo(initial);
      setSavedInfo(initial);
    }

    if (viewRole === 'attorney') {
      const { data: noteData } = await supabase
        .from('attorney_notes')
        .select('*')
        .eq('case_id', caseData.id)
        .maybeSingle();

      if (noteData) {
        const n = { content: noteData.content || '' };
        setAttorneyNotes(n);
        setSavedAttorneyNotes(n);
      }
    }

    setLoading(false);
  };

  const update = (field: keyof ClientInfo, value: any) => {
    setInfo(prev => ({ ...prev, [field]: value }));
  };

  // SSN handling
  const handleRevealSSN = () => {
    setSsnVisible(true);
    (async () => {
      await supabase.from('activity_log').insert({
        case_id: caseData.id,
        event_type: 'ssn_viewed',
        actor_role: viewRole,
        actor_name: actorName,
        description: `${actorName} viewed SSN`,
      });
    })();
    onRefresh();

    if (ssnTimer) clearTimeout(ssnTimer);
    const timer = setTimeout(() => setSsnVisible(false), 30000);
    setSsnTimer(timer);
  };

  const maskedSSN = useMemo(() => {
    if (!info.ssn_encrypted) return '';
    const last4 = info.ssn_encrypted.slice(-4);
    return `•••••••${last4}`;
  }, [info.ssn_encrypted]);

  // Save helpers
  const upsertClientInfo = async (fields: Partial<ClientInfo>) => {
    const { data: existing } = await supabase
      .from('client_info')
      .select('id')
      .eq('case_id', caseData.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('client_info').update({ ...fields, updated_at: new Date().toISOString() }).eq('case_id', caseData.id);
    } else {
      await supabase.from('client_info').insert({ case_id: caseData.id, ...fields });
    }
  };

  const flashSuccess = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  // Personal info save
  const personalChanged = info.full_legal_name !== savedInfo.full_legal_name ||
    info.date_of_birth !== savedInfo.date_of_birth ||
    info.ssn_encrypted !== savedInfo.ssn_encrypted ||
    info.current_address !== savedInfo.current_address ||
    info.phone !== savedInfo.phone ||
    info.email !== savedInfo.email ||
    info.marital_status !== savedInfo.marital_status;

  const savePersonal = async () => {
    setSavingPersonal(true);
    try {
      await upsertClientInfo({
        full_legal_name: info.full_legal_name,
        date_of_birth: info.date_of_birth,
        ssn_encrypted: info.ssn_encrypted,
        current_address: info.current_address,
        phone: info.phone,
        email: info.email,
        marital_status: info.marital_status,
      });

      // Sync contact info back to cases table so notifications always use the latest
      const contactUpdates: Record<string, string | null> = {};
      if (info.phone !== savedInfo.phone) contactUpdates.client_phone = info.phone || null;
      if (info.email !== savedInfo.email) contactUpdates.client_email = info.email;
      if (Object.keys(contactUpdates).length > 0) {
        await supabase.from('cases').update(contactUpdates).eq('id', caseData.id);
      }

      // Sync DOB to cases table
      if (info.date_of_birth !== savedInfo.date_of_birth) {
        await supabase.from('cases').update({ client_dob: info.date_of_birth }).eq('id', caseData.id);
      }

      await supabase.from('activity_log').insert({ case_id: caseData.id, event_type: 'client_info_updated', actor_role: viewRole, actor_name: actorName, description: `${actorName} updated client information` });
      setSavedInfo(prev => ({ ...prev, full_legal_name: info.full_legal_name, date_of_birth: info.date_of_birth, ssn_encrypted: info.ssn_encrypted, current_address: info.current_address, phone: info.phone, email: info.email, marital_status: info.marital_status }));
      flashSuccess(setSuccessPersonal);

      // Show specific toast if contact info changed
      const contactChanged = info.phone !== savedInfo.phone || info.email !== savedInfo.email;
      if (contactChanged) {
        toast.success('Contact information updated. Future notifications will be sent to the new email and phone number.');
      } else {
        toast.success('Personal information saved');
      }
      onRefresh();
    } catch {
      toast.error('Failed to save personal information');
    }
    setSavingPersonal(false);
  };

  // Employment save
  const employmentChanged = info.employment_status !== savedInfo.employment_status ||
    info.employer_name !== savedInfo.employer_name ||
    info.employer_address !== savedInfo.employer_address ||
    info.job_title !== savedInfo.job_title ||
    info.monthly_gross_income !== savedInfo.monthly_gross_income ||
    info.pay_frequency !== savedInfo.pay_frequency ||
    info.business_name !== savedInfo.business_name ||
    info.business_type !== savedInfo.business_type ||
    info.avg_monthly_income !== savedInfo.avg_monthly_income ||
    info.last_employer_name !== savedInfo.last_employer_name ||
    info.date_last_employment !== savedInfo.date_last_employment;

  const saveEmployment = async () => {
    setSavingEmployment(true);
    try {
      await upsertClientInfo({
        employment_status: info.employment_status,
        employer_name: info.employer_name,
        employer_address: info.employer_address,
        job_title: info.job_title,
        monthly_gross_income: info.monthly_gross_income,
        pay_frequency: info.pay_frequency,
        business_name: info.business_name,
        business_type: info.business_type,
        avg_monthly_income: info.avg_monthly_income,
        last_employer_name: info.last_employer_name,
        date_last_employment: info.date_last_employment,
      });
      await supabase.from('activity_log').insert({ case_id: caseData.id, event_type: 'client_info_updated', actor_role: viewRole, actor_name: actorName, description: `${actorName} updated client information` });
      setSavedInfo(prev => ({ ...prev, employment_status: info.employment_status, employer_name: info.employer_name, employer_address: info.employer_address, job_title: info.job_title, monthly_gross_income: info.monthly_gross_income, pay_frequency: info.pay_frequency, business_name: info.business_name, business_type: info.business_type, avg_monthly_income: info.avg_monthly_income, last_employer_name: info.last_employer_name, date_last_employment: info.date_last_employment }));
      flashSuccess(setSuccessEmployment);
      toast.success('Employment information saved');
      onRefresh();
    } catch {
      toast.error('Failed to save employment information');
    }
    setSavingEmployment(false);
  };

  // Household save
  const householdChanged = info.household_size !== savedInfo.household_size ||
    info.num_dependents !== savedInfo.num_dependents ||
    info.expense_rent !== savedInfo.expense_rent ||
    info.expense_utilities !== savedInfo.expense_utilities ||
    info.expense_food !== savedInfo.expense_food ||
    info.expense_transportation !== savedInfo.expense_transportation ||
    info.expense_insurance !== savedInfo.expense_insurance ||
    info.expense_other !== savedInfo.expense_other ||
    info.other_expenses_description !== savedInfo.other_expenses_description;

  const saveHousehold = async () => {
    setSavingHousehold(true);
    try {
      await upsertClientInfo({
        household_size: info.household_size,
        num_dependents: info.num_dependents,
        expense_rent: info.expense_rent,
        expense_utilities: info.expense_utilities,
        expense_food: info.expense_food,
        expense_transportation: info.expense_transportation,
        expense_insurance: info.expense_insurance,
        expense_other: info.expense_other,
        other_expenses_description: info.other_expenses_description,
      });
      await supabase.from('activity_log').insert({ case_id: caseData.id, event_type: 'client_info_updated', actor_role: viewRole, actor_name: actorName, description: `${actorName} updated client information` });
      setSavedInfo(prev => ({ ...prev, household_size: info.household_size, num_dependents: info.num_dependents, expense_rent: info.expense_rent, expense_utilities: info.expense_utilities, expense_food: info.expense_food, expense_transportation: info.expense_transportation, expense_insurance: info.expense_insurance, expense_other: info.expense_other, other_expenses_description: info.other_expenses_description }));
      flashSuccess(setSuccessHousehold);
      toast.success('Household information saved');
      onRefresh();
    } catch {
      toast.error('Failed to save household information');
    }
    setSavingHousehold(false);
  };

  // Attorney notes save
  const attorneyChanged = attorneyNotes.content !== savedAttorneyNotes.content;

  const saveAttorneyNotes = async () => {
    setSavingAttorney(true);
    try {
      const { data: existing } = await supabase
        .from('attorney_notes')
        .select('id')
        .eq('case_id', caseData.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('attorney_notes').update({ content: attorneyNotes.content, updated_at: new Date().toISOString(), updated_by: actorName }).eq('case_id', caseData.id);
      } else {
        await supabase.from('attorney_notes').insert({ case_id: caseData.id, content: attorneyNotes.content, updated_by: actorName });
      }

      setSavedAttorneyNotes({ content: attorneyNotes.content });
      flashSuccess(setSuccessAttorney);
      toast.success('Attorney notes saved');
    } catch {
      toast.error('Failed to save attorney notes');
    }
    setSavingAttorney(false);
  };

  const totalExpenses = info.expense_rent + info.expense_utilities + info.expense_food + info.expense_transportation + info.expense_insurance + info.expense_other;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Personal Information */}
      <Section title="Personal Information" saving={savingPersonal} hasChanges={personalChanged} onSave={savePersonal} saveSuccess={successPersonal} defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full Legal Name</Label>
            <Input value={info.full_legal_name} onChange={e => update('full_legal_name', e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date of Birth</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", inputClass)}>
                  {info.date_of_birth ? format((() => { const [y,m,d] = info.date_of_birth!.split('-').map(Number); return new Date(y, m-1, d); })(), 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={info.date_of_birth ? (() => { const [y,m,d] = info.date_of_birth!.split('-').map(Number); return new Date(y, m-1, d); })() : undefined}
                  onSelect={d => update('date_of_birth', d ? d.toISOString().slice(0, 10) : null)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phone Number</Label>
            <Input type="tel" value={info.phone} onChange={e => update('phone', e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email Address</Label>
            <Input type="email" value={info.email} onChange={e => update('email', e.target.value)} className={inputClass} />
          </div>
        </div>
      </Section>

    </div>
  );
};

export default ClientInfoTab;
