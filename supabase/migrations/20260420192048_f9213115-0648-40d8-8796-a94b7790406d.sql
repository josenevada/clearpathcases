-- Add language preference to cases
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS client_language text DEFAULT 'en';

-- Add branding fields to firms
ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS branding_logo_url text,
  ADD COLUMN IF NOT EXISTS branding_display_name text,
  ADD COLUMN IF NOT EXISTS branding_accent_color text;

-- Create firm-assets storage bucket (public for logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('firm-assets', 'firm-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access to firm-assets
CREATE POLICY "Firm assets are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'firm-assets');

-- Authenticated users can upload to their own firm folder
CREATE POLICY "Authenticated users can upload firm assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'firm-assets'
  AND (storage.foldername(name))[1] = (public.get_user_firm_id())::text
);

CREATE POLICY "Authenticated users can update firm assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'firm-assets'
  AND (storage.foldername(name))[1] = (public.get_user_firm_id())::text
);

CREATE POLICY "Authenticated users can delete firm assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'firm-assets'
  AND (storage.foldername(name))[1] = (public.get_user_firm_id())::text
);