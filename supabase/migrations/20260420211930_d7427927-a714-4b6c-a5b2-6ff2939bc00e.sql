ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS is_joint_filing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS spouse_name text,
  ADD COLUMN IF NOT EXISTS spouse_email text;

ALTER TABLE public.client_info
  ADD COLUMN IF NOT EXISTS spouse_name text,
  ADD COLUMN IF NOT EXISTS spouse_email text,
  ADD COLUMN IF NOT EXISTS spouse_phone text,
  ADD COLUMN IF NOT EXISTS spouse_dob date;