import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Stagehand } from 'npm:@browserbasehq/stagehand';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const instructions: Record<string, string> = {
  adp: 'You are on the ADP dashboard. Navigate to Pay statements and download pay stubs from the last 2 months. Look for "Pay" or "Pay Statements" in the navigation. Download each pay stub as PDF.',
  workday: 'Navigate to Pay section, then Pay History or Payslips. Download pay stubs from the last 2 months as PDFs.',
  paychex: 'Navigate to Pay History and download pay stubs from the last 2 months as PDFs.',
  gusto: 'Navigate to Documents or Pay Stubs section and download pay stubs from the last 2 months.',
  paylocity: 'Navigate to Pay section then Pay History and download pay stubs from the last 2 months as PDFs.',
};

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

    const stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: Deno.env.get('BROWSERBASE_API_KEY')!,
      browserbaseSessionID: sessionId,
      modelName: 'claude-sonnet-4-20250514',
      modelClientOptions: { apiKey: Deno.env.get('ANTHROPIC_API_KEY')! },
    } as any);

    await stagehand.init();

    await stagehand.page.act(instructions[provider] || instructions.adp);

    const result: any = await stagehand.page.extract({
      instruction: 'Find pay stub document download links or PDF files for the last 2 months. Return one entry per pay stub with its pay period date (YYYY-MM-DD if possible), a direct downloadUrl to the PDF, and the employer name if visible.',
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uploadedFiles: Array<{ fileName: string; date: string; employerName?: string }> = [];

    for (const doc of (result?.documents ?? []) as Array<{ date?: string; downloadUrl: string; employerName?: string }>) {
      try {
        const dl = await fetch(doc.downloadUrl);
        if (!dl.ok) continue;
        const buffer = await dl.arrayBuffer();
        const dateStr = doc.date || 'unknown';
        const fileName = `PayStub-${dateStr}.pdf`;
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
            file_name: fileName,
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

        await fetch(`${supabaseUrl}/rest/v1/checklist_items?id=eq.${checklistItemId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ completed: true }),
        });

        uploadedFiles.push({ fileName, date: dateStr, employerName: doc.employerName });
      } catch (e) {
        console.error('document download/upload error', e);
      }
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
