import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Stagehand } from 'npm:@browserbasehq/stagehand@1.14.0';
import Browserbase from 'npm:@browserbasehq/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let stagehand: Stagehand | undefined;

  try {
    const { sessionId, provider, caseId, checklistItemId } = await req.json();

    if (!sessionId || !provider || !caseId || !checklistItemId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('BROWSERBASE_API_KEY')!;
    const projectId = Deno.env.get('BROWSERBASE_PROJECT_ID')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;

    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey,
      projectId,
      browserbaseSessionID: sessionId,
      modelName: 'claude-sonnet-4-20250514',
      modelClientOptions: { apiKey: anthropicKey },
      verbose: 1,
      enableCaching: false,
    } as any);

    await stagehand.init();
    const page: any = stagehand.page;

    // CDP session to intercept downloads as base64
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Browser.setDownloadBehavior', {
      behavior: 'base64',
      eventsEnabled: true,
    });

    const downloadedFiles: Array<{ data: string; fileName: string }> = [];

    cdpSession.on('Browser.downloadProgress', (event: any) => {
      if (event.state === 'completed' && event.base64Data) {
        downloadedFiles.push({
          data: event.base64Data,
          fileName: `PayStub-${Date.now()}.pdf`,
        });
      }
    });

    // Navigate directly to pay statements
    await page.goto('https://my.adp.com/#/pay/statements', { waitUntil: 'networkidle' });

    // Handle "Go Paperless" popup if it appears
    try {
      await page.act(
        'If a "Go Paperless" or "Paperless Settings" popup appears, close it by clicking the close button.'
      );
    } catch (_) { /* no popup */ }

    await page.waitForTimeout(2000);

    // Extract pay statement entries
    const statements = await page.extract({
      instruction:
        'List all pay statement entries visible in the left panel list. Return each one with its display date text and its position index (0 = first/most recent).',
      schema: {
        type: 'object',
        properties: {
          statements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                index: { type: 'number' },
              },
            },
          },
        },
      },
    } as any).catch((e: unknown) => {
      console.error('extract statements failed', e);
      return null;
    });

    const recentStatements = (statements?.statements || []).slice(0, 5);
    console.log(`found ${recentStatements.length} statements to download`);

    for (const stmt of recentStatements) {
      try {
        await page.act(
          `Click on the pay statement entry for ${stmt.date} in the list on the left side.`
        );
        await page.waitForTimeout(1000);

        await page.act(
          'Click the "View statement" button (sdf-button with hint "View statement").'
        );
        await page.waitForTimeout(500);

        await page.act(
          'Click "Download current statement Recommended" from the dropdown menu.'
        );
        await page.waitForTimeout(3000);

        if (downloadedFiles.length > 0) {
          const last = downloadedFiles[downloadedFiles.length - 1];
          last.fileName = `PayStub-${String(stmt.date).replace(/[^a-z0-9]/gi, '-')}.pdf`;
        }
      } catch (err) {
        console.error(`Failed to download ${stmt.date}:`, err);
        continue;
      }
    }

    // Upload to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uploadedFiles: Array<{ fileName: string }> = [];

    for (const file of downloadedFiles) {
      try {
        const binaryStr = atob(file.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const storagePath = `${caseId}/${checklistItemId}/${Date.now()}-${file.fileName}`;

        const storageRes = await fetch(
          `${supabaseUrl}/storage/v1/object/case-documents/${storagePath}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/pdf',
              'x-upsert': 'true',
            },
            body: bytes,
          }
        );

        if (!storageRes.ok) {
          console.error('Upload failed:', await storageRes.text());
          continue;
        }

        const insertRes = await fetch(`${supabaseUrl}/rest/v1/files`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            case_id: caseId,
            checklist_item_id: checklistItemId,
            file_name: file.fileName,
            storage_path: storagePath,
            uploaded_by: 'agent',
            review_status: 'pending',
            ai_validation_status: 'passed',
          }),
        });

        if (insertRes.ok) {
          uploadedFiles.push({ fileName: file.fileName });
        } else {
          console.error('files insert failed', await insertRes.text());
        }
      } catch (err) {
        console.error('File upload error:', err);
      }
    }

    if (uploadedFiles.length > 0) {
      await fetch(
        `${supabaseUrl}/rest/v1/checklist_items?id=eq.${checklistItemId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ completed: true }),
        }
      );
    }

    try { await stagehand.close(); } catch (_) {}

    try {
      const bb = new Browserbase({ apiKey });
      await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' } as any);
    } catch (_) {}

    return new Response(
      JSON.stringify({ success: uploadedFiles.length > 0, files: uploadedFiles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('retrieve-paystubs error', err);
    if (stagehand) { try { await stagehand.close(); } catch (_) {} }
    return new Response(
      JSON.stringify({ success: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
