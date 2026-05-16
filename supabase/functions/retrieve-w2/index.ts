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

  try {
    const { sessionId, provider, caseId, checklistItemId } = await req.json();

    if (!sessionId || !provider || !caseId || !checklistItemId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const skyvernApiKey = Deno.env.get('SKYVERN_API_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const bb = new Browserbase({
      apiKey: Deno.env.get('BROWSERBASE_API_KEY')!,
    });
    const session: any = await bb.sessions.retrieve(sessionId);
    const currentUrl = session?.currentUrl || 'https://my.adp.com';

    const taskRes = await fetch('https://api.skyvern.com/api/v1/tasks', {
      method: 'POST',
      headers: {
        'x-api-key': skyvernApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: currentUrl,
        goal: `Download W-2 tax forms for the last 2 years as PDF files. The user is already logged in. Navigate to the tax statements or W-2 section and download each W-2 PDF. Handle any popups that appear.`,
        browser_session_id: sessionId,
        webhook_callback_url:
          `${supabaseUrl}/functions/v1/skyvern-webhook?caseId=${caseId}&checklistItemId=${checklistItemId}&type=w2`,
        extracted_information_schema: {
          type: 'object',
          properties: {
            downloaded_files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  file_name: { type: 'string' },
                  year: { type: 'string' },
                },
              },
            },
          },
        },
      }),
    });

    if (!taskRes.ok) {
      const err = await taskRes.text();
      console.error('Skyvern task creation failed:', err);
      return new Response(
        JSON.stringify({ success: false, error: err }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const task = await taskRes.json();
    console.log('Skyvern task created:', task.task_id);

    let attempts = 0;
    const maxAttempts = 36;
    let taskResult: any = null;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 5000));
      attempts++;

      const statusRes = await fetch(
        `https://api.skyvern.com/api/v1/tasks/${task.task_id}`,
        { headers: { 'x-api-key': skyvernApiKey } }
      );

      if (!statusRes.ok) continue;

      const status = await statusRes.json();
      console.log(`Task status (${attempts}):`, status.status);

      if (status.status === 'completed') {
        taskResult = status;
        break;
      }

      if (status.status === 'failed' || status.status === 'terminated') {
        console.error('Task failed:', status);
        break;
      }
    }

    if (!taskResult) {
      try {
        await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' } as any);
      } catch (_) {}

      return new Response(
        JSON.stringify({ success: false, error: 'Task timed out or failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const artifactsRes = await fetch(
      `https://api.skyvern.com/api/v1/tasks/${task.task_id}/artifacts`,
      { headers: { 'x-api-key': skyvernApiKey } }
    );

    const artifacts = artifactsRes.ok ? await artifactsRes.json() : [];

    const uploadedFiles: Array<{ fileName: string }> = [];

    for (const artifact of artifacts) {
      if (!artifact.uri || !artifact.artifact_type?.includes('download')) {
        continue;
      }

      try {
        const fileRes = await fetch(artifact.uri);
        if (!fileRes.ok) continue;
        const buffer = await fileRes.arrayBuffer();

        const fileName = artifact.file_name || `W2-${Date.now()}.pdf`;
        const storagePath = `${caseId}/${checklistItemId}/${fileName}`;

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
          }
        );

        if (!storageRes.ok) {
          console.error('Storage upload failed:', await storageRes.text());
          continue;
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
      } catch (err) {
        console.error('Artifact upload error:', err);
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
      JSON.stringify({
        success: uploadedFiles.length > 0,
        files: uploadedFiles,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('retrieve-w2 error', err);
    return new Response(
      JSON.stringify({ success: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
