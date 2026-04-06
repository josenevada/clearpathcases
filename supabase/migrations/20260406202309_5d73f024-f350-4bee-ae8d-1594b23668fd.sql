
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS client_first_name text,
  ADD COLUMN IF NOT EXISTS client_middle_name text,
  ADD COLUMN IF NOT EXISTS client_last_name text,
  ADD COLUMN IF NOT EXISTS client_suffix text;
