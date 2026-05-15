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

    // Navigate to provider URL before returning
    // so the iframe shows the login page immediately
    const navRes = await fetch(
      `https://api.browserbase.com/v1/sessions/${session.id}/navigate`,
      {
        method: 'POST',
        headers: {
          'X-BB-API-Key': Deno.env.get('BROWSERBASE_API_KEY')!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: providerUrls[provider],
        }),
      }
    );
    if (!navRes.ok) {
      console.error('Navigation failed:', await navRes.text());
    }
    // Wait for page to start loading
    await new Promise((r) => setTimeout(r, 2000));

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
