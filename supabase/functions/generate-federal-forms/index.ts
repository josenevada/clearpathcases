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

const COMMUNITY_PROPERTY_STATES = ["AZ", "CA", "ID", "LA", "NV", "NM", "TX", "WA", "WI", "PR"];

const STATE_DISTRICTS: Record<string, string> = {
  AL: "Northern District of Alabama", AK: "District of Alaska", AZ: "District of Arizona",
  AR: "Eastern District of Arkansas", CA: "Central District of California",
  CO: "District of Colorado", CT: "District of Connecticut", DE: "District of Delaware",
  FL: "Southern District of Florida", GA: "Northern District of Georgia",
  HI: "District of Hawaii", ID: "District of Idaho", IL: "Northern District of Illinois",
  IN: "Southern District of Indiana", IA: "Northern District of Iowa",
  KS: "District of Kansas", KY: "Eastern District of Kentucky",
  LA: "Eastern District of Louisiana", ME: "District of Maine",
  MD: "District of Maryland", MA: "District of Massachusetts",
  MI: "Eastern District of Michigan", MN: "District of Minnesota",
  MS: "Southern District of Mississippi", MO: "Eastern District of Missouri",
  MT: "District of Montana", NE: "District of Nebraska", NV: "District of Nevada",
  NH: "District of New Hampshire", NJ: "District of New Jersey",
  NM: "District of New Mexico", NY: "Southern District of New York",
  NC: "Eastern District of North Carolina", ND: "District of North Dakota",
  OH: "Northern District of Ohio", OK: "Western District of Oklahoma",
  OR: "District of Oregon", PA: "Eastern District of Pennsylvania",
  RI: "District of Rhode Island", SC: "District of South Carolina",
  SD: "District of South Dakota", TN: "Middle District of Tennessee",
  TX: "Southern District of Texas", UT: "District of Utah",
  VT: "District of Vermont", VA: "Eastern District of Virginia",
  WA: "Western District of Washington", WV: "Southern District of West Virginia",
  WI: "Eastern District of Wisconsin", WY: "District of Wyoming",
  DC: "District of Columbia", PR: "District of Puerto Rico",
};

function safeFill(form: any, fieldName: string, value: string | undefined | null) {
  if (!value) return;
  try {
    const field = form.getTextField(fieldName);
    field.setText(value);
  } catch { /* skip */ }
}

function safeCheck(form: any, fieldName: string, shouldCheck: boolean) {
  if (!shouldCheck) return;
  try {
    const field = form.getCheckBox(fieldName);
    field.check();
  } catch { /* skip */ }
}

function todayFormatted(): string {
  return new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function sumFields(fm: Record<string, string>, ...keys: string[]): string {
  const total = keys.reduce((sum, k) => {
    const v = parseFloat(fm[k] || "0");
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
  return total > 0 ? total.toFixed(2) : "";
}

// ─── FILL FUNCTIONS PER FORM ───────────────────────────────────────────

function fillB101(form: any, fm: Record<string, string>, caseData: any) {
  const today = todayFormatted();
  const clientState = fm["client_info_state"] || caseData?.client_info?.state || "";

  // Debtor 1
  safeFill(form, "Debtor1.First name", fm["debtor_legal_name_first"]);
  safeFill(form, "Debtor1.Middle name", fm["debtor_legal_name_middle"]);
  safeFill(form, "Debtor1.Last name", fm["debtor_legal_name_last"]);
  // SSN — NEVER FILL
  safeFill(form, "Debtor1.Street", fm["debtor_id_address"]);
  safeFill(form, "Debtor1.City", fm["client_info_city"] || caseData?.client_info?.city);
  safeFill(form, "Debtor1.State", clientState);
  safeFill(form, "Debtor1.ZIP Code", fm["client_info_zip"] || caseData?.client_info?.zip);
  safeFill(form, "Debtor1.County", fm["client_info_county"] || caseData?.client_info?.county);
  safeFill(form, "Debtor1.Contact phone_2", fm["client_info_phone"] || caseData?.client_phone);
  safeFill(form, "Debtor1.Email address_2", fm["client_info_email"] || caseData?.client_email);
  safeFill(form, "Debtor1.Business name", fm["employer_name"]);
  safeFill(form, "Debtor1.Date signed", today);
  safeFill(form, "Executed on", today);

  // District
  const district = STATE_DISTRICTS[clientState] || "";
  safeFill(form, "Bankruptcy District Information", district);

  // Chapter 7 checkbox
  safeCheck(form, "Check Box5", true); // Ch 7

  // Credit counseling
  safeFill(form, "Debtor1.Name", fm["credit_counseling_debtor_name"]);

  // Joint filing — Debtor 2
  if (caseData?.joint_filing) {
    safeFill(form, "Debtor2.First name", fm["spouse_legal_name_first"]);
    safeFill(form, "Debtor2.Middle name_2", fm["spouse_legal_name_middle"]);
    safeFill(form, "Debtor2.Last name", fm["spouse_legal_name_last"]);
    safeFill(form, "Debtor2.Street", fm["spouse_street"]);
    safeFill(form, "Debtor2.City", fm["spouse_city"]);
    safeFill(form, "Debtor2.State", fm["spouse_state"]);
    safeFill(form, "Debtor2.ZIP", fm["spouse_zip"]);
    safeFill(form, "Debtor2.Contact phone", fm["spouse_phone"]);
    safeFill(form, "Debtor2.Email address", fm["spouse_email"]);
    safeFill(form, "Debtor2.Date signed", today);
  }
}

function fillB106I(form: any, fm: Record<string, string>, caseData: any) {
  // Debtor 1
  safeFill(form, "Occupation Debtor 1", fm["occupation"]);
  safeFill(form, "Employers Name Debtor 1", fm["employer_name"]);
  safeFill(form, "Employers Street1 Debtor 1", fm["employer_street"]);
  safeFill(form, "Employers City Debtor 1", fm["employer_city"]);
  safeFill(form, "Employers State Debtor 1", fm["employer_state"]);
  safeFill(form, "Employers Zip debtor 1", fm["employer_zip"]);

  // Income
  safeFill(form, "Amount 2 Debtor 1", fm["gross_monthly_calculated"]);
  safeFill(form, "Amount 3 Debtor 1", fm["estimated_monthly_overtime"]);

  // Deductions (5a-5h)
  safeFill(form, "Amount 5a Debtor 1", fm["deduction_federal_tax"]);
  safeFill(form, "Amount 5b Debtor 1", fm["deduction_state_tax"]);
  safeFill(form, "Amount 5c Debtor 1", fm["deduction_ss"]);
  safeFill(form, "Amount 5d Debtor 1", fm["deduction_medicare"]);
  safeFill(form, "Amount 5e Debtor 1", fm["deduction_health_insurance"]);
  safeFill(form, "Amount 5f Debtor 1", fm["deduction_retirement_401k"]);
  safeFill(form, "Amount 5g Debtor 1", fm["deduction_union_dues"]);
  safeFill(form, "Amount 5h Debtor 1", fm["deduction_other"]);

  // Auto-sum deductions
  const deductionSum = sumFields(fm,
    "deduction_federal_tax", "deduction_state_tax", "deduction_ss",
    "deduction_medicare", "deduction_health_insurance", "deduction_retirement_401k",
    "deduction_union_dues", "deduction_other"
  );
  safeFill(form, "Amount 6 Debtor 1", deductionSum);

  // Net income (gross - deductions)
  const gross = parseFloat(fm["gross_monthly_calculated"] || "0");
  const deductions = parseFloat(deductionSum || "0");
  if (gross > 0) {
    safeFill(form, "Amount 7 Debtor 1", (gross - deductions).toFixed(2));
  }

  // Joint filing — Debtor 2
  if (caseData?.joint_filing) {
    safeFill(form, "Occupation Debtor 2", fm["spouse_occupation"]);
    safeFill(form, "Employers Name Debtor 2", fm["spouse_employer_name"]);
    safeFill(form, "Employers Street1 Debtor 2", fm["spouse_employer_street"]);
    safeFill(form, "Employers City Debtor 2", fm["spouse_employer_city"]);
    safeFill(form, "Employers State Debtor 2", fm["spouse_employer_state"]);
    safeFill(form, "Employers Zip debtor 2", fm["spouse_employer_zip"]);
    safeFill(form, "Amount 2 Debtor 2", fm["spouse_gross_monthly"]);
    safeFill(form, "Amount 5a Debtor 2", fm["spouse_deduction_federal_tax"]);
    safeFill(form, "Amount 5b Debtor 2", fm["spouse_deduction_state_tax"]);
    safeFill(form, "Amount 5c Debtor 2", fm["spouse_deduction_ss"]);
    safeFill(form, "Amount 5d Debtor 2", fm["spouse_deduction_medicare"]);
    safeFill(form, "Amount 5e Debtor 2", fm["spouse_deduction_health_insurance"]);
    safeFill(form, "Amount 5f Debtor 2", fm["spouse_deduction_retirement_401k"]);
  }

  // Debtor info header
  safeFill(form, "Debtor 1", fm["debtor_legal_name_full"] || `${fm["debtor_legal_name_first"] || ""} ${fm["debtor_legal_name_last"] || ""}`.trim());
}

function fillB106J(form: any, fm: Record<string, string>) {
  // Only fill extractable expense lines — leave others blank for attorney
  safeFill(form, "4a", fm["mortgage_monthly_payment"]);
  safeFill(form, "4b", fm["auto_loan_monthly_payment"]);
  safeFill(form, "15a", fm["insurance_1_monthly_premium"]);
  safeFill(form, "15b", fm["insurance_2_monthly_premium"]);
  // Escrow breakdowns
  safeFill(form, "4c", fm["escrow_property_tax_monthly"]);
  safeFill(form, "4d", fm["escrow_insurance_monthly"]);
  // Lease rent
  safeFill(form, "4", fm["lease_1_monthly_rent"]);
}

function fillB106D(form: any, fm: Record<string, string>) {
  // Creditor 1: Mortgage
  safeFill(form, "Creditors Name", fm["mortgage_lender_name"]);
  safeFill(form, "Street", fm["mortgage_lender_street"]);
  safeFill(form, "1", fm["mortgage_lender_city"]);
  safeFill(form, "2", fm["mortgage_lender_state"]);
  safeFill(form, "3", fm["mortgage_lender_zip"]);
  safeFill(form, "Date debt was incurred", fm["mortgage_origination_date"]);
  safeFill(form, "4", fm["mortgage_balance"]);
  safeCheck(form, "An agreement you made such as mortgage or secured", true);

  // Creditor 2: Auto loan
  safeFill(form, "Creditors Name_2", fm["auto_lender_name"]);
  safeFill(form, "Street_2", fm["auto_lender_street"]);
  safeFill(form, "1_2", fm["auto_lender_city"]);
  safeFill(form, "2_2", fm["auto_lender_state"]);
  safeFill(form, "3_2", fm["auto_lender_zip"]);
  safeFill(form, "Date debt was incurred_2", fm["auto_loan_origination_date"]);
  safeFill(form, "4_2", fm["auto_loan_balance"]);
  safeCheck(form, "An agreement you made such as mortgage or secured_2", true);
}

function fillB106EF(form: any, fm: Record<string, string>) {
  // Unsecured creditors — repeating pattern
  const suffixes = ["", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9", "_10"];

  // Credit cards
  for (let i = 1; i <= 10; i++) {
    const prefix = `cc_${i}_`;
    const suffix = suffixes[i - 1] || `_${i}`;
    const name = fm[`${prefix}creditor_name`];
    if (!name) break;

    safeFill(form, `Creditors Name${suffix}`, name);
    safeFill(form, `Street${suffix}`, fm[`${prefix}creditor_street`]);
    safeFill(form, `account number${suffix === "" ? "" : " " + i}`, fm[`${prefix}account_last4`]);
    safeFill(form, `Date debt was incurred${suffix}`, fm[`${prefix}date_opened`]);
    safeFill(form, `1${suffix}`, fm[`${prefix}balance`]);
  }

  // Collection accounts — continue after credit cards
  for (let i = 1; i <= 5; i++) {
    const prefix = `collection_${i}_`;
    const name = fm[`${prefix}agency_name`];
    if (!name) break;
    // Fill into next available creditor slots
  }

  // Student loans
  for (let i = 1; i <= 3; i++) {
    const prefix = `student_loan_${i}_`;
    const name = fm[`${prefix}servicer_name`];
    if (!name) break;
    // Student loans are non-dischargeable — would need checkbox
  }
}

function fillB106G(form: any, fm: Record<string, string>) {
  // Up to 13 lease/contract entries
  let hasLease = false;
  for (let i = 1; i <= 13; i++) {
    const prefix = `lease_${i}_`;
    const name = fm[`${prefix}lessor_name`];
    if (!name) continue;
    hasLease = true;
    safeFill(form, `Company Name 2.${i}`, name);
    safeFill(form, `City 2.${i}`, fm[`${prefix}lessor_city`]);
    safeFill(form, `State 2.${i}`, fm[`${prefix}lessor_state`]);
    safeFill(form, `Zip 2.${i}`, fm[`${prefix}lessor_zip`]);
  }
  if (!hasLease) {
    safeCheck(form, "check1", true); // No executory contracts
  }
}

function fillB106H(form: any, fm: Record<string, string>, caseData: any) {
  const clientState = fm["client_info_state"] || caseData?.client_info?.state || "";
  const isCommunityProperty = COMMUNITY_PROPERTY_STATES.includes(clientState.toUpperCase());

  // Spouse info (joint filing)
  if (caseData?.joint_filing) {
    safeFill(form, "Spouse Street", fm["spouse_street"]);
    safeFill(form, "Spouse City", fm["spouse_city"]);
    safeFill(form, "Spouse State", fm["spouse_state"]);
    safeFill(form, "Spouse Zip", fm["spouse_zip"]);
  }

  // Codebtors from secured debts
  let coIndex = 1;
  if (fm["mortgage_lender_name"]) {
    safeFill(form, `Codebtor Name 3.${coIndex}`, fm["mortgage_lender_name"]);
    coIndex++;
  }
  if (fm["auto_lender_name"]) {
    safeFill(form, `Codebtor Name 3.${coIndex}`, fm["auto_lender_name"]);
    coIndex++;
  }

  // Community property flag
  if (isCommunityProperty) {
    safeCheck(form, "Check if this is an", true);
  }
}

function fillB106AB(form: any, fm: Record<string, string>) {
  // Real estate — property 1
  safeFill(form, "City", fm["mortgage_property_city"]);
  safeFill(form, "State", fm["mortgage_property_state"]);
  safeFill(form, "ZIP Code", fm["mortgage_property_zip"]);
  safeFill(form, "property identification number", fm["mortgage_account_last4"]);
  safeCheck(form, "Singlefamily home", true);

  // Vehicles
  const v1Desc = [fm["vehicle_year"], fm["vehicle_make"], fm["vehicle_model"]].filter(Boolean).join(" ");
  const v2Desc = [fm["auto_vehicle_year"], fm["auto_vehicle_make"], fm["auto_vehicle_model"]].filter(Boolean).join(" ");
  // Vehicle fields are in Part 3 of B106AB — exact field names vary

  // Bank accounts — Part 4
  safeFill(form, "Debtor 2", fm["bank_name"]);

  // Retirement accounts — Part 8
}

function fillB106C(form: any, fm: Record<string, string>) {
  // Pre-populate asset descriptions from A/B
  const realEstateDesc = fm["mortgage_property_street"] || fm["debtor_id_address"] || "";
  safeFill(form, "description", realEstateDesc);

  const vehicleDesc = [fm["vehicle_year"], fm["vehicle_make"], fm["vehicle_model"]].filter(Boolean).join(" ");
  if (vehicleDesc) safeFill(form, "description_2", vehicleDesc);

  const bankDesc = [fm["bank_name"], fm["bank_account_type"], `****${fm["bank_account_last4"] || ""}`].filter(Boolean).join(" ");
  if (bankDesc && fm["bank_name"]) safeFill(form, "description_3", bankDesc);

  // Exemption amounts — LEAVE BLANK (attorney judgment)
}

function fillB106Sum(_form: any, _fm: Record<string, string>) {
  // All fields auto-calculated — do not fill from extraction
  // Attorney/paralegal will fill from completed schedules
}

function fillB106Dec(form: any, _fm: Record<string, string>) {
  const today = todayFormatted();
  // Signature — LEAVE BLANK (wet signature)
  safeFill(form, "Executed on", today);
  safeCheck(form, "check1", true); // No petition preparer
}

function fillB107(form: any, fm: Record<string, string>, caseData: any) {
  const clientState = fm["client_info_state"] || caseData?.client_info?.state || "";
  const isCommunityProperty = COMMUNITY_PROPERTY_STATES.includes(clientState.toUpperCase());

  // Debtor name header
  safeFill(form, "Debtor 1", fm["debtor_legal_name_full"] || `${fm["debtor_legal_name_first"] || ""} ${fm["debtor_legal_name_last"] || ""}`.trim());

  // Marital status
  if (caseData?.joint_filing) {
    safeCheck(form, "check1", true); // Married
  }

  // Prior addresses
  safeFill(form, "Street address 1b Debtor 1", fm["prior_address_street"]);
  safeFill(form, "City 1b Debtor1", fm["prior_address_city"]);
  safeFill(form, "State 1b Debtor1", fm["prior_address_state"]);
  safeFill(form, "ZIP Code 1b Debtor 1", fm["prior_address_zip"]);

  // Income from employment — check wages if pay stub
  if (fm["employer_name"]) {
    safeCheck(form, "check4a Debtor 1", true);
  }

  // Tax return income for prior 2 years
  safeFill(form, "check4a Debtor 1", fm["tax_wages_year"]);

  // Community property
  if (isCommunityProperty) {
    safeCheck(form, "check3", true);
  }

  // All other B107 fields (lawsuits, transfers, gifts) — LEAVE BLANK
}

function fillB108(form: any, fm: Record<string, string>) {
  const today = todayFormatted();

  // Secured creditor 1: Mortgage
  safeFill(form, "Creditors Name 1a", fm["mortgage_lender_name"]);
  safeFill(form, "PropertyDescription 1a", fm["mortgage_property_street"]);

  // Secured creditor 2: Auto loan
  safeFill(form, "Creditors Name 1b", fm["auto_lender_name"]);
  const autoDesc = [fm["auto_vehicle_year"], fm["auto_vehicle_make"], fm["auto_vehicle_model"]].filter(Boolean).join(" ");
  safeFill(form, "PropertyDescription 1b", autoDesc);

  // Explain fields — LEAVE BLANK (attorney selects surrender/retain/reaffirm)

  // Leases
  safeFill(form, "Lessors Name 2a", fm["lease_1_lessor_name"]);
  safeFill(form, "PropertyDescription 2a", fm["lease_1_premises_address"]);

  // Signature — LEAVE BLANK
  safeFill(form, "Date signed Debtor 1", today);
}

function fillB122A1(form: any, fm: Record<string, string>, caseData: any) {
  // Debtor name
  const fullName = fm["debtor_legal_name_full"] || `${fm["debtor_legal_name_first"] || ""} ${fm["debtor_legal_name_last"] || ""}`.trim();
  safeFill(form, "Debtor1.Name", fullName);

  // 6-month income (means test window)
  safeFill(form, "Debto1.Quest3", fm["means_test_gross_1"]);
  safeFill(form, "Debto1.Quest4", fm["means_test_gross_2"]);
  safeFill(form, "Debto1.Quest5A", fm["means_test_gross_3"]);
  safeFill(form, "Debto1.Quest5B", fm["means_test_gross_4"]);
  safeFill(form, "Debto1.Quest5C", fm["means_test_gross_5"]);
  safeFill(form, "Debto1.Quest6A", fm["means_test_gross_6"]);

  // Auto-sum 6 months
  const sixMonthTotal = sumFields(fm,
    "means_test_gross_1", "means_test_gross_2", "means_test_gross_3",
    "means_test_gross_4", "means_test_gross_5", "means_test_gross_6"
  );
  safeFill(form, "Debto1.Quest11", sixMonthTotal);

  // Monthly average (total / 6)
  const totalNum = parseFloat(sixMonthTotal || "0");
  if (totalNum > 0) {
    safeFill(form, "Quest11", (totalNum / 6).toFixed(2));
  }

  // Joint filing — Debtor 2
  if (caseData?.joint_filing) {
    safeFill(form, "Debtor2.Name", fm["spouse_legal_name_full"]);
    safeFill(form, "Debto2.Quest3", fm["spouse_means_test_gross_1"]);
    safeFill(form, "Debto2.Quest5A", fm["spouse_means_test_gross_3"]);
    safeFill(form, "Debto2.Quest5B", fm["spouse_means_test_gross_4"]);
    safeFill(form, "Debto2.Quest5C", fm["spouse_means_test_gross_5"]);
    safeFill(form, "Debto2.Quest6A", fm["spouse_means_test_gross_6"]);
  }

  // 12B — state median (IRS table, leave blank for attorney)
  // 13A — auto-compare (leave blank for attorney)
}

function fillB122A2(form: any, fm: Record<string, string>) {
  // Vehicle descriptions
  const v1 = [fm["auto_vehicle_year"], fm["auto_vehicle_make"], fm["auto_vehicle_model"]].filter(Boolean).join(" ");
  const v2 = [fm["vehicle_year"], fm["vehicle_make"], fm["vehicle_model"]].filter(Boolean).join(" ");
  safeFill(form, "Describe Vehicle 1 1", v1 || v2);
  if (v1 && v2 && v1 !== v2) {
    safeFill(form, "Describe Vehicle 2 1", v2);
  }

  // Secured debt descriptions
  const securedDesc = [fm["mortgage_lender_name"], fm["auto_lender_name"]].filter(Boolean).join(", ");
  safeFill(form, "secures the debt", securedDesc);

  // 60-month average debt payments
  safeFill(form, "Explain 1", fm["mortgage_60mo_average"]);
  safeFill(form, "Explain 2", fm["auto_loan_60mo_average"]);

  // IRS deduction fields — LEAVE BLANK (attorney)
}

// ─── MAIN FILL DISPATCHER ──────────────────────────────────────────────

function fillFormFields(form: any, formCode: string, fm: Record<string, string>, caseData: any) {
  switch (formCode) {
    case "B101": fillB101(form, fm, caseData); break;
    case "B106I": fillB106I(form, fm, caseData); break;
    case "B106J": fillB106J(form, fm); break;
    case "B106D": fillB106D(form, fm); break;
    case "B106EF": fillB106EF(form, fm); break;
    case "B106G": fillB106G(form, fm); break;
    case "B106H": fillB106H(form, fm, caseData); break;
    case "B106AB": fillB106AB(form, fm); break;
    case "B106C": fillB106C(form, fm); break;
    case "B106Sum": fillB106Sum(form, fm); break;
    case "B106Dec": fillB106Dec(form, fm); break;
    case "B107": fillB107(form, fm, caseData); break;
    case "B108": fillB108(form, fm); break;
    case "B122A1": fillB122A1(form, fm, caseData); break;
    case "B122A2": fillB122A2(form, fm); break;
  }
}

// ─── WATERMARK ──────────────────────────────────────────────────────────

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

// ─── PLACEHOLDER PDF ────────────────────────────────────────────────────

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
    if (yPos < 80) { pdfDoc.addPage([612, 792]); yPos = 720; }
    const val = f.manually_overridden ? f.override_value : f.field_value;
    page.drawText(`${f.field_label}: ${val || "—"}`, {
      x: 70, y: yPos, size: 9, font: bodyFont, color: rgb(0.2, 0.2, 0.2),
    });
    yPos -= 16;
  }
  return pdfDoc;
}

// ─── MAIN HANDLER ───────────────────────────────────────────────────────

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

    // Fetch case data with client info
    const { data: caseData } = await supabase
      .from("cases")
      .select("*, client_info(*)")
      .eq("id", case_id)
      .single();

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

    // Inject client_info fields into fieldMap for convenience
    if (caseData?.client_info) {
      const ci = caseData.client_info;
      if (ci.phone) fieldMap["client_info_phone"] = ci.phone;
      if (ci.email) fieldMap["client_info_email"] = ci.email;
      if (ci.current_address) {
        // Parse address components if not already in extracted data
        fieldMap["client_info_address"] = ci.current_address;
      }
    }

    const formsToGenerate = form_codes === "all" ? ALL_CH7_FORMS : (form_codes as string[]);
    const results: Array<{ form_code: string; success: boolean; record_id?: string; error?: string }> = [];

    for (const formCode of formsToGenerate) {
      try {
        const templateFileName = TEMPLATE_FILES[formCode];
        let pdfDoc: any;

        if (!templateFileName) {
          pdfDoc = await createPlaceholderPdf(formCode, extractedData || []);
        } else {
          const { data: templateBytes, error: templateError } = await supabase.storage
            .from("form-templates")
            .download(templateFileName);

          if (templateError || !templateBytes) {
            pdfDoc = await createPlaceholderPdf(formCode, extractedData || []);
          } else {
            pdfDoc = await PDFDocument.load(await templateBytes.arrayBuffer());
            try {
              const form = pdfDoc.getForm();
              fillFormFields(form, formCode, fieldMap, caseData);
              // Flatten the form so values render in all PDF viewers
              form.flatten();
            } catch (e) {
              console.error(`Form fill error for ${formCode}:`, e);
              // Continue — PDF has no form fields or fill failed
            }
          }
        }

        await addWatermark(pdfDoc, "DRAFT");
        const pdfBytes = await pdfDoc.save();

        // Get current version
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

        results.push({ form_code: formCode, success: true, record_id: record?.id });
      } catch (err) {
        console.error(`Error generating ${formCode}:`, err);
        results.push({ form_code: formCode, success: false, error: (err as Error).message });
      }
    }

    // Log activity
    const successCount = results.filter((r) => r.success).length;
    await supabase.from("activity_log").insert({
      case_id,
      event_type: "forms_generated",
      actor_role: "paralegal",
      actor_name: triggered_by || "Staff",
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
