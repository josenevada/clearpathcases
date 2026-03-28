import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────────────────
interface ExtractedField {
  field_key: string;
  field_label: string;
  field_value: string | null;
  form_reference: string;
  section_label: string;
  confidence: "high" | "medium" | "low";
  source_document_name: string;
  source_file_id: string;
}

// ─── Gemini call via Lovable AI Gateway ─────────────────────────────
async function callGeminiVision(
  imageUrl: string,
  prompt: string,
  apiKey: string
): Promise<ExtractedField[]> {
  // Download the file to get base64
  const fileResp = await fetch(imageUrl);
  if (!fileResp.ok) throw new Error(`Failed to download file: ${fileResp.status}`);
  const fileBuffer = await fileResp.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
  const contentType = fileResp.headers.get("content-type") || "application/pdf";

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${contentType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 8000,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI Gateway error:", response.status, errText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  // Parse JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("No JSON array found in response:", text.substring(0, 500));
    return [];
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse extracted JSON:", e);
    return [];
  }
}

// ─── Document Category → Extraction Prompt ──────────────────────────
function buildExtractionPrompt(
  docLabel: string,
  category: string,
  filingDate: string,
  isJoint: boolean
): string {
  const base = `You are a bankruptcy paralegal assistant. Extract structured data from this document for use in filing Chapter 7 bankruptcy forms.
Return ONLY a valid JSON array of extracted fields. No markdown, no explanation, no preamble.
Each object must have: field_key (snake_case unique identifier), field_label (human readable), field_value (extracted string value or null if not found), confidence ("high", "medium", or "low"), form_reference (which bankruptcy form this fills e.g. "B101", "B106I"), section_label (section name on that form).
If a value is not present in the document, return null for field_value with confidence "low".
Never extract or return a full Social Security Number. If you see an SSN, return only the last 4 digits with field_key "ssn_last_four".
Filing date for this case: ${filingDate}. Joint filing: ${isJoint}.`;

  const labelLower = docLabel.toLowerCase();

  if (labelLower.includes("pay stub")) {
    return `${base}
Extract: employer name/address (field_keys: employer_name, employer_street, employer_city, employer_state, employer_zip → B106I/Employment), employee name (debtor_name_on_stub), pay period dates (pay_period_start, pay_period_end), pay frequency (pay_frequency), gross pay this period (gross_pay_period), YTD gross (gross_pay_ytd), calculated gross monthly income (gross_monthly_calculated → B106I/Monthly Income), all deductions itemized (deduction_federal_tax, deduction_state_tax, deduction_ss, deduction_medicare, deduction_health_insurance, deduction_retirement_401k etc → B106I/Deductions), net pay (net_pay_period), occupation (occupation → B106I/Employment). For means test: extract gross for 6 calendar months ending the month before ${filingDate} (means_test_month_1..6, means_test_gross_1..6 → B122A-1/Means Test Income).`;
  }

  if (labelLower.includes("tax return")) {
    return `${base}
Extract: tax year (tax_return_year → B107/Income History), filing status (tax_filing_status → B101), wages line 1 (tax_wages_year → B107), Schedule C net profit (schedule_c_net, schedule_c_business_name → B107), total income (tax_total_income_year → B107), AGI (tax_agi_year → B107), alimony received (tax_alimony_received_year → B107/Other Income), pension/annuity (tax_pension_year → B107), social security benefits (tax_social_security_year → B107), charitable contributions (tax_charitable_year → B107/Charitable Contributions).`;
  }

  if (labelLower.includes("bank statement") || labelLower.includes("checking") || labelLower.includes("savings")) {
    return `${base}
Extract: bank name/address (bank_name, bank_street, bank_city, bank_state, bank_zip → B106AB/Financial Accounts), account type (bank_account_type), account last 4 (bank_account_last4), statement date (bank_statement_date), balance (bank_balance → B106AB/Financial Accounts), account holder name (bank_account_holder_name). Flag large payments to creditors >$600 in last 90 days (creditor_payment_{n}_payee, _amount, _date → B107/90-Day Payments). Flag account closure (account_closed_flag, account_closed_date → B107).`;
  }

  if (labelLower.includes("mortgage")) {
    return `${base}
Extract: lender name/address (mortgage_lender_name, _street, _city, _state, _zip → B106D/Secured Creditors), account last 4 (mortgage_account_last4), balance (mortgage_balance → B106D), monthly payment (mortgage_monthly_payment → B106J/Monthly Expenses), property address (mortgage_property_street, _city, _state, _zip → B106AB/Real Property), property value if shown (mortgage_property_value → B106AB), origination date (mortgage_origination_date → B106D), lien type (mortgage_lien_type → B106D), escrow breakdown (escrow_property_tax_monthly, escrow_insurance_monthly → B106J), past due flag (mortgage_default_flag, mortgage_past_due_amount → B107/Foreclosure Flag).`;
  }

  if (labelLower.includes("vehicle") && labelLower.includes("title")) {
    return `${base}
Extract: year/make/model (vehicle_year, vehicle_make, vehicle_model → B106AB/Vehicles), VIN (vehicle_vin), owner name (vehicle_owner_name), lienholder name/address (vehicle_lienholder_name, _street, _city, _state, _zip → B106D/Secured Creditors), title date (vehicle_title_date).`;
  }

  if (labelLower.includes("credit card")) {
    return `${base}
Extract: issuer name/address (cc_1_creditor_name, _street, _city, _state, _zip → B106EF/Unsecured Creditors), account last 4 (cc_1_account_last4), balance (cc_1_balance → B106EF), date opened (cc_1_date_opened), account holder (cc_1_account_holder), is retail card (cc_1_is_retail).`;
  }

  if (labelLower.includes("social security card") || labelLower.includes("ssn card")) {
    return `${base}
Extract: full legal name (debtor_legal_name_full, debtor_legal_name_first, debtor_legal_name_middle, debtor_legal_name_last → B101/Debtor Identity), last 4 of SSN ONLY (ssn_last_four → B101/Debtor Identity). NEVER extract the full SSN.`;
  }

  if (labelLower.includes("government id") || labelLower.includes("driver") || labelLower.includes("passport")) {
    return `${base}
Extract: full legal name (debtor_id_name_full → B101/Debtor Identity), date of birth (debtor_dob → B101), current address (debtor_id_address → B101), ID expiry (debtor_id_expiry).`;
  }

  if (labelLower.includes("credit counseling")) {
    return `${base}
Extract: certificate date (credit_counseling_date → B101/Credit Counseling), provider name (credit_counseling_provider), certificate number (credit_counseling_cert_number), debtor name on certificate (credit_counseling_debtor_name).`;
  }

  if (labelLower.includes("collection")) {
    return `${base}
Extract: agency name/address (collection_1_agency_name, _street, _city, _state, _zip → B106EF/Unsecured Creditors Part 3), original creditor (collection_1_original_creditor), account last 4 (collection_1_account_last4), amount claimed (collection_1_amount), debt type (collection_1_debt_type).`;
  }

  if (labelLower.includes("student loan")) {
    return `${base}
Extract: servicer name/address (student_loan_1_servicer_name, _street, _city, _state, _zip → B106EF/Unsecured Creditors), account last 4 (student_loan_1_account_last4), balance (student_loan_1_balance), loan type federal/private (student_loan_1_type), non-dischargeable flag (student_loan_1_nondischargeable_flag = "true").`;
  }

  if (labelLower.includes("retirement") || labelLower.includes("401k") || labelLower.includes("ira")) {
    return `${base}
Extract: institution name/address (retirement_1_institution, _street, _city, _state, _zip → B106AB/Retirement Accounts), account type (retirement_1_account_type), account last 4 (retirement_1_account_last4), balance (retirement_1_balance), holder name (retirement_1_holder_name), monthly distributions (retirement_1_monthly_distribution → B106I/Other Monthly Income).`;
  }

  if (labelLower.includes("insurance")) {
    return `${base}
Extract: company name (insurance_1_company → B106J/Monthly Expenses), policy type (insurance_1_type), monthly premium (insurance_1_monthly_premium), vehicle covered if auto (insurance_1_vehicle_covered).`;
  }

  if (labelLower.includes("lease")) {
    return `${base}
Extract: landlord name/address (lease_1_lessor_name, _street, _city, _state, _zip → B106G/Executory Contracts), premises address (lease_1_premises_address), lease dates (lease_1_start_date, lease_1_end_date), monthly rent (lease_1_monthly_rent → B106J/Monthly Expenses), type (lease_1_type).`;
  }

  // Generic fallback
  return `${base}
Extract any financial information from this document relevant to a Chapter 7 bankruptcy filing. Include creditor names/addresses, account numbers (last 4 only), balances, and payment amounts. Identify which bankruptcy form each field belongs to.`;
}

// ─── Conflict Resolution ────────────────────────────────────────────
function resolveConflicts(fields: ExtractedField[]): ExtractedField[] {
  const byKey: Record<string, ExtractedField[]> = {};
  for (const f of fields) {
    if (!byKey[f.field_key]) byKey[f.field_key] = [];
    byKey[f.field_key].push(f);
  }

  const confRank = { high: 0, medium: 1, low: 2 };

  return Object.values(byKey).map((dupes) => {
    if (dupes.length === 1) return dupes[0];

    const values = dupes.map((d) => d.field_value?.trim().toLowerCase());
    const unique = [...new Set(values)];
    const sorted = dupes.sort(
      (a, b) => confRank[a.confidence] - confRank[b.confidence]
    );

    if (unique.length <= 1) {
      return {
        ...sorted[0],
        conflict_detected: false,
        source_document_name: dupes.map((d) => d.source_document_name).join(", "),
      };
    }

    return {
      ...sorted[0],
      conflict_detected: true,
      source_document_name: dupes
        .map((d) => `${d.source_document_name}: ${d.field_value}`)
        .join(" | "),
    };
  });
}

// ─── Main handler ───────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { case_id, trigger_type, triggered_by } = await req.json();
    if (!case_id) {
      return new Response(JSON.stringify({ error: "case_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create extraction run record
    const { data: run, error: runError } = await supabase
      .from("form_extraction_runs")
      .insert({
        case_id,
        trigger_type: trigger_type || "manual",
        triggered_by: triggered_by || null,
        status: "running",
      })
      .select()
      .single();

    if (runError) throw runError;

    try {
      // Fetch case data
      const { data: caseData } = await supabase
        .from("cases")
        .select("*")
        .eq("id", case_id)
        .single();

      if (!caseData) throw new Error("Case not found");

      const filingDate = caseData.filing_deadline || new Date().toISOString().split("T")[0];
      const isJoint = false; // TODO: check joint filing field when available

      // Fetch all approved files with their checklist item info
      const { data: files } = await supabase
        .from("files")
        .select("id, file_name, storage_path, checklist_item_id")
        .eq("case_id", case_id)
        .eq("review_status", "approved");

      if (!files || files.length === 0) {
        await supabase
          .from("form_extraction_runs")
          .update({
            status: "complete",
            fields_extracted: 0,
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        return new Response(
          JSON.stringify({ success: true, run_id: run.id, fields: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get checklist item labels for each file
      const checklistIds = [...new Set(files.map((f: any) => f.checklist_item_id))];
      const { data: checklistItems } = await supabase
        .from("checklist_items")
        .select("id, label, category")
        .in("id", checklistIds);

      const checklistMap: Record<string, { label: string; category: string }> = {};
      for (const ci of checklistItems || []) {
        checklistMap[ci.id] = { label: ci.label, category: ci.category };
      }

      // Extract from each file
      const allExtracted: ExtractedField[] = [];
      const errors: string[] = [];

      for (const file of files) {
        try {
          if (!file.storage_path) continue;

          // Get signed URL
          const { data: signedData } = await supabase.storage
            .from("case-documents")
            .createSignedUrl(file.storage_path, 300);

          if (!signedData?.signedUrl) continue;

          const ci = checklistMap[file.checklist_item_id] || {
            label: file.file_name,
            category: "Unknown",
          };

          const prompt = buildExtractionPrompt(
            ci.label,
            ci.category,
            filingDate,
            isJoint
          );

          const extracted = await callGeminiVision(
            signedData.signedUrl,
            prompt,
            LOVABLE_API_KEY
          );

          // Attach source info
          for (const field of extracted) {
            field.source_document_name = file.file_name;
            field.source_file_id = file.id;
          }

          allExtracted.push(...extracted);
        } catch (fileErr) {
          console.error(`Error extracting from ${file.file_name}:`, fileErr);
          errors.push(`${file.file_name}: ${(fileErr as Error).message}`);
          // Continue with remaining documents
        }
      }

      // Resolve conflicts
      const resolved = resolveConflicts(allExtracted);

      // Preserve manually overridden fields
      const { data: existingFields } = await supabase
        .from("case_extracted_data")
        .select("field_key, manually_overridden, override_value, override_by, override_at")
        .eq("case_id", case_id)
        .eq("manually_overridden", true);

      const overriddenMap: Record<string, any> = {};
      for (const ef of existingFields || []) {
        overriddenMap[ef.field_key] = ef;
      }

      // Prepare upsert data
      const upsertData = resolved.map((f) => {
        const existing = overriddenMap[f.field_key];
        return {
          case_id,
          field_key: f.field_key,
          field_label: f.field_label,
          field_value: f.field_value,
          form_reference: f.form_reference,
          section_label: f.section_label,
          source_document_name: f.source_document_name,
          source_file_id: f.source_file_id,
          confidence: f.confidence,
          extracted_at: new Date().toISOString(),
          conflict_detected: (f as any).conflict_detected || false,
          // Preserve overrides
          manually_overridden: existing?.manually_overridden || false,
          override_value: existing?.override_value || null,
          override_by: existing?.override_by || null,
          override_at: existing?.override_at || null,
        };
      });

      if (upsertData.length > 0) {
        const { error: upsertError } = await supabase
          .from("case_extracted_data")
          .upsert(upsertData, {
            onConflict: "case_id,field_key",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error("Upsert error:", upsertError);
        }
      }

      // Update run stats
      const stats = {
        status: "complete",
        fields_extracted: resolved.length,
        fields_high_confidence: resolved.filter((f) => f.confidence === "high").length,
        fields_medium_confidence: resolved.filter((f) => f.confidence === "medium").length,
        fields_low_confidence: resolved.filter((f) => f.confidence === "low").length,
        conflicts_detected: resolved.filter((f: any) => f.conflict_detected).length,
        completed_at: new Date().toISOString(),
        error_message: errors.length > 0 ? `Partial errors: ${errors.join("; ")}` : null,
      };

      await supabase
        .from("form_extraction_runs")
        .update(stats)
        .eq("id", run.id);

      // Log to activity
      await supabase.from("activity_log").insert({
        case_id,
        event_type: trigger_type === "auto" ? "extraction_triggered_auto" : "extraction_triggered_manual",
        actor_role: trigger_type === "auto" ? "system" : "paralegal",
        actor_name: trigger_type === "auto" ? "System" : "Staff",
        description: `${resolved.length} fields extracted across federal forms. ${stats.conflicts_detected} conflicts detected.`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          run_id: run.id,
          fields_extracted: resolved.length,
          conflicts: stats.conflicts_detected,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("Extraction error:", err);
      await supabase
        .from("form_extraction_runs")
        .update({
          status: "failed",
          error_message: (err as Error).message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return new Response(
        JSON.stringify({ success: false, error: (err as Error).message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("Handler error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
