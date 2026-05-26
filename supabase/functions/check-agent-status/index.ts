import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BU_API_KEY = Deno.env.get('BROWSER_USE_API_KEY')!;
const BU_BASE = 'https://api.browser-use.com/api/v3';

const followUpTasks: Record<string, string> = {
  paystubs: `The user just finished logging in to ADP. Now retrieve their pay stubs.

Steps:
1. Navigate to https://my.adp.com/#/pay/statements
2. If a "Go Paperless" or any popup appears, close it.
3. Wait for the pay statements list to load.
4. For each of the 4 most recent pay stubs:
   a. Click the pay statement entry in the left list
   b. Click the "View statement" button
   c. Click "Download current statement" from the dropdown
   d. Wait 3 seconds for the download to complete
5. End the task.`,

  w2: `The user just finished logging in to ADP. Now retrieve their W-2 tax forms.

Steps:
1. Navigate to https://my.adp.com/#/pay/tax-statements
2. Close any popups that appear.
3. Wait for the tax statements list to load.
4. For each of the 2 most recent W-2 forms:
   a. Click the W-2 entry in the list
   b. Download the W-2 as a PDF
   c. Wait 3 seconds for the download
5. End the task.`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: ud, error: ue } = await authClient.auth.getUser();
    if (ue || !ud?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    const { taskId, action, documentType } = await req.json();
    const sessionId = taskId;

    if (action === 'resume') {
      const followUp = followUpTasks[documentType] || followUpTasks.paystubs;
      const dispatchRes = await fetch(`${BU_BASE}/sessions`, {
        method: 'POST',
        headers: {
          'X-Browser-Use-API-Key': BU_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          task: followUp,
          keepAlive: false,
        }),
      });
      if (!dispatchRes.ok) {
        throw new Error(
          `Follow-up dispatch failed: ${dispatchRes.status} ${await dispatchRes.text()}`,
        );
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'stop') {
      await fetch(`${BU_BASE}/sessions/${sessionId}/stop`, {
        method: 'POST',
        headers: { 'X-Browser-Use-API-Key': BU_API_KEY },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const statusRes = await fetch(`${BU_BASE}/sessions/${sessionId}`, {
      headers: { 'X-Browser-Use-API-Key': BU_API_KEY },
    });

    if (!statusRes.ok) {
      throw new Error(`Status check failed: ${await statusRes.text()}`);
    }

    const session = await statusRes.json();

    // Map v3 statuses to the simplified taxonomy the client expects.
    // 'stopped' / 'timed_out' / 'error' => 'stopped' (download phase done)
    // 'running' => 'running'
    // 'created' / 'idle' => 'idle' (between tasks; client ignores)
    let mapped: string = session.status;
    if (['timed_out', 'error'].includes(session.status)) mapped = 'stopped';

    return new Response(
      JSON.stringify({
        status: mapped,
        liveUrl: session.liveUrl,
        output: session.output,
        steps: session.stepCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('check-agent-status error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
