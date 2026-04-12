
-- =============================================
-- 1. Harden client_info anonymous policies
-- =============================================

-- Drop existing overly permissive anon policies
DROP POLICY IF EXISTS "client_info_anon_select" ON public.client_info;
DROP POLICY IF EXISTS "client_info_anon_insert" ON public.client_info;
DROP POLICY IF EXISTS "client_info_anon_update" ON public.client_info;

-- Scoped anon SELECT: only wizard cases
CREATE POLICY "client_info_anon_select" ON public.client_info
  FOR SELECT TO anon
  USING (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL));

-- Scoped anon INSERT: only wizard cases
CREATE POLICY "client_info_anon_insert" ON public.client_info
  FOR INSERT TO anon
  WITH CHECK (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL));

-- Scoped anon UPDATE: only wizard cases
CREATE POLICY "client_info_anon_update" ON public.client_info
  FOR UPDATE TO anon
  USING (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL))
  WITH CHECK (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL));

-- =============================================
-- 2. Harden checklist_items anonymous policies
-- =============================================

-- Drop existing overly permissive anon policies
DROP POLICY IF EXISTS "checklist_items_anon_select" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items_anon_insert" ON public.checklist_items;
DROP POLICY IF EXISTS "checklist_items_anon_update" ON public.checklist_items;

-- Scoped anon SELECT: only wizard cases
CREATE POLICY "checklist_items_anon_select" ON public.checklist_items
  FOR SELECT TO anon
  USING (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL));

-- Scoped anon INSERT: only wizard cases
CREATE POLICY "checklist_items_anon_insert" ON public.checklist_items
  FOR INSERT TO anon
  WITH CHECK (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL));

-- Scoped anon UPDATE: only wizard cases
CREATE POLICY "checklist_items_anon_update" ON public.checklist_items
  FOR UPDATE TO anon
  USING (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL))
  WITH CHECK (case_id IN (SELECT id FROM public.cases WHERE case_code IS NOT NULL));
