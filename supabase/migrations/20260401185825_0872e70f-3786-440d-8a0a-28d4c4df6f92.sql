
-- Make case-documents bucket public so files can be accessed via direct URL
UPDATE storage.buckets SET public = true WHERE id = 'case-documents';

-- Drop old blanket policy if exists
DROP POLICY IF EXISTS "case_documents_all" ON storage.objects;

-- Ensure anon can upload to case-documents (for client wizard)
CREATE POLICY "case_documents_anon_insert" ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'case-documents');

CREATE POLICY "case_documents_anon_select" ON storage.objects  
FOR SELECT TO anon
USING (bucket_id = 'case-documents');

CREATE POLICY "case_documents_auth_all" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'case-documents')
WITH CHECK (bucket_id = 'case-documents');
