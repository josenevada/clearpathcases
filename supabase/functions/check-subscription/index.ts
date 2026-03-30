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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      // Return unsubscribed instead of 500 for deleted/invalid users
      return new Response(JSON.stringify({ subscribed: false, status: "unauthenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");

    // Get the user's firm
    const { data: userRow } = await supabaseClient
      .from("users")
      .select("firm_id")
      .eq("email", user.email)
      .maybeSingle();

    if (!userRow?.firm_id) {
      return new Response(JSON.stringify({ subscribed: false, status: "no_firm" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get firm subscription info
    const { data: firm } = await supabaseClient
      .from("firms")
      .select("subscription_status, trial_ends_at, plan_name, stripe_customer_id")
      .eq("id", userRow.firm_id)
      .maybeSingle();

    if (!firm) {
      return new Response(JSON.stringify({ subscribed: false, status: "no_firm" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check trial
    if (firm.subscription_status === "trial") {
      const trialEnd = firm.trial_ends_at ? new Date(firm.trial_ends_at) : null;
      const now = new Date();
      if (trialEnd && trialEnd > now) {
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return new Response(JSON.stringify({
          subscribed: true,
          status: "trial",
          plan: firm.plan_name || "starter",
          days_left: daysLeft,
          trial_ends_at: firm.trial_ends_at,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Trial expired
      return new Response(JSON.stringify({ subscribed: false, status: "trial_expired", plan: firm.plan_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check Stripe subscription
    if (firm.subscription_status === "active" && firm.stripe_customer_id) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const subscriptions = await stripe.subscriptions.list({
        customer: firm.stripe_customer_id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const productId = sub.items.data[0]?.price?.product;
        return new Response(JSON.stringify({
          subscribed: true,
          status: "active",
          plan: firm.plan_name,
          product_id: productId,
          subscription_end: new Date(sub.current_period_end * 1000).toISOString(),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Canceled or no active sub
    return new Response(JSON.stringify({ subscribed: false, status: firm.subscription_status || "inactive" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
