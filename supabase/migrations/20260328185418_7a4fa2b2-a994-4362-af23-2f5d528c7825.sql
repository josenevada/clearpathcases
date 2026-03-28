
-- Migration 1: case_extracted_data
CREATE TABLE IF NOT EXISTS public.case_extracted_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_value TEXT,
  form_reference TEXT NOT NULL,
  section_label TEXT NOT NULL,
  source_document_name TEXT,
  source_file_id UUID REFERENCES public.files(id),
  confidence TEXT DEFAULT 'medium',
  extracted_at TIMESTAMPTZ DEFAULT now(),
  manually_overridden BOOLEAN DEFAULT false,
  override_value TEXT,
  override_by UUID REFERENCES public.users(id),
  override_at TIMESTAMPTZ,
  conflict_detected BOOLEAN DEFAULT false,
  conflict_sources TEXT[],
  notes TEXT,
  UNIQUE(case_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_extracted_data_case ON public.case_extracted_data(case_id);
CREATE INDEX IF NOT EXISTS idx_extracted_data_form ON public.case_extracted_data(case_id, form_reference);

-- Migration 2: form_extraction_runs
CREATE TABLE IF NOT EXISTS public.form_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES public.users(id),
  trigger_type TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'pending',
  fields_extracted INTEGER DEFAULT 0,
  fields_high_confidence INTEGER DEFAULT 0,
  fields_medium_confidence INTEGER DEFAULT 0,
  fields_low_confidence INTEGER DEFAULT 0,
  conflicts_detected INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_case ON public.form_extraction_runs(case_id);

-- Migration 3: generated_federal_forms
CREATE TABLE IF NOT EXISTS public.generated_federal_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  form_code TEXT NOT NULL,
  form_title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  watermark_status TEXT DEFAULT 'draft',
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT now(),
  included_in_packet BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_generated_forms_case ON public.generated_federal_forms(case_id);

-- Migration 4: Enable RLS
ALTER TABLE public.case_extracted_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_federal_forms ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing security definer functions
CREATE POLICY "extracted_data_anon" ON public.case_extracted_data FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "extracted_data_auth_select" ON public.case_extracted_data FOR SELECT TO authenticated USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
CREATE POLICY "extracted_data_auth_insert" ON public.case_extracted_data FOR INSERT TO authenticated WITH CHECK (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
CREATE POLICY "extracted_data_auth_update" ON public.case_extracted_data FOR UPDATE TO authenticated USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids())) WITH CHECK (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
CREATE POLICY "extracted_data_auth_delete" ON public.case_extracted_data FOR DELETE TO authenticated USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));

CREATE POLICY "extraction_runs_anon" ON public.form_extraction_runs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "extraction_runs_auth_select" ON public.form_extraction_runs FOR SELECT TO authenticated USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
CREATE POLICY "extraction_runs_auth_insert" ON public.form_extraction_runs FOR INSERT TO authenticated WITH CHECK (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
CREATE POLICY "extraction_runs_auth_update" ON public.form_extraction_runs FOR UPDATE TO authenticated USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids())) WITH CHECK (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
CREATE POLICY "extraction_runs_auth_delete" ON public.form_extraction_runs FOR DELETE TO authenticated USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));

CREATE POLICY "generated_forms_anon" ON public.generated_federal_forms FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "generated_forms_auth_select" ON public.generated_federal_forms FOR SELECT TO authenticated USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
CREATE POLICY "generated_forms_auth_insert" ON public.generated_federal_forms FOR INSERT TO authenticated WITH CHECK (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
CREATE POLICY "generated_forms_auth_update" ON public.generated_federal_forms FOR UPDATE TO authenticated USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids())) WITH CHECK (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
CREATE POLICY "generated_forms_auth_delete" ON public.generated_federal_forms FOR DELETE TO authenticated USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));

-- Migration 5: Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('federal-forms', 'federal-forms', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('form-templates', 'form-templates', false) ON CONFLICT (id) DO NOTHING;

-- Storage RLS for federal-forms
CREATE POLICY "federal_forms_auth_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'federal-forms');
CREATE POLICY "federal_forms_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'federal-forms');
CREATE POLICY "federal_forms_anon_select" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'federal-forms');

-- Storage RLS for form-templates
CREATE POLICY "form_templates_auth_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'form-templates');
CREATE POLICY "form_templates_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'form-templates');
CREATE POLICY "form_templates_anon_select" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'form-templates');
