ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS spouse_case_code text;
CREATE UNIQUE INDEX IF NOT EXISTS cases_spouse_case_code_key ON public.cases(spouse_case_code) WHERE spouse_case_code IS NOT NULL;

-- Update anon RLS so spouse can access the case via spouse_case_code on cases, checklist_items, client_info
DROP POLICY IF EXISTS cases_anon_select ON public.cases;
CREATE POLICY cases_anon_select ON public.cases FOR SELECT TO anon
  USING (case_code IS NOT NULL OR spouse_case_code IS NOT NULL);

DROP POLICY IF EXISTS cases_anon_update ON public.cases;
CREATE POLICY cases_anon_update ON public.cases FOR UPDATE TO anon
  USING (case_code IS NOT NULL OR spouse_case_code IS NOT NULL)
  WITH CHECK (case_code IS NOT NULL OR spouse_case_code IS NOT NULL);

DROP POLICY IF EXISTS checklist_items_anon_select ON public.checklist_items;
CREATE POLICY checklist_items_anon_select ON public.checklist_items FOR SELECT TO anon
  USING (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL));

DROP POLICY IF EXISTS checklist_items_anon_insert ON public.checklist_items;
CREATE POLICY checklist_items_anon_insert ON public.checklist_items FOR INSERT TO anon
  WITH CHECK (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL));

DROP POLICY IF EXISTS checklist_items_anon_update ON public.checklist_items;
CREATE POLICY checklist_items_anon_update ON public.checklist_items FOR UPDATE TO anon
  USING (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL))
  WITH CHECK (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL));

DROP POLICY IF EXISTS client_info_anon_select ON public.client_info;
CREATE POLICY client_info_anon_select ON public.client_info FOR SELECT TO anon
  USING (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL));

DROP POLICY IF EXISTS client_info_anon_insert ON public.client_info;
CREATE POLICY client_info_anon_insert ON public.client_info FOR INSERT TO anon
  WITH CHECK (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL));

DROP POLICY IF EXISTS client_info_anon_update ON public.client_info;
CREATE POLICY client_info_anon_update ON public.client_info FOR UPDATE TO anon
  USING (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL))
  WITH CHECK (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL));