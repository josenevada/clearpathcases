import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BU_API_KEY = Deno.env.get('BROWSER_USE_API_KEY')!;
const BU_BASE = 'https://api.browser-use.com/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { taskId, caseId, checklistItemId, documentType } = await req.json();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    return true;
  };

  try {
    const outputRes = await fetch(`${BU_BASE}/task/${taskId}/output-file`, {
      headers: { Authorization: `Bearer ${BU_API_KEY}` },
    });

    if (outputRes.ok) {
      const contentType = outputRes.headers.get('content-type') || '';
      const buffer = await outputRes.arrayBuffer();

      if (buffer.byteLength > 0) {
        const ext = contentType.includes('zip') ? 'zip' : 'pdf';
        const prefix = documentType === 'w2' ? 'W2' : 'PayStubs';
        const fileName = `${prefix}-${Date.now()}.${ext}`;
        await uploadBuffer(buffer, fileName, contentType || 'application/pdf');
      }
    }

    if (uploadedFiles.length === 0) {
      const mediaRes = await fetch(`${BU_BASE}/task/${taskId}/media`, {
        headers: { Authorization: `Bearer ${BU_API_KEY}` },
      });

      if (mediaRes.ok) {
        const media = await mediaRes.json();
        const files = media.files || media.downloads || [];

        for (const file of files) {
          try {
            const fileUrl = file.url || file.download_url;
            if (!fileUrl) continue;
            const fileRes = await fetch(fileUrl);
            if (!fileRes.ok) continue;
            const buffer = await fileRes.arrayBuffer();
            const fileName =
              file.name ||
              file.filename ||
              `${documentType === 'w2' ? 'W2' : 'PayStub'}-${Date.now()}.pdf`;
            await uploadBuffer(buffer, fileName, 'application/pdf');
          } catch (e) {
            console.error('File upload error:', e);
          }
        }
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
        },
      );
    }

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
