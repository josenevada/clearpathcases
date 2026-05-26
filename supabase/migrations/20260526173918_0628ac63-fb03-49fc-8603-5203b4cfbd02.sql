
-- 1. Remove anon access to federal-forms bucket
DROP POLICY IF EXISTS "federal_forms_anon_select" ON storage.objects;

-- 2. Restrict form-templates writes to super_admin
DROP POLICY IF EXISTS "form_templates_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "form_templates_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "form_templates_auth_delete" ON storage.objects;

CREATE POLICY "form_templates_super_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form-templates' AND public.is_super_admin());

CREATE POLICY "form_templates_super_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'form-templates' AND public.is_super_admin())
  WITH CHECK (bucket_id = 'form-templates' AND public.is_super_admin());

CREATE POLICY "form_templates_super_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'form-templates' AND public.is_super_admin());

-- 3. Restrict marketing-videos writes to super_admin
DROP POLICY IF EXISTS "Authenticated can upload marketing videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update marketing videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete marketing videos" ON storage.objects;

CREATE POLICY "marketing_videos_super_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketing-videos' AND public.is_super_admin());

CREATE POLICY "marketing_videos_super_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'marketing-videos' AND public.is_super_admin())
  WITH CHECK (bucket_id = 'marketing-videos' AND public.is_super_admin());

CREATE POLICY "marketing_videos_super_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'marketing-videos' AND public.is_super_admin());

-- 4. Prevent non-super-admins from changing the `role` column on users
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only super admins may change a user role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_escalation_trg ON public.users;
CREATE TRIGGER prevent_role_escalation_trg
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();
