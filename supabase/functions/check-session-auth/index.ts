import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Browserbase from 'npm:@browserbasehq/sdk';
import { chromium } from 'npm:playwright-core@1.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const loginUrls: Record<string, string[]> = {
  adp: ['accounts.adp.com', 'online.adp.com/signin'],
  workday: ['wd5.myworkday.com/wday/authgwy', 'impl.workday.com/login', 'myworkday.com/login'],
  paychex: ['myapps.paychex.com/landing_pages/login', 'paychex.com/login'],
  gusto: ['app.gusto.com/login', 'gusto.com/login'],
  paylocity: ['access.paylocity.com'],
};

const dashboardHints: Record<string, string[]> = {
  adp: ['#/dashboard', 'tax statements', 'pay statements', 'paystub', 'pay stub', 'dashboard'],
  workday: ['home', 'pay', 'payslips', 'tax documents'],
  paychex: ['dashboard', 'pay history', 'tax documents'],
  gusto: ['dashboard', 'documents', 'pay stubs'],
  paylocity: ['self service portal', 'pay', 'history'],
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
      browser.disconnect();
    } catch (cdpErr) {
      console.error('check-session-auth CDP read failed', cdpErr);
    }

    console.log('check-session-auth current page', { provider, currentUrl, pageTitle });

    const loginPaths = loginUrls[provider] || [];
    const isBlank = !currentUrl || currentUrl === 'about:blank';
    const textAndUrl = `${currentUrl} ${pageTitle} ${bodyText}`.toLowerCase();
    const isOnLoginPage = isBlank || loginPaths.some((path) => currentUrl.includes(path)) || textAndUrl.includes('forgot your user id') || textAndUrl.includes('forgot your password');
    const hasDashboardHint = (dashboardHints[provider] || []).some((hint) => textAndUrl.includes(hint));
    const authenticated = !isOnLoginPage && hasDashboardHint;

    return new Response(
      JSON.stringify({ authenticated, currentUrl, pageTitle }),
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
