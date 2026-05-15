import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Stagehand } from 'npm:@browserbasehq/stagehand';
import Browserbase from 'npm:@browserbasehq/sdk';

type BrowserbaseDownload = {
  id: string;
  sessionId: string;
  filename: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const instructions: Record<string, string> = {
  adp: `You are on the ADP dashboard at my.adp.com. Click on "Pay" in the top navigation tabs. Find pay statements from the last 2 months. For each one, get the PDF download link.`,
  workday: 'Navigate to Pay section, then Pay History or Payslips. Download pay stubs from the last 2 months as PDFs.',
  paychex: 'Navigate to Pay History and download pay stubs from the last 2 months as PDFs.',
  gusto: 'Navigate to Documents or Pay Stubs section and download pay stubs from the last 2 months.',
  paylocity: 'Navigate to Pay section then Pay History and download pay stubs from the last 2 months as PDFs.',
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const safeName = (name: string) => name.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 80);

async function listDownloads(sessionId: string, apiKey: string): Promise<BrowserbaseDownload[]> {
  const res = await fetch(`https://api.browserbase.com/v1/downloads?sessionId=${sessionId}&limit=20`, {
    headers: { 'X-BB-API-Key': apiKey },
  });
  if (!res.ok) {
    console.error('Browserbase list downloads failed', res.status, await res.text());
    return [];
  }
  const data = await res.json().catch(() => ({ downloads: [] }));
  return (data.downloads || []) as BrowserbaseDownload[];
}

async function waitForDownloads(sessionId: string, apiKey: string, minCount = 1): Promise<BrowserbaseDownload[]> {
  const end = Date.now() + 60000;
  let downloads: BrowserbaseDownload[] = [];
  while (Date.now() < end) {
    downloads = await listDownloads(sessionId, apiKey);
    if (downloads.length >= minCount) return downloads;
    await wait(3000);
  }
  return downloads;
}

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

    try {
      const cdp = await stagehand.page.context().newCDPSession(stagehand.page);
      await cdp.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: 'downloads',
        eventsEnabled: true,
      });
    } catch (downloadBehaviorErr) {
      console.error('setDownloadBehavior failed', downloadBehaviorErr);
    }

    await stagehand.page.act(instructions[provider] || instructions.adp);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uploadedFiles: Array<{ fileName: string; date: string; employerName?: string }> = [];

    const uploadBuffer = async (buffer: ArrayBuffer, fileName: string, dateStr: string, employerName?: string) => {
      const finalFileName = safeName(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
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
          body: buffer,
        },
      );

      if (!storageRes.ok) {
        console.error('storage upload failed', await storageRes.text());
        return false;
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
        return false;
      }

      uploadedFiles.push({ fileName: finalFileName, date: dateStr, employerName });
      return true;
    };

    const downloads = await waitForDownloads(sessionId, browserbaseApiKey, 4);
    console.log('Browserbase downloads found', downloads.map((d) => ({ id: d.id, filename: d.filename, mimeType: d.mimeType, size: d.size })));

    for (const download of downloads.slice(0, 4)) {
      try {
        const dl = await fetch(`https://api.browserbase.com/v1/downloads/${download.id}`, {
          headers: { 'X-BB-API-Key': browserbaseApiKey, Accept: 'application/octet-stream' },
        });
        if (!dl.ok) continue;
        const buffer = await dl.arrayBuffer();
        await uploadBuffer(buffer, download.filename || `PayStub-${uploadedFiles.length + 1}.pdf`, 'recent');
      } catch (e) {
        console.error('Browserbase download upload error', e);
      }
    }

    if (uploadedFiles.length === 0) {
      const result: any = await stagehand.page.extract({
        instruction: 'Find pay stub document download links or PDF files for the 4 most recent pay stubs. Return one entry per pay stub with its pay period date (YYYY-MM-DD if possible), a direct downloadUrl to the PDF, and the employer name if visible.',
        schema: {
          type: 'object',
          properties: {
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  downloadUrl: { type: 'string' },
                  employerName: { type: 'string' },
                },
                required: ['downloadUrl'],
              },
            },
          },
        },
      } as any);

      for (const doc of (result?.documents ?? []).slice(0, 4) as Array<{ date?: string; downloadUrl: string; employerName?: string }>) {
        try {
          const dl = await fetch(doc.downloadUrl);
          if (!dl.ok) continue;
          const buffer = await dl.arrayBuffer();
          const dateStr = doc.date || 'unknown';
          await uploadBuffer(buffer, `PayStub-${dateStr}.pdf`, dateStr, doc.employerName);
        } catch (e) {
          console.error('document download/upload error', e);
        }
      }
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

    try {
      await stagehand.close();
    } catch (_) {
      // ignore
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
