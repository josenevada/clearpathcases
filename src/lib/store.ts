import { differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// ─── Types ───────────────────────────────────────────────────────────
export type ChapterType = '7' | '13';
export type UrgencyLevel = 'normal' | 'at-risk' | 'critical';
export type CaseStatus = 'active' | 'on-hold' | 'ready-to-file' | 'filed' | 'closed';
export type FileReviewStatus = 'pending' | 'approved' | 'correction-requested' | 'overridden';
export type FileValidationStatus = 'pending' | 'validating' | 'passed' | 'warning' | 'failed' | 'client-confirmed' | 'client-override';
export type ActivityEventType =
  | 'file_upload' | 'file_approved' | 'file_correction' | 'file_reupload'
  | 'file_overridden' | 'file_deleted' | 'item_flagged' | 'milestone_reached' | 'checkpoint_completed'
  | 'case_created' | 'case_ready' | 'reminder_sent' | 'status_change' | 'case_updated'
  | 'ssn_viewed' | 'client_info_updated' | 'notification_sent' | 'document_validated'
  | 'item_not_applicable' | 'case_deleted' | 'notifications_paused'
  | 'item_added' | 'item_removed'
  | 'extraction_triggered_auto' | 'extraction_triggered_manual' | 'extraction_complete' | 'extraction_failed'
  | 'field_overridden' | 'conflict_resolved' | 'forms_generated' | 'forms_approved' | 'share_link_created';

export interface FileValidationResult {
  isCorrectDocumentType: boolean;
  confidenceScore: number;
  extractedYear: string | null;
  extractedName: string | null;
  extractedInstitution: string | null;
  issues: string[];
  suggestion: string;
  validatorNotes: string;
  validationStatus: 'passed' | 'warning' | 'failed';
  validatedAt: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  dataUrl: string;
  storagePath?: string;
  uploadedAt: string;
  reviewStatus: FileReviewStatus;
  reviewNote?: string;
  uploadedBy: 'client' | 'paralegal' | 'plaid';
  validationStatus?: FileValidationStatus;
  validationResult?: FileValidationResult;
  manuallyReviewed?: boolean;
}

export interface CorrectionRequest {
  reason: string;
  details?: string;
  requestedBy: string;
  requestedAt: string;
  targetFileId?: string;
  status: 'open' | 'resolved';
}

export interface TextEntry {
  employerName: string;
  employerAddress?: string;
  selfEmployed?: boolean;
  notEmployed?: boolean;
  savedAt: string;
}

export interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  description: string;
  whyWeNeedThis: string;
  required: boolean;
  conditionalOn?: { itemId: string; answer: string };
  files: UploadedFile[];
  textEntry?: TextEntry;
  flaggedForAttorney: boolean;
  attorneyNote?: string;
  correctionRequest?: CorrectionRequest;
  resubmittedAt?: string;
  completed: boolean;
  notApplicable?: boolean;
  notApplicableReason?: string;
  notApplicableMarkedBy?: string;
  notApplicableAt?: string;
  isCustom?: boolean;
}

export interface ActivityLogEntry {
  id: string;
  eventType: ActivityEventType;
  actorRole: 'client' | 'paralegal' | 'attorney' | 'system';
  actorName: string;
  description: string;
  timestamp: string;
  itemId?: string;
}

export interface InternalNote {
  id: string;
  author: string;
  authorRole: 'paralegal' | 'attorney';
  content: string;
  timestamp: string;
  clientVisible: boolean;
}

export interface Case {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientDob?: string;
  caseCode?: string;
  courtCaseNumber?: string;
  isJointFiling?: boolean;
  spouseName?: string;
  spouseEmail?: string;
  spousePhone?: string;
  spouseDob?: string;
  spouseCaseCode?: string;
  chapterType: ChapterType;
  assignedParalegal: string;
  assignedAttorney: string;
  filingDeadline: string;
  createdAt: string;
  lastClientActivity?: string;
  checklist: ChecklistItem[];
  activityLog: ActivityLogEntry[];
  notes: InternalNote[];
  checkpointsCompleted: string[];
  urgency: UrgencyLevel;
  status: CaseStatus;
  readyToFile: boolean;
  wizardStep: number;
  closedAt?: string;
  retentionNotifiedAt?: string;
  retentionDeleteScheduledAt?: string;
  district?: string;
  meetingDate?: string;
  milestones?: MilestoneEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────
const STORAGE_KEY = 'cp_cases';
const SEEDED_KEY = 'cp_seeded';
const FIRM_SETTINGS_KEY = 'cp_firmSettings';
const TEMPLATES_KEY = 'cp_docTemplates';
const INTAKE_QUESTIONS_KEY = 'cp_intakeQuestions';
const NAMED_TEMPLATES_KEY = 'clearpath_named_templates';

const uid = () => crypto.randomUUID();

// ─── Firm Settings ───────────────────────────────────────────────────
export interface FirmSettings {
  firmName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  phone: string;
  defaultParalegal: string;
  defaultAttorney: string;
}

export const getDefaultFirmSettings = (): FirmSettings => ({
  firmName: '',
  primaryContactName: '',
  primaryContactEmail: '',
  phone: '',
  defaultParalegal: 'Sarah Johnson',
  defaultAttorney: 'David Park',
});

export const getFirmSettings = (): FirmSettings => {
  const raw = localStorage.getItem(FIRM_SETTINGS_KEY);
  return raw ? JSON.parse(raw) : getDefaultFirmSettings();
};

export const saveFirmSettings = (settings: FirmSettings) => {
  localStorage.setItem(FIRM_SETTINGS_KEY, JSON.stringify(settings));
};

// ─── Document Templates ─────────────────────────────────────────────
export interface TemplateItem {
  id: string;
  category: string;
  label: string;
  description: string;
  whyWeNeedThis: string;
  required: boolean;
  active: boolean;
  isCustom: boolean;
  order: number;
}

export const buildDefaultTemplates = (): TemplateItem[] => {
  const items = buildDefaultChecklist();
  return items.map((item, i) => ({
    id: item.id,
    category: item.category,
    label: item.label,
    description: item.description,
    whyWeNeedThis: item.whyWeNeedThis,
    required: item.required,
    active: true,
    isCustom: false,
    order: i,
  }));
};

export const getDocTemplates = (): TemplateItem[] => {
  const raw = localStorage.getItem(TEMPLATES_KEY);
  return raw ? JSON.parse(raw) : buildDefaultTemplates();
};

/**
 * Hydrate localStorage cache from the firm's saved templates in Supabase.
 * Call once after login. If the firm has no saved templates yet, do nothing
 * (localStorage falls back to buildDefaultTemplates()).
 */
export const hydrateDocTemplatesFromFirm = async (firmId: string): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('firms')
      .select('document_templates')
      .eq('id', firmId)
      .maybeSingle();
    if (error) return;
    const remote = (data as unknown as { document_templates?: TemplateItem[] | null } | null)?.document_templates;
    if (Array.isArray(remote) && remote.length > 0) {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(remote));
    }
  } catch {
    // non-blocking — fall back to local cache
  }
};

export const saveDocTemplates = (templates: TemplateItem[]) => {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  // Mirror to Supabase for cross-device sync (fire-and-forget).
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      const { data: userRow } = await supabase
        .from('users')
        .select('firm_id')
        .eq('id', userId)
        .maybeSingle();
      const firmId = userRow?.firm_id;
      if (!firmId) return;
      await supabase
        .from('firms')
        .update({ document_templates: templates as unknown as Json })
        .eq('id', firmId);
    } catch {
      // local cache already updated — silent failure is acceptable
    }
  })();
};

export const resetDocTemplates = () => {
  localStorage.removeItem(TEMPLATES_KEY);
  // Clear remote copy too so other devices fall back to defaults.
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      const { data: userRow } = await supabase
        .from('users')
        .select('firm_id')
        .eq('id', userId)
        .maybeSingle();
      const firmId = userRow?.firm_id;
      if (!firmId) return;
      await supabase
        .from('firms')
        .update({ document_templates: null })
        .eq('id', firmId);
    } catch {
      /* silent */
    }
  })();
};

// ─── Intake Questions ───────────────────────────────────────────────
export interface IntakeQuestion {
  id: string;
  question: string;
  controlsItems: string[];
  active: boolean;
  order: number;
}

export const getDefaultIntakeQuestions = (): IntakeQuestion[] => [
  { id: 'iq-1', question: 'Are you currently employed?', controlsItems: ['Pay Stubs (Last 2 Months)', 'Employer Name'], active: true, order: 0 },
  { id: 'iq-2', question: 'Do you have any bank accounts (checking or savings)?', controlsItems: ['Checking/Savings Statements (Last 6 Months)'], active: true, order: 1 },
  { id: 'iq-3', question: 'Do you have any outstanding loans or credit card debt?', controlsItems: ['Credit Card Statements (Last 3 Months)', 'Loan Statements', 'Collection Notices'], active: true, order: 2 },
  { id: 'iq-4', question: 'Do you own any real estate property?', controlsItems: ['Property Deed', 'Mortgage Statement or Lease'], active: true, order: 3 },
  { id: 'iq-5', question: 'Do you own a vehicle?', controlsItems: ['Vehicle Title or Registration'], active: true, order: 4 },
  { id: 'iq-6', question: 'Do you have any investment or retirement accounts?', controlsItems: ['Investment/Retirement Statements'], active: true, order: 5 },
];

export const getIntakeQuestions = (): IntakeQuestion[] => {
  const raw = localStorage.getItem(INTAKE_QUESTIONS_KEY);
  return raw ? JSON.parse(raw) : getDefaultIntakeQuestions();
};

export const saveIntakeQuestions = (questions: IntakeQuestion[]) => {
  localStorage.setItem(INTAKE_QUESTIONS_KEY, JSON.stringify(questions));
};

// Build checklist from templates (for new cases — no intake filtering)
export const buildChecklistFromTemplates = (): ChecklistItem[] => {
  const templates = getDocTemplates();
  return templates
    .filter(t => t.active)
    .sort((a, b) => a.order - b.order)
    .map(t => ({
      id: uid(),
      category: t.category,
      label: t.label,
      description: t.description,
      whyWeNeedThis: t.whyWeNeedThis,
      required: t.required,
      files: [],
      flaggedForAttorney: false,
      correctionRequest: undefined,
      resubmittedAt: undefined,
      completed: false,
    }));
};

// ─── Intake-Driven Checklist Builder ─────────────────────────────────
export interface IntakeAnswers {
  ownsRealEstate: boolean;
  ownsVehicle: boolean;
  selfEmployed: boolean;
  hasRetirement: boolean;
  hasStudentLoans: boolean;
  filingJointly: boolean;
  isEmployed: boolean;
  hasDigitalWallets: boolean;
  hasCollections: boolean;
  isRenting: boolean;
  hasRentalIncome: boolean;
  hasDomesticSupport: boolean;
  mortgageInArrears?: boolean; // CH.13 only
}

// ─── Chapter 13 Milestone Tracking ──────────────────────────────────
export const CH13_MILESTONES = [
  'Intake Complete',
  'Petition Filed',
  '341 Meeting Scheduled',
  '341 Meeting Held',
  'Plan Filed',
  'Plan Confirmation Hearing',
  'Plan Confirmed',
  'First Payment Due',
] as const;

export type Ch13Milestone = typeof CH13_MILESTONES[number];

export interface MilestoneEntry {
  name: Ch13Milestone;
  date?: string;
  completed: boolean;
}

// ─── Federal Forms by Chapter ───────────────────────────────────────
export const FEDERAL_FORMS_CH7 = [
  'Schedule A/B',
  'Schedule C',
  'Schedule I',
  'Schedule J',
  'Form 122A-1',
  'SOFA (Statement of Financial Affairs)',
];

export const FEDERAL_FORMS_CH13 = [
  'Schedule A/B',
  'Schedule C',
  'Schedule I',
  'Schedule J',
  'Form 122C-1',
  'Form 122C-2',
  'Form 113 (Repayment Plan)',
  'SOFA (Statement of Financial Affairs)',
];

const conditionalItems: Record<string, { category: string; items: Omit<ChecklistItem, 'id' | 'category' | 'files' | 'flaggedForAttorney' | 'completed'>[] }> = {
  ownsRealEstate: {
    category: 'Assets & Property',
    items: [
      { label: 'Homeowners Insurance Declaration', description: 'Upload your current homeowners insurance declaration page.', whyWeNeedThis: 'Homeowners insurance is needed to determine the replacement value of your property for exemption purposes.', required: true },
    ],
  },
  selfEmployed: {
    category: 'Income & Employment',
    items: [
      { label: 'Profit & Loss Statement', description: 'Upload a profit and loss statement for your business for the current year.', whyWeNeedThis: 'The court requires business income documentation to assess your financial situation accurately.', required: true },
      { label: 'Business Bank Statements (Last 6 Months)', description: 'Upload bank statements for all business accounts.', whyWeNeedThis: 'Business account activity must be disclosed separately from personal accounts in bankruptcy filings.', required: true },
      { label: 'Business Tax Returns (Last 2 Years)', description: 'Upload your business tax returns from the last two years.', whyWeNeedThis: 'Business tax returns provide a comprehensive view of business income and expenses for the court.', required: true },
    ],
  },
  hasRetirement: {
    category: 'Bank & Financial Accounts',
    items: [
      { label: '401(k) Account Statement', description: 'Upload your most recent 401(k) statement.', whyWeNeedThis: 'Retirement account balances must be disclosed, though they are typically exempt from the bankruptcy estate.', required: true },
      { label: 'IRA Account Statement', description: 'Upload your most recent IRA statement.', whyWeNeedThis: 'IRA balances must be disclosed and may be subject to different exemption limits.', required: false },
    ],
  },
  hasStudentLoans: {
    category: 'Debts & Credit',
    items: [
      { label: 'Student Loan Statements', description: 'Upload your most recent student loan statements showing current balances.', whyWeNeedThis: 'Student loan debts must be listed in your bankruptcy filing. They are typically non-dischargeable but must still be disclosed.', required: true },
    ],
  },
};

// Labels to EXCLUDE when an intake answer is "No"
const exclusionMap: Record<string, string[]> = {
  ownsRealEstate: ['Mortgage Statement or Lease', 'Property Deed'],
  ownsVehicle: ['Vehicle Title or Registration'],
  hasRetirement: ['Investment/Retirement Statements'],
  isEmployed: ['Pay Stubs (Last 2 Months)', 'Pay Stubs (Last 6 Months)', 'Employer Name'],
  hasDigitalWallets: ['Digital Wallet Statements'],
  hasCollections: ['Collection Notices'],
};

export const buildCustomChecklist = (answers: IntakeAnswers, chapterType: ChapterType = '7'): ChecklistItem[] => {
  const templates = getDocTemplates();
  let items = templates
    .filter(t => t.active)
    .sort((a, b) => a.order - b.order);

  // Exclude items based on "No" answers
  const labelsToExclude = new Set<string>();
  if (!answers.ownsRealEstate) exclusionMap.ownsRealEstate.forEach(l => labelsToExclude.add(l));
  if (!answers.ownsVehicle) exclusionMap.ownsVehicle.forEach(l => labelsToExclude.add(l));
  if (!answers.hasRetirement) exclusionMap.hasRetirement.forEach(l => labelsToExclude.add(l));
  if (!answers.isEmployed) exclusionMap.isEmployed.forEach(l => labelsToExclude.add(l));
  if (!answers.hasDigitalWallets) exclusionMap.hasDigitalWallets.forEach(l => labelsToExclude.add(l));
  if (!answers.hasCollections) exclusionMap.hasCollections.forEach(l => labelsToExclude.add(l));

  let checklist: ChecklistItem[] = items
    .filter(t => !labelsToExclude.has(t.label))
    .map(t => {
      let label = t.label;
      let description = t.description;
      // CH.13: upgrade Tax Returns from 2 years to 4 years
      if (chapterType === '13' && t.label === 'Tax Returns (Last 2 Years)') {
        label = 'Tax Returns (Last 4 Years)';
        description = 'Upload your federal tax returns from the last four years. Chapter 13 requires a longer history to support your repayment plan.';
      }
      // CH.13: upgrade Pay Stubs from 2 months to 6 months
      if (chapterType === '13' && t.label === 'Pay Stubs (Last 2 Months)') {
        label = 'Pay Stubs (Last 6 Months)';
        description = 'Upload your pay stubs from the last 6 months. Chapter 13 requires a longer income history to support your repayment plan.';
      }
      return {
        id: uid(),
        category: t.category,
        label,
        description,
        whyWeNeedThis: t.whyWeNeedThis,
        required: t.required,
        files: [],
        flaggedForAttorney: false,
        correctionRequest: undefined,
        resubmittedAt: undefined,
        completed: false,
      };
    });

  // Renting — swap mortgage statement for rental lease
  if (answers.isRenting) {
    checklist = checklist.filter(i => i.label !== 'Mortgage Statement or Lease');
    const leaseItem: ChecklistItem = {
      id: uid(), category: 'Assets & Property',
      label: 'Rental Lease Agreement',
      description: 'Upload your current rental lease agreement.',
      whyWeNeedThis: 'Your lease shows the court your current housing obligation and monthly rent payment.',
      required: false, files: [], flaggedForAttorney: false, completed: false,
    };
    const propIdx = checklist.findIndex(i => i.category === 'Assets & Property');
    if (propIdx !== -1) checklist.splice(propIdx, 0, leaseItem);
    else checklist.push(leaseItem);
  }

  // Add conditional items for "Yes" answers
  for (const [key, config] of Object.entries(conditionalItems)) {
    if (answers[key as keyof IntakeAnswers]) {
      const newItems: ChecklistItem[] = config.items.map(ci => ({
        ...ci,
        id: uid(),
        category: config.category,
        files: [],
        flaggedForAttorney: false,
        correctionRequest: undefined,
        resubmittedAt: undefined,
        completed: false,
      }));
      const lastIdx = checklist.map(c => c.category).lastIndexOf(config.category);
      if (lastIdx !== -1) {
        checklist.splice(lastIdx + 1, 0, ...newItems);
      } else {
        checklist.push(...newItems);
      }
    }
  }

  // ─── Chapter 13 Additional Documents ──────────────────────────────
  if (chapterType === '13') {
    const ch13Income: ChecklistItem[] = [
      {
        id: uid(), category: 'Income & Employment',
        label: 'Proof of Regular Income — Last 6 Months',
        description: 'Upload documentation showing consistent income over the past 6 months (e.g. pay stubs, deposit records, or income ledgers).',
        whyWeNeedThis: 'Chapter 13 requires demonstrating consistent income to support your repayment plan.',
        required: true, files: [], flaggedForAttorney: false, completed: false,
      },
    ];
    const lastIncomeIdx = checklist.map(c => c.category).lastIndexOf('Income & Employment');
    if (lastIncomeIdx !== -1) checklist.splice(lastIncomeIdx + 1, 0, ...ch13Income);

    // Monthly expense documentation
    const ch13Expenses: ChecklistItem[] = [{
      id: uid(), category: 'Income & Employment',
      label: 'Monthly Expense Documentation',
      description: 'Upload documentation of your regular monthly expenses — utility bills, insurance statements, childcare invoices, medical bills, or any other recurring costs.',
      whyWeNeedThis: 'Your Chapter 13 repayment plan is based on your disposable income — what\'s left after reasonable expenses. The more completely we document your expenses, the more accurate your plan will be.',
      required: true, files: [], flaggedForAttorney: false, completed: false,
    }];
    const expenseInsertIdx = checklist.map(c => c.category).lastIndexOf('Income & Employment');
    if (expenseInsertIdx !== -1) checklist.splice(expenseInsertIdx + 1, 0, ...ch13Expenses);

    // Most recent tax refund documentation
    const taxRefundItems: ChecklistItem[] = [{
      id: uid(), category: 'Bank & Financial Accounts',
      label: 'Most Recent Tax Refund Amount',
      description: 'Upload your most recent tax refund — found on your tax return or IRS transcript.',
      whyWeNeedThis: 'Chapter 13 trustees may claim tax refunds received during your plan period as additional plan payments. Your attorney needs to account for this upfront.',
      required: false, files: [], flaggedForAttorney: false, completed: false,
    }];
    const lastBankIdxRefund = checklist.map(c => c.category).lastIndexOf('Bank & Financial Accounts');
    if (lastBankIdxRefund !== -1) checklist.splice(lastBankIdxRefund + 1, 0, ...taxRefundItems);

    // Domestic support obligations (conditional)
    if (answers.hasDomesticSupport) {
      const dsItems: ChecklistItem[] = [{
        id: uid(), category: 'Income & Employment',
        label: 'Domestic Support Order or Agreement',
        description: 'Upload your divorce decree, court order, or written agreement showing alimony or child support obligations.',
        whyWeNeedThis: 'Domestic support obligations are priority debts in Chapter 13 and must be current for your plan to be confirmed.',
        required: true, files: [], flaggedForAttorney: false, completed: false,
      }];
      const dsIdx = checklist.map(c => c.category).lastIndexOf('Income & Employment');
      if (dsIdx !== -1) checklist.splice(dsIdx + 1, 0, ...dsItems);
    }

    // Rental income (conditional)
    if (answers.hasRentalIncome) {
      const rentalIncomeDoc: ChecklistItem = {
        id: uid(), category: 'Income & Employment',
        label: 'Rental Income Documentation (Last 6 Months)',
        description: 'Upload rent receipts, lease agreements, or bank deposits showing rental income for the last 6 months.',
        whyWeNeedThis: 'Rental income is included in your disposable income calculation for your Chapter 13 repayment plan.',
        required: true, files: [], flaggedForAttorney: false, completed: false,
      };
      const rentalPropDoc: ChecklistItem = {
        id: uid(), category: 'Assets & Property',
        label: 'Rental Property Documents',
        description: 'Upload the deed, mortgage statement, and current lease for any rental properties you own.',
        whyWeNeedThis: 'Rental properties must be accounted for in your Chapter 13 plan — the mortgage, equity, and income all affect how the plan is structured.',
        required: true, files: [], flaggedForAttorney: false, completed: false,
      };
      const rentalIncIdx = checklist.map(c => c.category).lastIndexOf('Income & Employment');
      if (rentalIncIdx !== -1) checklist.splice(rentalIncIdx + 1, 0, rentalIncomeDoc);
      const rentalPropIdx = checklist.map(c => c.category).lastIndexOf('Assets & Property');
      if (rentalPropIdx !== -1) checklist.splice(rentalPropIdx + 1, 0, rentalPropDoc);
      else checklist.push(rentalPropDoc);
    }

    // Property valuation (conditional on owning real estate)
    if (answers.ownsRealEstate) {
      const propItems: ChecklistItem[] = [
        {
          id: uid(), category: 'Assets & Property',
          label: 'Property Valuation or Appraisal',
          description: 'Upload a recent appraisal or valuation of your real estate property.',
          whyWeNeedThis: 'Chapter 13 plans must account for the value of property you intend to keep.',
          required: true, files: [], flaggedForAttorney: false, completed: false,
        },
      ];
      const lastPropIdx = checklist.map(c => c.category).lastIndexOf('Assets & Property');
      if (lastPropIdx !== -1) checklist.splice(lastPropIdx + 1, 0, ...propItems);
    }

    // Vehicle valuation (conditional on owning vehicle)
    if (answers.ownsVehicle) {
      const vehItems: ChecklistItem[] = [
        {
          id: uid(), category: 'Assets & Property',
          label: 'Vehicle Valuation — Kelley Blue Book or Dealer Appraisal',
          description: 'Upload a KBB printout or dealer appraisal for each vehicle you own.',
          whyWeNeedThis: 'Vehicle values must be documented to determine how they are treated in your repayment plan.',
          required: true, files: [], flaggedForAttorney: false, completed: false,
        },
      ];
      const lastVehIdx = checklist.map(c => c.category).lastIndexOf('Assets & Property');
      if (lastVehIdx !== -1) checklist.splice(lastVehIdx + 1, 0, ...vehItems);
    }

    // Mortgage arrears docs (conditional)
    if (answers.mortgageInArrears) {
      const mortgageItems: ChecklistItem[] = [
        {
          id: uid(), category: 'Assets & Property',
          label: 'Mortgage Cure Amount Statement',
          description: 'Upload a statement from your mortgage servicer showing the total amount needed to cure the arrears.',
          whyWeNeedThis: 'The Chapter 13 plan must include the exact cure amount to bring your mortgage current.',
          required: true, files: [], flaggedForAttorney: false, completed: false,
        },
      ];
      const lastMortIdx = checklist.map(c => c.category).lastIndexOf('Assets & Property');
      if (lastMortIdx !== -1) checklist.splice(lastMortIdx + 1, 0, ...mortgageItems);
    }

    // Mortgage payment history (conditional on owning real estate / having mortgage)
    if (answers.ownsRealEstate) {
      const mortHistItems: ChecklistItem[] = [
        {
          id: uid(), category: 'Debts & Credit',
          label: 'Mortgage Payment History — Last 12 Months',
          description: 'Upload a 12-month payment history from your mortgage servicer.',
          whyWeNeedThis: 'The court needs to see your recent mortgage payment pattern to evaluate your Chapter 13 plan.',
          required: true, files: [], flaggedForAttorney: false, completed: false,
        },
      ];
      const lastDebtIdx = checklist.map(c => c.category).lastIndexOf('Debts & Credit');
      if (lastDebtIdx !== -1) checklist.splice(lastDebtIdx + 1, 0, ...mortHistItems);
    }
  }

  // Joint filing: duplicate income, ID, and core bank statement items for spouse
  if (answers.filingJointly) {
    const spouseItems: ChecklistItem[] = [];
    checklist.forEach(ci => {
      if (
        ci.category === 'Income & Employment' ||
        ci.category === 'Personal Identification' ||
        (ci.category === 'Bank & Financial Accounts' && ci.label === 'Checking/Savings Statements (Last 6 Months)')
      ) {
        spouseItems.push({
          ...ci,
          id: uid(),
          label: `${ci.label} (Spouse)`,
          description: `Spouse: ${ci.description}`,
        });
      }
    });
    const lastIncomeIdx = checklist.map(c => c.category).lastIndexOf('Income & Employment');
    const incomeSpouse = spouseItems.filter(s => s.category === 'Income & Employment');
    const idSpouse = spouseItems.filter(s => s.category === 'Personal Identification');
    const bankSpouse = spouseItems.filter(s => s.category === 'Bank & Financial Accounts');
    if (lastIncomeIdx !== -1) checklist.splice(lastIncomeIdx + 1, 0, ...incomeSpouse);
    const lastIdIdx = checklist.map(c => c.category).lastIndexOf('Personal Identification');
    if (lastIdIdx !== -1) checklist.splice(lastIdIdx + 1, 0, ...idSpouse);
    const lastBankIdx = checklist.map(c => c.category).lastIndexOf('Bank & Financial Accounts');
    if (lastBankIdx !== -1) checklist.splice(lastBankIdx + 1, 0, ...bankSpouse);
  }

  return checklist;
};

// Build default milestones for CH.13
export const buildCh13Milestones = (): MilestoneEntry[] =>
  CH13_MILESTONES.map(name => ({ name, completed: false }));

export const calculateUrgency = (c: Case): UrgencyLevel => {
  const daysLeft = differenceInDays(new Date(c.filingDeadline), new Date());
  const total = c.checklist.length;
  const done = c.checklist.filter(isItemEffectivelyComplete).length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const hasCorrections = c.checklist.some(i => i.correctionRequest?.status === 'open' || i.files.some(f => f.reviewStatus === 'correction-requested'));
  const daysSinceActivity = c.lastClientActivity
    ? differenceInDays(new Date(), new Date(c.lastClientActivity))
    : 999;

  if (daysLeft <= 7 && pct < 80) return 'critical';
  if (daysSinceActivity >= 3 || hasCorrections) return 'at-risk';
  return 'normal';
};

/**
 * Determines if a checklist item is effectively complete from the client's perspective.
 * An item is complete when it has at least one uploaded file (or text entry) AND has no open correction request.
 * Also honors the persisted `completed` flag from the database for cross-device consistency.
 * This is the single source of truth for progress calculations across the entire app.
 */
export const isItemEffectivelyComplete = (item: ChecklistItem): boolean => {
  if (item.notApplicable) return true;
  if (item.correctionRequest?.status === 'open') return false;
  // Text-entry items are complete if they have a saved entry
  if (item.textEntry?.savedAt) return true;
  // File-based items are complete if they have at least one file
  if (item.files.length > 0) return true;
  // Honor the persisted completed flag from the database (cross-device persistence)
  if (item.completed) return true;
  return false;
};

export const calculateProgress = (c: Case): number => {
  // N/A items are excluded from both numerator and denominator
  const applicable = c.checklist.filter(i => !i.notApplicable);
  const total = applicable.length;
  if (total === 0) return 0;
  return Math.round((applicable.filter(isItemEffectivelyComplete).length / total) * 100);
};

// ─── CRUD ────────────────────────────────────────────────────────────
const normalizeCase = (c: Case): Case => ({
  ...c,
  status: c.status || 'active',
  checklist: c.checklist.map(item => ({
    ...item,
    correctionRequest: item.correctionRequest,
    resubmittedAt: item.resubmittedAt,
  })),
});

export const getAllCases = (): Case[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map(normalizeCase);
};

export const getCase = (id: string): Case | undefined => {
  return getAllCases().find(c => c.id === id);
};

export const saveCases = (cases: Case[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
};

export const createCase = (data: Omit<Case, 'id' | 'createdAt' | 'activityLog' | 'notes' | 'checkpointsCompleted' | 'urgency' | 'readyToFile' | 'wizardStep' | 'status'> & { checklist?: ChecklistItem[] }): Case => {
  const newCase: Case = {
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    clientPhone: data.clientPhone,
    chapterType: data.chapterType,
    assignedParalegal: data.assignedParalegal,
    assignedAttorney: data.assignedAttorney,
    filingDeadline: data.filingDeadline,
    id: uid(),
    createdAt: new Date().toISOString(),
    checklist: data.checklist || buildChecklistFromTemplates(),
    activityLog: [{
      id: uid(),
      eventType: 'case_created',
      actorRole: 'system',
      actorName: 'ClearPath',
      description: `Case created for ${data.clientName}`,
      timestamp: new Date().toISOString(),
    }],
    notes: [],
    checkpointsCompleted: [],
    urgency: 'normal',
    status: 'active',
    readyToFile: false,
    wizardStep: 0,
  };
  const cases = getAllCases();
  cases.push(newCase);
  saveCases(cases);
  return newCase;
};

export const updateCase = (id: string, updater: (c: Case) => Case): Case | undefined => {
  const cases = getAllCases();
  const idx = cases.findIndex(c => c.id === id);
  if (idx === -1) return undefined;
  let updated = updater(cases[idx]);
  updated.urgency = calculateUrgency(updated);
  cases[idx] = updated;
  saveCases(cases);
  return updated;
};

export const deleteCase = (id: string): void => {
  const cases = getAllCases().filter(c => c.id !== id);
  saveCases(cases);
};

export const addActivityEntry = (caseId: string, entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): void => {
  updateCase(caseId, c => ({
    ...c,
    activityLog: [...c.activityLog, { ...entry, id: uid(), timestamp: new Date().toISOString() }],
  }));
};

// ─── Default Checklist ───────────────────────────────────────────────
export const CATEGORIES = [
  'Income & Employment',
  'Bank & Financial Accounts',
  'Debts & Credit',
  'Assets & Property',
  'Personal Identification',
  'Agreements & Confirmation',
] as const;

export const STEP_MOTIVATIONS = [
  "Most people finish this part in just a few minutes.",
  "You're building momentum — keep it up.",
  "Take your time with this one. There's no rush.",
  "You're doing great — over halfway done.",
  "Almost there. Just a few more things to go.",
  "Final stretch — you've got this.",
];

const item = (category: string, label: string, description: string, whyWeNeedThis: string, required = true): ChecklistItem => ({
  id: uid(),
  category,
  label,
  description,
  whyWeNeedThis,
  required,
  files: [],
  flaggedForAttorney: false,
  correctionRequest: undefined,
  resubmittedAt: undefined,
  completed: false,
});

export const buildDefaultChecklist = (): ChecklistItem[] => [
  // Step 1: Income & Employment
  item('Income & Employment', 'Pay Stubs (Last 2 Months)', 'Upload your most recent pay stubs from the last 60 days.', 'Your pay stubs show the court what you\'re currently earning. Think of it as proof that you qualify for the fresh start you\'re asking for.'),
  item('Income & Employment', 'W-2s (Last 2 Years)', 'Upload your W-2 forms from the last two tax years.', 'W-2s help your attorney show the court your work history. It\'s a standard part of every filing — nothing unusual.'),
  item('Income & Employment', 'Tax Returns (Last 2 Years)', 'Upload your federal tax returns from the last two years.', 'Your tax returns give the court the big picture of your finances. Every bankruptcy filing includes these.'),
  item('Income & Employment', 'Employer Name', 'Tell us where you work so we can include it on your paperwork.', 'This goes directly on your bankruptcy petition. If you\'re not working right now, just let us know — that\'s totally fine.', false),

  // Step 2: Bank & Financial Accounts
  item('Bank & Financial Accounts', 'Checking/Savings Statements (Last 6 Months)', 'Upload bank statements for all your checking and savings accounts.', 'The trustee looks at these to understand your day-to-day finances. Six months is the standard — it\'s the same for everyone.'),
  item('Bank & Financial Accounts', 'Digital Wallet Statements', 'Used Venmo, PayPal, or Cash App in the last 12 months? We need to include those too.', 'Digital wallets count as financial accounts under bankruptcy law. The trustee needs to see all money movement — even Venmo. Missing these could cause problems with your case.'),
  item('Bank & Financial Accounts', 'Investment/Retirement Statements', 'Upload statements for any investment or retirement accounts.', 'Good news — retirement accounts are usually protected. We just need to document them so your attorney can make sure they\'re covered.', false),

  // Step 3: Debts & Credit
  item('Debts & Credit', 'Credit Card Statements (Last 3 Months)', 'Upload your most recent credit card statements.', 'We need these so we can make a complete list of what you owe. The more accurate the list, the better your filing goes.'),
  item('Debts & Credit', 'Loan Statements', 'Upload statements for any auto loans, personal loans, or student loans.', 'Every debt needs to be listed in your filing. This makes sure nothing slips through the cracks.'),
  item('Debts & Credit', 'Collection Notices', 'Got any letters from collectors? Upload them here.', 'Including collection accounts in your filing is how we stop them from contacting you. The more you upload, the more protection you get.', false),

  // Step 4: Assets & Property
  item('Assets & Property', 'Mortgage Statement or Lease', 'Upload your mortgage statement or rental lease.', 'Your housing situation affects how your case is structured. Whether you rent or own, this helps your attorney pick the right strategy.'),
  item('Assets & Property', 'Vehicle Title or Registration', 'Upload your car title or registration if you own a vehicle.', 'We need to know about your vehicles so your attorney can make sure they\'re protected under the right exemptions.', false),
  item('Assets & Property', 'Property Deed', 'Upload the deed if you own any real property.', 'Property ownership is a big factor in bankruptcy. Your attorney needs this to figure out the best way to protect your home.', false),

  // Step 5: Personal Identification
  item('Personal Identification', 'Government-Issued Photo ID', 'Upload a clear photo of your driver\'s license, passport, or state ID.', 'The court needs to verify your identity before your case can be filed. A simple photo of your ID is all we need.'),
  item('Personal Identification', 'Social Security Card', 'Upload a photo or scan of your Social Security card. A clear photo taken with your phone works perfectly.', 'Your SSN goes on every page of the bankruptcy petition. It\'s required by the court — uploading the card itself helps your attorney verify accuracy.'),

  // Step 6: Agreements & Confirmation
  item('Agreements & Confirmation', 'Credit Counseling Certificate', 'Upload your certificate from an approved credit counseling course.', 'Federal law says everyone has to complete a short counseling session before filing. Most people do it online in under an hour.'),
  item('Agreements & Confirmation', 'Financial Disclosure Confirmation', 'Please confirm that all financial information you\'ve provided is accurate and complete.', 'This is just you saying "yes, everything I shared is true to the best of my knowledge." It\'s a standard part of the process.'),
  item('Agreements & Confirmation', 'Assets Disclosure Confirmation', 'Please confirm that you\'ve told us about everything you own.', 'The court takes this seriously, so we want to make sure nothing was accidentally left out. No surprises is the goal.'),
  item('Agreements & Confirmation', 'Final Confirmation', 'One last check — confirm everything looks good before your attorney takes over.', 'This wraps up your part. After this, your attorney reviews everything and starts preparing your petition.'),
];

// ─── Seed Data ───────────────────────────────────────────────────────
export const seedIfNeeded = () => {
  if (localStorage.getItem(SEEDED_KEY)) return;

  // No demo cases — start with a clean empty state
  saveCases([]);
  localStorage.setItem(SEEDED_KEY, 'true');
};
