const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CorrectionNotificationPayload {
  clientEmail: string;
  clientName: string;
  clientPhone?: string;
  correctionLink: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const sendSms = async (payload: CorrectionNotificationPayload) => {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

  if (!payload.clientPhone) {
    return { status: 'skipped', detail: 'Missing client phone number' };
  }

  if (!accountSid || !authToken || !fromNumber) {
    return { status: 'skipped', detail: 'Twilio credentials are not configured' };
  }

  const body = new URLSearchParams({
    To: payload.clientPhone,
    From: fromNumber,
    Body: `Your attorney's office needs one updated document before your case is ready. It only takes a minute to fix. Tap here: ${payload.correctionLink}`,
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { status: 'failed', detail: `Twilio error [${response.status}]: ${JSON.stringify(data)}` };
  }

  return { status: 'sent', detail: data.sid };
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
