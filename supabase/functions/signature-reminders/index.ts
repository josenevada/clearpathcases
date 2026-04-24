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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Find pending requests older than 48h with < 3 reminders
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: pending } = await supabase
    .from('signature_requests')
    .select('*')
    .eq('status', 'pending_client')
    .lt('created_at', cutoff)
    .lt('reminder_count', 3);

  const results: unknown[] = [];

  for (const req of pending ?? []) {
    // Check if last reminder was > 24h ago
    if (req.last_reminder_sent_at) {
      const lastSent = new Date(req.last_reminder_sent_at);
      if (Date.now() - lastSent.getTime() < 24 * 60 * 60 * 1000) continue;
    }

    const appUrl = Deno.env.get('APP_URL') || 'https://clearpathcases.lovable.app';
    const signingUrl = `${appUrl}/sign/${req.client_token}`;

    // Send SMS reminder via send-sms (which enforces quiet hours + cooldown gate)
    if (req.client_phone) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            to: req.client_phone,
            body: `Reminder: ${req.client_name}, your bankruptcy documents still need your signature. Sign here: ${signingUrl}`,
            caseId: req.case_id,
            clientName: req.client_name,
          }),
        });
      } catch { /* optional */ }
    }

    // Update reminder count
    await supabase.from('signature_requests').update({
      reminder_count: (req.reminder_count || 0) + 1,
      last_reminder_sent_at: new Date().toISOString(),
    }).eq('id', req.id);

    // Audit log
    await supabase.from('signature_audit_log').insert({
      signature_request_id: req.id,
      event_type: 'reminder_sent',
      actor_type: 'system',
      metadata: { reminder_number: (req.reminder_count || 0) + 1 },
    });

    await supabase.from('activity_log').insert({
      case_id: req.case_id,
      event_type: 'signature_reminder_sent',
      actor_role: 'system',
      actor_name: 'System',
      description: `Reminder ${(req.reminder_count || 0) + 1}/3 sent to ${req.client_name}.`,
    });

    results.push({ id: req.id, reminder: (req.reminder_count || 0) + 1 });
  }

  return json({ processed: results.length, results });
});
