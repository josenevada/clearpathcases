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

  // Give ADP a beat to render the paperless interstitial before we try anything.
  await page.waitForTimeout(2500);

  // Dismiss the ADP "Go Paperless" / "Paperless Settings" interstitial.
  // ADP wraps it in custom elements: <sdf-focus-pane data-e2e="prompt-modal">
  // and <paperless-view-wrapper data-e2e="paperless-prompt">, NOT [role="dialog"].
  const dialogSel = [
    '[data-e2e="prompt-modal"]',
    '[data-e2e="paperless-prompt"]',
    'paperless-view-wrapper',
    'sdf-focus-pane',
    '[role="dialog"]',
    '.modal, .sdf-dialog, .sdf-modal',
    '[class*="paperless" i]',
  ].join(', ');

  const namedButtons = [
    'Maybe Later', 'Remind me later', 'Remind Me Later',
    'No thanks', 'No Thanks', 'Not now', 'Not Now',
    'Cancel', 'Skip', 'Dismiss', 'Close dialog', 'Close',
  ];
  const iconCloseSelectors = [
    '[data-e2e="prompt-modal"] [id*="close" i]',
    '[data-e2e="prompt-modal"] [aria-label*="close" i]',
    '[data-e2e="prompt-modal"] button:has(svg)',
    '[data-e2e="paperless-prompt"] [aria-label*="close" i]',
    'sdf-focus-pane [aria-label*="close" i]',
    'sdf-focus-pane [id*="close" i]',
    'sdf-focus-pane button:has(svg)',
    'sdf-icon-button[aria-label*="close" i]',
    '#close-icon, button#close-icon',
    'button[aria-label*="close" i]',
    'button[title*="close" i]',
    'button[data-testid*="close" i]',
    '.modal-close, .close-button, .sdf-dialog-close, .sdf-icon-close',
  ];

  for (let pass = 0; pass < 5; pass++) {
    const dialog = page.locator(dialogSel).first();
    const visible = await dialog.isVisible({ timeout: 600 }).catch(() => false);
    if (!visible) break;
    console.log(`paperless modal detected (pass ${pass + 1}), attempting to dismiss`);

    let dismissed = false;

    // Labelled buttons SCOPED to the modal first.
    for (const label of namedButtons) {
      try {
        const scoped = page.locator(dialogSel).first()
          .getByRole('button', { name: new RegExp(`^\\s*${label}\\s*$`, 'i') }).first();
        if (await scoped.isVisible({ timeout: 300 })) {
          await scoped.click({ timeout: 1500 });
          dismissed = true;
          break;
        }
      } catch (_) { /* try next */ }
    }

    // Icon-only close controls.
    if (!dismissed) {
      for (const sel of iconCloseSelectors) {
        try {
          const el = page.locator(sel).first();
          if (await el.isVisible({ timeout: 300 })) {
            await el.click({ timeout: 1500 });
            dismissed = true;
            break;
          }
        } catch (_) { /* try next */ }
      }
    }

    if (!dismissed) {
      try { await page.keyboard.press('Escape'); } catch (_) { /* ignore */ }
    }

    await page.waitForTimeout(800);
    const stillThere = await dialog.isVisible({ timeout: 400 }).catch(() => false);
    if (!stillThere) {
      console.log('paperless modal dismissed');
      break;
    }
  }

  // Wait for the actual statements list. Avoid generic [role="button"] —
  // ADP renders dozens of those (nav widgets, modal buttons). Scope to statement rows.
  const statementRowSel = [
    '[data-e2e*="statement" i]',
    '[class*="statement-row" i]',
    'a[href*="statements"]',
  ].join(', ');
  await page.waitForSelector(statementRowSel, { timeout: 20000 }).catch(() => {});

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
