import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BU_API_KEY = Deno.env.get('BROWSER_USE_API_KEY')!;
const BU_BASE = 'https://api.browser-use.com/api/v3';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { taskId, caseId, checklistItemId, documentType } = await req.json();
  const sessionId = taskId;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const uploadedFiles: Array<{ fileName: string }> = [];

  const uploadBuffer = async (
    buffer: ArrayBuffer,
    fileName: string,
    contentType: string,
  ) => {
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
    return true;
  };

  try {
    const dlRes = await fetch(
      `${BU_BASE}/browsers/${sessionId}/downloads?includeUrls=true&limit=100`,
      { headers: { 'X-Browser-Use-API-Key': BU_API_KEY } },
    );

    if (dlRes.ok) {
      const data = await dlRes.json();
      const files = data.files || [];
      const prefix = documentType === 'w2' ? 'W2' : 'PayStub';
      let idx = 0;
      for (const file of files) {
        try {
          if (!file.url) continue;
          const fileRes = await fetch(file.url);
          if (!fileRes.ok) continue;
          const buffer = await fileRes.arrayBuffer();
          const baseName =
            file.path?.split('/').pop() || `${prefix}-${Date.now()}-${idx}.pdf`;
          const fileName = baseName.includes('.')
            ? baseName
            : `${baseName}.pdf`;
          const contentType =
            fileRes.headers.get('content-type') || 'application/pdf';
          await uploadBuffer(buffer, fileName, contentType);
          idx++;
        } catch (e) {
          console.error('File upload error:', e);
        }
      }
    } else {
      console.error('Downloads list failed:', dlRes.status, await dlRes.text());
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
        },
      );
    }

    // Best-effort: stop the session to release resources
    fetch(`${BU_BASE}/sessions/${sessionId}/stop`, {
      method: 'POST',
      headers: { 'X-Browser-Use-API-Key': BU_API_KEY },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: uploadedFiles.length > 0, files: uploadedFiles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('get-agent-files error:', err);
    return new Response(
      JSON.stringify({ success: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
