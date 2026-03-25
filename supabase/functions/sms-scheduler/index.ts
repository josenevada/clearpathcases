const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const STEP_NAMES = [
  'Income & Employment',
  'Bank & Financial Accounts',
  'Debts & Credit',
  'Assets & Property',
  'Personal Identification',
  'Agreements & Confirmation',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Missing server config' }, 500);
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  // Fetch all active, non-complete cases
  const casesRes = await fetch(
    `${supabaseUrl}/rest/v1/cases?status=eq.active&ready_to_file=eq.false&select=*`,
    { headers },
  );
  const cases = await casesRes.json();
  if (!Array.isArray(cases)) {
    return json({ error: 'Failed to fetch cases' }, 500);
  }

  const now = new Date();
  const results: any[] = [];

  for (const c of cases) {
    if (!c.client_name) continue;

    // Fetch latest contact info from client_info table
    const ciRes = await fetch(
      `${supabaseUrl}/rest/v1/client_info?case_id=eq.${c.id}&select=phone&limit=1`,
      { headers },
    );
    const ciRows = await ciRes.json();
    const ci = Array.isArray(ciRows) && ciRows.length > 0 ? ciRows[0] : null;
    const clientPhone = ci?.phone || c.client_phone || null;

    if (!clientPhone) continue;

    const firstName = c.client_name.split(' ')[0];
    const portalLink = `https://yourclearpath.app/client/${c.case_code || c.id}`;
    const filingDeadline = new Date(c.filing_deadline);
    const daysUntilDeadline = Math.ceil((filingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get checklist stats
    const checklistRes = await fetch(
      `${supabaseUrl}/rest/v1/checklist_items?case_id=eq.${c.id}&select=completed`,
      { headers },
    );
    const items = await checklistRes.json();
    const total = Array.isArray(items) ? items.length : 0;
    const done = Array.isArray(items) ? items.filter((i: any) => i.completed).length : 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const remaining = total - done;

    // Get firm name
    let firmName = 'your attorney\'s office';
    if (c.firm_id) {
      const firmRes = await fetch(
        `${supabaseUrl}/rest/v1/firms?id=eq.${c.firm_id}&select=name&limit=1`,
        { headers },
      );
      const firms = await firmRes.json();
      if (Array.isArray(firms) && firms.length > 0 && firms[0].name) {
        firmName = firms[0].name;
      }
    }

    const wizardStep = c.wizard_step ?? 0;
    const currentStepName = STEP_NAMES[wizardStep] || 'the next step';
    const nextStepName = STEP_NAMES[wizardStep] || 'the next step';

    let smsBody: string | null = null;
    let triggerName: string | null = null;

    // ── Trigger 2: First Step Nudge (24h after welcome, wizard_step still 0) ──
    if (wizardStep === 0) {
      const createdAt = new Date(c.created_at);
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation >= 23 && hoursSinceCreation < 48) {
        triggerName = 'first_step_nudge';
        smsBody = `Hi ${firstName}, your portal is ready whenever you are. The first step only takes a few minutes — most people find it easier than they expected. ${portalLink}`;
      }
    }

    // ── Trigger 4: Re-engagement Nudge (48h inactivity) ──
    if (!smsBody && c.last_client_activity && pct < 100) {
      const lastActivity = new Date(c.last_client_activity);
      const hoursSince = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
      if (hoursSince >= 48) {
        triggerName = 'reengagement_nudge';
        smsBody = `Hi ${firstName}, you left off on ${currentStepName}. You only have ${remaining} items left — want to knock a few out now? ${portalLink}`;
      }
    }

    // ── Trigger 6: Deadline Awareness (7 days, < 80%) ──
    if (!smsBody && daysUntilDeadline === 7 && pct < 80) {
      triggerName = 'deadline_7d';
      smsBody = `Hi ${firstName}, your filing date is in 7 days. You have ${remaining} items left — finishing this week keeps everything on track. Your attorney is ready when you are: ${portalLink}`;
    }

    // ── Trigger 7: Final Urgency (3 days, < 100%) ──
    if (!smsBody && daysUntilDeadline === 3 && pct < 100) {
      triggerName = 'final_urgency';
      smsBody = `${firstName}, your filing date is in 3 days. Please complete your documents today so your attorney has time to review everything. This is important: ${portalLink}`;
    }

    if (!smsBody) continue;

    // Send via send-sms function (which handles rate limiting)
    const smsRes = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: clientPhone,
        body: smsBody,
        caseId: c.id,
        clientName: c.client_name,
      }),
    });

    const smsResult = await smsRes.json().catch(() => ({}));
    results.push({ caseId: c.id, trigger: triggerName, result: smsResult });
  }

  return json({ processed: results.length, results });
});
