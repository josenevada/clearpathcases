import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Browserbase from 'npm:@browserbasehq/sdk';
import { chromium } from 'npm:playwright-core@1.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const providerUrls: Record<string, string> = {
  adp: 'https://my.adp.com',
  workday: 'https://www.myworkday.com',
  paychex: 'https://myapps.paychex.com',
  gusto: 'https://app.gusto.com',
  paylocity: 'https://access.paylocity.com',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { provider, caseId } = await req.json();
    if (!provider || !providerUrls[provider]) {
      return new Response(JSON.stringify({ error: 'Invalid provider' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bb = new Browserbase({ apiKey: Deno.env.get('BROWSERBASE_API_KEY')! });

    const session = await bb.sessions.create({
      projectId: Deno.env.get('BROWSERBASE_PROJECT_ID')!,
      browserSettings: {
        solveCaptchas: true,
        blockAds: true,
        viewport: { width: 400, height: 600 },
      },
      keepAlive: true,
      timeout: 1800,
      userMetadata: { caseId, provider },
    });

    // Navigate to provider URL via CDP so the iframe shows the login page immediately.
    // Browserbase has no REST `/navigate` endpoint — we must connect over CDP.
    try {
      const connectUrl = (session as any).connectUrl
        ?? `wss://connect.browserbase.com?apiKey=${Deno.env.get('BROWSERBASE_API_KEY')}&sessionId=${session.id}`;
      const browser = await chromium.connectOverCDP(connectUrl);
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(providerUrls[provider], { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Detach without killing the remote Browserbase session.
      // For CDP-connected browsers, close() only closes the local connection.
      try { await (browser as any).close?.(); } catch (_) { /* ignore */ }
    } catch (navErr) {
      console.error('CDP navigation failed:', navErr);
    }

    // liveUrls may need a separate call depending on SDK version
    let browserSessionUrl: string | undefined =
      (session as any).liveUrls?.browser ?? (session as any).debuggerFullscreenUrl;

    if (!browserSessionUrl) {
      try {
        const debug = await (bb.sessions as any).debug(session.id);
        browserSessionUrl = debug?.debuggerFullscreenUrl ?? debug?.debuggerUrl;
      } catch (_) {
        // ignore
      }
    }

    const connectUrl = (session as any).connectUrl
      ?? `wss://connect.browserbase.com?apiKey=${Deno.env.get('BROWSERBASE_API_KEY')}&sessionId=${session.id}`;

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        browserSessionUrl,
        connectUrl,
        providerUrl: providerUrls[provider],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('create-browser-session error', err);
    return new Response(JSON.stringify({ error: String((err as Error).message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
