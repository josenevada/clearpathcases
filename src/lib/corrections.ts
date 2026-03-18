import { CATEGORIES, type Case, type ChecklistItem, type FileReviewStatus } from '@/lib/store';

export const CORRECTION_REASON_OPTIONS = [
  'Wrong year',
  'Illegible',
  'Missing pages',
  'Wrong document type',
] as const;

export type ChecklistStatusTone = 'muted' | 'warning' | 'success' | 'primary';

export interface ChecklistStatusInfo {
  key: FileReviewStatus | 'not-started';
  label: string;
  colorClass: string;
  badgeClass: string;
  tone: ChecklistStatusTone;
}

export const getChecklistItemStatus = (item: ChecklistItem): ChecklistStatusInfo => {
  if (item.files.length === 0) {
    return {
      key: 'not-started',
      label: 'Not Started',
      colorClass: 'text-muted-foreground',
      badgeClass: 'bg-secondary text-muted-foreground border-border',
      tone: 'muted',
    };
  }

  const hasOpenCorrection = item.correctionRequest?.status === 'open';
  const hasPending = item.files.some(file => file.reviewStatus === 'pending');
  const hasApproved = item.files.some(file => file.reviewStatus === 'approved' || file.reviewStatus === 'overridden');

  if (hasOpenCorrection) {
    return {
      key: 'correction-requested',
      label: 'Correction Requested',
      colorClass: 'text-warning',
      badgeClass: 'bg-warning/10 text-warning border-warning/20',
      tone: 'warning',
    };
  }

  if (hasPending) {
    return {
      key: 'pending',
      label: 'Pending Review',
      colorClass: 'text-warning',
      badgeClass: 'bg-warning/10 text-warning border-warning/20',
      tone: 'warning',
    };
  }

  if (hasApproved) {
    return {
      key: 'approved',
      label: item.files.some(file => file.reviewStatus === 'overridden') ? 'Approved (Override)' : 'Approved',
      colorClass: 'text-success',
      badgeClass: 'bg-success/10 text-success border-success/20',
      tone: 'success',
    };
  }

  return {
    key: 'pending',
    label: 'Pending Review',
    colorClass: 'text-warning',
    badgeClass: 'bg-warning/10 text-warning border-warning/20',
    tone: 'warning',
  };
};

export const getOpenCorrectionItem = (caseData: Case): ChecklistItem | undefined =>
  caseData.checklist.find(item => item.correctionRequest?.status === 'open');

export const hasOpenCorrection = (caseData: Case): boolean =>
  caseData.checklist.some(item => item.correctionRequest?.status === 'open');

export const getChecklistItemPosition = (caseData: Case, itemId: string) => {
  const checklistItem = caseData.checklist.find(item => item.id === itemId);
  if (!checklistItem) return null;

  const categoryIdx = CATEGORIES.findIndex(category => category === checklistItem.category);
  if (categoryIdx === -1) return null;

  const itemIdx = caseData.checklist
    .filter(item => item.category === checklistItem.category)
    .findIndex(item => item.id === itemId);

  if (itemIdx === -1) return null;

  return { categoryIdx, itemIdx };
};

export const getCorrectionSummary = (item: ChecklistItem): string => {
  if (!item.correctionRequest) return '';
  return item.correctionRequest.details?.trim()
    ? `${item.correctionRequest.reason}. ${item.correctionRequest.details.trim()}`
    : item.correctionRequest.reason;
};

export const itemHasRecentResubmission = (item: ChecklistItem): boolean =>
  Boolean(item.resubmittedAt && item.files.some(file => file.reviewStatus === 'pending'));

export const caseHasRecentResubmission = (caseData: Case): boolean =>
  caseData.checklist.some(itemHasRecentResubmission);
