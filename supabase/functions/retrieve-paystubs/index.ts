import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Browserbase from 'npm:@browserbasehq/sdk';
import { Stagehand } from 'npm:@browserbasehq/stagehand@1.14.0';
import { z } from 'npm:zod';
import type { Download, Page } from 'npm:playwright-core@1.47.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const safeName = (name: string) =>
  name.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 80);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

// Stagehand-driven ADP retrieval. The LLM "sees" the page each step and
// self-heals around popups (Paperless Settings, security prompts, etc.)
// without us hard-coding selectors or shadow-DOM hacks.
async function runAdp(page: Page, maxStatements = 4): Promise<Download[]> {
  const downloads: Download[] = [];
  page.setDefaultTimeout(15000);

  await page.goto('https://my.adp.com/#/pay/statements', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(2500);

  // Stagehand attaches act/observe/extract methods to the Playwright page.
  const sh = page as any;

  // Self-healing popup dismissal — the LLM looks at the screenshot and clicks
  // the right close/dismiss/skip button, even inside ADP's shadow DOM modals.
  await sh.act?.(
    "If a 'Paperless Settings', 'Go Paperless', or any other modal/popup is covering the pay statements list, close or dismiss it (click Close, X, Skip, Maybe later, or Not now). If no popup is visible, do nothing.",
  ).catch((e: unknown) => console.log('initial popup dismissal note:', String(e)));

  await page.waitForTimeout(1000);

  // Find the visible pay statements via Stagehand's observe (returns elements
  // ranked by the LLM's understanding of the page).
  const statements = await sh.observe?.({
    instruction: 'Find each pay statement row in the pay statements list, ordered most recent first.',
    returnAction: false,
  }).catch(() => [] as Array<{ selector?: string; description?: string }>);

  const total = Math.min(maxStatements, Array.isArray(statements) ? statements.length : maxStatements);
  console.log(`stagehand observed ${Array.isArray(statements) ? statements.length : 0} statements; will fetch ${total}`);

  for (let i = 0; i < total; i++) {
    try {
      // Re-dismiss any popup that may have re-appeared between iterations.
      await sh.act?.(
        "If any popup, modal, or 'Paperless Settings' overlay is on screen, close it. Otherwise do nothing.",
      ).catch(() => {});

      await sh.act?.(
        `Click the pay statement at position ${i + 1} (1 = most recent) in the pay statements list.`,
      );

      await sh.act?.('Click the "View Statement" button to open the statement viewer.').catch(() => {});

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 25000 }),
        sh.act?.('Click the "Download Current Statement" link or button to download the PDF.'),
      ]);

      downloads.push(download);

      // Back to the list.
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
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

  const startedAt = Date.now();
  let releaseSession: (() => Promise<void>) | undefined;
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
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stagehand requires ANTHROPIC_API_KEY (or OPENAI_API_KEY).' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const bb = new Browserbase({ apiKey });
    releaseSession = async () => {
      try { await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' } as any); } catch (_) { /* ignore */ }
    };

    // Attach Stagehand to the existing Browserbase session created by
    // create-browser-session (so the user's manual login is preserved).
    stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey,
      projectId,
      browserbaseSessionID: sessionId,
      modelName: 'claude-3-5-sonnet-latest',
      modelClientOptions: { apiKey: anthropicKey },
      verbose: 1,
      enableCaching: false,
    });

    await stagehand.init();
    const page = stagehand.page as unknown as Page;

    let downloads: Download[] = [];
    let retrievalError: string | null = null;
    try {
      if (provider === 'adp') {
        downloads = await withTimeout(runAdp(page, 4), 120_000, 'ADP retrieval');
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Provider "${provider}" not yet supported by the Stagehand agent.`,
          }),
          { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } catch (e) {
      retrievalError = String((e as Error).message ?? e);
      console.error('paystub retrieval failed before upload', e);
    } finally {
      try { await withTimeout(stagehand.close(), 1500, 'stagehand close'); } catch (_) { /* ignore */ }
    }

    console.log('paystub downloads captured:', downloads.length);

    if (downloads.length === 0) {
      await withTimeout(releaseSession(), 1000, 'session release').catch(() => {});
      return new Response(
        JSON.stringify({ success: false, error: retrievalError || 'No paystub downloads were captured.', elapsedMs: Date.now() - startedAt }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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

    await withTimeout(releaseSession(), 1000, 'session release').catch(() => {});

    return new Response(
      JSON.stringify({ success: uploadedFiles.length > 0, files: uploadedFiles, elapsedMs: Date.now() - startedAt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('retrieve-paystubs error', err);
    if (stagehand) { try { await stagehand.close(); } catch (_) { /* ignore */ } }
    if (releaseSession) await withTimeout(releaseSession(), 1000, 'session release').catch(() => {});
    return new Response(
      JSON.stringify({ success: false, error: String((err as Error).message ?? err), elapsedMs: Date.now() - startedAt }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
