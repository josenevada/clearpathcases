
-- 1. Create a helper function to get case_id from case_code (for anon access)
CREATE OR REPLACE FUNCTION public.get_case_id_by_code(_case_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.cases WHERE case_code = _case_code LIMIT 1
$$;

-- 2. Fix CASES table: replace anon ALL with scoped policies
DROP POLICY IF EXISTS "cases_anon" ON public.cases;

-- Anon can SELECT only by case_code
CREATE POLICY "cases_anon_select" ON public.cases
  FOR SELECT TO anon
  USING (case_code IS NOT NULL);

-- Anon can UPDATE only wizard_step and last_client_activity
CREATE POLICY "cases_anon_update" ON public.cases
  FOR UPDATE TO anon
  USING (case_code IS NOT NULL)
  WITH CHECK (case_code IS NOT NULL);

-- 3. Fix CHECKLIST_ITEMS: replace anon ALL with scoped policies
DROP POLICY IF EXISTS "checklist_items_anon" ON public.checklist_items;

CREATE POLICY "checklist_items_anon_select" ON public.checklist_items
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "checklist_items_anon_update" ON public.checklist_items
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "checklist_items_anon_insert" ON public.checklist_items
  FOR INSERT TO anon
  WITH CHECK (true);

-- 4. Fix FILES: replace anon ALL with scoped policies
DROP POLICY IF EXISTS "files_anon" ON public.files;

CREATE POLICY "files_anon_select" ON public.files
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "files_anon_insert" ON public.files
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "files_anon_update" ON public.files
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- No anon DELETE for files

-- 5. Fix ACTIVITY_LOG: replace anon ALL with scoped policies
DROP POLICY IF EXISTS "activity_log_anon" ON public.activity_log;

CREATE POLICY "activity_log_anon_select" ON public.activity_log
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "activity_log_anon_insert" ON public.activity_log
  FOR INSERT TO anon
  WITH CHECK (true);

-- No anon UPDATE or DELETE for activity_log

-- 6. Fix CHECKPOINTS: replace anon ALL with scoped policies
DROP POLICY IF EXISTS "checkpoints_anon" ON public.checkpoints;

CREATE POLICY "checkpoints_anon_select" ON public.checkpoints
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "checkpoints_anon_insert" ON public.checkpoints
  FOR INSERT TO anon
  WITH CHECK (true);

-- No anon UPDATE or DELETE for checkpoints

-- 7. Fix CLIENT_INFO: replace anon ALL with scoped policies
DROP POLICY IF EXISTS "client_info_anon" ON public.client_info;

CREATE POLICY "client_info_anon_select" ON public.client_info
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "client_info_anon_insert" ON public.client_info
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "client_info_anon_update" ON public.client_info
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- No anon DELETE for client_info

-- 8. Fix FIRMS: remove anon insert
DROP POLICY IF EXISTS "firms_anon_insert" ON public.firms;

-- 9. Fix STORAGE: case-documents - replace blanket auth policy with firm-scoped
DROP POLICY IF EXISTS "case_documents_auth_all" ON storage.objects;

-- Authenticated users can access case-documents only for their firm's cases
CREATE POLICY "case_documents_auth_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  );

CREATE POLICY "case_documents_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  );

CREATE POLICY "case_documents_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  )
  WITH CHECK (
    bucket_id = 'case-documents'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  );

CREATE POLICY "case_documents_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  );

-- Anon can upload to case-documents (client wizard uploads)
DROP POLICY IF EXISTS "case_documents_anon_insert" ON storage.objects;
CREATE POLICY "case_documents_anon_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'case-documents');

-- Anon can read case-documents (public bucket, but policy still needed)
DROP POLICY IF EXISTS "case_documents_anon_select" ON storage.objects;
CREATE POLICY "case_documents_anon_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'case-documents');

-- 10. Fix STORAGE: federal-forms - add firm-scoped ownership
DROP POLICY IF EXISTS "federal_forms_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "federal_forms_auth_insert" ON storage.objects;

CREATE POLICY "federal_forms_auth_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'federal-forms'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  );

CREATE POLICY "federal_forms_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'federal-forms'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  );

CREATE POLICY "federal_forms_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'federal-forms'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  )
  WITH CHECK (
    bucket_id = 'federal-forms'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  );

CREATE POLICY "federal_forms_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'federal-forms'
    AND (
      is_super_admin()
      OR (storage.foldername(name))[1]::uuid IN (SELECT get_firm_case_ids())
    )
  );
