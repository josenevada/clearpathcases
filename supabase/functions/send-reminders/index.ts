// Scheduled edge function: checks all active cases for deadline/inactivity reminders
// Invoke via pg_cron or manual trigger

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing Supabase config' }, 500);
  }

  const now = new Date();

  // Quiet hours guard — only send between 8 AM and 8 PM MST
  const mstHour = (now.getUTCHours() - 7 + 24) % 24;
  if (mstHour < 8 || mstHour >= 20) {
    return json({ skipped: true, reason: `Outside quiet hours (${mstHour}:00 MST)` });
  }

  // Fetch all non-ready cases
  const casesRes = await fetch(`${supabaseUrl}/rest/v1/cases?ready_to_file=eq.false&select=*`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  const cases = await casesRes.json();
  if (!Array.isArray(cases)) {
    return json({ error: 'Failed to fetch cases' }, 500);
  }

  const results: any[] = [];

  for (const c of cases) {
    if (!c.client_email || !c.client_name) continue;

    // Fetch latest contact info from client_info table (paralegal may have updated it)
    const ciRes = await fetch(
      `${supabaseUrl}/rest/v1/client_info?case_id=eq.${c.id}&select=email,phone&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    const ciRows = await ciRes.json();
    const ci = Array.isArray(ciRows) && ciRows.length > 0 ? ciRows[0] : null;
    const clientEmail = ci?.email || c.client_email;
    const clientPhone = ci?.phone || c.client_phone || null;

    const portalLink = `https://yourclearpath.app/client/${c.case_code}`;
    const filingDeadline = new Date(c.filing_deadline);
    const daysUntilDeadline = Math.ceil((filingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Fetch checklist items to calculate completion
    const checklistRes = await fetch(
      `${supabaseUrl}/rest/v1/checklist_items?case_id=eq.${c.id}&select=completed`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      },
    );
    const items = await checklistRes.json();
    const total = Array.isArray(items) ? items.length : 0;
    const done = Array.isArray(items) ? items.filter((i: any) => i.completed).length : 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Skip if 100% complete
    if (pct >= 100) continue;

    // Notification type priority — clean if/else chain
    let notificationType: string | null = null;

    if (daysUntilDeadline <= 3 && daysUntilDeadline > 0) {
      notificationType = 'deadline_reminder_3d';
    } else if (daysUntilDeadline <= 7 && daysUntilDeadline > 3) {
      notificationType = 'deadline_reminder_7d';
    } else if (!c.last_client_activity && c.created_at) {
      const hoursSinceCreated = (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreated >= 24) {
        notificationType = 'never_started';
      }
    } else if (c.last_client_activity) {
      const hoursSince = (now.getTime() - new Date(c.last_client_activity).getTime()) / (1000 * 60 * 60);
      if (hoursSince >= 96) {
        notificationType = 'inactivity_96h';
      } else if (hoursSince >= 48) {
        notificationType = 'inactivity_48h';
      }
    }

    if (!notificationType) continue;

    // Skip if any notification was sent today (MST calendar day)
    const mstMidnight = new Date(now);
    mstMidnight.setUTCHours(7, 0, 0, 0); // 7 UTC = midnight MST
    if (mstMidnight > now) mstMidnight.setUTCDate(mstMidnight.getUTCDate() - 1);

    const logRes = await fetch(
      `${supabaseUrl}/rest/v1/activity_log?case_id=eq.${c.id}&event_type=in.(sms_sent,reminder_sent,notification_sent,reminder_attempted)&created_at=gte.${mstMidnight.toISOString()}&select=id&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const existingLogs = await logRes.json();
    if (Array.isArray(existingLogs) && existingLogs.length > 0) continue;

    // Log attempt before sending to prevent duplicates even on failure
    await fetch(`${supabaseUrl}/rest/v1/activity_log`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        case_id: c.id,
        event_type: 'reminder_attempted',
        actor_role: 'system',
        actor_name: 'ClearPath',
        description: `Automated reminder attempted [${notificationType}]: ${c.client_name}`,
      }),
    });

    // Send notification
    const notifyRes = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: notificationType,
        reminderType: notificationType,
        clientName: c.client_name,
        clientEmail: clientEmail,
        clientPhone: clientPhone,
        portalLink,
        caseId: c.id,
        completionPercent: pct,
        filingDeadline: c.filing_deadline,
      }),
    });

    const notifyResult = await notifyRes.json().catch(() => ({}));

    results.push({ caseId: c.id, type: notificationType, result: notifyResult });
  }

  return json({ processed: results.length, results });
});
