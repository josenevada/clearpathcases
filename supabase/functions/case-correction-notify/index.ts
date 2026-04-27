import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CorrectionNotificationPayload {
  clientEmail: string;
  clientName: string;
  clientPhone?: string;
  correctionLink: string;
  caseId?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const sendSms = async (payload: CorrectionNotificationPayload) => {
  if (!payload.clientPhone) {
    return { status: 'skipped', detail: 'Missing client phone number' };
  }
  if (!payload.caseId) {
    return { status: 'skipped', detail: 'Missing caseId — cannot route through send-sms gate' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return { status: 'skipped', detail: 'Server config missing' };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const smsBody = `Your attorney's office needs one updated document before your case is ready. It only takes a minute to fix. Tap here: ${payload.correctionLink}`;

  const { data, error } = await supabase.functions.invoke('send-sms', {
    body: {
      to: payload.clientPhone,
      body: smsBody,
      caseId: payload.caseId,
      clientName: payload.clientName,
    },
  });

  if (error) {
    return { status: 'failed', detail: `send-sms error: ${error.message}` };
  }

  if (data?.skipped) {
    return { status: 'skipped', detail: data.reason || 'send-sms skipped' };
  }

  return { status: 'sent', detail: data?.sid ?? 'ok' };
};

const sendEmail = async (payload: CorrectionNotificationPayload) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const sender = Deno.env.get('CORRECTION_EMAIL_FROM');

  if (!resendApiKey || !sender) {
    return { status: 'skipped', detail: 'Email sender is not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender,
      to: [payload.clientEmail],
      subject: 'Action needed on your case',
      text: `Your attorney's office needs one updated document before your case is ready. It only takes a minute to fix. Tap here: ${payload.correctionLink}`,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { status: 'failed', detail: `Email error [${response.status}]: ${JSON.stringify(data)}` };
  }

  return { status: 'sent', detail: data.id };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const payload = await req.json().catch(() => null) as CorrectionNotificationPayload | null;

  if (!payload?.clientEmail || !payload?.clientName || !payload?.correctionLink) {
    return json({ error: 'Missing required notification fields' }, 400);
  }

  const [sms, email] = await Promise.all([
    sendSms(payload),
    sendEmail(payload),
  ]);

  return json({ sms, email });
});
