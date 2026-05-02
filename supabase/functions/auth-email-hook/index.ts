// Supabase Auth Email Hook -> Resend
// Receives auth email events from Supabase, renders branded HTML, sends via Resend.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
const FROM = "ClearPath <noreply@yourclearpath.app>";

function escape(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function renderEmail(opts: {
  heading: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  token?: string;
  footer?: string;
}) {
  const { heading, intro, ctaLabel, ctaUrl, token, footer } = opts;
  const cta = ctaUrl && ctaLabel
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
        <tr><td style="border-radius:8px;background:#00C2A8">
          <a href="${escape(ctaUrl)}" style="display:inline-block;padding:14px 28px;font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:600;color:#0D1B2A;text-decoration:none;border-radius:8px">${escape(ctaLabel)}</a>
        </td></tr>
      </table>` : "";
  const code = token
    ? `<div style="margin:20px 0;padding:16px;background:#F4F6F8;border-radius:8px;font-family:'Courier New',monospace;font-size:24px;letter-spacing:4px;text-align:center;color:#0D1B2A;font-weight:700">${escape(token)}</div>` : "";
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#ffffff;font-family:'DM Sans',Arial,sans-serif;color:#0D1B2A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px">
        <tr><td style="padding-bottom:24px">
          <div style="font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:700;color:#0D1B2A">ClearPath</div>
        </td></tr>
        <tr><td style="padding:32px;background:#ffffff;border:1px solid #E5E7EB;border-radius:12px">
          <h1 style="margin:0 0 16px;font-family:'Playfair Display',Georgia,serif;font-size:24px;color:#0D1B2A">${escape(heading)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#374151">${intro}</p>
          ${code}
          ${cta}
          ${ctaUrl ? `<p style="margin:16px 0 0;font-size:13px;color:#6B7280">Or copy this link: <span style="word-break:break-all">${escape(ctaUrl)}</span></p>` : ""}
        </td></tr>
        <tr><td style="padding:24px 8px;font-size:12px;color:#9CA3AF;text-align:center">
          ${escape(footer ?? "If you didn't request this email, you can safely ignore it.")}
          <br/>© ClearPath
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildEmail(payload: any): { subject: string; html: string } {
  const { email_action_type, token, token_hash, redirect_to, site_url } = payload.email_data ?? {};
  const userEmail = payload.user?.email ?? "";
  const base = (site_url || "").replace(/\/$/, "");
  const link = token_hash
    ? `${base}/auth/v1/verify?token=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(email_action_type)}&redirect_to=${encodeURIComponent(redirect_to || base)}`
    : redirect_to || base;

  switch (email_action_type) {
    case "signup":
      return {
        subject: "Confirm your ClearPath account",
        html: renderEmail({
          heading: "Welcome to ClearPath",
          intro: `Confirm your email <strong>${escape(userEmail)}</strong> to activate your account.`,
          ctaLabel: "Confirm email",
          ctaUrl: link,
          token,
        }),
      };
    case "recovery":
      return {
        subject: "Reset your ClearPath password",
        html: renderEmail({
          heading: "Reset your password",
          intro: "Click the button below to choose a new password. This link expires in 1 hour.",
          ctaLabel: "Reset password",
          ctaUrl: link,
        }),
      };
    case "magiclink":
      return {
        subject: "Your ClearPath sign-in link",
        html: renderEmail({
          heading: "Sign in to ClearPath",
          intro: "Click the button below to sign in. This link expires shortly.",
          ctaLabel: "Sign in",
          ctaUrl: link,
        }),
      };
    case "email_change":
    case "email_change_new":
      return {
        subject: "Confirm your new email",
        html: renderEmail({
          heading: "Confirm your new email",
          intro: "Click the button below to confirm this email address for your ClearPath account.",
          ctaLabel: "Confirm email",
          ctaUrl: link,
        }),
      };
    case "invite":
      return {
        subject: "You've been invited to ClearPath",
        html: renderEmail({
          heading: "You're invited",
          intro: "Accept the invitation below to join your firm on ClearPath.",
          ctaLabel: "Accept invitation",
          ctaUrl: link,
        }),
      };
    case "reauthentication":
      return {
        subject: "Your ClearPath verification code",
        html: renderEmail({
          heading: "Verification code",
          intro: "Use the code below to verify this action:",
          token,
        }),
      };
    default:
      return {
        subject: "ClearPath notification",
        html: renderEmail({
          heading: "ClearPath",
          intro: "An action was requested on your ClearPath account.",
          ctaLabel: link ? "Open ClearPath" : undefined,
          ctaUrl: link,
        }),
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!HOOK_SECRET) throw new Error("SEND_EMAIL_HOOK_SECRET not configured");

    const payloadRaw = await req.text();
    const headers = Object.fromEntries(req.headers);

    // Verify standardwebhooks signature. Secret format: v1,whsec_xxx -> strip prefix.
    const secret = HOOK_SECRET.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
    const wh = new Webhook(secret);
    const payload: any = wh.verify(payloadRaw, headers);

    const to = payload.user?.email;
    if (!to) throw new Error("Missing recipient email");

    const { subject, html } = buildEmail(payload);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", res.status, errText);
      return new Response(JSON.stringify({ error: "send_failed", detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auth-email-hook error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: e?.message ?? "hook_failed" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
