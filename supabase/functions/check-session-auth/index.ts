import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Browserbase from 'npm:@browserbasehq/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const loginUrls: Record<string, string[]> = {
  adp: ['my.adp.com/login', 'accounts.adp.com', 'online.adp.com/signin'],
  workday: ['wd5.myworkday.com/wday/authgwy', 'impl.workday.com/login', 'myworkday.com/login'],
  paychex: ['myapps.paychex.com/landing_pages/login', 'paychex.com/login'],
  gusto: ['app.gusto.com/login', 'gusto.com/login'],
  paylocity: ['access.paylocity.com'],
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

    const bb = new Browserbase({ apiKey: Deno.env.get('BROWSERBASE_API_KEY')! });
    const session: any = await bb.sessions.retrieve(sessionId);

    const currentUrl: string = session?.currentUrl ?? session?.startUrl ?? '';

    const loginPaths = loginUrls[provider] || [];
    const isOnLoginPage = !currentUrl || loginPaths.some((path) => currentUrl.includes(path));

    return new Response(
      JSON.stringify({ authenticated: !isOnLoginPage, currentUrl }),
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
