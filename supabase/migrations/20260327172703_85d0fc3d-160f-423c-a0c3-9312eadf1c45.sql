
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS not_applicable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS not_applicable_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS not_applicable_marked_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS not_applicable_at timestamptz DEFAULT NULL;
