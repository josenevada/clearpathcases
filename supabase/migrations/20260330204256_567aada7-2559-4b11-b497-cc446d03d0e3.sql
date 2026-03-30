
-- The users_auth_insert policy checks firm_id = get_user_firm_id(), but during
-- signup the user has no record yet so get_user_firm_id() returns NULL.
-- Allow authenticated users to insert their own record (id = auth.uid()).
DROP POLICY IF EXISTS "users_auth_insert" ON public.users;

CREATE POLICY "users_auth_insert" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
  id = auth.uid()
  OR is_super_admin()
  OR (firm_id = get_user_firm_id())
);
