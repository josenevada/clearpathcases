ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS document_templates JSONB;