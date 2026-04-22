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

  const now = new Date();
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

    let notificationType: string | null = null;

    // 3-day deadline reminder
    if (daysUntilDeadline <= 3 && daysUntilDeadline > 0) {
      notificationType = 'deadline_reminder_3d';
    }
    // 7-day deadline reminder
    else if (daysUntilDeadline <= 7 && daysUntilDeadline > 3) {
      notificationType = 'deadline_reminder_7d';
    }

    // "Never started" detection — welcomed but never opened portal
    if (!notificationType && !c.last_client_activity && c.created_at) {
      const createdAt = new Date(c.created_at);
      const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreated >= 24) {
        notificationType = 'never_started';
      }
    }

    // Inactivity checks (48h first nudge, 96h second nudge)
    if (!notificationType && c.last_client_activity) {
      const lastActivity = new Date(c.last_client_activity);
      const hoursSince = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
      if (hoursSince >= 96 && hoursSince < 120) {
        notificationType = 'inactivity_96h';
      } else if (hoursSince >= 48 && hoursSince < 96) {
        notificationType = 'inactivity_48h';
      }
    }

    if (!notificationType) continue;

    // Type-specific dedup: don't re-send the SAME type today, but allow different types
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const logRes = await fetch(
      `${supabaseUrl}/rest/v1/activity_log?case_id=eq.${c.id}&event_type=eq.reminder_sent&created_at=gte.${todayStart.toISOString()}&description=ilike.*${notificationType}*&select=id&limit=1`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      },
    );
    const existingLogs = await logRes.json();
    if (Array.isArray(existingLogs) && existingLogs.length > 0) continue;

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
