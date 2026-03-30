import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { email } = await req.json();
  
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users?.find((u: any) => u.email === email);
  
  if (!user) {
    return new Response(JSON.stringify({ status: "not_found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase.auth.admin.deleteUser(user.id);
  
  return new Response(JSON.stringify({ 
    status: error ? "error" : "deleted", 
    message: error?.message 
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
