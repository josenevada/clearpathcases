import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Browserbase from 'npm:@browserbasehq/sdk';
import { chromium, type Download, type Page } from 'npm:playwright-core@1.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const safeName = (name: string) =>
  name.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 80);

// Deterministic Playwright script for ADP. Returns the downloaded PDFs.
async function runAdp(page: Page, maxStatements = 4): Promise<Download[]> {
  const downloads: Download[] = [];

  await page.goto('https://my.adp.com/#/pay/statements', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Dismiss "Go Paperless" / similar popups if present.
  for (const label of ['Close dialog', 'Close', 'Not now', 'Maybe later', 'No thanks']) {
    try {
      const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ timeout: 1500 });
      }
    } catch (_) { /* no popup */ }
  }

  // Wait for the statements list to render.
  await page.waitForSelector('[role="button"]', { timeout: 20000 });

  for (let i = 0; i < maxStatements; i++) {
    try {
      const rows = page.locator('[role="button"]');
      const count = await rows.count();
      if (i >= count) break;

      await rows.nth(i).click({ timeout: 10000 });

      // "View statement" opens the statement viewer.
      await page
        .getByRole('button', { name: /view statement/i })
        .first()
        .click({ timeout: 10000 });

      // Trigger and capture the download.
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page
          .getByText(/download current statement/i)
          .first()
          .click({ timeout: 10000 }),
      ]);

      downloads.push(download);

      // Back to the list for the next statement.
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForSelector('[role="button"]', { timeout: 15000 }).catch(() => {});
    } catch (e) {
      console.error(`paystub ${i} retrieval failed`, e);
      break;
    }
  }

  return downloads;
}

async function downloadToBuffer(download: Download): Promise<{ buffer: Uint8Array; suggested: string }> {
  const stream = await download.createReadStream();
  if (!stream) {
    // Fallback to saveAs to a tmp path then read.
    const tmp = await Deno.makeTempFile({ suffix: '.pdf' });
    await download.saveAs(tmp);
    const buf = await Deno.readFile(tmp);
    await Deno.remove(tmp).catch(() => {});
    return { buffer: buf, suggested: download.suggestedFilename() || 'paystub.pdf' };
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as any) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return { buffer: out, suggested: download.suggestedFilename() || 'paystub.pdf' };
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

    const apiKey = Deno.env.get('BROWSERBASE_API_KEY')!;
    const bb = new Browserbase({ apiKey });
    const session: any = await bb.sessions.retrieve(sessionId);

    const connectUrl =
      (session as any).connectUrl ??
      `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${sessionId}`;

    const browser = await chromium.connectOverCDP(connectUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());

    let downloads: Download[] = [];
    try {
      if (provider === 'adp') {
        downloads = await runAdp(page, 4);
      } else {
        // Other providers: not implemented yet via raw Playwright.
        return new Response(
          JSON.stringify({
            success: false,
            error: `Provider "${provider}" not yet supported by deterministic script.`,
          }),
          { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } finally {
      browser.disconnect();
    }

    console.log('paystub downloads captured:', downloads.length);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uploadedFiles: Array<{ fileName: string }> = [];

    for (const dl of downloads) {
      try {
        const { buffer, suggested } = await downloadToBuffer(dl);
        const finalFileName = safeName(suggested.endsWith('.pdf') ? suggested : `${suggested}.pdf`);
        const storagePath = `${caseId}/${checklistItemId}/${Date.now()}-${finalFileName}`;

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
      } catch (e) {
        console.error('paystub upload error', e);
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
      await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' } as any);
    } catch (_) { /* ignore */ }

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
