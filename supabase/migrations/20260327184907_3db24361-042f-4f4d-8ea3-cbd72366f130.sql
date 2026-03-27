
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS court_case_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS retention_notified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS retention_delete_scheduled_at timestamptz DEFAULT NULL;
