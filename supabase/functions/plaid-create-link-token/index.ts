// Plaid Link Token Creation
// Test with Plaid Sandbox: Institution "First Platypus Bank", username: user_good, password: pass_good
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function verifyPortalToken(token: string | undefined, caseId: string): Promise<boolean> {
  if (!token || !caseId) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tokCaseId, expStr, sig] = parts;
  if (tokCaseId !== caseId) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${tokCaseId}.${expStr}`));
  const u8 = new Uint8Array(sigBuf);
  let s = ''; for (const b of u8) s += String.fromCharCode(b);
  const expected = btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return expected === sig;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('plaid-create-link-token invoked, redirect_uri will be: https://yourclearpath.app');
    const { case_id, client_name, portal_token, statement_months = 6 } = await req.json();

    if (!case_id) {
      return new Response(JSON.stringify({ error: 'case_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!(await verifyPortalToken(portal_token, case_id))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return new Response(JSON.stringify({ error: 'Plaid credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const plaidHost = PLAID_ENV === 'production'
      ? 'https://production.plaid.com'
      : PLAID_ENV === 'development'
        ? 'https://development.plaid.com'
        : 'https://sandbox.plaid.com';

    const today = new Date();
    const months = Math.min(Math.max(Number(statement_months) || 6, 1), 24);
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months);

    const plaidRequestBody = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      user: { client_user_id: case_id },
      client_name: 'ClearPath',
      products: ['statements'],
      statements: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: today.toISOString().split('T')[0],
      },
      country_codes: ['US'],
      language: 'en',
      redirect_uri: 'https://yourclearpath.app/plaid-oauth',
    };

    console.log('Plaid link token request body:', JSON.stringify(plaidRequestBody));

    const response = await fetch(`${plaidHost}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plaidRequestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Plaid error:', data);
      return new Response(JSON.stringify({ error: data.error_message || 'Failed to create link token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ link_token: data.link_token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('plaid-create-link-token error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
