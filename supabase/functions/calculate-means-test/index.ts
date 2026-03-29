import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// IRS National Standards 2025
const IRS_FOOD_CLOTHING: Record<number, number> = { 1: 809, 2: 1497, 3: 1722, 4: 2120 };
const IRS_FOOD_ADDITIONAL = 379;
const IRS_HEALTHCARE_UNDER_65 = 75;
const IRS_HEALTHCARE_OVER_65 = 153;
const IRS_VEHICLE_OPERATION = 318;
const IRS_VEHICLE_OWNERSHIP = 588;
const PRESUMPTION_THRESHOLD = 167;
const BORDERLINE_RANGE = 30;

const IRS_HOUSING: Record<string, Record<string, number>> = {
  CA: { 'Los Angeles': 3247, 'San Francisco': 3891, 'San Diego': 2891, 'Sacramento': 2234, default: 2456 },
  FL: { 'Miami-Dade': 2456, 'Broward': 2234, 'Palm Beach': 2178, 'Hillsborough': 1876, 'Orange': 1789, default: 1654 },
  TX: { Harris: 1654, Dallas: 1723, Travis: 1891, Bexar: 1456, default: 1456 },
  OH: { Franklin: 1234, Cuyahoga: 1189, Hamilton: 1156, default: 1089 },
  IL: { Cook: 1891, DuPage: 1678, default: 1234 },
  GA: { Fulton: 1456, DeKalb: 1345, Gwinnett: 1234, default: 1123 },
  MI: { Wayne: 1123, Oakland: 1234, Macomb: 1089, default: 1045 },
  AZ: { Maricopa: 1456, Pima: 1234, default: 1189 },
  NY: { 'New York': 3456, Kings: 3234, Queens: 2891, Nassau: 2678, default: 2234 },
  NC: { Mecklenburg: 1345, Wake: 1456, Guilford: 1123, default: 1045 },
};

const STATE_MEDIAN: Record<string, Record<number, number>> = {
  CA: { 1: 72793, 2: 95050, 3: 102678, 4: 119456, 5: 128234 },
  FL: { 1: 56234, 2: 71234, 3: 82456, 4: 98234, 5: 107012 },
  TX: { 1: 58234, 2: 75234, 3: 86456, 4: 101234, 5: 110012 },
  OH: { 1: 52234, 2: 67234, 3: 78456, 4: 92234, 5: 101012 },
  IL: { 1: 60234, 2: 77234, 3: 88456, 4: 104234, 5: 113012 },
  GA: { 1: 53234, 2: 68234, 3: 79456, 4: 93234, 5: 102012 },
  MI: { 1: 54234, 2: 69234, 3: 80456, 4: 94234, 5: 103012 },
  AZ: { 1: 57234, 2: 73234, 3: 84456, 4: 99234, 5: 108012 },
  NY: { 1: 67234, 2: 87234, 3: 99456, 4: 116234, 5: 125012 },
  NC: { 1: 51234, 2: 65234, 3: 76456, 4: 90234, 5: 99012 },
};
const MEDIAN_ADDITIONAL = 9000;

function getMedian(state: string, size: number): number {
  const s = STATE_MEDIAN[state];
  if (!s) return 60000;
  if (size <= 5) return s[size] || s[1];
  return (s[5] || 100000) + (size - 5) * MEDIAN_ADDITIONAL;
}

function getHousing(state: string, county?: string): number {
  const s = IRS_HOUSING[state];
  if (!s) return 1200;
  if (county && s[county]) return s[county];
  return s.default || 1200;
}

function getFoodClothing(size: number): number {
  if (size <= 4) return IRS_FOOD_CLOTHING[size] || IRS_FOOD_CLOTHING[1];
  return IRS_FOOD_CLOTHING[4] + (size - 4) * IRS_FOOD_ADDITIONAL;
}

// Calculate 6-month lookback window
function calcWindow(filingDate: Date): { start: Date; end: Date } {
  // Window ends last day of calendar month before filing month
  const endYear = filingDate.getMonth() === 0 ? filingDate.getFullYear() - 1 : filingDate.getFullYear();
  const endMonth = filingDate.getMonth() === 0 ? 11 : filingDate.getMonth() - 1;
  const end = new Date(endYear, endMonth + 1, 0); // last day of endMonth

  // Start is 6 months before the end month
  const startMonth = endMonth - 5;
  const startYear = endYear + Math.floor(startMonth / 12);
  const actualStartMonth = ((startMonth % 12) + 12) % 12;
  const start = new Date(startYear, actualStartMonth, 1);

  return { start, end };
}

function monthsBetween(start: Date, end: Date): { year: number; month: number; label: string }[] {
  const months: { year: number; month: number; label: string }[] = [];
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let y = start.getFullYear();
  let m = start.getMonth();
  const endY = end.getFullYear();
  const endM = end.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ year: y, month: m, label: `${labels[m]} ${y}` });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return months;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { case_id } = await req.json();
    if (!case_id) {
      return new Response(JSON.stringify({ error: "case_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch case
    const { data: caseData, error: caseErr } = await supabase
      .from("cases")
      .select("*")
      .eq("id", case_id)
      .single();
    if (caseErr || !caseData) {
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client info
    const { data: clientInfo } = await supabase
      .from("client_info")
      .select("*")
      .eq("case_id", case_id)
      .maybeSingle();

    const filingDate = caseData.filing_deadline
      ? new Date(caseData.filing_deadline)
      : new Date();
    const householdSize = clientInfo?.household_size || 1;
    const clientState = caseData.district?.substring(0, 2)?.toUpperCase() || "FL";

    // Calculate 6-month window
    const { start: windowStart, end: windowEnd } = calcWindow(filingDate);
    const windowMonths = monthsBetween(windowStart, windowEnd);

    // Fetch extracted data for income fields
    const { data: extractedData } = await supabase
      .from("case_extracted_data")
      .select("*")
      .eq("case_id", case_id);

    // Build monthly income from extracted data
    const getFieldValue = (key: string): number => {
      const field = extractedData?.find(
        (f: any) => f.field_key === key
      );
      if (!field) return 0;
      const val = field.override_value || field.field_value;
      return parseFloat(val || "0") || 0;
    };

    // Monthly income values
    const monthlyGrossWages = getFieldValue("monthly_gross_wages") || (clientInfo?.monthly_gross_income || 0);
    const monthlyNetBusiness = getFieldValue("monthly_net_business") || 0;
    const monthlyRentalIncome = getFieldValue("monthly_rental_income") || 0;
    const monthlyInterestDividends = getFieldValue("monthly_interest_dividends") || 0;
    const monthlyPensionRetirement = getFieldValue("monthly_pension_retirement") || 0;
    const monthlySocialSecurity = getFieldValue("monthly_social_security") || 0;
    const monthlyUnemployment = getFieldValue("monthly_unemployment") || 0;
    const monthlyOtherIncome = getFieldValue("monthly_other_income") || 0;

    // Build monthly breakdown
    const incomeMonths = windowMonths.map((m) => {
      const wages = monthlyGrossWages;
      const business = monthlyNetBusiness;
      const other = monthlyRentalIncome + monthlyInterestDividends + monthlyPensionRetirement +
        monthlyUnemployment + monthlyOtherIncome;
      // Social Security excluded from CMI per 11 U.S.C. § 101(10A)
      const total = wages + business + other;
      return {
        month_year: `${m.year}-${String(m.month + 1).padStart(2, "0")}`,
        month_label: m.label,
        wages,
        business_income: business,
        other_income: other,
        total_month: total,
        source_documents: [] as string[],
        has_coverage: wages > 0 || business > 0,
        flagged_missing: wages === 0 && business === 0,
      };
    });

    // CMI = total 6 months ÷ 6 (Social Security EXCLUDED per 11 U.S.C. § 101(10A))
    const totalSixMonths = incomeMonths.reduce((s, m) => s + m.total_month, 0);
    const cmi = totalSixMonths / 6;
    const annualizedIncome = cmi * 12;

    // State median comparison
    const stateMedian = getMedian(clientState, householdSize);
    const belowMedian = annualizedIncome < stateMedian;

    let eligibilityResult: string;
    let eligibilityNotes = "";
    let presumptionArises = false;
    let monthlyDisposable = 0;
    let totalDeductions = 0;
    let ch13Recommended = false;

    // Deduction fields
    let foodClothing = 0;
    let healthcare = 0;
    let housing = 0;
    let utilities = 0;
    let vehicleOperation = 0;
    let vehicleOwnership = 0;
    let securedDebt = 0;
    let priorityDebt = 0;
    let otherNecessary = 0;

    if (belowMedian) {
      eligibilityResult = "eligible_below_median";
      eligibilityNotes = `Annualized income $${annualizedIncome.toFixed(0)} is below ${clientState} median of $${stateMedian.toLocaleString()} for a ${householdSize}-person household. Form 122A-2 not required.`;
    } else {
      // Calculate IRS standard deductions
      foodClothing = getFoodClothing(householdSize);
      healthcare = householdSize * IRS_HEALTHCARE_UNDER_65;
      housing = getHousing(clientState);
      utilities = 0; // included in housing for IRS purposes
      vehicleOperation = IRS_VEHICLE_OPERATION;
      vehicleOwnership = IRS_VEHICLE_OWNERSHIP;

      // Get actual secured debt from extracted data
      const mortgagePayment = getFieldValue("monthly_mortgage_payment") ||
        getFieldValue("mortgage_payment") || 0;
      const carLoanPayment = getFieldValue("monthly_car_payment") ||
        getFieldValue("car_loan_payment") || 0;
      securedDebt = mortgagePayment + carLoanPayment;
      priorityDebt = getFieldValue("priority_debt_payments") || 0;
      otherNecessary = getFieldValue("other_necessary_expenses") || 0;

      totalDeductions = foodClothing + healthcare + housing + utilities +
        vehicleOperation + vehicleOwnership + securedDebt + priorityDebt + otherNecessary;

      monthlyDisposable = cmi - totalDeductions;

      // Borderline check: within $30 of $167 threshold
      if (monthlyDisposable >= PRESUMPTION_THRESHOLD) {
        presumptionArises = true;
        eligibilityResult = "presumption_of_abuse";
        eligibilityNotes = `Disposable income of $${monthlyDisposable.toFixed(0)}/month exceeds $${PRESUMPTION_THRESHOLD}/month threshold.`;
        ch13Recommended = true;
      } else if (
        Math.abs(monthlyDisposable - PRESUMPTION_THRESHOLD) <= BORDERLINE_RANGE
      ) {
        eligibilityResult = "borderline";
        eligibilityNotes = `Disposable income of $${monthlyDisposable.toFixed(0)}/month is within $${BORDERLINE_RANGE} of the $${PRESUMPTION_THRESHOLD} threshold. Attorney review required.`;
      } else {
        eligibilityResult = "eligible_above_median_passes";
        eligibilityNotes = `Above median income but allowed deductions reduce disposable income to $${monthlyDisposable.toFixed(0)}/month — below $${PRESUMPTION_THRESHOLD} threshold.`;
      }
    }

    // Delete existing calculation for this case (upsert)
    await supabase
      .from("means_test_calculations")
      .delete()
      .eq("case_id", case_id);

    // Insert calculation
    const { data: calc, error: calcErr } = await supabase
      .from("means_test_calculations")
      .insert({
        case_id,
        filing_date: filingDate.toISOString().split("T")[0],
        calculation_window_start: windowStart.toISOString().split("T")[0],
        calculation_window_end: windowEnd.toISOString().split("T")[0],
        household_size: householdSize,
        client_state: clientState,
        monthly_gross_wages: monthlyGrossWages,
        monthly_net_business: monthlyNetBusiness,
        monthly_rental_income: monthlyRentalIncome,
        monthly_interest_dividends: monthlyInterestDividends,
        monthly_pension_retirement: monthlyPensionRetirement,
        monthly_social_security: monthlySocialSecurity,
        monthly_unemployment: monthlyUnemployment,
        monthly_other_income: monthlyOtherIncome,
        total_current_monthly_income: cmi,
        annualized_income: annualizedIncome,
        state_median_income: stateMedian,
        below_median: belowMedian,
        national_standard_food_clothing: foodClothing,
        national_standard_healthcare: healthcare,
        local_standard_housing: housing,
        local_standard_utilities: utilities,
        local_standard_vehicle_operation: vehicleOperation,
        local_standard_vehicle_ownership: vehicleOwnership,
        secured_debt_payments: securedDebt,
        priority_debt_payments: priorityDebt,
        other_necessary_expenses: otherNecessary,
        total_allowed_deductions: totalDeductions,
        monthly_disposable_income: monthlyDisposable,
        presumption_arises: presumptionArises,
        eligibility_result: eligibilityResult,
        eligibility_notes: eligibilityNotes,
        ch13_recommended: ch13Recommended,
      })
      .select()
      .single();

    if (calcErr) {
      return new Response(JSON.stringify({ error: calcErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert monthly breakdown
    if (calc) {
      const monthRows = incomeMonths.map((m) => ({
        calculation_id: calc.id,
        month_year: m.month_year,
        month_label: m.month_label,
        wages: m.wages,
        business_income: m.business_income,
        other_income: m.other_income,
        total_month: m.total_month,
        source_documents: m.source_documents,
        has_coverage: m.has_coverage,
        flagged_missing: m.flagged_missing,
      }));

      await supabase.from("means_test_income_months").insert(monthRows);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      case_id,
      event_type: eligibilityResult === "borderline"
        ? "means_test_borderline"
        : eligibilityResult === "presumption_of_abuse"
        ? "means_test_presumption"
        : "means_test_calculated",
      actor_role: "system",
      actor_name: "ClearPath Engine",
      description: eligibilityNotes,
    });

    return new Response(
      JSON.stringify({ success: true, calculation: calc, months: incomeMonths }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
