
-- 1. Add secret token column to team_invitations
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

-- Backfill any pre-existing nulls (defensive)
UPDATE public.team_invitations
SET token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE token IS NULL OR length(token) < 32;

CREATE INDEX IF NOT EXISTS team_invitations_token_idx ON public.team_invitations(token);

-- 2. Replace the anon UPDATE policy: now also keyed by token (token must already match
-- in the row; PostgREST will additionally filter by .eq('token', token) from the client,
-- but RLS itself doesn't see the WHERE clause — so we keep the policy as before for the
-- pending->accepted transition and rely on the RPC for token verification on read.
-- The real protection is: anon can no longer SELECT invitations without the token (RPC),
-- and the row id alone is not enough to accept because the client must also know the token
-- to look up the row via the RPC. We further tighten the UPDATE policy to require that
-- the row's status is pending and the new status is accepted (already in place).
DROP POLICY IF EXISTS "team_invitations_anon_update_accept" ON public.team_invitations;

-- 3. Replace the SECURITY DEFINER RPC to require the token
DROP FUNCTION IF EXISTS public.get_invitation_for_signup(uuid);

CREATE OR REPLACE FUNCTION public.get_invitation_for_signup(_invitation_id uuid, _token text)
RETURNS TABLE(id uuid, firm_id uuid, email text, role text, status text, personal_message text, firm_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ti.id, ti.firm_id, ti.email, ti.role, ti.status, ti.personal_message,
         f.name AS firm_name
  FROM public.team_invitations ti
  LEFT JOIN public.firms f ON f.id = ti.firm_id
  WHERE ti.id = _invitation_id
    AND ti.token = _token
    AND ti.status = 'pending'
$$;

-- New SECURITY DEFINER function to atomically accept the invitation (token-gated)
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_invitation_id uuid, _token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _updated int;
BEGIN
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = _invitation_id
    AND token = _token
    AND status = 'pending';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;

-- 4. Lock down EXECUTE permissions on SECURITY DEFINER helpers
-- Keep the two anon-facing RPCs callable by anon; revoke direct execute on internal helpers
REVOKE EXECUTE ON FUNCTION public.get_user_firm_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_firm_case_ids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_case_id_by_code(text) FROM PUBLIC, anon, authenticated;

-- Allow anon + authenticated to call the invitation RPCs (token-gated)
GRANT EXECUTE ON FUNCTION public.get_invitation_for_signup(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid, text) TO anon, authenticated;

-- 5. Drop the unauthenticated SELECT policy on the private form-templates bucket
DROP POLICY IF EXISTS "form_templates_anon_select" ON storage.objects;
