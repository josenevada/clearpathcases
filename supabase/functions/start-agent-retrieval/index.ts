import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BU_API_KEY = Deno.env.get('BROWSER_USE_API_KEY')!;
const BU_BASE = 'https://api.browser-use.com/api/v3';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const sessionRes = await fetch(`${BU_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'X-Browser-Use-API-Key': BU_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task:
          'Navigate to https://my.adp.com/ and load the login page. Do not enter any credentials. Once the login page is fully visible, end the task and report "ready for login".',
        keepAlive: true,
      }),
    });

    if (!sessionRes.ok) {
      throw new Error(
        `Browser Use session creation failed: ${sessionRes.status} ${await sessionRes.text()}`,
      );
    }

    const session = await sessionRes.json();

    return new Response(
      JSON.stringify({ taskId: session.id, liveUrl: session.liveUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('start-agent-retrieval error:', err);
    return new Response(
      JSON.stringify({ error: String((err as Error).message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
