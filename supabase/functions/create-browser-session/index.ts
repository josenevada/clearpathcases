import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Browserbase from 'npm:@browserbasehq/sdk';

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
        viewport: { width: 1280, height: 800 },
      },
      keepAlive: true,
      timeout: 1800,
      userMetadata: { caseId, provider },
    });

    // Navigate to provider URL so the iframe shows the login page immediately
    try {
      const { chromium } = await import('npm:playwright-core');
      const browser = await chromium.connectOverCDP((session as any).connectUrl);
      const context = browser.contexts()[0];
      const page = context.pages()[0] || (await context.newPage());
      await page.goto(providerUrls[provider], {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await browser.close();
    } catch (navErr) {
      console.error('initial navigation failed', navErr);
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

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        browserSessionUrl,
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
