// Client Portal mediator — handles all anonymous client-portal DB and storage
// access via a HMAC-signed portalToken issued after DOB verification.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SIGNING_SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h

// Whitelisted columns that the anonymous client may write.
const CASE_WRITABLE_COLS = new Set([
  'last_client_activity', 'wizard_step', 'ready_to_file',
]);
const ITEM_WRITABLE_COLS = new Set([
  'completed', 'text_value', 'not_applicable', 'not_applicable_reason',
  'not_applicable_marked_by', 'not_applicable_at',
  'resubmitted_at', 'correction_status',
]);

function pick(obj: Record<string, unknown>, allowed: Set<string>) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj || {})) if (allowed.has(k)) out[k] = obj[k];
  return out;
}

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64url(sig);
}

async function issueToken(caseId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${caseId}.${exp}`;
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

async function verifyToken(token: string | undefined, caseId: string): Promise<boolean> {
  if (!token || !caseId) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tokCaseId, expStr, sig] = parts;
  if (tokCaseId !== caseId) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmac(`${tokCaseId}.${expStr}`);
  return expected === sig;
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch { /* noop */ }
  const action = body?.action as string;

  try {
    // ---- Unauthenticated actions ----
    if (action === 'lookup') {
      const caseCode = String(body.caseCode || '').trim();
      if (!caseCode) return json({ error: 'caseCode required' }, 400);
      const { data: byClient } = await sb.from('cases')
        .select('id, case_code, spouse_case_code')
        .eq('case_code', caseCode).maybeSingle();
      if (byClient) return json({ caseId: byClient.id, isSpouseLink: false });
      const { data: bySpouse } = await sb.from('cases')
        .select('id, case_code, spouse_case_code')
        .eq('spouse_case_code', caseCode).maybeSingle();
      if (bySpouse) return json({ caseId: bySpouse.id, isSpouseLink: true });
      return json({ caseId: null });
    }

    if (action === 'verify') {
      const caseCode = String(body.caseCode || '').trim();
      const dob = String(body.dob || '').trim();
      if (!caseCode || !dob) return json({ error: 'caseCode and dob required' }, 400);

      const { data: c } = await sb.from('cases')
        .select('id, case_code, spouse_case_code, client_dob, spouse_dob')
        .or(`case_code.eq.${caseCode},spouse_case_code.eq.${caseCode}`)
        .maybeSingle();
      if (!c) return json({ error: 'not found' }, 404);

      const isSpouseLink = c.spouse_case_code === caseCode;
      const expectedDob = isSpouseLink ? c.spouse_dob : c.client_dob;
      if (!expectedDob || expectedDob !== dob) return json({ error: 'dob mismatch' }, 401);

      const portalToken = await issueToken(c.id);
      return json({ caseId: c.id, isSpouseLink, portalToken });
    }

    // ---- Token-gated actions ----
    const caseId = String(body.caseId || '');
    const tokenOk = await verifyToken(body.portalToken, caseId);
    if (!tokenOk) return json({ error: 'unauthorized' }, 401);

    if (action === 'load') {
      const [caseRes, itemsRes, filesRes, actRes] = await Promise.all([
        sb.from('cases').select('*').eq('id', caseId).maybeSingle(),
        sb.from('checklist_items').select('*').eq('case_id', caseId).order('sort_order', { ascending: true }),
        sb.from('files').select('*').eq('case_id', caseId),
        sb.from('activity_log').select('*').eq('case_id', caseId).order('created_at', { ascending: false }).limit(200),
      ]);
      const caseRow = caseRes.data;
      let firmData: any = null;
      if (caseRow?.firm_id) {
        const { data } = await sb.from('firms')
          .select('name, plan_name, counseling_provider_link, counseling_provider_name, counseling_attorney_code')
          .eq('id', caseRow.firm_id).maybeSingle();
        firmData = data;
      }
      // Sign URLs for files so client can preview
      const fileRows = await Promise.all((filesRes.data || []).map(async (f: any) => {
        let display_url = '';
        if (f.storage_path) {
          const { data: signed } = await sb.storage.from('case-documents')
            .createSignedUrl(f.storage_path, 3600);
          display_url = signed?.signedUrl || '';
        }
        return { ...f, display_url };
      }));
      return json({
        caseRow,
        checklistRows: itemsRes.data || [],
        fileRows,
        activityRows: actRes.data || [],
        firmData,
      });
    }

    if (action === 'update-case') {
      const updates = pick(body.updates || {}, CASE_WRITABLE_COLS);
      if (Object.keys(updates).length === 0) return json({ ok: true });
      const { error } = await sb.from('cases').update(updates).eq('id', caseId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'update-item') {
      const itemId = String(body.itemId || '');
      const updates = pick(body.updates || {}, ITEM_WRITABLE_COLS);
      if (!itemId) return json({ error: 'itemId required' }, 400);
      const { error } = await sb.from('checklist_items')
        .update(updates).eq('id', itemId).eq('case_id', caseId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'create-file') {
      const f = body.file || {};
      if (!f.id || !f.checklist_item_id || !f.file_name) {
        return json({ error: 'invalid file payload' }, 400);
      }
      const { error } = await sb.from('files').insert({
        id: f.id,
        case_id: caseId,
        checklist_item_id: f.checklist_item_id,
        file_name: f.file_name,
        storage_path: f.storage_path || null,
        uploaded_at: f.uploaded_at || new Date().toISOString(),
        review_status: f.review_status || 'pending',
        uploaded_by: f.uploaded_by || 'client',
        ai_validation_status: f.ai_validation_status || 'pending',
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'delete-file') {
      const fileId = String(body.fileId || '');
      if (!fileId) return json({ error: 'fileId required' }, 400);
      // Verify file belongs to this case before deletion
      const { data: f } = await sb.from('files')
        .select('id, storage_path, case_id').eq('id', fileId).maybeSingle();
      if (!f || f.case_id !== caseId) return json({ error: 'not found' }, 404);
      if (f.storage_path) {
        await sb.storage.from('case-documents').remove([f.storage_path]);
      }
      await sb.from('files').delete().eq('id', fileId);
      return json({ ok: true });
    }

    if (action === 'log-activity') {
      const e = body.entry || {};
      const { error } = await sb.from('activity_log').insert({
        case_id: caseId,
        event_type: String(e.eventType || 'client_action'),
        actor_role: String(e.actorRole || 'client'),
        actor_name: String(e.actorName || 'Client'),
        description: e.description || null,
        item_id: e.itemId || null,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'insert-checkpoint') {
      const { error } = await sb.from('checkpoints').insert({
        case_id: caseId,
        checkpoint_type: String(body.checkpointType || ''),
        confirmed_by: String(body.confirmedBy || 'client'),
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'upsert-client-info-ssn') {
      const ssn = String(body.ssn || '');
      const fullLegalName = body.fullLegalName ? String(body.fullLegalName) : null;
      const email = body.email ? String(body.email) : null;
      const phone = body.phone ? String(body.phone) : null;

      const { data: existing } = await sb.from('client_info')
        .select('id').eq('case_id', caseId).maybeSingle();
      const payload: Record<string, unknown> = {
        case_id: caseId,
        ssn_encrypted: ssn,
        updated_at: new Date().toISOString(),
      };
      if (fullLegalName) payload.full_legal_name = fullLegalName;
      if (email) payload.email = email;
      if (phone) payload.phone = phone;

      if (existing) {
        const { error } = await sb.from('client_info').update(payload).eq('id', existing.id);
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await sb.from('client_info').insert(payload);
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === 'create-signed-upload') {
      const checklistItemId = String(body.checklistItemId || '');
      const fileName = String(body.fileName || '').replace(/[^\w.\-]/g, '_');
      if (!checklistItemId || !fileName) return json({ error: 'checklistItemId and fileName required' }, 400);
      // Verify the checklist item belongs to this case
      const { data: item } = await sb.from('checklist_items')
        .select('id, case_id').eq('id', checklistItemId).maybeSingle();
      if (!item || item.case_id !== caseId) return json({ error: 'invalid item' }, 403);

      const path = `${caseId}/${checklistItemId}/${crypto.randomUUID()}-${fileName}`;
      const { data, error } = await sb.storage.from('case-documents')
        .createSignedUploadUrl(path);
      if (error || !data) return json({ error: error?.message || 'upload prep failed' }, 400);
      return json({ path: data.path, token: data.token });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('client-portal error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
