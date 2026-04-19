-- Create public bucket for marketing demo videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-videos', 'marketing-videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access
CREATE POLICY "Public read access for marketing videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-videos');

-- Allow authenticated users to manage (admin uploads via dashboard/tools)
CREATE POLICY "Authenticated can upload marketing videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketing-videos');

CREATE POLICY "Authenticated can update marketing videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'marketing-videos');

CREATE POLICY "Authenticated can delete marketing videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'marketing-videos');