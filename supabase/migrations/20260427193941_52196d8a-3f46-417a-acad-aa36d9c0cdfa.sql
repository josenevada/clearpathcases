-- 1. USERS — remove anon entirely
DROP POLICY IF EXISTS "users_anon" ON public.users;

-- 2. FILES — scope anon to case_code verified cases only
DROP POLICY IF EXISTS "files_anon_select" ON public.files;
DROP POLICY IF EXISTS "files_anon_insert" ON public.files;
DROP POLICY IF EXISTS "files_anon_update" ON public.files;

CREATE POLICY "files_anon_select" ON public.files
  FOR SELECT TO anon
  USING (case_id IN (
    SELECT id FROM public.cases
    WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
  ));

CREATE POLICY "files_anon_insert" ON public.files
  FOR INSERT TO anon
  WITH CHECK (case_id IN (
    SELECT id FROM public.cases
    WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
  ));

CREATE POLICY "files_anon_update" ON public.files
  FOR UPDATE TO anon
  USING (case_id IN (
    SELECT id FROM public.cases
    WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
  ))
  WITH CHECK (case_id IN (
    SELECT id FROM public.cases
    WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
  ));

-- 3. CASE-DOCUMENTS STORAGE — scope anon to valid case folder
DROP POLICY IF EXISTS "case_documents_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_anon_select" ON storage.objects;

CREATE POLICY "case_documents_anon_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'case-documents'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.cases
      WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
    )
  );

CREATE POLICY "case_documents_anon_select" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'case-documents'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.cases
      WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
    )
  );

-- 4. AGENT INTERACTIONS — scope anon insert to valid cases
DROP POLICY IF EXISTS "agent_interactions_anon_insert" ON public.agent_interactions;

CREATE POLICY "agent_interactions_anon_insert" ON public.agent_interactions
  FOR INSERT TO anon
  WITH CHECK (case_id IN (
    SELECT id FROM public.cases
    WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
  ));