import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify the user
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claimsData.claims.sub as string;

    const { case_id } = await req.json();
    if (!case_id) return json({ error: 'case_id is required' }, 400);

    // Fetch case data
    const { data: caseData, error: caseErr } = await supabase
      .from('cases').select('*').eq('id', case_id).single();
    if (caseErr || !caseData) return json({ error: 'Case not found' }, 404);

    // Fetch client info
    const { data: clientInfo } = await supabase
      .from('client_info').select('*').eq('case_id', case_id).maybeSingle();

    // Verify attorney has approved forms
    const { data: forms } = await supabase
      .from('generated_federal_forms').select('id')
      .eq('case_id', case_id).eq('watermark_status', 'approved');

    if (!forms || forms.length === 0) {
      return json({ error: 'Attorney must approve forms before sending for signature' }, 400);
    }

    const clientToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const clientName = clientInfo?.full_legal_name || caseData.client_name;
    const clientEmail = clientInfo?.email || caseData.client_email;
    const clientPhone = clientInfo?.phone || caseData.client_phone;

    const { data: request, error: insertErr } = await supabase
      .from('signature_requests')
      .upsert({
        case_id,
        created_by: userId,
        status: 'pending_client',
        client_token: clientToken,
        client_token_expires_at: expiresAt.toISOString(),
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
      }, { onConflict: 'case_id' })
      .select().single();

    if (insertErr) return json({ error: insertErr.message }, 500);

    const appUrl = Deno.env.get('APP_URL') || 'https://clearpathcases.lovable.app';
    const signingUrl = `${appUrl}/sign/${clientToken}`;

    // Send SMS notification
    try {
      if (clientPhone) {
        await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            to: clientPhone,
            message: `${clientName}, your bankruptcy filing documents are ready for your signature. Please sign here: ${signingUrl} — Link expires in 7 days.`,
          }),
        });
      }
    } catch { /* SMS optional */ }

    // Log audit event
    await supabase.from('signature_audit_log').insert({
      signature_request_id: request.id,
      event_type: 'request_created',
      actor_type: 'paralegal',
      actor_name: 'Staff',
      metadata: { case_id, expires_at: expiresAt.toISOString() },
    });

    // Log activity
    await supabase.from('activity_log').insert({
      case_id,
      event_type: 'signature_request_sent',
      actor_role: 'paralegal',
      actor_name: 'Staff',
      description: `Signature request sent to ${clientName} via SMS. Expires ${expiresAt.toLocaleDateString('en-US')}.`,
    });

    return json({
      success: true,
      request_id: request.id,
      client_signing_url: signingUrl,
      expires_at: expiresAt.toISOString(),
    });
  } catch (err) {
    return json({ error: err.message || 'Internal error' }, 500);
  }
});
