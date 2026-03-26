
CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'paralegal',
  invited_by text,
  invited_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  personal_message text
);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Anon can read invitations (for the invite signup page)
CREATE POLICY "team_invitations_anon_select" ON public.team_invitations
  FOR SELECT TO anon USING (true);

-- Authenticated firm members can manage their firm's invitations
CREATE POLICY "team_invitations_auth_select" ON public.team_invitations
  FOR SELECT TO authenticated USING (
    is_super_admin() OR firm_id = get_user_firm_id()
  );

CREATE POLICY "team_invitations_auth_insert" ON public.team_invitations
  FOR INSERT TO authenticated WITH CHECK (
    is_super_admin() OR firm_id = get_user_firm_id()
  );

CREATE POLICY "team_invitations_auth_update" ON public.team_invitations
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR firm_id = get_user_firm_id())
  WITH CHECK (is_super_admin() OR firm_id = get_user_firm_id());

CREATE POLICY "team_invitations_auth_delete" ON public.team_invitations
  FOR DELETE TO authenticated USING (
    is_super_admin() OR firm_id = get_user_firm_id()
  );

-- Anon can update status to accepted (for invite signup)
CREATE POLICY "team_invitations_anon_update" ON public.team_invitations
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
