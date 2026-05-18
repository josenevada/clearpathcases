import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BU_API_KEY = Deno.env.get('BROWSER_USE_API_KEY')!;
const BU_BASE = 'https://api.browser-use.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { taskId, action } = await req.json();

    if (action === 'resume') {
      await fetch(`${BU_BASE}/resume-task?task_id=${taskId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${BU_API_KEY}` },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'stop') {
      await fetch(`${BU_BASE}/stop-task?task_id=${taskId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${BU_API_KEY}` },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const statusRes = await fetch(`${BU_BASE}/task/${taskId}`, {
      headers: { Authorization: `Bearer ${BU_API_KEY}` },
    });

    if (!statusRes.ok) {
      throw new Error(`Status check failed: ${await statusRes.text()}`);
    }

    const task = await statusRes.json();

    return new Response(
      JSON.stringify({
        status: task.status,
        liveUrl: task.live_url,
        output: task.output,
        steps: task.steps?.length || 0,
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
