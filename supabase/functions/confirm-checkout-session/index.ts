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

    const { payment_intent_id, plan } = await req.json();
    if (!payment_intent_id) throw new Error("No payment_intent_id provided");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== "succeeded") {
      return new Response(JSON.stringify({ confirmed: false, status: paymentIntent.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

    // Find subscription for this customer
    let subscriptionId: string | null = null;
    if (customerId) {
      const subs = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: "active" });
      if (subs.data.length > 0) subscriptionId = subs.data[0].id;
    }

    // Find the user's firm
    const { data: userRow } = await supabaseClient
      .from("users")
      .select("firm_id")
      .eq("id", user.id)
      .single();

    if (userRow?.firm_id) {
      await supabaseClient
        .from("firms")
        .update({
          subscription_status: "active",
          plan_name: plan || "starter",
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId,
        })
        .eq("id", userRow.firm_id);
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
