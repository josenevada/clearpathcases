
-- Migration 1: means_test_calculations table
CREATE TABLE IF NOT EXISTS means_test_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  filing_date DATE,
  calculation_window_start DATE,
  calculation_window_end DATE,
  household_size INTEGER,
  client_state TEXT,
  monthly_gross_wages NUMERIC DEFAULT 0,
  monthly_net_business NUMERIC DEFAULT 0,
  monthly_rental_income NUMERIC DEFAULT 0,
  monthly_interest_dividends NUMERIC DEFAULT 0,
  monthly_pension_retirement NUMERIC DEFAULT 0,
  monthly_social_security NUMERIC DEFAULT 0,
  monthly_unemployment NUMERIC DEFAULT 0,
  monthly_other_income NUMERIC DEFAULT 0,
  total_current_monthly_income NUMERIC DEFAULT 0,
  annualized_income NUMERIC DEFAULT 0,
  state_median_income NUMERIC DEFAULT 0,
  below_median BOOLEAN DEFAULT false,
  national_standard_food_clothing NUMERIC DEFAULT 0,
  national_standard_healthcare NUMERIC DEFAULT 0,
  local_standard_housing NUMERIC DEFAULT 0,
  local_standard_utilities NUMERIC DEFAULT 0,
  local_standard_vehicle_operation NUMERIC DEFAULT 0,
  local_standard_vehicle_ownership NUMERIC DEFAULT 0,
  secured_debt_payments NUMERIC DEFAULT 0,
  priority_debt_payments NUMERIC DEFAULT 0,
  other_necessary_expenses NUMERIC DEFAULT 0,
  total_allowed_deductions NUMERIC DEFAULT 0,
  monthly_disposable_income NUMERIC DEFAULT 0,
  presumption_arises BOOLEAN DEFAULT false,
  eligibility_result TEXT,
  eligibility_notes TEXT,
  ch13_recommended BOOLEAN DEFAULT false,
  attorney_reviewed BOOLEAN DEFAULT false,
  attorney_reviewed_by UUID REFERENCES users(id),
  attorney_reviewed_at TIMESTAMPTZ,
  attorney_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id)
);

CREATE INDEX IF NOT EXISTS idx_means_test_case ON means_test_calculations(case_id);

-- Migration 2: means_test_income_months table
CREATE TABLE IF NOT EXISTS means_test_income_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id UUID NOT NULL REFERENCES means_test_calculations(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  month_label TEXT NOT NULL,
  wages NUMERIC DEFAULT 0,
  business_income NUMERIC DEFAULT 0,
  other_income NUMERIC DEFAULT 0,
  total_month NUMERIC DEFAULT 0,
  source_documents TEXT[],
  has_coverage BOOLEAN DEFAULT true,
  flagged_missing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_means_test_months ON means_test_income_months(calculation_id);

-- Migration 3: Enable RLS with security definer functions to avoid recursion
ALTER TABLE means_test_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE means_test_income_months ENABLE ROW LEVEL SECURITY;

-- Anon policies for client portal access
CREATE POLICY "means_test_anon" ON means_test_calculations FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "means_test_months_anon" ON means_test_income_months FOR ALL TO anon USING (true) WITH CHECK (true);

-- Auth policies using existing security definer function
CREATE POLICY "means_test_auth_select" ON means_test_calculations FOR SELECT TO authenticated
  USING (is_super_admin() OR (case_id IN (SELECT get_firm_case_ids())));

CREATE POLICY "means_test_auth_insert" ON means_test_calculations FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR (case_id IN (SELECT get_firm_case_ids())));

CREATE POLICY "means_test_auth_update" ON means_test_calculations FOR UPDATE TO authenticated
  USING (is_super_admin() OR (case_id IN (SELECT get_firm_case_ids())))
  WITH CHECK (is_super_admin() OR (case_id IN (SELECT get_firm_case_ids())));

CREATE POLICY "means_test_auth_delete" ON means_test_calculations FOR DELETE TO authenticated
  USING (is_super_admin() OR (case_id IN (SELECT get_firm_case_ids())));

-- Income months auth policies
CREATE POLICY "means_test_months_auth_select" ON means_test_income_months FOR SELECT TO authenticated
  USING (is_super_admin() OR (calculation_id IN (SELECT id FROM means_test_calculations WHERE case_id IN (SELECT get_firm_case_ids()))));

CREATE POLICY "means_test_months_auth_insert" ON means_test_income_months FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR (calculation_id IN (SELECT id FROM means_test_calculations WHERE case_id IN (SELECT get_firm_case_ids()))));

CREATE POLICY "means_test_months_auth_update" ON means_test_income_months FOR UPDATE TO authenticated
  USING (is_super_admin() OR (calculation_id IN (SELECT id FROM means_test_calculations WHERE case_id IN (SELECT get_firm_case_ids()))))
  WITH CHECK (is_super_admin() OR (calculation_id IN (SELECT id FROM means_test_calculations WHERE case_id IN (SELECT get_firm_case_ids()))));

CREATE POLICY "means_test_months_auth_delete" ON means_test_income_months FOR DELETE TO authenticated
  USING (is_super_admin() OR (calculation_id IN (SELECT id FROM means_test_calculations WHERE case_id IN (SELECT get_firm_case_ids()))));
