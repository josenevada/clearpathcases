import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { form_code } = await req.json();
    if (!form_code) {
      return new Response(JSON.stringify({ error: "form_code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.storage
      .from("form-templates")
      .download(`forms/federal/ch7/${form_code}.pdf`);

    if (error || !data) {
      return new Response(
        JSON.stringify({
          error: `Template not found for ${form_code}. Upload to form-templates/forms/federal/ch7/${form_code}.pdf first.`,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfDoc = await PDFDocument.load(await data.arrayBuffer());
    const form = pdfDoc.getForm();
    const fields = form.getFields().map((f: any) => ({
      name: f.getName(),
      type: f.constructor.name,
    }));

    return new Response(
      JSON.stringify({
        form_code,
        field_count: fields.length,
        fields,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
