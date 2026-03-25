import { supabase } from '@/integrations/supabase/client';

/** Fetch the latest phone number for a case from client_info, falling back to the provided value */
const getFreshPhone = async (caseId: string, fallback?: string): Promise<string | undefined> => {
  const { data } = await supabase
    .from('client_info')
    .select('phone')
    .eq('case_id', caseId)
    .maybeSingle();
  return data?.phone || fallback || undefined;
};

interface SendSmsParams {
  to: string;
  body: string;
  caseId: string;
  clientName?: string;
}

export const sendSms = async (params: SendSmsParams) => {
  const { data, error } = await supabase.functions.invoke('send-sms', {
    body: params,
  });

  if (error) {
    console.error('SMS send error:', error);
    throw new Error(error.message || 'Failed to send SMS');
  }

  return data as { success: boolean; skipped?: boolean; reason?: string; sid?: string };
};

export const sendWelcomeSms = async (
  clientPhone: string | undefined,
  clientName: string,
  caseCode: string,
  caseId: string,
  firmName: string,
) => {
  const phone = await getFreshPhone(caseId, clientPhone);
  if (!phone) return;

  const firstName = clientName.split(' ')[0];
  const portalLink = `${window.location.origin}/client/${caseCode}`;
  const body = `Hi ${firstName}, your document portal from ${firmName} is ready. It takes most people about 30 minutes total and you can do it in pieces. Start here: ${portalLink}`;

  return sendSms({ to: phone, body, caseId, clientName });
};

export const sendCorrectionSms = async (
  clientPhone: string | undefined,
  clientName: string,
  caseCode: string,
  caseId: string,
) => {
  const phone = await getFreshPhone(caseId, clientPhone);
  if (!phone) return;

  const firstName = clientName.split(' ')[0];
  const portalLink = `${window.location.origin}/client/${caseCode}`;
  const body = `Hi ${firstName}, your attorney's office needs one quick update on your documents before your case can move forward. It only takes a minute: ${portalLink}`;

  return sendSms({ to: phone, body, caseId, clientName });
};

export const sendMomentumSms = async (
  clientPhone: string | undefined,
  clientName: string,
  caseCode: string,
  caseId: string,
  completedStep: number,
  completionPercent: number,
  nextStepName: string,
) => {
  const phone = await getFreshPhone(caseId, clientPhone);
  if (!phone) return;

  const firstName = clientName.split(' ')[0];
  const portalLink = `${window.location.origin}/client/${caseCode}`;
  const body = `Great work ${firstName}. Step ${completedStep} is done. You are ${completionPercent} percent of the way there — ${nextStepName} is next and it usually takes just a few minutes. ${portalLink}`;

  return sendSms({ to: phone, body, caseId, clientName });
};
