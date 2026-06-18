// Plaid Disconnect — revoke access token
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const { case_id, client_name, portal_token } = await req.json();

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


    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Log the disconnection
    await supabase.from('activity_log').insert({
      case_id,
      event_type: 'plaid_disconnected',
      actor_role: 'client',
      actor_name: client_name || 'Client',
      description: `${client_name || 'Client'} disconnected their bank account`,
    });

    // Delete Plaid files from the files table
    const { data: plaidFiles } = await supabase
      .from('files')
      .select('id, storage_path')
      .eq('case_id', case_id)
      .eq('uploaded_by', 'plaid');

    if (plaidFiles && plaidFiles.length > 0) {
      // Delete from storage
      const storagePaths = plaidFiles
        .map(f => f.storage_path)
        .filter(Boolean);

      if (storagePaths.length > 0) {
        await supabase.storage
          .from('case-documents')
          .remove(storagePaths);
      }

      // Delete file records from DB
      await supabase
        .from('files')
        .delete()
        .eq('case_id', case_id)
        .eq('uploaded_by', 'plaid');
    }

    // Also delete the plaid_connection record if it exists
    await supabase
      .from('plaid_connections')
      .delete()
      .eq('case_id', case_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('plaid-disconnect error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
