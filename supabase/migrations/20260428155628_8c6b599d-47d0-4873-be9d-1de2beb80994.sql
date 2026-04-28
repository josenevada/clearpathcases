DROP POLICY IF EXISTS "team_invitations_anon_select" ON public.team_invitations;
DROP POLICY IF EXISTS "team_invitations_anon_update" ON public.team_invitations;

CREATE POLICY "team_invitations_anon_update_accept" ON public.team_invitations
  FOR UPDATE TO anon
  USING (status = 'pending')
  WITH CHECK (status = 'accepted');