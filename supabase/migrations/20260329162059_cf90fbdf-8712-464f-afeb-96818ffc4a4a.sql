
-- Fix exemption policies: drop old public-role ones, create authenticated ones
DROP POLICY IF EXISTS "Firm access to exemption analyses" ON public.exemption_analyses;
DROP POLICY IF EXISTS "Firm access to exemption line items" ON public.exemption_line_items;

CREATE POLICY "exemption_analyses_auth" ON public.exemption_analyses
  FOR ALL TO authenticated
  USING (
    case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    OR public.is_super_admin()
  )
  WITH CHECK (
    case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    OR public.is_super_admin()
  );

CREATE POLICY "exemption_line_items_auth" ON public.exemption_line_items
  FOR ALL TO authenticated
  USING (
    analysis_id IN (
      SELECT ea.id FROM public.exemption_analyses ea
      WHERE ea.case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    analysis_id IN (
      SELECT ea.id FROM public.exemption_analyses ea
      WHERE ea.case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    )
    OR public.is_super_admin()
  );

-- Team invitations: add limited anon select for invite signup
CREATE POLICY "team_invitations_anon_select_limited" ON public.team_invitations
  FOR SELECT TO anon
  USING (status = 'pending');

-- Fix lookup functions to use auth.uid() instead of email
CREATE OR REPLACE FUNCTION public.get_user_firm_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT firm_id FROM public.users
  WHERE id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'super_admin'
  )
$$;
