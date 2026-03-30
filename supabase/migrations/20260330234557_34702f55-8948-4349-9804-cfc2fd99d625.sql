ALTER TABLE public.firms
ADD COLUMN IF NOT EXISTS branding_attorney_name TEXT,
ADD COLUMN IF NOT EXISTS branding_bar_number TEXT,
ADD COLUMN IF NOT EXISTS counseling_provider_name TEXT,
ADD COLUMN IF NOT EXISTS counseling_provider_link TEXT,
ADD COLUMN IF NOT EXISTS counseling_attorney_code TEXT;