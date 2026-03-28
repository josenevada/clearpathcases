import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMPLATE_FILES: Record<string, string> = {
  B101: "form_b_101_0624_fillable_clean (1).pdf",
  B106AB: "form_b106ab.pdf",
  B106C: "b_106c_0425-form.pdf",
  B106D: "form_b106d.pdf",
  B106EF: "form_b106ef.pdf",
  B106G: "form_b106g.pdf",
  B106H: "form_b106h.pdf",
  B106I: "form_b106i.pdf",
  B106J: "form_b106j.pdf",
  B106Sum: "form_b106sum.pdf",
  B106Dec: "form_b106dec.pdf",
  B107: "b_107_0425-form.pdf",
  B108: "form_b108.pdf",
  B122A1: "b_122a-1.pdf",
  B122A2: "b_122a-2_0425-form.pdf",
};

const FORM_TITLES: Record<string, string> = {
  B101: "Voluntary Petition for Individuals Filing for Bankruptcy",
  B106AB: "Schedule A/B: Property",
  B106C: "Schedule C: The Property You Claim as Exempt",
  B106D: "Schedule D: Creditors Who Have Claims Secured by Property",
  B106EF: "Schedule E/F: Creditors Who Have Unsecured Claims",
  B106G: "Schedule G: Executory Contracts and Unexpired Leases",
  B106H: "Schedule H: Your Codebtors",
  B106I: "Schedule I: Your Income",
  B106J: "Schedule J: Your Expenses",
  B106Sum: "Summary of Your Assets and Liabilities",
  B106Dec: "Declaration About an Individual Debtor's Schedules",
  B107: "Statement of Financial Affairs for Individuals",
  B108: "Statement of Intention for Individuals Filing Under Chapter 7",
  B122A1: "Chapter 7 Statement of Your Current Monthly Income (122A-1)",
  B122A2: "Chapter 7 Means Test Calculation (122A-2)",
};

const ALL_CH7_FORMS = Object.keys(FORM_TITLES);

async function addWatermark(pdfDoc: any, text: string) {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 2 - 120,
      y: height / 2,
      size: 72,
      font,
      color: rgb(0.85, 0.85, 0.85),
      opacity: 0.3,
      rotate: { type: "degrees", angle: 45 },
    });
  }
}

function safeFill(form: any, fieldName: string, value: string | undefined | null) {
  if (!value) return;
  try {
    const field = form.getTextField(fieldName);
    field.setText(value);
  } catch {
    // Field not found — skip silently
  }
}

function safeCheck(form: any, fieldName: string, shouldCheck: boolean) {
  if (!shouldCheck) return;
  try {
    const field = form.getCheckBox(fieldName);
    field.check();
  } catch {
    // Field not found — skip silently
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { case_id, form_codes, triggered_by } = await req.json();
    if (!case_id) {
      return new Response(JSON.stringify({ error: "case_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all extracted data
    const { data: extractedData } = await supabase
      .from("case_extracted_data")
      .select("*")
      .eq("case_id", case_id);

    // Build field lookup
    const fieldMap: Record<string, string> = {};
    for (const field of extractedData || []) {
      fieldMap[field.field_key] = field.manually_overridden
        ? field.override_value || ""
        : field.field_value || "";
    }

    const formsToGenerate =
      form_codes === "all" ? ALL_CH7_FORMS : (form_codes as string[]);
    const results: Array<{
      form_code: string;
      success: boolean;
      record_id?: string;
      error?: string;
    }> = [];

    for (const formCode of formsToGenerate) {
      try {
        const templateFileName = TEMPLATE_FILES[formCode];
        let pdfDoc: any;

        if (!templateFileName) {
          // No template mapping — create placeholder
          pdfDoc = await createPlaceholderPdf(formCode, extractedData);
        } else {
          const { data: templateBytes, error: templateError } = await supabase.storage
            .from("form-templates")
            .download(templateFileName);

          if (templateError || !templateBytes) {
            pdfDoc = await createPlaceholderPdf(formCode, extractedData);
          } else {
            pdfDoc = await PDFDocument.load(await templateBytes.arrayBuffer());
            try {
              const form = pdfDoc.getForm();
              fillFormFields(form, formCode, fieldMap);
            } catch {
              // PDF has no form fields — continue with watermark only
            }
          }
        }

        await addWatermark(pdfDoc, "DRAFT");
        const pdfBytes = await pdfDoc.save();

        // Get current version number
        const { data: existing } = await supabase
          .from("generated_federal_forms")
          .select("version")
          .eq("case_id", case_id)
          .eq("form_code", formCode)
          .order("version", { ascending: false })
          .limit(1);

        const newVersion = (existing?.[0]?.version ?? 0) + 1;
        const storagePath = `cases/${case_id}/forms/ch7/${formCode}_v${newVersion}.pdf`;

        await supabase.storage
          .from("federal-forms")
          .upload(storagePath, pdfBytes, {
            contentType: "application/pdf",
            upsert: false,
          });

        const { data: record } = await supabase
          .from("generated_federal_forms")
          .insert({
            case_id,
            form_code: formCode,
            form_title: FORM_TITLES[formCode] || formCode,
            storage_path: storagePath,
            version: newVersion,
            watermark_status: "draft",
          })
          .select()
          .single();

        results.push({
          form_code: formCode,
          success: true,
          record_id: record?.id,
        });
      } catch (err) {
        console.error(`Error generating ${formCode}:`, err);
        results.push({
          form_code: formCode,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    // Log activity
    const successCount = results.filter((r) => r.success).length;
    await supabase.from("activity_log").insert({
      case_id,
      event_type: "forms_generated",
      actor_role: "paralegal",
      actor_name: "Staff",
      description: `${successCount} pre-filled federal forms generated (DRAFT). Attorney approval required.`,
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Handler error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function createPlaceholderPdf(formCode: string, extractedData: any[]) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText(`${formCode} — ${FORM_TITLES[formCode] || formCode}`, {
    x: 50, y: 720, size: 14, font, color: rgb(0.05, 0.1, 0.16),
  });

  page.drawText("PLACEHOLDER — Upload official PDF template to enable form filling", {
    x: 50, y: 690, size: 10, font: bodyFont, color: rgb(0.5, 0.5, 0.5),
  });

  const formFields = (extractedData || []).filter((f: any) => f.form_reference === formCode);
  let yPos = 650;
  for (const f of formFields) {
    if (yPos < 80) {
      pdfDoc.addPage([612, 792]);
      yPos = 720;
    }
    const val = f.manually_overridden ? f.override_value : f.field_value;
    page.drawText(`${f.field_label}: ${val || "—"}`, {
      x: 70, y: yPos, size: 9, font: bodyFont, color: rgb(0.2, 0.2, 0.2),
    });
    yPos -= 16;
  }

  return pdfDoc;
}

function fillFormFields(form: any, formCode: string, fieldMap: Record<string, string>) {
  if (formCode === "B101") {
    safeFill(form, "Debtor1_FirstName", fieldMap["debtor_legal_name_first"]);
    safeFill(form, "Debtor1_MiddleName", fieldMap["debtor_legal_name_middle"]);
    safeFill(form, "Debtor1_LastName", fieldMap["debtor_legal_name_last"]);
    safeFill(form, "Debtor1_SSN_Last4", fieldMap["ssn_last_four"]);
    safeFill(form, "Debtor1_Street", fieldMap["debtor_id_address"]);
    safeFill(form, "Debtor1_Employer", fieldMap["employer_name"]);
    safeFill(form, "CreditCounseling_Provider", fieldMap["credit_counseling_provider"]);
    safeFill(form, "CreditCounseling_Date", fieldMap["credit_counseling_date"]);
    safeCheck(form, "Chapter7_Checkbox", true);
  }
  if (formCode === "B106I") {
    safeFill(form, "Debtor1_Occupation", fieldMap["occupation"]);
    safeFill(form, "Debtor1_Employer_Name", fieldMap["employer_name"]);
    safeFill(form, "Debtor1_Employer_Street", fieldMap["employer_street"]);
    safeFill(form, "Debtor1_Employer_City", fieldMap["employer_city"]);
    safeFill(form, "Debtor1_Employer_State", fieldMap["employer_state"]);
    safeFill(form, "Debtor1_Employer_Zip", fieldMap["employer_zip"]);
    safeFill(form, "Debtor1_GrossMonthly", fieldMap["gross_monthly_calculated"]);
    safeFill(form, "Debtor1_Deduction_FedTax", fieldMap["deduction_federal_tax"]);
    safeFill(form, "Debtor1_Deduction_StateTax", fieldMap["deduction_state_tax"]);
    safeFill(form, "Debtor1_Deduction_SS", fieldMap["deduction_ss"]);
    safeFill(form, "Debtor1_Deduction_Medicare", fieldMap["deduction_medicare"]);
    safeFill(form, "Debtor1_Deduction_Health", fieldMap["deduction_health_insurance"]);
    safeFill(form, "Debtor1_Deduction_Retirement", fieldMap["deduction_retirement_401k"]);
  }
  // Additional form codes — field names need updating after running discover-pdf-fields
}
