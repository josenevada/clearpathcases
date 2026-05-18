import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BU_API_KEY = Deno.env.get('BROWSER_USE_API_KEY')!;
const BU_BASE = 'https://api.browser-use.com/api/v1';

const tasks: Record<string, string> = {
  paystubs: `You are helping a bankruptcy attorney retrieve their client's pay stubs. The client will log in themselves — do not try to enter credentials.

Steps:
1. Navigate to https://my.adp.com/
2. PAUSE and wait for the user to complete login.
3. After login, navigate directly to https://my.adp.com/#/pay/statements
4. If a "Go Paperless" or "Paperless Settings" popup appears, close it immediately.
5. Wait for the pay statements list to load.
6. For each of the 4 most recent pay stubs:
   a. Click the pay statement entry in the left list
   b. Click the "View statement" button
   c. Click "Download current statement" from the dropdown
   d. Wait 3 seconds for the download to complete
7. Return the task as complete.`,

  w2: `You are helping a bankruptcy attorney retrieve their client's W-2 tax forms. The client will log in themselves — do not try to enter credentials.

Steps:
1. Navigate to https://my.adp.com/
2. PAUSE and wait for the user to complete login.
3. After login, navigate directly to https://my.adp.com/#/pay/tax-statements
4. If any popup appears, close it.
5. Wait for the tax statements list to load.
6. For each of the 2 most recent W-2 forms:
   a. Click the W-2 entry in the list
   b. Download the W-2 as a PDF
   c. Wait 3 seconds for the download
7. Return the task as complete.`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { documentType } = await req.json();
    const taskInstructions = tasks[documentType] || tasks.paystubs;

    const taskRes = await fetch(`${BU_BASE}/run-task`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BU_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: taskInstructions,
        use_proxy: true,
        use_adblock: true,
        save_browser_data: false,
        structured_output_json: JSON.stringify({
          type: 'object',
          properties: {
            files_downloaded: { type: 'integer' },
            status: { type: 'string' },
          },
        }),
      }),
    });

    if (!taskRes.ok) {
      throw new Error(`Browser Use task creation failed: ${await taskRes.text()}`);
    }

    const task = await taskRes.json();

    await fetch(`${BU_BASE}/pause-task?task_id=${task.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${BU_API_KEY}` },
    });

    return new Response(
      JSON.stringify({ taskId: task.id, liveUrl: task.live_url }),
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
