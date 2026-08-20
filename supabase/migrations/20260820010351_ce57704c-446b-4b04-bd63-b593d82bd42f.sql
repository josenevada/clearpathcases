DROP POLICY IF EXISTS "Service role upload" ON storage.objects;

CREATE POLICY "public_assets_auth_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'public-assets'
  AND (
    public.is_super_admin()
    OR ((storage.foldername(name))[1] = 'firm-logos'
       AND (storage.foldername(name))[2] = (public.get_user_firm_id())::text)
  )
);

CREATE POLICY "public_assets_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'public-assets'
  AND (
    public.is_super_admin()
    OR ((storage.foldername(name))[1] = 'firm-logos'
       AND (storage.foldername(name))[2] = (public.get_user_firm_id())::text)
  )
)
WITH CHECK (
  bucket_id = 'public-assets'
  AND (
    public.is_super_admin()
    OR ((storage.foldername(name))[1] = 'firm-logos'
       AND (storage.foldername(name))[2] = (public.get_user_firm_id())::text)
  )
);

CREATE POLICY "public_assets_auth_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'public-assets'
  AND (
    public.is_super_admin()
    OR ((storage.foldername(name))[1] = 'firm-logos'
       AND (storage.foldername(name))[2] = (public.get_user_firm_id())::text)
  )
);

DROP POLICY IF EXISTS "Public read access for marketing videos" ON storage.objects;
CREATE POLICY "marketing_videos_public_read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'marketing-videos');