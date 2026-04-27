// Sends a confirmation + admin notification email when a firm submits a
// support ticket from the in-app Support tab. The ticket itself is already
// persisted in the `support_tickets` table by the client. This function
// handles email delivery only.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface TicketPayload {
  ticketId: string;
  firmName?: string;
  submittedByName: string;
  submittedByEmail: string;
  subject: string;
  message: string;
  category: string;
  priority: 'priority' | 'standard';
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const SUPPORT_INBOX = 'support@yourclearpath.app';
const FROM = 'ClearPath Support <noreply@yourclearpath.app>';

const sendResend = async (to: string, subject: string, html: string, replyTo?: string) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return { ok: false, detail: 'RESEND_API_KEY not configured' };
  }

  const body: Record<string, unknown> = {
    from: FROM,
    to: [to],
    subject,
    html,
  };
  if (replyTo) body.reply_to = replyTo;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, detail: `Resend error [${response.status}]: ${JSON.stringify(data)}` };
  }
  return { ok: true, detail: data.id };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const payload = (await req.json().catch(() => null)) as TicketPayload | null;

  if (
    !payload?.ticketId ||
    !payload?.submittedByName ||
    !payload?.submittedByEmail ||
    !payload?.subject ||
    !payload?.message
  ) {
    return json({ error: 'Missing required ticket fields' }, 400);
  }

  const safeSubject = escapeHtml(payload.subject);
  const safeMessage = escapeHtml(payload.message).replace(/\n/g, '<br/>');
  const safeName = escapeHtml(payload.submittedByName);
  const safeEmail = escapeHtml(payload.submittedByEmail);
  const safeFirm = escapeHtml(payload.firmName || 'Unknown firm');
  const safeCategory = escapeHtml(payload.category);
  const isPriority = payload.priority === 'priority';

  // ── Admin notification ──
  const adminHtml = `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#0D1B2A;margin:0 0 16px;">New support ticket${isPriority ? ' • PRIORITY' : ''}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
        <tr><td style="padding:6px 0;width:140px;color:#6b7280;">Ticket ID</td><td>${escapeHtml(payload.ticketId)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Firm</td><td>${safeFirm}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">From</td><td>${safeName} &lt;${safeEmail}&gt;</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Category</td><td>${safeCategory}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Priority</td><td>${isPriority ? 'Priority (4-hr SLA)' : 'Standard'}</td></tr>
      </table>
      <h3 style="margin:24px 0 8px;color:#0D1B2A;">${safeSubject}</h3>
      <div style="background:#f9fafb;border-left:3px solid #00C2A8;padding:14px 16px;border-radius:6px;font-size:14px;color:#1f2937;line-height:1.55;">
        ${safeMessage}
      </div>
      <p style="margin-top:24px;font-size:12px;color:#9ca3af;">
        Reply to this email to respond directly to the firm.
      </p>
    </div>
  `;

  // ── Submitter confirmation ──
  const userHtml = `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#0D1B2A;margin:0 0 16px;">We got your message</h2>
      <p style="font-size:15px;color:#374151;line-height:1.6;">Hi ${safeName},</p>
      <p style="font-size:15px;color:#374151;line-height:1.6;">
        Thanks for reaching out — we received your support request and our team will get back to you
        ${isPriority ? 'within 4 business hours' : 'within 1–2 business days'}.
      </p>
      <div style="background:#f9fafb;padding:16px;border-radius:8px;margin:20px 0;">
        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Your message</div>
        <div style="font-weight:600;color:#0D1B2A;margin-bottom:8px;">${safeSubject}</div>
        <div style="font-size:14px;color:#374151;line-height:1.55;">${safeMessage}</div>
      </div>
      <p style="font-size:13px;color:#6b7280;">Ticket ID: ${escapeHtml(payload.ticketId)}</p>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;">
        ClearPath — Bankruptcy document intake, simplified.
      </p>
    </div>
  `;

  const [admin, user] = await Promise.all([
    sendResend(
      SUPPORT_INBOX,
      `${isPriority ? '[PRIORITY] ' : ''}[${safeFirm}] ${payload.subject}`,
      adminHtml,
      payload.submittedByEmail,
    ),
    sendResend(
      payload.submittedByEmail,
      `We received your support request: ${payload.subject}`,
      userHtml,
    ),
  ]);

  return json({ admin, user });
});
