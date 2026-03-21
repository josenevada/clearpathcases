const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type NotificationType =
  | 'client_welcome'
  | 'correction_request'
  | 'deadline_reminder_7d'
  | 'deadline_reminder_3d'
  | 'inactivity_48h'
  | 'firm_welcome'
  | 'general_reminder';

interface NotificationPayload {
  type: NotificationType;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  portalLink: string;
  caseId: string;
  // Optional fields for specific types
  correctionReason?: string;
  completionPercent?: number;
  firmName?: string;
  setupLink?: string;
  filingDeadline?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// ─── Email Templates ─────────────────────────────────────────────────

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:32px 40px 0;">
  <img src="https://clearpathcases.lovable.app/placeholder.svg" alt="ClearPath" width="120" style="display:block;margin-bottom:24px;" />
</td></tr>
<tr><td style="padding:0 40px 32px;">
${content}
</td></tr>
<tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
    ClearPath — Bankruptcy document intake, simplified.<br/>
    This is an automated message. Please do not reply directly.
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

const tealButton = (text: string, href: string) =>
  `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:#14b8a6;border-radius:8px;padding:14px 32px;">
      <a href="${href}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;display:inline-block;">${text}</a>
    </td></tr>
  </table>`;

const getEmailContent = (p: NotificationPayload): { subject: string; html: string } => {
  const firstName = p.clientName.split(' ')[0];

  switch (p.type) {
    case 'client_welcome':
      return {
        subject: 'Your document portal is ready',
        html: emailWrapper(`
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">Your document portal is ready</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${firstName},
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Your attorney's office has set up a secure document portal for your case. It walks you through everything you need to share, step by step. Most clients finish in under 30 minutes.
          </p>
          ${tealButton('Open My Portal', p.portalLink)}
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            This link is unique to you. Please do not share it.
          </p>
        `),
      };

    case 'correction_request':
      return {
        subject: 'One document needs your attention',
        html: emailWrapper(`
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">One document needs your attention</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${firstName},
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Your attorney's office reviewed your documents and needs one update before your case can move forward.
          </p>
          ${p.correctionReason ? `<p style="margin:0 0 16px;font-size:14px;color:#6b7280;background:#f9fafb;padding:12px 16px;border-radius:8px;border-left:3px solid #14b8a6;">
            <strong>Reason:</strong> ${p.correctionReason}
          </p>` : ''}
          ${tealButton('Fix It Now', p.portalLink)}
        `),
      };

    case 'deadline_reminder_7d':
      return {
        subject: 'Your filing date is coming up',
        html: emailWrapper(`
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">Your filing date is coming up</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${firstName},
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Your filing deadline is in about 7 days${p.filingDeadline ? ` (${p.filingDeadline})` : ''}. Your document portal is currently ${p.completionPercent ?? 0}% complete.
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Please take a few minutes to finish uploading your remaining documents so your attorney can prepare your case on time.
          </p>
          ${tealButton('Complete My Documents', p.portalLink)}
        `),
      };

    case 'deadline_reminder_3d':
      return {
        subject: 'Important — your filing date is in 3 days',
        html: emailWrapper(`
          <h1 style="margin:0 0 16px;font-size:22px;color:#d97706;">Important — your filing date is in 3 days</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${firstName},
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Your filing deadline is just 3 days away${p.filingDeadline ? ` (${p.filingDeadline})` : ''}. Your documents are ${p.completionPercent ?? 0}% complete.
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Please complete your remaining documents today so your attorney has time to review everything before filing.
          </p>
          ${tealButton('Complete My Documents Now', p.portalLink)}
        `),
      };

    case 'inactivity_48h':
      return {
        subject: 'Your document portal is waiting',
        html: emailWrapper(`
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">Your document portal is waiting</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${firstName},
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Just a friendly reminder — your attorney still needs a few more documents from you. Most clients finish in under 30 minutes.
          </p>
          ${tealButton('Continue Where I Left Off', p.portalLink)}
        `),
      };

    case 'firm_welcome':
      return {
        subject: 'Welcome to ClearPath',
        html: emailWrapper(`
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">Welcome to ClearPath</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Hi there,
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            A ClearPath account has been created for <strong>${p.firmName || 'your firm'}</strong>.
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            ClearPath helps bankruptcy firms collect client documents faster. Your clients get a guided, step-by-step portal. Your team gets real-time progress tracking and one-click filing packets.
          </p>
          ${p.setupLink ? tealButton('Set Up Your Password', p.setupLink) : ''}
        `),
      };

    case 'general_reminder':
      return {
        subject: 'Reminder about your documents',
        html: emailWrapper(`
          <h1 style="margin:0 0 16px;font-size:22px;color:#111827;">Reminder about your documents</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
            Hi ${firstName},
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            Your attorney's office is waiting on a few more documents from you. It only takes a few minutes to finish.
          </p>
          ${tealButton('Open My Portal', p.portalLink)}
        `),
      };

    default:
      return {
        subject: 'Update from your attorney\'s office',
        html: emailWrapper(`
          <p style="font-size:15px;color:#374151;">Please visit your document portal for an update.</p>
          ${tealButton('Open Portal', p.portalLink)}
        `),
      };
  }
};

// ─── SMS Templates ───────────────────────────────────────────────────

const getSmsBody = (p: NotificationPayload): string => {
  const firstName = p.clientName.split(' ')[0];

  switch (p.type) {
    case 'client_welcome':
      return `Hi ${firstName}, your document portal is ready. It only takes a few minutes. Open it here: ${p.portalLink}`;
    case 'correction_request':
      return `Your attorney's office needs one updated document. Tap here to fix it quickly: ${p.portalLink}`;
    case 'inactivity_48h':
      return `Just a reminder — your document portal is waiting. Your attorney needs a few more items: ${p.portalLink}`;
    case 'deadline_reminder_3d':
      return `Your filing date is in 3 days. Please complete your documents today: ${p.portalLink}`;
    case 'deadline_reminder_7d':
      return `Your filing date is coming up in 7 days. Please finish your documents soon: ${p.portalLink}`;
    case 'general_reminder':
      return `Hi ${firstName}, your attorney's office is waiting on a few more documents. It only takes a few minutes: ${p.portalLink}`;
    default:
      return `Hi ${firstName}, please visit your document portal: ${p.portalLink}`;
  }
};

// ─── Senders ─────────────────────────────────────────────────────────

const sendEmail = async (p: NotificationPayload) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return { status: 'skipped' as const, detail: 'RESEND_API_KEY not configured' };
  }

  const { subject, html } = getEmailContent(p);
  const to = p.type === 'firm_welcome' ? p.clientEmail : p.clientEmail;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ClearPath <noreply@yourclearpath.app>',
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { status: 'failed' as const, detail: `Resend error [${response.status}]: ${JSON.stringify(data)}` };
  }

  return { status: 'sent' as const, detail: data.id };
};

const sendSms = async (p: NotificationPayload) => {
  if (!p.clientPhone) {
    return { status: 'skipped' as const, detail: 'No phone number' };
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    return { status: 'skipped' as const, detail: 'Twilio credentials not configured' };
  }

  const body = new URLSearchParams({
    To: p.clientPhone,
    From: fromNumber,
    Body: getSmsBody(p),
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { status: 'failed' as const, detail: `Twilio error [${response.status}]: ${JSON.stringify(data)}` };
  }

  return { status: 'sent' as const, detail: data.sid };
};

// ─── Log to activity_log table ───────────────────────────────────────

const logNotification = async (p: NotificationPayload, emailResult: any, smsResult: any) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;

  const channels = [];
  if (emailResult.status === 'sent') channels.push('email');
  if (smsResult.status === 'sent') channels.push('SMS');
  if (channels.length === 0) return;

  const typeLabels: Record<string, string> = {
    client_welcome: 'Welcome notification',
    correction_request: 'Correction request notification',
    deadline_reminder_7d: '7-day deadline reminder',
    deadline_reminder_3d: '3-day deadline reminder',
    inactivity_48h: '48-hour inactivity reminder',
    general_reminder: 'General reminder',
    firm_welcome: 'Firm welcome email',
  };

  await fetch(`${supabaseUrl}/rest/v1/activity_log`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      case_id: p.caseId,
      event_type: 'reminder_sent',
      actor_role: 'system',
      actor_name: 'ClearPath',
      description: `${typeLabels[p.type] || 'Notification'} sent via ${channels.join(' and ')} to ${p.clientName}`,
    }),
  });
};

// ─── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const payload = (await req.json().catch(() => null)) as NotificationPayload | null;

  if (!payload?.type || !payload?.clientEmail || !payload?.clientName || !payload?.caseId) {
    return json({ error: 'Missing required fields: type, clientEmail, clientName, caseId' }, 400);
  }

  // Firm welcome only needs email
  if (payload.type === 'firm_welcome') {
    const email = await sendEmail(payload);
    return json({ email, sms: { status: 'skipped', detail: 'Not applicable for firm welcome' } });
  }

  const [email, sms] = await Promise.all([sendEmail(payload), sendSms(payload)]);

  // Log to activity feed
  await logNotification(payload, email, sms).catch(() => {});

  return json({ email, sms });
});
