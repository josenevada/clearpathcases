import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_FILES: Record<string, string> = {
  B101: "form_b_101_0624_fillable_clean (1).pdf",
  B101A: "form_b101a_0.pdf",
  B101B: "form_b101b.pdf",
  B103A: "form_b103a.pdf",
  B103B: "form_b103b.pdf",
  B106AB: "form_b106ab.pdf",
  B106C: "b_106c_0425-form.pdf",
  B106D: "form_b106d.pdf",
  B106EF: "form_b106ef.pdf",
  B106G: "form_b106g.pdf",
  B106H: "form_b106h.pdf",
  B106I: "form_b106i.pdf",
  B106J: "form_b106j.pdf",
  B106J2: "form_b106j2.pdf",
  B106Sum: "form_b106sum.pdf",
  B106Dec: "form_b106dec.pdf",
  B107: "b_107_0425-form.pdf",
  B108: "form_b108.pdf",
  B122A1: "b_122a-1.pdf",
  B122A2: "b_122a-2_0425-form.pdf",
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

    const fileName = TEMPLATE_FILES[form_code];
    if (!fileName) {
      return new Response(
        JSON.stringify({
          error: `Unknown form_code "${form_code}". Valid codes: ${Object.keys(TEMPLATE_FILES).join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.storage
      .from("form-templates")
      .download(fileName);

    if (error || !data) {
      return new Response(
        JSON.stringify({
          error: `Template not found: ${fileName}. Upload to form-templates bucket first.`,
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
        file_name: fileName,
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
