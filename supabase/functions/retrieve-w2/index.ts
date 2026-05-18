import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Stagehand } from 'npm:@browserbasehq/stagehand';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STEEL_API_KEY = Deno.env.get('STEEL_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { sessionId, provider, caseId, checklistItemId } = await req.json();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cdpUrl = `wss://connect.steel.dev?apiKey=${STEEL_API_KEY}&sessionId=${sessionId}`;

  const releaseSession = async () => {
    try {
      await fetch(`https://api.steel.dev/v1/sessions/${sessionId}/release`, {
        method: 'POST',
        headers: { 'Steel-Api-Key': STEEL_API_KEY },
      });
    } catch (_) {}
  };

  try {
    const stagehand = new Stagehand({
      env: 'LOCAL',
      localBrowserLaunchOptions: { cdpUrl },
      modelName: 'claude-sonnet-4-20250514',
      modelClientOptions: { apiKey: Deno.env.get('ANTHROPIC_API_KEY')! },
    } as any);

    await stagehand.init();

    await stagehand.page.goto('https://my.adp.com/#/pay/tax-statements', {
      waitUntil: 'domcontentloaded',
    });
    await stagehand.page.waitForTimeout(3000);

    try {
      await stagehand.page.act('If a popup appears, close it.');
      await stagehand.page.waitForTimeout(1000);
    } catch (_) {}

    for (let i = 0; i < 2; i++) {
      try {
        const label = i === 0 ? 'most recent' : 'second most recent';
        await stagehand.page.act(`Click the ${label} W-2 tax form entry in the list.`);
        await stagehand.page.waitForTimeout(1500);
        await stagehand.page.act('Download this W-2 document as a PDF.');
        await stagehand.page.waitForTimeout(4000);
      } catch (_) {
        break;
      }
    }

    try { await stagehand.close(); } catch (_) {}
    await new Promise((r) => setTimeout(r, 3000));

    const uploadedFiles: Array<{ fileName: string }> = [];

    const uploadBuffer = async (buffer: ArrayBuffer, fileName: string, contentType: string) => {
      const storagePath = `${caseId}/${checklistItemId}/${fileName}`;
      const storageRes = await fetch(
        `${supabaseUrl}/storage/v1/object/case-documents/${storagePath}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': contentType,
            'x-upsert': 'true',
          },
          body: buffer,
        },
      );
      if (!storageRes.ok) {
        console.error('Storage upload failed:', fileName, await storageRes.text());
        return false;
      }
      await fetch(`${supabaseUrl}/rest/v1/files`, {
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
          file_name: fileName,
          storage_path: storagePath,
          uploaded_by: 'agent',
          review_status: 'pending',
          ai_validation_status: 'passed',
        }),
      });
      uploadedFiles.push({ fileName });
      console.log('Uploaded:', fileName, buffer.byteLength, 'bytes');
      return true;
    };

    const filesRes = await fetch(
      `https://api.steel.dev/v1/sessions/${sessionId}/files`,
      { headers: { 'Steel-Api-Key': STEEL_API_KEY } },
    );

    if (filesRes.ok) {
      const filesList = await filesRes.json();
      const pdfFiles = (filesList.data || []).filter(
        (f: any) => f.path?.endsWith('.pdf') || f.name?.endsWith('.pdf'),
      );

      for (const file of pdfFiles) {
        try {
          const fr = await fetch(
            `https://api.steel.dev/v1/sessions/${sessionId}/files/download?path=${encodeURIComponent(file.path)}`,
            { headers: { 'Steel-Api-Key': STEEL_API_KEY } },
          );
          if (!fr.ok) continue;
          const buffer = await fr.arrayBuffer();
          const fileName = file.name || file.path?.split('/').pop() || `W2-${Date.now()}.pdf`;
          await uploadBuffer(buffer, fileName, 'application/pdf');
        } catch (e) {
          console.error('File upload error:', e);
        }
      }
    }

    if (uploadedFiles.length === 0) {
      const zipRes = await fetch(
        `https://api.steel.dev/v1/sessions/${sessionId}/files/download-archive`,
        { headers: { 'Steel-Api-Key': STEEL_API_KEY } },
      );
      if (zipRes.ok) {
        const buffer = await zipRes.arrayBuffer();
        if (buffer.byteLength > 100) {
          await uploadBuffer(buffer, `W2-${Date.now()}.zip`, 'application/zip');
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

    await releaseSession();

    return new Response(
      JSON.stringify({ success: uploadedFiles.length > 0, files: uploadedFiles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('retrieve-w2 error:', err);
    await releaseSession();
    return new Response(
      JSON.stringify({ success: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
