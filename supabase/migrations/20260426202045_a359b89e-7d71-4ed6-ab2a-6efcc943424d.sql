-- 1. FIRMS: drop anon SELECT entirely
DROP POLICY IF EXISTS "firms_anon" ON public.firms;

-- 2. ACTIVITY LOG: scope anon access to cases with a case_code
DROP POLICY IF EXISTS "activity_log_anon_select" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_anon_insert" ON public.activity_log;

CREATE POLICY "activity_log_anon_select" ON public.activity_log
  FOR SELECT TO anon
  USING (case_id IN (
    SELECT id FROM public.cases
    WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
  ));

CREATE POLICY "activity_log_anon_insert" ON public.activity_log
  FOR INSERT TO anon
  WITH CHECK (case_id IN (
    SELECT id FROM public.cases
    WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
  ));

-- 3. CHECKPOINTS: scope anon access to cases with a case_code
DROP POLICY IF EXISTS "checkpoints_anon_select" ON public.checkpoints;
DROP POLICY IF EXISTS "checkpoints_anon_insert" ON public.checkpoints;

CREATE POLICY "checkpoints_anon_select" ON public.checkpoints
  FOR SELECT TO anon
  USING (case_id IN (
    SELECT id FROM public.cases
    WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
  ));

CREATE POLICY "checkpoints_anon_insert" ON public.checkpoints
  FOR INSERT TO anon
  WITH CHECK (case_id IN (
    SELECT id FROM public.cases
    WHERE case_code IS NOT NULL OR spouse_case_code IS NOT NULL
  ));