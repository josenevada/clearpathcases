import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { token, signer_type, typed_name, signature_data, ip_address, user_agent } = await req.json();

    if (!token || !signer_type || !typed_name) {
      return json({ error: 'token, signer_type, and typed_name are required' }, 400);
    }

    if (!['client', 'spouse', 'attorney'].includes(signer_type)) {
      return json({ error: 'Invalid signer_type' }, 400);
    }

    if (typed_name.length > 200) return json({ error: 'Name too long' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find the signature request by token
    const tokenField = signer_type === 'spouse' ? 'spouse_token' : 'client_token';
    let query = supabase.from('signature_requests').select('*');

    if (signer_type === 'attorney') {
      // Attorney signs by case context, token is the request id
      query = query.eq('id', token);
    } else {
      query = query.eq(tokenField, token);
    }

    const { data: request, error: fetchErr } = await query.single();
    if (fetchErr || !request) return json({ error: 'Invalid or expired signing link' }, 404);

    // Check expiry for client/spouse
    if (signer_type !== 'attorney') {
      const expiresAt = signer_type === 'spouse' ? request.spouse_token_expires_at : request.client_token_expires_at;
      if (new Date(expiresAt) < new Date()) {
        return json({ error: 'Signing link has expired. Please contact your attorney for a new link.' }, 410);
      }
    }

    const signedAt = new Date().toISOString();

    // Fetch forms requiring signature
    const { data: forms } = await supabase
      .from('generated_federal_forms').select('*')
      .eq('case_id', request.case_id)
      .in('form_code', ['B101', 'B106Dec', 'B108', 'B122A1'])
      .eq('watermark_status', 'approved');

    const signedFormPaths: { form_code: string; path: string }[] = [];

    for (const form of forms ?? []) {
      try {
        const { data: pdfBlob } = await supabase.storage
          .from('federal-forms').download(form.storage_path);
        if (!pdfBlob) continue;

        const pdfDoc = await PDFDocument.load(await pdfBlob.arrayBuffer());
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const { width } = lastPage.getSize();

        // Embed drawn signature if provided
        if (signature_data && signature_data.startsWith('data:image/png;base64,')) {
          try {
            const base64 = signature_data.split(',')[1];
            const sigBytes = Uint8Array.from(atob(base64), (c: string) => c.charCodeAt(0));
            const sigImage = await pdfDoc.embedPng(sigBytes);
            const sigDims = sigImage.scale(0.25);
            lastPage.drawImage(sigImage, {
              x: width * 0.08, y: 90,
              width: sigDims.width, height: sigDims.height,
            });
          } catch { /* skip image embed failure */ }
        }

        // Typed name as legal signature
        lastPage.drawText(`/s/ ${typed_name}`, {
          x: width * 0.08, y: 72, size: 12, font, color: rgb(0, 0, 0),
        });
        lastPage.drawText(`Electronically signed: ${new Date(signedAt).toLocaleString('en-US')}`, {
          x: width * 0.08, y: 58, size: 8, font, color: rgb(0.4, 0.4, 0.4),
        });
        lastPage.drawText(`IP: ${ip_address || 'N/A'} | Consent: Signed under ESIGN Act and UETA`, {
          x: width * 0.08, y: 46, size: 7, font, color: rgb(0.6, 0.6, 0.6),
        });

        const signedPdfBytes = await pdfDoc.save();
        const signedPath = form.storage_path.replace('.pdf', `_signed_${signer_type}.pdf`);

        await supabase.storage.from('federal-forms').upload(signedPath, signedPdfBytes, {
          contentType: 'application/pdf', upsert: true,
        });

        signedFormPaths.push({ form_code: form.form_code, path: signedPath });
      } catch (e) {
        console.error(`Failed to sign form ${form.form_code}:`, e);
      }
    }

    // Update signature request
    const updateData: Record<string, unknown> = { updated_at: signedAt };
    if (signer_type === 'client') {
      updateData.client_signed_at = signedAt;
      updateData.client_ip_address = ip_address;
      updateData.client_user_agent = user_agent;
      updateData.client_typed_name = typed_name;
      updateData.client_signature_data = signature_data;
      updateData.status = 'client_signed';
    } else if (signer_type === 'spouse') {
      updateData.spouse_signed_at = signedAt;
      updateData.spouse_ip_address = ip_address;
      updateData.spouse_typed_name = typed_name;
      updateData.spouse_signature_data = signature_data;
      updateData.status = 'client_signed';
    } else if (signer_type === 'attorney') {
      updateData.attorney_signed_at = signedAt;
      updateData.attorney_ip_address = ip_address;
      updateData.attorney_typed_name = typed_name;
      updateData.status = 'complete';
      updateData.completed_at = signedAt;
    }

    await supabase.from('signature_requests').update(updateData).eq('id', request.id);

    // Audit log
    await supabase.from('signature_audit_log').insert({
      signature_request_id: request.id,
      event_type: `${signer_type}_signed`,
      actor_type: signer_type,
      actor_name: typed_name,
      ip_address, user_agent,
      metadata: { signed_at: signedAt, forms_signed: signedFormPaths.map(f => f.form_code) },
    });

    // Activity log
    const eventType = signer_type === 'attorney' ? 'attorney_countersigned' : `${signer_type}_signed`;
    const description = signer_type === 'attorney'
      ? `Attorney ${typed_name} countersigned. All signatures complete. Packet ready to file.`
      : `${typed_name} signed ${signedFormPaths.length} bankruptcy documents electronically.`;

    await supabase.from('activity_log').insert({
      case_id: request.case_id,
      event_type: eventType,
      actor_role: signer_type,
      actor_name: typed_name,
      description,
    });

    // If attorney signed (complete), update case to ready_to_file
    if (signer_type === 'attorney') {
      await supabase.from('cases').update({
        ready_to_file: true,
        status: 'ready',
      }).eq('id', request.case_id);
    }

    return json({ success: true, signed_forms: signedFormPaths.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message || 'Internal error' }, 500);
  }
});
