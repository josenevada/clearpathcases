import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const RETENTION_YEARS = 7;
    const GRACE_PERIOD_DAYS = 90;
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - RETENTION_YEARS);

    // Find cases that are filed/closed, older than 7 years, and not yet scheduled for deletion
    const { data: eligibleCases, error: queryError } = await supabase
      .from("cases")
      .select("id, client_name, court_case_number, case_code, firm_id, status, closed_at, created_at, retention_notified_at, retention_delete_scheduled_at")
      .in("status", ["filed", "closed"])
      .is("retention_delete_scheduled_at", null);

    if (queryError) throw queryError;

    // Filter cases older than retention period
    const casesToProcess = (eligibleCases || []).filter((c: any) => {
      const closedDate = c.closed_at ? new Date(c.closed_at) : new Date(c.created_at);
      return closedDate < cutoffDate;
    });

    if (casesToProcess.length === 0) {
      return new Response(JSON.stringify({ message: "No cases eligible for retention action." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by firm_id
    const firmGroups: Record<string, typeof casesToProcess> = {};
    for (const c of casesToProcess) {
      const fid = c.firm_id || "unknown";
      if (!firmGroups[fid]) firmGroups[fid] = [];
      firmGroups[fid].push(c);
    }

    const deleteScheduledAt = new Date();
    deleteScheduledAt.setDate(deleteScheduledAt.getDate() + GRACE_PERIOD_DAYS);

    for (const [firmId, cases] of Object.entries(firmGroups)) {
      // Get firm contact
      const { data: firm } = await supabase
        .from("firms")
        .select("name, primary_contact_email")
        .eq("id", firmId)
        .single();

      if (!firm?.primary_contact_email) continue;

      // Mark cases with scheduled deletion date
      for (const c of cases) {
        await supabase
          .from("cases")
          .update({
            retention_notified_at: new Date().toISOString(),
            retention_delete_scheduled_at: deleteScheduledAt.toISOString(),
          })
          .eq("id", c.id);

        // Log activity
        await supabase.from("activity_log").insert({
          case_id: c.id,
          event_type: "case_updated",
          actor_role: "system",
          actor_name: "ClearPath",
          description: `Data retention notice — scheduled for deletion on ${deleteScheduledAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
        });
      }

      // Send notification email via Resend
      if (resendKey) {
        const caseList = cases
          .map((c: any) => `• ${c.client_name}${c.court_case_number ? ` (${c.court_case_number})` : ""}`)
          .join("\n");

        const htmlCaseList = cases
          .map(
            (c: any) =>
              `<li style="margin-bottom:8px"><strong>${c.client_name}</strong>${c.court_case_number ? ` — ${c.court_case_number}` : ""}</li>`
          )
          .join("");

        const deletionDate = deleteScheduledAt.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ClearPath <noreply@updates.clearpathcases.com>",
            to: [firm.primary_contact_email],
            subject: "Action required — archived case data scheduled for deletion",
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                <h2 style="color:#0d9488">Data Retention Notice</h2>
                <p>The following cases have been filed or closed for more than 7 years and are scheduled for permanent deletion on <strong>${deletionDate}</strong>:</p>
                <ul style="padding-left:20px">${htmlCaseList}</ul>
                <p>All associated documents, activity history, and client data will be permanently deleted unless you export or manually delete them before this date.</p>
                <p style="margin-top:24px">
                  <a href="https://clearpathcases.lovable.app/paralegal" style="background-color:#0d9488;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold">Review Cases</a>
                </p>
                <p style="color:#888;font-size:12px;margin-top:32px">This is an automated message from ClearPath's data retention system.</p>
              </div>
            `,
          }),
        });
      }
    }

    // Process actual deletions — cases past the 90-day grace period
    const { data: deletionCases } = await supabase
      .from("cases")
      .select("id, client_name, court_case_number, firm_id")
      .in("status", ["filed", "closed"])
      .not("retention_delete_scheduled_at", "is", null)
      .lt("retention_delete_scheduled_at", new Date().toISOString());

    let deletedCount = 0;
    for (const c of deletionCases || []) {
      // Cascade delete all associated records
      await Promise.all([
        supabase.from("files").delete().eq("case_id", c.id),
        supabase.from("checklist_items").delete().eq("case_id", c.id),
        supabase.from("activity_log").delete().eq("case_id", c.id),
        supabase.from("notes").delete().eq("case_id", c.id),
        supabase.from("client_info").delete().eq("case_id", c.id),
        supabase.from("attorney_notes").delete().eq("case_id", c.id),
        supabase.from("checkpoints").delete().eq("case_id", c.id),
      ]);

      // Delete storage files
      const { data: storedFiles } = await supabase.storage
        .from("case-documents")
        .list(c.id);
      if (storedFiles && storedFiles.length > 0) {
        await supabase.storage
          .from("case-documents")
          .remove(storedFiles.map((f: any) => `${c.id}/${f.name}`));
      }

      // Delete the case
      await supabase.from("cases").delete().eq("id", c.id);
      deletedCount++;
    }

    return new Response(
      JSON.stringify({
        notified: casesToProcess.length,
        deleted: deletedCount,
        message: `Notified ${casesToProcess.length} cases, deleted ${deletedCount} cases.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Data retention error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
