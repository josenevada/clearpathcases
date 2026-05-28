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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  bypass?: boolean;
}

const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
};

const authorizeRequest = async (req: Request, supabaseUrl: string, serviceKey: string, caseId: string) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader === `Bearer ${serviceKey}`) return true;
  if (!authHeader?.startsWith('Bearer ')) return false;

  const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
  if (claimsError || !claimsData?.claims?.sub) return false;

  const admin = createClient(supabaseUrl, serviceKey);
  const [{ data: caller }, { data: caseRow }] = await Promise.all([
    admin.from('users').select('firm_id, role').eq('id', claimsData.claims.sub).maybeSingle(),
    admin.from('cases').select('firm_id').eq('id', caseId).maybeSingle(),
  ]);
  return !!caller && !!caseRow && (caller.role === 'super_admin' || caller.firm_id === caseRow.firm_id);
};

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

  const normalizedPhone = normalizePhone(payload.to);
  if (!normalizedPhone) {
    return json({ success: true, skipped: true, reason: 'Invalid phone number format' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing server config' }, 500);
  }

  if (!(await authorizeRequest(req, supabaseUrl, serviceKey, payload.caseId))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── Gate 1: Quiet hours (8 AM – 8 PM MST) ──
  const nowUTC = new Date();
  const mstHour = (nowUTC.getUTCHours() - 7 + 24) % 24;
  if (mstHour < 8 || mstHour >= 20) {
    return json({ success: true, skipped: true, reason: `Quiet hours (${mstHour}:00 MST)` });
  }

  // ── Gate 2: Per-case 4-hour cooldown across all SMS event types ──
  // Bypassed for paralegal-triggered manual sends (bypass: true).
  if (!payload.bypass) {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const cooldownRes = await fetch(
      `${supabaseUrl}/rest/v1/activity_log?case_id=eq.${payload.caseId}&event_type=in.(sms_sent,reminder_sent,notification_sent)&created_at=gte.${fourHoursAgo}&select=id&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    const recentLogs = await cooldownRes.json();
    if (Array.isArray(recentLogs) && recentLogs.length > 0) {
      return json({ success: true, skipped: true, reason: 'Cooldown — SMS sent within last 4 hours' });
    }
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
          number: normalizedPhone,
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

  const pingramData = await pingramRes.json().catch(() => ({}));
  const pingramMessages = Array.isArray(pingramData?.messages) ? pingramData.messages.map(String) : [];
  const pingramMessageText = pingramMessages.join(' ').toLowerCase();
  const pingramDiscarded = /discard|disabled|aborted|budget|limit|suppressed|ignored/.test(pingramMessageText);

  if (!pingramRes.ok) {
    console.error('Pingram error:', pingramData);
    return json({ success: false, skipped: true, reason: `Pingram error [${pingramRes.status}]: ${JSON.stringify(pingramData) || 'Unknown'}` });
  }

  if (pingramDiscarded) {
    const reason = pingramMessages.join(' ') || 'Pingram accepted the request but discarded delivery';
    console.error('Pingram discarded SMS:', pingramData);
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
        event_type: 'sms_failed',
        actor_role: 'system',
        actor_name: 'ClearPath',
        description: `SMS not delivered to ${payload.clientName || 'client'}: ${reason}`,
      }),
    }).catch((err) => console.error('Failed to log SMS failure:', err));
    return json({ success: false, skipped: true, reason, trackingId: pingramData?.trackingId });
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
      description: `SMS sent to ${payload.clientName || 'client'}${pingramData?.trackingId ? ` (tracking ${pingramData.trackingId})` : ''}`,
    }),
  }).catch((err) => console.error('Failed to log SMS:', err));

  return json({ success: true, trackingId: pingramData?.trackingId, messages: pingramMessages });
});
