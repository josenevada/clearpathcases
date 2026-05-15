import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Browserbase from 'npm:@browserbasehq/sdk';
import { chromium } from 'npm:playwright-core@1.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const authenticatedUrls: Record<string, string[]> = {
  adp: [
    'my.adp.com/#/dashboard',
    'my.adp.com/dashboard',
    'myadp.my.site.com',
  ],
  workday: [
    'myworkday.com/d/',
    'wd5.myworkday.com/d/',
  ],
  paychex: [
    'myapps.paychex.com/home',
    'paychex.com/dashboard',
  ],
  gusto: [
    'app.gusto.com/dashboard',
    'app.gusto.com/home',
  ],
  paylocity: [
    'access.paylocity.com/Paylocity/Dashboard',
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sessionId, provider } = await req.json();
    if (!sessionId || !provider) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or provider' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('BROWSERBASE_API_KEY')!;
    const bb = new Browserbase({ apiKey });
    const session: any = await bb.sessions.retrieve(sessionId);

    let currentUrl: string = session?.currentUrl ?? session?.startUrl ?? '';
    let pageTitle = '';
    let bodyText = '';

    try {
      const connectUrl = (session as any).connectUrl
        ?? `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${sessionId}`;
      const browser = await chromium.connectOverCDP(connectUrl);
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());
      currentUrl = page.url() || currentUrl;
      pageTitle = await page.title().catch(() => '');
      bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
      try { await (browser as any).close?.(); } catch (_) { /* ignore */ }
    } catch (cdpErr) {
      console.error('check-session-auth CDP read failed', cdpErr);
    }

    console.log('check-session-auth current page', { provider, currentUrl, pageTitle });

    const authPaths = authenticatedUrls[provider] || [];
    const isAuthenticated = authPaths.some((path) => currentUrl.includes(path));

    return new Response(
      JSON.stringify({ authenticated: isAuthenticated, currentUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('check-session-auth error', err);
    return new Response(
      JSON.stringify({ authenticated: false, error: String((err as Error).message ?? err) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
