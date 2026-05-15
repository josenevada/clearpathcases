import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Stagehand } from 'npm:@browserbasehq/stagehand';
import Browserbase from 'npm:@browserbasehq/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const instructions: Record<string, string> = {
  adp: `You are on the authenticated ADP dashboard.
Follow these exact steps:

1. Navigate directly to https://my.adp.com/#/pay/statements

2. Wait for the page to load and the pay statements list to appear.

3. If a "Go Paperless" or "Paperless Settings" popup appears, close it by clicking the close button (hint: "Close dialog").

4. Click on the most recent pay statement entry in the list (the first div with role="button" showing the most recent date).

5. Click the "View statement" button (sdf-button with hint "View statement").

6. Click "Download current statement" from the dropdown menu (sdf-menu-item with text "Download current statement Recommended").

7. Go back to the pay statements list.

8. Click on the second most recent pay statement.

9. Click "View statement" again.

10. Click "Download current statement" again.

Repeat for any additional statements within the last 2 months.`,
  workday: 'Navigate to Pay section, then Pay History or Payslips. Download pay stubs from the last 2 months as PDFs.',
  paychex: 'Navigate to Pay History and download pay stubs from the last 2 months as PDFs.',
  gusto: 'Navigate to Documents or Pay Stubs section and download pay stubs from the last 2 months.',
  paylocity: 'Navigate to Pay section then Pay History and download pay stubs from the last 2 months as PDFs.',
};

const safeName = (name: string) => name.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 80);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sessionId, provider, caseId, checklistItemId } = await req.json();

    if (!sessionId || !provider || !caseId || !checklistItemId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const browserbaseApiKey = Deno.env.get('BROWSERBASE_API_KEY')!;
    const stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: browserbaseApiKey,
      browserbaseSessionId: sessionId,
      modelName: 'claude-sonnet-4-20250514',
      modelClientOptions: { apiKey: Deno.env.get('ANTHROPIC_API_KEY')! },
    } as any);

    await stagehand.init();

    // Set up download interception via CDP before navigation
    const downloadDir = '/tmp/adp-downloads';
    try {
      await Deno.mkdir(downloadDir, { recursive: true });
    } catch (_) {
      // ignore
    }

    const client = await (stagehand.page as any).context().newCDPSession(stagehand.page);
    await client.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
      eventsEnabled: true,
    });

    client.on('Browser.downloadProgress', (event: any) => {
      if (event.state === 'completed') {
        console.log('Download completed:', event.guid);
      }
    });

    // Run the navigation instructions
    await stagehand.page.act(instructions[provider] || instructions.adp);

    // Wait for downloads to complete
    await new Promise((r) => setTimeout(r, 5000));

    // Read downloaded files from /tmp
    const downloadedFiles: Array<{ buffer: Uint8Array; fileName: string }> = [];
    try {
      for await (const entry of Deno.readDir(downloadDir)) {
        if (entry.isFile && entry.name.toLowerCase().endsWith('.pdf')) {
          const buffer = await Deno.readFile(`${downloadDir}/${entry.name}`);
          downloadedFiles.push({ buffer, fileName: entry.name });
        }
      }
    } catch (e) {
      console.error('reading downloads failed', e);
    }

    console.log('Downloaded files captured:', downloadedFiles.map((f) => f.fileName));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uploadedFiles: Array<{ fileName: string }> = [];

    for (const file of downloadedFiles) {
      const finalFileName = safeName(file.fileName);
      const storagePath = `${caseId}/${checklistItemId}/${finalFileName}`;

      const storageRes = await fetch(
        `${supabaseUrl}/storage/v1/object/case-documents/${storagePath}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/pdf',
            'x-upsert': 'true',
          },
          body: file.buffer,
        },
      );

      if (!storageRes.ok) {
        console.error('storage upload failed', await storageRes.text());
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
          file_name: finalFileName,
          storage_path: storagePath,
          uploaded_by: 'agent',
          review_status: 'pending',
          ai_validation_status: 'passed',
        }),
      });

      if (!insertRes.ok) {
        console.error('files insert failed', await insertRes.text());
        continue;
      }

      uploadedFiles.push({ fileName: finalFileName });
    }

    if (uploadedFiles.length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/checklist_items?id=eq.${checklistItemId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: true }),
      });
    }

    // Cleanup local downloads
    try {
      await Deno.remove(downloadDir, { recursive: true });
    } catch (_) {
      // ignore
    }

    try {
      await stagehand.close();
    } catch (_) {
      // ignore
    }

    try {
      const bb = new Browserbase({ apiKey: browserbaseApiKey });
      await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' } as any);
    } catch (_) {
      // ignore termination errors
    }

    return new Response(
      JSON.stringify({ success: uploadedFiles.length > 0, files: uploadedFiles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('retrieve-paystubs error', err);
    return new Response(
      JSON.stringify({ success: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
