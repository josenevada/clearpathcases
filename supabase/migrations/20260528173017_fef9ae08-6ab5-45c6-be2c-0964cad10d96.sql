-- Remove broad anonymous table access from client portal data.
-- Client-facing reads and writes are now routed through verified Edge Functions
-- that require the specific case code and case id for each operation.

DROP POLICY IF EXISTS cases_anon_select ON public.cases;
DROP POLICY IF EXISTS cases_anon_update ON public.cases;

DROP POLICY IF EXISTS client_info_anon_select ON public.client_info;
DROP POLICY IF EXISTS client_info_anon_insert ON public.client_info;
DROP POLICY IF EXISTS client_info_anon_update ON public.client_info;

DROP POLICY IF EXISTS checklist_items_anon_select ON public.checklist_items;
DROP POLICY IF EXISTS checklist_items_anon_insert ON public.checklist_items;
DROP POLICY IF EXISTS checklist_items_anon_update ON public.checklist_items;

DROP POLICY IF EXISTS files_anon_select ON public.files;
DROP POLICY IF EXISTS files_anon_insert ON public.files;
DROP POLICY IF EXISTS files_anon_update ON public.files;

DROP POLICY IF EXISTS checkpoints_anon_select ON public.checkpoints;
DROP POLICY IF EXISTS checkpoints_anon_insert ON public.checkpoints;

DROP POLICY IF EXISTS agent_interactions_anon_insert ON public.agent_interactions;

-- Anonymous users may no longer upload directly into the private case-documents bucket.
-- The client portal will request a short-lived signed upload token from a verified backend function.
DROP POLICY IF EXISTS case_documents_anon_insert ON storage.objects;
DROP POLICY IF EXISTS case_documents_anon_select ON storage.objects;