
-- Security definer function: get current authenticated user's firm_id
CREATE OR REPLACE FUNCTION public.get_user_firm_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT firm_id FROM public.users
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1
$$;

-- Security definer function: check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND role = 'super_admin'
  )
$$;

-- Security definer function: get case IDs for current user's firm (bypasses cases RLS)
CREATE OR REPLACE FUNCTION public.get_firm_case_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id()
$$;

-- ============================================================
-- Drop all existing wide-open policies
-- ============================================================
DROP POLICY IF EXISTS "cases_all" ON cases;
DROP POLICY IF EXISTS "checklist_items_all" ON checklist_items;
DROP POLICY IF EXISTS "files_all" ON files;
DROP POLICY IF EXISTS "activity_log_all" ON activity_log;
DROP POLICY IF EXISTS "notes_all" ON notes;
DROP POLICY IF EXISTS "client_info_all" ON client_info;
DROP POLICY IF EXISTS "attorney_notes_all" ON attorney_notes;
DROP POLICY IF EXISTS "checkpoints_all" ON checkpoints;
DROP POLICY IF EXISTS "users_all" ON users;
DROP POLICY IF EXISTS "firms_all" ON firms;

-- ============================================================
-- CASES — authenticated: firm-scoped; anon: open (client portal)
-- ============================================================
CREATE POLICY "cases_anon" ON cases FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "cases_auth_select" ON cases FOR SELECT TO authenticated
  USING (public.is_super_admin() OR firm_id = public.get_user_firm_id());

CREATE POLICY "cases_auth_insert" ON cases FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR firm_id = public.get_user_firm_id());

CREATE POLICY "cases_auth_update" ON cases FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR firm_id = public.get_user_firm_id())
  WITH CHECK (public.is_super_admin() OR firm_id = public.get_user_firm_id());

CREATE POLICY "cases_auth_delete" ON cases FOR DELETE TO authenticated
  USING (public.is_super_admin() OR firm_id = public.get_user_firm_id());

-- ============================================================
-- CHECKLIST_ITEMS — linked through case_id
-- ============================================================
CREATE POLICY "checklist_items_anon" ON checklist_items FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "checklist_items_auth_select" ON checklist_items FOR SELECT TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "checklist_items_auth_insert" ON checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "checklist_items_auth_update" ON checklist_items FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()))
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "checklist_items_auth_delete" ON checklist_items FOR DELETE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

-- ============================================================
-- FILES — linked through case_id
-- ============================================================
CREATE POLICY "files_anon" ON files FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "files_auth_select" ON files FOR SELECT TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "files_auth_insert" ON files FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "files_auth_update" ON files FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()))
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "files_auth_delete" ON files FOR DELETE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

-- ============================================================
-- ACTIVITY_LOG — linked through case_id
-- ============================================================
CREATE POLICY "activity_log_anon" ON activity_log FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "activity_log_auth_select" ON activity_log FOR SELECT TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "activity_log_auth_insert" ON activity_log FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "activity_log_auth_update" ON activity_log FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()))
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "activity_log_auth_delete" ON activity_log FOR DELETE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

-- ============================================================
-- NOTES — linked through case_id
-- ============================================================
CREATE POLICY "notes_anon" ON notes FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "notes_auth_select" ON notes FOR SELECT TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "notes_auth_insert" ON notes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "notes_auth_update" ON notes FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()))
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "notes_auth_delete" ON notes FOR DELETE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

-- ============================================================
-- CLIENT_INFO — linked through case_id
-- ============================================================
CREATE POLICY "client_info_anon" ON client_info FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "client_info_auth_select" ON client_info FOR SELECT TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "client_info_auth_insert" ON client_info FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "client_info_auth_update" ON client_info FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()))
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "client_info_auth_delete" ON client_info FOR DELETE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

-- ============================================================
-- ATTORNEY_NOTES — linked through case_id
-- ============================================================
CREATE POLICY "attorney_notes_anon" ON attorney_notes FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "attorney_notes_auth_select" ON attorney_notes FOR SELECT TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "attorney_notes_auth_insert" ON attorney_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "attorney_notes_auth_update" ON attorney_notes FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()))
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "attorney_notes_auth_delete" ON attorney_notes FOR DELETE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

-- ============================================================
-- CHECKPOINTS — linked through case_id
-- ============================================================
CREATE POLICY "checkpoints_anon" ON checkpoints FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "checkpoints_auth_select" ON checkpoints FOR SELECT TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "checkpoints_auth_insert" ON checkpoints FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "checkpoints_auth_update" ON checkpoints FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()))
  WITH CHECK (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

CREATE POLICY "checkpoints_auth_delete" ON checkpoints FOR DELETE TO authenticated
  USING (public.is_super_admin() OR case_id IN (SELECT public.get_firm_case_ids()));

-- ============================================================
-- USERS — staff see own firm members; super_admin sees all
-- ============================================================
CREATE POLICY "users_anon" ON users FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "users_auth_select" ON users FOR SELECT TO authenticated
  USING (public.is_super_admin() OR firm_id = public.get_user_firm_id());

CREATE POLICY "users_auth_insert" ON users FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR firm_id = public.get_user_firm_id());

CREATE POLICY "users_auth_update" ON users FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR firm_id = public.get_user_firm_id())
  WITH CHECK (public.is_super_admin() OR firm_id = public.get_user_firm_id());

CREATE POLICY "users_auth_delete" ON users FOR DELETE TO authenticated
  USING (public.is_super_admin() OR firm_id = public.get_user_firm_id());

-- ============================================================
-- FIRMS — staff see own firm; super_admin sees all
-- ============================================================
CREATE POLICY "firms_anon" ON firms FOR SELECT TO anon USING (true);

CREATE POLICY "firms_auth_select" ON firms FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.get_user_firm_id());

CREATE POLICY "firms_auth_update" ON firms FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR id = public.get_user_firm_id())
  WITH CHECK (public.is_super_admin() OR id = public.get_user_firm_id());

CREATE POLICY "firms_auth_insert" ON firms FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "firms_auth_delete" ON firms FOR DELETE TO authenticated
  USING (public.is_super_admin());
