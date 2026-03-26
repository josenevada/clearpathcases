import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invitationId, firmName, inviterName, recipientEmail, role, personalMessage } = await req.json();

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const inviteUrl = `https://yourclearpath.app/invite/${invitationId}`;

    const emailHtml = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-family: 'Syne', Arial, sans-serif; font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">
            You're invited to ClearPath
          </h1>
        </div>
        <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 16px;">
          <strong>${inviterName}</strong> has invited you to join <strong>${firmName}</strong> on ClearPath as a <strong>${role}</strong>.
        </p>
        ${personalMessage ? `<div style="background: #f1f5f9; border-left: 3px solid #14b8a6; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0; font-style: italic;">"${personalMessage}"</p>
        </div>` : ''}
        <div style="text-align: center; margin: 32px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background: #14b8a6; color: #ffffff; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
            Accept Invitation
          </a>
        </div>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; text-align: center;">
          This invitation was sent via ClearPath — bankruptcy document intake, simplified.
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClearPath <noreply@yourclearpath.app>",
        to: [recipientEmail],
        subject: `You have been invited to join ${firmName} on ClearPath`,
        html: emailHtml,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
      throw new Error(result?.message || "Failed to send invitation email");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-invitation error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
