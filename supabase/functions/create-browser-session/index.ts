import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { chromium } from 'npm:playwright-core@1.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STEEL_API_KEY = Deno.env.get('STEEL_API_KEY')!;

const providerUrls: Record<string, string> = {
  adp: 'https://my.adp.com/',
  workday: 'https://www.myworkday.com/',
  paychex: 'https://myapps.paychex.com/',
  gusto: 'https://app.gusto.com/',
  paylocity: 'https://access.paylocity.com/',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json();

    const sessionRes = await fetch('https://api.steel.dev/v1/sessions', {
      method: 'POST',
      headers: {
        'Steel-Api-Key': STEEL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        useProxy: true,
        solveCaptcha: true,
        timeout: 600000,
        sessionContext: {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      }),
    });

    if (!sessionRes.ok) {
      throw new Error(`Steel session creation failed: ${await sessionRes.text()}`);
    }

    const session = await sessionRes.json();
    const sessionId = session.id;
    const debugUrl = session.debugUrl;
    const cdpUrl = `wss://connect.steel.dev?apiKey=${STEEL_API_KEY}&sessionId=${sessionId}`;

    try {
      const browser = await chromium.connectOverCDP(cdpUrl);
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(providerUrls[provider] || providerUrls.adp, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      try { await (browser as any).close?.(); } catch (_) {}
    } catch (navErr) {
      console.error('CDP navigation failed:', navErr);
    }

    return new Response(
      JSON.stringify({
        sessionId,
        browserSessionUrl: `${debugUrl}?interactive=true&showControls=true`,
        providerUrl: providerUrls[provider],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('create-browser-session error:', err);
    return new Response(
      JSON.stringify({ error: String((err as Error).message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
