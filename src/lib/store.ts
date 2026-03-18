import { differenceInDays } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────
export type ChapterType = '7' | '13';
export type UrgencyLevel = 'normal' | 'at-risk' | 'critical';
export type FileReviewStatus = 'pending' | 'approved' | 'correction-requested' | 'overridden';
export type ActivityEventType =
  | 'file_upload' | 'file_approved' | 'file_correction' | 'file_reupload'
  | 'file_overridden' | 'item_flagged' | 'milestone_reached' | 'checkpoint_completed'
  | 'case_created' | 'case_ready' | 'reminder_sent';

export interface UploadedFile {
  id: string;
  name: string;
  dataUrl: string;
  uploadedAt: string;
  reviewStatus: FileReviewStatus;
  reviewNote?: string;
  uploadedBy: 'client' | 'paralegal';
}

export interface CorrectionRequest {
  reason: string;
  details?: string;
  requestedBy: string;
  requestedAt: string;
  targetFileId?: string;
  status: 'open' | 'resolved';
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
  flaggedForAttorney: boolean;
  attorneyNote?: string;
  correctionRequest?: CorrectionRequest;
  resubmittedAt?: string;
  completed: boolean;
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
  readyToFile: boolean;
  wizardStep: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const STORAGE_KEY = 'cp_cases';
const SEEDED_KEY = 'cp_seeded';
const FIRM_SETTINGS_KEY = 'cp_firmSettings';
const TEMPLATES_KEY = 'cp_docTemplates';
const INTAKE_QUESTIONS_KEY = 'cp_intakeQuestions';

const uid = () => Math.random().toString(36).substr(2, 9);

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

export const saveDocTemplates = (templates: TemplateItem[]) => {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
};

export const resetDocTemplates = () => {
  localStorage.removeItem(TEMPLATES_KEY);
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
  { id: 'iq-1', question: 'Are you currently employed?', controlsItems: ['Pay Stubs (Last 2 Months)', 'Employer Name & Address'], active: true, order: 0 },
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
}

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
};

export const buildCustomChecklist = (answers: IntakeAnswers): ChecklistItem[] => {
  const templates = getDocTemplates();
  let items = templates
    .filter(t => t.active)
    .sort((a, b) => a.order - b.order);

  // Exclude items based on "No" answers
  const labelsToExclude = new Set<string>();
  if (!answers.ownsRealEstate) exclusionMap.ownsRealEstate.forEach(l => labelsToExclude.add(l));
  if (!answers.ownsVehicle) exclusionMap.ownsVehicle.forEach(l => labelsToExclude.add(l));
  if (!answers.hasRetirement) exclusionMap.hasRetirement.forEach(l => labelsToExclude.add(l));

  let checklist: ChecklistItem[] = items
    .filter(t => !labelsToExclude.has(t.label))
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
      // Insert after existing items in that category
      const lastIdx = checklist.map(c => c.category).lastIndexOf(config.category);
      if (lastIdx !== -1) {
        checklist.splice(lastIdx + 1, 0, ...newItems);
      } else {
        checklist.push(...newItems);
      }
    }
  }

  // Joint filing: duplicate income & ID items for spouse
  if (answers.filingJointly) {
    const spouseItems: ChecklistItem[] = [];
    checklist.forEach(ci => {
      if (ci.category === 'Income & Employment' || ci.category === 'Personal Identification') {
        spouseItems.push({
          ...ci,
          id: uid(),
          label: `${ci.label} (Spouse)`,
          description: `Spouse: ${ci.description}`,
        });
      }
    });
    // Insert spouse income items after income section, spouse ID after ID section
    const lastIncomeIdx = checklist.map(c => c.category).lastIndexOf('Income & Employment');
    const incomeSpouse = spouseItems.filter(s => s.category === 'Income & Employment');
    const idSpouse = spouseItems.filter(s => s.category === 'Personal Identification');
    if (lastIncomeIdx !== -1) checklist.splice(lastIncomeIdx + 1, 0, ...incomeSpouse);
    const lastIdIdx = checklist.map(c => c.category).lastIndexOf('Personal Identification');
    if (lastIdIdx !== -1) checklist.splice(lastIdIdx + 1, 0, ...idSpouse);
  }

  return checklist;
};

export const calculateUrgency = (c: Case): UrgencyLevel => {
  const daysLeft = differenceInDays(new Date(c.filingDeadline), new Date());
  const total = c.checklist.length;
  const done = c.checklist.filter(i => i.completed).length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const hasCorrections = c.checklist.some(i => i.files.some(f => f.reviewStatus === 'correction-requested'));
  const daysSinceActivity = c.lastClientActivity
    ? differenceInDays(new Date(), new Date(c.lastClientActivity))
    : 999;

  if (daysLeft <= 7 && pct < 80) return 'critical';
  if (daysSinceActivity >= 3 || hasCorrections) return 'at-risk';
  return 'normal';
};

export const calculateProgress = (c: Case): number => {
  const total = c.checklist.length;
  if (total === 0) return 0;
  return Math.round((c.checklist.filter(i => i.completed).length / total) * 100);
};

// ─── CRUD ────────────────────────────────────────────────────────────
export const getAllCases = (): Case[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
};

export const getCase = (id: string): Case | undefined => {
  return getAllCases().find(c => c.id === id);
};

export const saveCases = (cases: Case[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
};

export const createCase = (data: Omit<Case, 'id' | 'createdAt' | 'activityLog' | 'notes' | 'checkpointsCompleted' | 'urgency' | 'readyToFile' | 'wizardStep'> & { checklist?: ChecklistItem[] }): Case => {
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
  "Most people finish this step in about 3 minutes.",
  "You're building momentum — keep going.",
  "This is the most important step. Take your time.",
  "Over halfway there. You're doing great.",
  "Almost done. Just a few more things.",
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
  completed: false,
});

export const buildDefaultChecklist = (): ChecklistItem[] => [
  // Step 1: Income & Employment
  item('Income & Employment', 'Pay Stubs (Last 2 Months)', 'Upload your most recent pay stubs from the last 60 days.', 'The court requires proof of your current income to determine your eligibility for bankruptcy protection.'),
  item('Income & Employment', 'W-2s (Last 2 Years)', 'Upload your W-2 forms from the last two tax years.', 'W-2s help verify your employment history and total earnings, which the court uses to assess your financial situation.'),
  item('Income & Employment', 'Tax Returns (Last 2 Years)', 'Upload your federal tax returns from the last two years.', 'Tax returns provide a comprehensive view of your income and are required by the bankruptcy court.'),
  item('Income & Employment', 'Employer Name & Address', 'Provide your current employer\'s name and address.', 'This is required on bankruptcy petition forms and helps verify your employment status.', false),

  // Step 2: Bank & Financial Accounts
  item('Bank & Financial Accounts', 'Checking/Savings Statements (Last 6 Months)', 'Upload bank statements for all checking and savings accounts.', 'The court needs to see your account activity to understand your financial transactions and current balances.'),
  item('Bank & Financial Accounts', 'Investment/Retirement Statements', 'Upload statements for any investment or retirement accounts.', 'These documents help determine what assets may be exempt from the bankruptcy estate.', false),

  // Step 3: Debts & Credit
  item('Debts & Credit', 'Credit Card Statements (Last 3 Months)', 'Upload your most recent credit card statements.', 'Credit card statements help us create an accurate list of your unsecured debts for the bankruptcy petition.'),
  item('Debts & Credit', 'Loan Statements', 'Upload statements for auto loans, personal loans, or student loans.', 'All outstanding debts must be listed in your bankruptcy filing to ensure they can be properly addressed.'),
  item('Debts & Credit', 'Collection Notices', 'Upload any collection letters or notices you\'ve received.', 'Collection accounts are debts that need to be included in your filing to stop collection activity.', false),

  // Step 4: Assets & Property
  item('Assets & Property', 'Mortgage Statement or Lease', 'Upload your mortgage statement or rental lease agreement.', 'Your housing situation affects how your bankruptcy case is structured and what exemptions apply.'),
  item('Assets & Property', 'Vehicle Title or Registration', 'Upload your vehicle title or current registration.', 'Vehicle ownership must be disclosed and may be subject to exemptions in your bankruptcy case.', false),
  item('Assets & Property', 'Property Deed', 'Upload the deed if you own any real property.', 'Real property ownership is a critical factor in bankruptcy and affects which chapter is best for you.', false),

  // Step 5: Personal Identification
  item('Personal Identification', 'Government-Issued Photo ID', 'Upload a clear photo of your driver\'s license, passport, or state ID.', 'Identity verification is required by the court before your case can be filed.'),
  item('Personal Identification', 'Social Security Card or Proof of SSN', 'Upload your Social Security card or an official document showing your SSN.', 'Your Social Security number is required on all bankruptcy petition forms.'),

  // Step 6: Agreements & Confirmation
  item('Agreements & Confirmation', 'Credit Counseling Certificate', 'Upload your certificate from an approved credit counseling course.', 'Federal law requires completion of credit counseling before filing for bankruptcy.'),
  item('Agreements & Confirmation', 'Financial Disclosure Confirmation', 'Please confirm that all financial information you\'ve provided is accurate and complete.', 'This confirmation is a legal requirement and ensures your filing is truthful.'),
  item('Agreements & Confirmation', 'Assets Disclosure Confirmation', 'Please confirm that you\'ve disclosed all assets and property you own.', 'Failing to disclose assets can result in your case being dismissed or criminal charges.'),
  item('Agreements & Confirmation', 'Final Confirmation', 'Please confirm that everything submitted is accurate to the best of your knowledge.', 'This final confirmation completes your document intake and allows your attorney to begin preparing your petition.'),
];

// ─── Seed Data ───────────────────────────────────────────────────────
export const seedIfNeeded = () => {
  if (localStorage.getItem(SEEDED_KEY)) return;

  const now = new Date();
  const checklist1 = buildDefaultChecklist();
  // Maria: 65% complete, 1 flag, critical
  const totalItems = checklist1.length;
  const completeCount = Math.round(totalItems * 0.65);
  checklist1.forEach((item, i) => {
    if (i < completeCount) {
      item.completed = true;
      item.files = [{
        id: uid(), name: `${item.label}.pdf`, dataUrl: '', uploadedAt: new Date(now.getTime() - 86400000 * (10 - i)).toISOString(),
        reviewStatus: i < completeCount - 2 ? 'approved' : 'pending', uploadedBy: 'client',
      }];
    }
  });
  checklist1[completeCount].flaggedForAttorney = true;
  checklist1[completeCount].attorneyNote = 'Please review — document appears to be from wrong year.';

  const checklist2 = buildDefaultChecklist();
  const completeCount2 = Math.round(totalItems * 0.9);
  checklist2.forEach((item, i) => {
    if (i < completeCount2) {
      item.completed = true;
      item.files = [{
        id: uid(), name: `${item.label}.pdf`, dataUrl: '', uploadedAt: new Date(now.getTime() - 86400000 * 5).toISOString(),
        reviewStatus: 'approved', uploadedBy: 'client',
      }];
    }
  });
  // One correction requested for at-risk
  checklist2[completeCount2].files = [{
    id: uid(), name: 'Vehicle Title.pdf', dataUrl: '', uploadedAt: new Date(now.getTime() - 86400000 * 4).toISOString(),
    reviewStatus: 'correction-requested', reviewNote: 'Wrong year', uploadedBy: 'client',
  }];

  const checklist3 = buildDefaultChecklist();
  checklist3.forEach(item => {
    item.completed = true;
    item.files = [{
      id: uid(), name: `${item.label}.pdf`, dataUrl: '', uploadedAt: new Date(now.getTime() - 86400000 * 15).toISOString(),
      reviewStatus: 'approved', uploadedBy: 'client',
    }];
  });

  const cases: Case[] = [
    {
      id: 'maria-001',
      clientName: 'Maria Rodriguez',
      clientEmail: 'maria@example.com',
      clientPhone: '(555) 234-5678',
      chapterType: '7',
      assignedParalegal: 'Sarah Johnson',
      assignedAttorney: 'David Park',
      filingDeadline: new Date(now.getTime() + 86400000 * 5).toISOString(),
      createdAt: new Date(now.getTime() - 86400000 * 20).toISOString(),
      lastClientActivity: new Date(now.getTime() - 86400000 * 1).toISOString(),
      checklist: checklist1,
      activityLog: [
        { id: uid(), eventType: 'case_created', actorRole: 'system', actorName: 'ClearPath', description: 'Case created for Maria Rodriguez', timestamp: new Date(now.getTime() - 86400000 * 20).toISOString() },
        { id: uid(), eventType: 'file_upload', actorRole: 'client', actorName: 'Maria Rodriguez', description: 'Maria uploaded her 2023 W-2', timestamp: new Date(now.getTime() - 86400000 * 1).toISOString(), itemId: checklist1[1].id },
        { id: uid(), eventType: 'item_flagged', actorRole: 'paralegal', actorName: 'Sarah Johnson', description: 'Flagged Credit Card Statements for attorney review', timestamp: new Date(now.getTime() - 86400000 * 0.5).toISOString(), itemId: checklist1[completeCount].id },
      ],
      notes: [
        { id: uid(), author: 'Sarah Johnson', authorRole: 'paralegal', content: 'Client has been responsive. May need extension on deadline.', timestamp: new Date(now.getTime() - 86400000 * 2).toISOString(), clientVisible: false },
      ],
      checkpointsCompleted: [],
      urgency: 'critical',
      readyToFile: false,
      wizardStep: 3,
    },
    {
      id: 'james-002',
      clientName: 'James Chen',
      clientEmail: 'james@example.com',
      chapterType: '13',
      assignedParalegal: 'Sarah Johnson',
      assignedAttorney: 'David Park',
      filingDeadline: new Date(now.getTime() + 86400000 * 14).toISOString(),
      createdAt: new Date(now.getTime() - 86400000 * 30).toISOString(),
      lastClientActivity: new Date(now.getTime() - 86400000 * 4).toISOString(),
      checklist: checklist2,
      activityLog: [
        { id: uid(), eventType: 'case_created', actorRole: 'system', actorName: 'ClearPath', description: 'Case created for James Chen', timestamp: new Date(now.getTime() - 86400000 * 30).toISOString() },
        { id: uid(), eventType: 'file_correction', actorRole: 'attorney', actorName: 'David Park', description: "Correction requested on Vehicle Title — 'Wrong year'", timestamp: new Date(now.getTime() - 86400000 * 2).toISOString() },
      ],
      notes: [],
      checkpointsCompleted: [],
      urgency: 'at-risk',
      readyToFile: false,
      wizardStep: 5,
    },
    {
      id: 'robert-003',
      clientName: 'Robert Kim',
      clientEmail: 'robert@example.com',
      clientPhone: '(555) 876-5432',
      chapterType: '7',
      assignedParalegal: 'Sarah Johnson',
      assignedAttorney: 'David Park',
      filingDeadline: new Date(now.getTime() + 86400000 * 30).toISOString(),
      createdAt: new Date(now.getTime() - 86400000 * 45).toISOString(),
      lastClientActivity: new Date(now.getTime() - 86400000 * 1).toISOString(),
      checklist: checklist3,
      activityLog: [
        { id: uid(), eventType: 'case_created', actorRole: 'system', actorName: 'ClearPath', description: 'Case created for Robert Kim', timestamp: new Date(now.getTime() - 86400000 * 45).toISOString() },
        { id: uid(), eventType: 'case_ready', actorRole: 'system', actorName: 'ClearPath', description: 'All documents received and approved', timestamp: new Date(now.getTime() - 86400000 * 2).toISOString() },
      ],
      notes: [],
      checkpointsCompleted: ['financial-disclosure', 'assets-disclosure', 'final-confirmation'],
      urgency: 'normal',
      readyToFile: true,
      wizardStep: 6,
    },
  ];

  saveCases(cases);
  localStorage.setItem(SEEDED_KEY, 'true');
};
