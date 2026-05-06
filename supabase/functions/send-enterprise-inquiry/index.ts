const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Payload {
  fullName: string;
  firmName: string;
  email: string;
  phone?: string;
  casesPerMonth: string;
  message?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const INBOX = 'hello@yourclearpath.app';
const FROM = 'ClearPath <noreply@yourclearpath.app>';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const p = (await req.json().catch(() => null)) as Payload | null;
  if (!p?.fullName || !p?.firmName || !p?.email || !p?.casesPerMonth) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) return json({ error: 'Email not configured' }, 500);

  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#0D1B2A;margin:0 0 16px;">New Enterprise Inquiry</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
        <tr><td style="padding:6px 0;width:160px;color:#6b7280;">Name</td><td>${escapeHtml(p.fullName)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Firm</td><td>${escapeHtml(p.firmName)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td>${escapeHtml(p.email)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td>${escapeHtml(p.phone || '—')}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Cases per month</td><td>${escapeHtml(p.casesPerMonth)}</td></tr>
      </table>
      ${p.message ? `<h3 style="margin:24px 0 8px;color:#0D1B2A;">Message</h3>
      <div style="background:#f9fafb;border-left:3px solid #00C2A8;padding:14px 16px;border-radius:6px;font-size:14px;color:#1f2937;line-height:1.55;">
        ${escapeHtml(p.message).replace(/\n/g, '<br/>')}
      </div>` : ''}
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [INBOX],
      reply_to: p.email,
      subject: `Enterprise Inquiry — ${p.firmName}`,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: 'Failed to send', detail: data }, 500);
  return json({ ok: true });
});
