
-- 1. Restrict firms insert to super admins only
DROP POLICY IF EXISTS "firms_auth_insert" ON public.firms;
CREATE POLICY "firms_auth_insert" ON public.firms
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

-- 2. Drop the unrestricted anon update on signature_requests.
-- All client/spouse signing flows go through the process-signature edge function (service role).
DROP POLICY IF EXISTS "sig_requests_anon_update" ON public.signature_requests;

-- Keep anon SELECT so the client can load their request by token, but tighten the
-- USING expression so only rows whose token is presented in the query can be fetched.
-- (RLS cannot read the WHERE clause directly, but since clients only fetch
--  by token, removing rows whose token is null is the strongest scoping we can apply
--  without an RPC.) Already in place: USING (client_token IS NOT NULL).

-- 3. Lock down team_invitations: drop the broad anon SELECT and provide a
-- SECURITY DEFINER RPC that returns a single invitation by id (the UUID acts as token).
DROP POLICY IF EXISTS "team_invitations_anon_select_limited" ON public.team_invitations;

CREATE OR REPLACE FUNCTION public.get_invitation_for_signup(_invitation_id uuid)
RETURNS TABLE (
  id uuid,
  firm_id uuid,
  email text,
  role text,
  status text,
  personal_message text,
  firm_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ti.id, ti.firm_id, ti.email, ti.role, ti.status, ti.personal_message,
         f.name AS firm_name
  FROM public.team_invitations ti
  LEFT JOIN public.firms f ON f.id = ti.firm_id
  WHERE ti.id = _invitation_id
    AND ti.status = 'pending'
$$;

REVOKE ALL ON FUNCTION public.get_invitation_for_signup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_for_signup(uuid) TO anon, authenticated;

-- 4. Make case-documents bucket private and remove anon SELECT.
UPDATE storage.buckets SET public = false WHERE id = 'case-documents';
DROP POLICY IF EXISTS "case_documents_anon_select" ON storage.objects;
-- Keep anon INSERT (clients upload via wizard with case_code) and authed firm-scoped policies.
