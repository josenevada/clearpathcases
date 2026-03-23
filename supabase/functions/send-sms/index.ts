const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface SendSmsPayload {
  to: string;
  body: string;
  caseId: string;
  clientName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const payload = (await req.json().catch(() => null)) as SendSmsPayload | null;

  if (!payload?.caseId) {
    return json({ error: 'Missing caseId' }, 400);
  }

  // If no phone number, skip silently
  if (!payload.to) {
    return json({ success: true, skipped: true, reason: 'No phone number' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing server config' }, 500);
  }

  // ── Rate limit: check if SMS was sent to this case in the past 20 hours ──
  const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const logRes = await fetch(
    `${supabaseUrl}/rest/v1/activity_log?case_id=eq.${payload.caseId}&event_type=eq.notification_sent&created_at=gte.${twentyHoursAgo}&select=id&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const recentLogs = await logRes.json();
  if (Array.isArray(recentLogs) && recentLogs.length > 0) {
    return json({ success: true, skipped: true, reason: 'Rate limited — SMS sent within last 20 hours' });
  }

  // ── Send SMS via Twilio ──
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || Deno.env.get('TWILIO_FROM_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    return json({ success: true, skipped: true, reason: 'Twilio credentials not configured' });
  }

  const twilioBody = new URLSearchParams({
    To: payload.to,
    From: fromNumber,
    Body: payload.body,
  });

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: twilioBody,
    },
  );

  const twilioData = await twilioRes.json().catch(() => ({}));

  if (!twilioRes.ok) {
    console.error('Twilio error:', twilioData);
    return json({ success: false, error: `Twilio error [${twilioRes.status}]` }, 500);
  }

  // ── Log to activity_log ──
  await fetch(`${supabaseUrl}/rest/v1/activity_log`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      case_id: payload.caseId,
      event_type: 'notification_sent',
      actor_role: 'system',
      actor_name: 'ClearPath',
      description: `System sent SMS to ${payload.clientName || 'client'}`,
    }),
  }).catch((err) => console.error('Failed to log SMS:', err));

  return json({ success: true, sid: twilioData.sid });
});
