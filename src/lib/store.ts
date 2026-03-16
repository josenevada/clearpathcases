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

// ─── Template Types ──────────────────────────────────────────────────
export interface TemplateItem {
  id: string;
  label: string;
  description: string;
  whyWeNeedThis: string;
  required: boolean;
  category: string;
  order: number;
  conditionalOn?: { questionId: string; answer: 'yes' | 'no' };
}

export interface FirmTemplate {
  id: string;
  name: string;
  chapterType: '7' | '13' | 'both';
  isDefault: boolean;
  createdAt: string;
  lastModified: string;
  items: TemplateItem[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'paralegal' | 'attorney';
}

export interface FirmSettings {
  firmName: string;
  firmAddress: string;
  firmPhone: string;
  templates: FirmTemplate[];
  defaultTemplateId: string;
  teamMembers: TeamMember[];
}

// ─── Helpers ─────────────────────────────────────────────────────────
const STORAGE_KEY = 'cp_cases';
const SEEDED_KEY = 'cp_seeded';
const FIRM_SETTINGS_KEY = 'clearpath_firm_settings';

const uid = () => Math.random().toString(36).substr(2, 9);

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

export const createCase = (data: Omit<Case, 'id' | 'createdAt' | 'checklist' | 'activityLog' | 'notes' | 'checkpointsCompleted' | 'urgency' | 'readyToFile' | 'wizardStep'>): Case => {
  const newCase: Case = {
    ...data,
    id: uid(),
    createdAt: new Date().toISOString(),
    checklist: buildDefaultChecklist(),
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
  seedFirmSettingsIfNeeded();
};

// ─── Firm Settings CRUD ──────────────────────────────────────────────
const buildTemplateItems = (): TemplateItem[] => {
  const checklist = buildDefaultChecklist();
  return checklist.map((item, i) => ({
    id: item.id,
    label: item.label,
    description: item.description,
    whyWeNeedThis: item.whyWeNeedThis,
    required: item.required,
    category: item.category,
    order: i,
  }));
};

const buildCh13TemplateItems = (): TemplateItem[] => {
  const base = buildTemplateItems();
  const incomeItems = base.filter(i => i.category === 'Income & Employment');
  const maxOrder = Math.max(...incomeItems.map(i => i.order));
  const extra: TemplateItem[] = [
    { id: uid(), label: 'Repayment Plan Documents', description: 'Upload your proposed Chapter 13 repayment plan documents.', whyWeNeedThis: 'The repayment plan is the core of a Chapter 13 filing and must be submitted to the court.', required: true, category: 'Income & Employment', order: maxOrder + 1 },
    { id: uid(), label: 'Proof of Regular Income (Last 6 Months)', description: 'Upload 6 months of income documentation showing regular earnings.', whyWeNeedThis: 'Chapter 13 requires proof of regular income to demonstrate ability to make plan payments.', required: true, category: 'Income & Employment', order: maxOrder + 2 },
    { id: uid(), label: 'Tax Returns (Last 4 Years)', description: 'Upload your federal tax returns from the last four years.', whyWeNeedThis: 'Chapter 13 cases require a more extensive tax history than Chapter 7 filings.', required: true, category: 'Income & Employment', order: maxOrder + 3 },
  ];
  return [...base, ...extra];
};

export const seedFirmSettingsIfNeeded = () => {
  if (localStorage.getItem(FIRM_SETTINGS_KEY)) return;
  const now = new Date().toISOString();
  const settings: FirmSettings = {
    firmName: 'ClearPath',
    firmAddress: '',
    firmPhone: '',
    defaultTemplateId: 'tpl-ch7-default',
    teamMembers: [
      { id: uid(), name: 'Sarah Johnson', role: 'paralegal' },
      { id: uid(), name: 'Michael Torres', role: 'paralegal' },
      { id: uid(), name: 'David Park', role: 'attorney' },
    ],
    templates: [
      { id: 'tpl-ch7-default', name: 'Standard Chapter 7', chapterType: '7', isDefault: true, createdAt: now, lastModified: now, items: buildTemplateItems() },
      { id: 'tpl-ch13-default', name: 'Standard Chapter 13', chapterType: '13', isDefault: false, createdAt: now, lastModified: now, items: buildCh13TemplateItems() },
    ],
  };
  localStorage.setItem(FIRM_SETTINGS_KEY, JSON.stringify(settings));
};

export const getFirmSettings = (): FirmSettings => {
  seedFirmSettingsIfNeeded();
  return JSON.parse(localStorage.getItem(FIRM_SETTINGS_KEY)!);
};

export const saveFirmSettings = (settings: FirmSettings) => {
  localStorage.setItem(FIRM_SETTINGS_KEY, JSON.stringify(settings));
};

export const updateFirmSettings = (updater: (s: FirmSettings) => FirmSettings): FirmSettings => {
  const current = getFirmSettings();
  const updated = updater(current);
  saveFirmSettings(updated);
  return updated;
};

export const getTemplate = (templateId: string): FirmTemplate | undefined => {
  return getFirmSettings().templates.find(t => t.id === templateId);
};

export const saveTemplate = (template: FirmTemplate): void => {
  updateFirmSettings(s => ({
    ...s,
    templates: s.templates.map(t => t.id === template.id ? { ...template, lastModified: new Date().toISOString() } : t),
  }));
};

export const createTemplate = (name: string, chapterType: '7' | '13' | 'both'): FirmTemplate => {
  const now = new Date().toISOString();
  const template: FirmTemplate = {
    id: `tpl-${uid()}`,
    name,
    chapterType,
    isDefault: false,
    createdAt: now,
    lastModified: now,
    items: buildTemplateItems(),
  };
  updateFirmSettings(s => ({ ...s, templates: [...s.templates, template] }));
  return template;
};

export const setDefaultTemplate = (templateId: string): void => {
  updateFirmSettings(s => ({
    ...s,
    defaultTemplateId: templateId,
    templates: s.templates.map(t => ({ ...t, isDefault: t.id === templateId })),
  }));
};

export const deleteTemplate = (templateId: string): void => {
  updateFirmSettings(s => ({
    ...s,
    templates: s.templates.filter(t => t.id !== templateId),
    defaultTemplateId: s.defaultTemplateId === templateId ? (s.templates.find(t => t.id !== templateId)?.id || '') : s.defaultTemplateId,
  }));
};
