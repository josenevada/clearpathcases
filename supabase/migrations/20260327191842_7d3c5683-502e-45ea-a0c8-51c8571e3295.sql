
CREATE TABLE public.document_validation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id text NOT NULL,
  case_id uuid NOT NULL,
  expected_document_type text NOT NULL,
  ai_result text NOT NULL,
  paralegal_feedback text NOT NULL,
  correct_document_type text,
  additional_notes text,
  paralegal_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.document_validation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dvf_anon" ON public.document_validation_feedback FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dvf_auth_select" ON public.document_validation_feedback FOR SELECT TO authenticated
  USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));

CREATE POLICY "dvf_auth_insert" ON public.document_validation_feedback FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));

CREATE POLICY "dvf_auth_update" ON public.document_validation_feedback FOR UPDATE TO authenticated
  USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()))
  WITH CHECK (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));

CREATE POLICY "dvf_auth_delete" ON public.document_validation_feedback FOR DELETE TO authenticated
  USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));
