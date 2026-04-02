import { supabase } from '@/integrations/supabase/client';
import { calculateProgress, type Case } from '@/lib/store';
import { hasOpenCorrection } from '@/lib/corrections';
import { differenceInDays, differenceInHours } from 'date-fns';

/** Fetch the latest contact info for a case from client_info, falling back to case record */
const getFreshContactInfo = async (caseData: Case) => {
  const { data } = await supabase
    .from('client_info')
    .select('email, phone')
    .eq('case_id', caseData.id)
    .maybeSingle();

  return {
    email: data?.email || caseData.clientEmail,
    phone: data?.phone || caseData.clientPhone || undefined,
  };
};

const APP_BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://clearpathcases.lovable.app';

type NotificationType =
  | 'client_welcome'
  | 'correction_request'
  | 'deadline_reminder_7d'
  | 'deadline_reminder_3d'
  | 'inactivity_48h'
  | 'firm_welcome'
  | 'general_reminder';

interface NotificationPayload {
  type: NotificationType;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  portalLink: string;
  caseId: string;
  correctionReason?: string;
  completionPercent?: number;
  firmName?: string;
  setupLink?: string;
  filingDeadline?: string;
}

export interface NotificationResult {
  email: { status: 'sent' | 'skipped' | 'failed'; detail?: string };
  sms: { status: 'sent' | 'skipped' | 'failed'; detail?: string };
}

export const sendNotification = async (payload: NotificationPayload): Promise<NotificationResult> => {
  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send notification');
  }

  return data as NotificationResult;
};

export const sendClientWelcome = async (caseData: Case) => {
  const portalLink = `${APP_BASE_URL}/client/${caseData.caseCode}`;
  const contact = await getFreshContactInfo(caseData);
  return sendNotification({
    type: 'client_welcome',
    clientName: caseData.clientName,
    clientEmail: contact.email,
    clientPhone: contact.phone,
    portalLink,
    caseId: caseData.id,
  });
};

export const sendCorrectionRequest = async (caseData: Case, correctionReason: string, itemId: string) => {
  const portalLink = `${APP_BASE_URL}/client/${caseData.caseCode}?fix=${encodeURIComponent(itemId)}`;
  const contact = await getFreshContactInfo(caseData);
  return sendNotification({
    type: 'correction_request',
    clientName: caseData.clientName,
    clientEmail: contact.email,
    clientPhone: contact.phone,
    portalLink,
    caseId: caseData.id,
    correctionReason,
  });
};

export const sendFirmWelcome = async (email: string, firmName: string, setupLink: string) => {
  return sendNotification({
    type: 'firm_welcome',
    clientName: firmName,
    clientEmail: email,
    portalLink: setupLink,
    caseId: 'n/a',
    firmName,
    setupLink,
  });
};

/**
 * Determines the best reminder type for a case based on its current state
 * and sends both email and SMS.
 */
export const sendSmartReminder = async (caseData: Case): Promise<NotificationResult> => {
  const portalLink = `${APP_BASE_URL}/client/${caseData.caseCode}`;
  const progress = calculateProgress(caseData);
  const daysLeft = differenceInDays(new Date(caseData.filingDeadline), new Date());
  const contact = await getFreshContactInfo(caseData);

  let type: NotificationType = 'general_reminder';

  // Priority 1: Open correction
  if (hasOpenCorrection(caseData)) {
    type = 'correction_request';
  }
  // Priority 2: 3-day deadline
  else if (daysLeft <= 3 && daysLeft > 0 && progress < 100) {
    type = 'deadline_reminder_3d';
  }
  // Priority 3: 7-day deadline
  else if (daysLeft <= 7 && daysLeft > 3 && progress < 100) {
    type = 'deadline_reminder_7d';
  }
  // Priority 4: Inactivity
  else if (caseData.lastClientActivity) {
    const hoursSince = differenceInHours(new Date(), new Date(caseData.lastClientActivity));
    if (hoursSince >= 48) {
      type = 'inactivity_48h';
    }
  }

  const result = await sendNotification({
    type,
    clientName: caseData.clientName,
    clientEmail: contact.email,
    clientPhone: contact.phone,
    portalLink,
    caseId: caseData.id,
    completionPercent: progress,
    filingDeadline: caseData.filingDeadline,
  });

  // Log locally
  const channels = [];
  if (result.email.status === 'sent') channels.push('email');
  if (result.sms.status === 'sent') channels.push('SMS');

  if (channels.length > 0) {
    await supabase.from('activity_log').insert({
      case_id: caseData.id,
      event_type: 'reminder_sent',
      actor_role: 'paralegal',
      actor_name: 'System',
      description: `Reminder sent via ${channels.join(' and ')} to ${caseData.clientName}`,
    });
  }

  return result;
};
