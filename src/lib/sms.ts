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

/** Read the case's preferred client language ('en' default) */
const getCaseLanguage = async (caseId: string): Promise<'en' | 'es'> => {
  const { data } = await supabase
    .from('cases')
    .select('client_language')
    .eq('id', caseId)
    .maybeSingle();
  return ((data as any)?.client_language === 'es' ? 'es' : 'en');
};

/**
 * SMS Gate — all outbound SMS must pass through this before sending.
 * Returns { allowed: true } or { allowed: false, reason: string }
 *
 * Rules:
 * - Quiet hours: only send between 8:00 AM and 8:00 PM MST (UTC-7).
 *   MST is used as the safe default since this is an Arizona-first product.
 * - Cooldown: no SMS to the same case within 4 hours of the last one.
 *   Check activity_log for the most recent reminder_sent event for this caseId.
 */
export const checkSmsGate = async (caseId: string): Promise<{ allowed: boolean; reason?: string }> => {
  const nowUTC = new Date();
  const mstHour = (nowUTC.getUTCHours() - 7 + 24) % 24;
  if (mstHour < 8 || mstHour >= 20) {
    return { allowed: false, reason: `Quiet hours (currently ${mstHour}:00 MST)` };
  }
  return { allowed: true };
};

interface SendSmsParams {
  to: string;
  body: string;
  caseId: string;
  clientName?: string;
}

export const sendSms = async (params: SendSmsParams & { bypass?: boolean }) => {
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

  const gate = await checkSmsGate(caseId);
  if (!gate.allowed) {
    console.log(`SMS gated for case ${caseId}: ${gate.reason}`);
    return;
  }

  const firstName = clientName.split(' ')[0];
  const portalLink = `${window.location.origin}/client/${caseCode}`;
  const lang = await getCaseLanguage(caseId);

  const body = lang === 'es'
    ? `Hola ${firstName}, tu abogado te ha enviado un enlace seguro para subir tus documentos. Empieza aquí: ${portalLink}`
    : `Hi ${firstName}, your document portal from ${firmName} is ready. It takes most people about 30 minutes total and you can do it in pieces. Start here: ${portalLink}`;

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

  const gate = await checkSmsGate(caseId);
  if (!gate.allowed) {
    console.log(`SMS gated for case ${caseId}: ${gate.reason}`);
    return;
  }

  const firstName = clientName.split(' ')[0];
  const portalLink = `${window.location.origin}/client/${caseCode}`;
  const lang = await getCaseLanguage(caseId);

  const body = lang === 'es'
    ? `Hola ${firstName}, tu caso de bancarrota necesita documentos adicionales. Completa tu envío aquí: ${portalLink}`
    : `Hi ${firstName}, your attorney's office needs one quick update on your documents before your case can move forward. It only takes a minute: ${portalLink}`;

  return sendSms({ to: phone, body, caseId, clientName });
};

