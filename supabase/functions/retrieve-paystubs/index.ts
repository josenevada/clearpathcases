import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Browserbase from 'npm:@browserbasehq/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { sessionId, connectUrl, provider, caseId, checklistItemId } = await req.json();

  const bbApiKey = Deno.env.get('BROWSERBASE_API_KEY')!;
  const skyvernApiKey = Deno.env.get('SKYVERN_API_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const bb = new Browserbase({ apiKey: bbApiKey });

  try {
    const taskRes = await fetch('https://api.skyvern.com/api/v1/tasks', {
      method: 'POST',
      headers: { 'x-api-key': skyvernApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://my.adp.com/#/pay/statements',
        goal: `The user is already logged into their payroll portal. Download all pay stubs from the last 2 months as PDF files. Navigate to the pay statements section. For each of the 2-4 most recent pay stubs: click the pay statement entry, click View statement, then click Download current statement. Handle any popups that appear by closing them.`,
        cdp_address: connectUrl,
        engine: 'skyvern-2.0',
      }),
    });

    if (!taskRes.ok) {
      const err = await taskRes.text();
      console.error('Skyvern task failed:', err);
      throw new Error(`Skyvern error: ${err}`);
    }

    const task = await taskRes.json();
    const taskId = task.task_id || task.run_id;
    console.log('Skyvern task created:', taskId);

    let taskResult: any = null;
    for (let i = 0; i < 36; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await fetch(
        `https://api.skyvern.com/api/v1/tasks/${taskId}`,
        { headers: { 'x-api-key': skyvernApiKey } }
      );
      if (!statusRes.ok) continue;
      const status = await statusRes.json();
      console.log(`Status (${i + 1}):`, status.status);
      if (status.status === 'completed') {
        taskResult = status;
        break;
      }
      if (status.status === 'failed' || status.status === 'terminated') {
        console.error('Task failed:', status);
        break;
      }
    }

    await new Promise((r) => setTimeout(r, 3000));

    const uploadedFiles: Array<{ fileName: string }> = [];

    const uploadPdf = async (buffer: ArrayBuffer, fileName: string, contentType = 'application/pdf') => {
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
        }
      );
      if (!storageRes.ok) {
        console.error('Storage upload failed:', fileName, await storageRes.text());
        return;
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
    };

    // Try Browserbase downloads first
    try {
      const downloadsRes = await fetch(
        `https://api.browserbase.com/v1/sessions/${sessionId}/downloads`,
        { headers: { 'X-BB-API-Key': bbApiKey } }
      );
      const ct = downloadsRes.headers.get('content-type') || '';
      console.log('BB downloads:', downloadsRes.status, 'content-type:', ct);

      if (downloadsRes.ok) {
        const buf = await downloadsRes.arrayBuffer();
        console.log('BB downloads bytes:', buf.byteLength);
        if (buf.byteLength > 100) {
          if (ct.includes('zip') || ct.includes('octet-stream')) {
            await uploadPdf(buf, `PayStubs-${Date.now()}.zip`, 'application/zip');
          } else if (ct.includes('json')) {
            const files = JSON.parse(new TextDecoder().decode(buf));
            console.log('BB downloads JSON:', JSON.stringify(files).slice(0, 500));
            for (const file of (files || [])) {
              try {
                const fr = await fetch(file.url || file.uri || file.downloadUrl);
                if (!fr.ok) continue;
                await uploadPdf(await fr.arrayBuffer(), file.name || file.fileName || `PayStub-${Date.now()}.pdf`);
              } catch (e) {
                console.error('BB file fetch err:', e);
              }
            }
          } else {
            // Assume it's a single binary
            await uploadPdf(buf, `PayStubs-${Date.now()}.bin`, ct || 'application/octet-stream');
          }
        }
      } else {
        console.error('BB downloads failed:', await downloadsRes.text());
      }
    } catch (e) {
      console.error('BB downloads error:', e);
    }

    // Fallback: pull artifacts from Skyvern
    if (uploadedFiles.length === 0) {
      try {
        const aRes = await fetch(
          `https://api.skyvern.com/api/v1/tasks/${taskId}/artifacts`,
          { headers: { 'x-api-key': skyvernApiKey } }
        );
        console.log('Skyvern artifacts status:', aRes.status);
        if (aRes.ok) {
          const artifacts = await aRes.json();
          console.log('Skyvern artifacts count:', Array.isArray(artifacts) ? artifacts.length : 'n/a',
            'sample:', JSON.stringify(artifacts).slice(0, 800));
          for (const art of (artifacts || [])) {
            const type = String(art.artifact_type || '');
            const uri = art.uri || art.signed_url || art.url;
            if (!uri) continue;
            if (!type.toLowerCase().includes('download') && !String(uri).toLowerCase().includes('.pdf')) continue;
            try {
              const fr = await fetch(uri);
              if (!fr.ok) continue;
              await uploadPdf(await fr.arrayBuffer(), art.file_name || `PayStub-${Date.now()}.pdf`);
            } catch (e) {
              console.error('Skyvern artifact fetch err:', e);
            }
          }
        } else {
          console.error('Skyvern artifacts failed:', await aRes.text());
        }
      } catch (e) {
        console.error('Skyvern artifacts error:', e);
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

    try {
      await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' } as any);
    } catch (_) {}

    return new Response(
      JSON.stringify({ success: uploadedFiles.length > 0, files: uploadedFiles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('retrieve-paystubs error:', err);
    try {
      await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' } as any);
    } catch (_) {}

    return new Response(
      JSON.stringify({ success: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
