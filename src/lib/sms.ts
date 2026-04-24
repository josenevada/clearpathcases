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
  // Quiet hours check (MST = UTC-7)
  const nowUTC = new Date();
  const mstHour = (nowUTC.getUTCHours() - 7 + 24) % 24;
  if (mstHour < 8 || mstHour >= 20) {
    return { allowed: false, reason: `Quiet hours (currently ${mstHour}:00 MST)` };
  }

  // 4-hour cooldown check via Supabase activity_log
  const { data } = await supabase
    .from('activity_log')
    .select('created_at')
    .eq('case_id', caseId)
    .eq('event_type', 'reminder_sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.created_at) {
    const hoursSince = (Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 4) {
      return { allowed: false, reason: `Cooldown — last message sent ${Math.round(hoursSince * 10) / 10}h ago` };
    }
  }

  return { allowed: true };
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

  const firstName = clientName.split(' ')[0];
  const portalLink = `${window.location.origin}/client/${caseCode}`;
  const lang = await getCaseLanguage(caseId);

  const body = lang === 'es'
    ? `Hola ${firstName}, tu caso de bancarrota necesita documentos adicionales. Completa tu envío aquí: ${portalLink}`
    : `Hi ${firstName}, your attorney's office needs one quick update on your documents before your case can move forward. It only takes a minute: ${portalLink}`;

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
  const lang = await getCaseLanguage(caseId);

  const body = lang === 'es'
    ? `¡Buen trabajo ${firstName}! Paso ${completedStep} completado. Vas al ${completionPercent} por ciento — sigue ${nextStepName}, suele tomar pocos minutos. ${portalLink}`
    : `Great work ${firstName}. Step ${completedStep} is done. You are ${completionPercent} percent of the way there — ${nextStepName} is next and it usually takes just a few minutes. ${portalLink}`;

  return sendSms({ to: phone, body, caseId, clientName });
};
