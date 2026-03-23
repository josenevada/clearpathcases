
-- Add status column to cases
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Create client_info table
CREATE TABLE public.client_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE UNIQUE,
  full_legal_name text,
  date_of_birth date,
  ssn_encrypted text,
  current_address text,
  phone text,
  email text,
  marital_status text,
  employment_status text DEFAULT 'employed',
  employer_name text,
  employer_address text,
  job_title text,
  monthly_gross_income numeric,
  pay_frequency text,
  business_name text,
  business_type text,
  avg_monthly_income numeric,
  last_employer_name text,
  date_last_employment date,
  household_size integer DEFAULT 1,
  num_dependents integer DEFAULT 0,
  expense_rent numeric DEFAULT 0,
  expense_utilities numeric DEFAULT 0,
  expense_food numeric DEFAULT 0,
  expense_transportation numeric DEFAULT 0,
  expense_insurance numeric DEFAULT 0,
  expense_other numeric DEFAULT 0,
  other_expenses_description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_info_all" ON public.client_info FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create attorney_notes table
CREATE TABLE public.attorney_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE UNIQUE,
  content text,
  updated_at timestamptz DEFAULT now(),
  updated_by text
);

ALTER TABLE public.attorney_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attorney_notes_all" ON public.attorney_notes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
