import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const { userId, firmName, fullName, email, planName } = body;

    if (!userId || !firmName || !fullName || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, firmName, fullName, email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client to bypass RLS
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify the user actually exists in auth.users
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
    if (authError || !authUser?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid user ID" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has a firm
    const { data: existingUser } = await admin
      .from("users")
      .select("firm_id")
      .eq("id", userId)
      .maybeSingle();

    if (existingUser?.firm_id) {
      return new Response(JSON.stringify({ firmId: existingUser.firm_id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate slug
    const baseSlug = firmName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "clearpath-firm";
    const { data: slugRows } = await admin
      .from("firms")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);
    const existingSlugs = new Set((slugRows ?? []).map((r: any) => r.slug).filter(Boolean));
    let slug = baseSlug;
    if (existingSlugs.has(slug)) {
      let suffix = 2;
      while (existingSlugs.has(`${baseSlug}-${suffix}`)) suffix++;
      slug = `${baseSlug}-${suffix}`;
    }

    const firmId = crypto.randomUUID();
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const selectedPlan = planName || "starter";

    // Insert firm
    const { error: firmError } = await admin.from("firms").insert({
      id: firmId,
      name: firmName,
      primary_contact_name: fullName,
      primary_contact_email: email,
      slug,
      subscription_status: "trial",
      trial_ends_at: trialEndsAt,
      plan_name: selectedPlan,
    });

    if (firmError) {
      console.error("Firm insert error:", firmError);
      return new Response(JSON.stringify({ error: "Failed to create workspace" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert user
    const { error: userError } = await admin.from("users").upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role: "attorney",
        firm_id: firmId,
      },
      { onConflict: "id" }
    );

    if (userError) {
      console.error("User insert error:", userError);
      // Rollback firm
      await admin.from("firms").delete().eq("id", firmId);
      return new Response(JSON.stringify({ error: "Failed to create user profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ firmId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("provision-workspace error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
