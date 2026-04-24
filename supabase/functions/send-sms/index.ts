// Requires PINGRAM_API_KEY in Supabase edge function environment variables.
//
// This function is the single authoritative SMS gate for the entire app.
// All outbound SMS — manual reminders, cron-triggered nudges, signature reminders,
// digital wallet "text me the link" — funnel through here. Two checks happen
// server-side before anything is sent:
//   1. Quiet hours: 8 AM – 8 PM MST (UTC-7).
//   2. Per-case cooldown: no SMS to the same case within 4 hours of the last one.
//      Cooldown reads activity_log for sms_sent (canonical) plus legacy event
//      types (reminder_sent, notification_sent) so historical data still counts.
// On success the function logs an activity_log row with event_type = 'sms_sent'.

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

  if (!payload.body) {
    return json({ success: true, skipped: true, reason: 'Empty SMS body' });
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

  // ── Gate 1: Quiet hours (8 AM – 8 PM MST) ──
  const nowUTC = new Date();
  const mstHour = (nowUTC.getUTCHours() - 7 + 24) % 24;
  if (mstHour < 8 || mstHour >= 20) {
    return json({ success: true, skipped: true, reason: `Quiet hours (${mstHour}:00 MST)` });
  }

  // ── Gate 2: Per-case 4-hour cooldown across all SMS event types ──
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const cooldownRes = await fetch(
    `${supabaseUrl}/rest/v1/activity_log?case_id=eq.${payload.caseId}&event_type=in.(sms_sent,reminder_sent,notification_sent)&created_at=gte.${fourHoursAgo}&select=id&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const recentLogs = await cooldownRes.json();
  if (Array.isArray(recentLogs) && recentLogs.length > 0) {
    return json({ success: true, skipped: true, reason: 'Cooldown — SMS sent within last 4 hours' });
  }

  // ── Send SMS via Pingram ──
  const apiKey = Deno.env.get('PINGRAM_API_KEY');
  if (!apiKey) {
    return json({ success: true, skipped: true, reason: 'Pingram API key not configured' });
  }

  let pingramRes: Response;
  try {
    pingramRes = await fetch('https://api.pingram.io/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        type: 'clearpath_notification',
        to: {
          id: payload.caseId,
          number: payload.to,
        },
        sms: {
          message: payload.body,
        },
      }),
    });
  } catch (err) {
    console.error('Pingram SMS error:', err);
    return json({ success: false, skipped: true, reason: `Pingram error: ${String(err)}` });
  }

  if (!pingramRes.ok) {
    const errText = await pingramRes.text().catch(() => '');
    console.error('Pingram error:', errText);
    return json({ success: false, skipped: true, reason: `Pingram error [${pingramRes.status}]: ${errText || 'Unknown'}` });
  }

  // ── Log to activity_log with the canonical sms_sent event type ──
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
      event_type: 'sms_sent',
      actor_role: 'system',
      actor_name: 'ClearPath',
      description: `SMS sent to ${payload.clientName || 'client'}`,
    }),
  }).catch((err) => console.error('Failed to log SMS:', err));

  return json({ success: true });
});
