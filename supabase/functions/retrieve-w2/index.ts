import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Stagehand } from 'npm:@browserbasehq/stagehand';
import Browserbase from 'npm:@browserbasehq/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const instructions: Record<string, string> = {
  adp: `You are on the ADP dashboard at my.adp.com. Click on "Tax Statements" in the top navigation tabs (you can see Pay, Direct Deposit, Tax Statements). Once on the Tax Statements page, find W-2 forms for 2024 and 2023. Click each one to get a download link or PDF URL.`,
  workday: 'Navigate to Pay section, then Tax Documents, and locate W-2 forms for the last 2 years.',
  paychex: 'Navigate to Tax Documents and locate W-2 forms for the last 2 years.',
  gusto: 'Navigate to Documents then Tax Documents and locate W-2 forms.',
  paylocity: 'Navigate to Pay then Tax Documents and locate W-2 forms for the last 2 years.',
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
      browserbaseSessionId: sessionId,
      modelName: 'claude-sonnet-4-20250514',
      modelClientOptions: { apiKey: Deno.env.get('ANTHROPIC_API_KEY')! },
    } as any);

    await stagehand.init();

    await stagehand.page.act(instructions[provider] || instructions.adp);

    const result: any = await stagehand.page.extract({
      instruction: 'Find W-2 document download links or PDF files. Return one entry per W-2 with its tax year, a direct downloadUrl to the PDF, and the employer name if visible.',
      schema: {
        type: 'object',
        properties: {
          documents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                year: { type: 'string' },
                downloadUrl: { type: 'string' },
                employerName: { type: 'string' },
              },
              required: ['year', 'downloadUrl'],
            },
          },
        },
      },
    } as any);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uploadedFiles: Array<{ fileName: string; year: string; employerName?: string }> = [];

    for (const doc of (result?.documents ?? []) as Array<{ year: string; downloadUrl: string; employerName?: string }>) {
      try {
        const dl = await fetch(doc.downloadUrl);
        if (!dl.ok) continue;
        const buffer = await dl.arrayBuffer();
        const safeEmployer = (doc.employerName || 'employer').replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
        const fileName = `W2-${doc.year}-${safeEmployer}.pdf`;
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

        // Mark checklist item completed
        await fetch(`${supabaseUrl}/rest/v1/checklist_items?id=eq.${checklistItemId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ completed: true }),
        });

        uploadedFiles.push({ fileName, year: doc.year, employerName: doc.employerName });
      } catch (e) {
        console.error('document download/upload error', e);
      }
    }

    try {
      await stagehand.close();
    } catch (_) {
      // ignore
    }

    // Terminate the Browserbase session
    try {
      const bb = new Browserbase({ apiKey: Deno.env.get('BROWSERBASE_API_KEY')! });
      await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' } as any);
    } catch (_) {
      // ignore termination errors
    }

    return new Response(
      JSON.stringify({ success: uploadedFiles.length > 0, files: uploadedFiles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('retrieve-w2 error', err);
    return new Response(
      JSON.stringify({ success: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
