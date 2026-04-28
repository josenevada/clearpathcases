// Plaid Token Exchange & Statement Retrieval
// Test with Plaid Sandbox: Institution "First Platypus Bank", username: user_good, password: pass_good
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { public_token, case_id, client_name, checklist_item_id } = await req.json();

    if (!public_token || !case_id) {
      return new Response(JSON.stringify({ error: 'public_token and case_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Exchange public token for access token
    const exchangeRes = await fetch(`${plaidHost}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    });

    const exchangeData = await exchangeRes.json();
    if (!exchangeRes.ok) {
      console.error('Plaid exchange error:', exchangeData);
      return new Response(JSON.stringify({ error: exchangeData.error_message || 'Token exchange failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = exchangeData.access_token;
    const itemId = exchangeData.item_id;

    // Step 2: Get account info
    const accountsRes = await fetch(`${plaidHost}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: accessToken,
      }),
    });
    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts || [];
    const institution = accountsData.item?.institution_id || 'Unknown Bank';

    // Step 3: Get institution name
    let institutionName = 'Connected Bank';
    try {
      const instRes = await fetch(`${plaidHost}/institutions/get_by_id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          institution_id: institution,
          country_codes: ['US'],
        }),
      });
      const instData = await instRes.json();
      if (instData.institution?.name) {
        institutionName = instData.institution.name;
      }
    } catch {
      // Use default
    }

    // Step 4: Retrieve statements
    const statementsRes = await fetch(`${plaidHost}/statements/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: accessToken,
      }),
    });

    let statementsRetrieved = 0;
    const connectedAccounts: Array<{ name: string; type: string; mask: string }> = [];

    for (const acct of accounts) {
      connectedAccounts.push({
        name: `${institutionName} ${acct.subtype || acct.type || 'Account'}`,
        type: acct.subtype || acct.type || 'depository',
        mask: acct.mask || '****',
      });
    }

    if (statementsRes.ok) {
      const statementsData = await statementsRes.json();
      const allStatements = statementsData.accounts?.flatMap((a: any) => 
        (a.statements || []).map((s: any) => ({ ...s, account_id: a.account_id }))
      ) || [];

      // Download each statement PDF and store it
      for (const stmt of allStatements) {
        try {
          const pdfRes = await fetch(`${plaidHost}/statements/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: PLAID_CLIENT_ID,
              secret: PLAID_SECRET,
              access_token: accessToken,
              statement_id: stmt.statement_id,
            }),
          });

          if (pdfRes.ok) {
            const pdfBlob = await pdfRes.arrayBuffer();
            const acct = accounts.find((a: any) => a.account_id === stmt.account_id);
            const acctName = acct?.name || 'Account';
            const fileName = `${institutionName}-${acctName}-${stmt.month}-${stmt.year}.pdf`;
            const storagePath = `${case_id}/plaid-statements/${fileName}`;

            // Upload to Supabase storage
            await supabase.storage.from('case-documents').upload(storagePath, pdfBlob, {
              contentType: 'application/pdf',
              upsert: true,
            });

            // Create file record
            const fileId = crypto.randomUUID();
            await supabase.from('files').insert({
              id: fileId,
              case_id,
              checklist_item_id: checklist_item_id || case_id,
              file_name: fileName,
              storage_path: storagePath,
              uploaded_by: 'plaid',
              review_status: 'pending',
              review_note: 'Auto-retrieved via Plaid bank connection',
            });

            statementsRetrieved++;
          }
        } catch (e) {
          console.error('Failed to download statement:', e);
        }
      }
    } else {
      const errBody = await statementsRes.text();
      console.error('Plaid /statements/list error:', statementsRes.status, errBody);
    }

    if (statementsRetrieved === 0) {
      console.warn(`No statements retrieved for case ${case_id}. Plaid may not have statements available for this institution.`);
    }

    // Mark checklist item as complete
    if (checklist_item_id) {
      await supabase.from('checklist_items').update({ completed: true }).eq('id', checklist_item_id);
    }

    // Log activity
    await supabase.from('activity_log').insert({
      case_id,
      event_type: 'plaid_connected',
      actor_role: 'client',
      actor_name: client_name || 'Client',
      description: `${client_name || 'Client'} connected ${institutionName} via Plaid and retrieved ${statementsRetrieved} months of statements`,
    });

    // Update last client activity
    await supabase.from('cases').update({ last_client_activity: new Date().toISOString() }).eq('id', case_id);

    return new Response(JSON.stringify({
      success: true,
      statements_retrieved: statementsRetrieved,
      accounts: connectedAccounts,
      institution_name: institutionName,
      item_id: itemId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('plaid-exchange-token error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
