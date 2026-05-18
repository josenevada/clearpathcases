import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { chromium } from 'npm:playwright-core@1.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STEEL_API_KEY = Deno.env.get('STEEL_API_KEY')!;

const authenticatedUrls: Record<string, string[]> = {
  adp: ['my.adp.com/#/dashboard', 'my.adp.com/dashboard', 'my.adp.com/#/pay'],
  workday: ['myworkday.com/d/', 'wd5.myworkday.com/d/'],
  paychex: ['myapps.paychex.com/home', 'paychex.com/dashboard'],
  gusto: ['app.gusto.com/dashboard', 'app.gusto.com/home', 'app.gusto.com/employees'],
  paylocity: ['access.paylocity.com/Paylocity/Dashboard'],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sessionId, provider } = await req.json();
    const cdpUrl = `wss://connect.steel.dev?apiKey=${STEEL_API_KEY}&sessionId=${sessionId}`;

    let currentUrl = '';
    try {
      const browser = await chromium.connectOverCDP(cdpUrl);
      const context = browser.contexts()[0];
      const page = context?.pages()[0];
      currentUrl = page?.url() || '';
      try { await (browser as any).close?.(); } catch (_) {}
    } catch (e) {
      console.error('CDP read failed:', e);
    }

    const authPaths = authenticatedUrls[provider] || [];
    const authenticated = authPaths.some((p) => currentUrl.includes(p));

    console.log(`Auth check — URL: ${currentUrl}, authenticated: ${authenticated}`);

    return new Response(
      JSON.stringify({ authenticated, currentUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('check-session-auth error:', err);
    return new Response(
      JSON.stringify({ authenticated: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
