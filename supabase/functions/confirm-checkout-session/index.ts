import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { payment_intent_id, session_id, plan } = await req.json();
    if (!payment_intent_id && !session_id) throw new Error("No payment_intent_id or session_id provided");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let customerId: string | null = null;
    let subscriptionId: string | null = null;
    let resolvedPlan: string | undefined = plan;

    if (session_id) {
      // Stripe Checkout Session flow
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ confirmed: false, status: session.payment_status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
      resolvedPlan = plan || session.metadata?.plan || "starter";
    } else {
      // Legacy payment_intent_id flow
      const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

      if (paymentIntent.status !== "succeeded") {
        return new Response(JSON.stringify({ confirmed: false, status: paymentIntent.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      customerId = typeof paymentIntent.customer === "string"
        ? paymentIntent.customer
        : paymentIntent.customer?.id ?? null;

      if (customerId) {
        const subs = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: "active" });
        if (subs.data.length > 0) subscriptionId = subs.data[0].id;
      }
    }

    // Find the user's firm
    const { data: userRow } = await supabaseClient
      .from("users")
      .select("firm_id")
      .eq("id", user.id)
      .single();

    const updatePayload = {
      subscription_status: "active",
      plan_name: resolvedPlan || "starter",
      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscriptionId,
    };

    let updatedFirmId: string | null = null;

    try {
      if (userRow?.firm_id) {
        const { data: updated, error: updateErr } = await supabaseClient
          .from("firms")
          .update(updatePayload)
          .eq("id", userRow.firm_id)
          .select("id");

        if (updateErr) {
          console.error("[confirm-checkout-session] firm update error:", updateErr);
        } else if (updated && updated.length > 0) {
          updatedFirmId = updated[0].id;
          console.log("[confirm-checkout-session] firm updated by id:", updatedFirmId);
        } else {
          console.warn("[confirm-checkout-session] firm update affected 0 rows for firm_id:", userRow.firm_id);
        }
      } else {
        console.warn("[confirm-checkout-session] no firm_id on users row for user:", user.id);
      }

      // Retry: look up firm via primary_contact_email if first attempt didn't update anything
      if (!updatedFirmId && user.email) {
        const { data: firmByEmail, error: lookupErr } = await supabaseClient
          .from("firms")
          .select("id")
          .eq("primary_contact_email", user.email)
          .maybeSingle();

        if (lookupErr) {
          console.error("[confirm-checkout-session] firm lookup-by-email error:", lookupErr);
        } else if (firmByEmail?.id) {
          const { data: retryUpdated, error: retryErr } = await supabaseClient
            .from("firms")
            .update(updatePayload)
            .eq("id", firmByEmail.id)
            .select("id");

          if (retryErr) {
            console.error("[confirm-checkout-session] retry update error:", retryErr);
          } else if (retryUpdated && retryUpdated.length > 0) {
            updatedFirmId = retryUpdated[0].id;
            console.log("[confirm-checkout-session] firm updated via email fallback:", updatedFirmId);
          }
        } else {
          console.warn("[confirm-checkout-session] no firm found by email:", user.email);
        }
      }
    } catch (e) {
      console.error("[confirm-checkout-session] unexpected error updating firm:", (e as Error).message);
    }

    return new Response(JSON.stringify({ confirmed: true, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
