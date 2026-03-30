
-- Drop the restrictive INSERT policy on firms
DROP POLICY IF EXISTS "firms_auth_insert" ON public.firms;

-- Allow anon to insert firms (needed during signup before email confirmation)
CREATE POLICY "firms_anon_insert" ON public.firms
FOR INSERT TO anon
WITH CHECK (true);

-- Allow authenticated users to insert firms
CREATE POLICY "firms_auth_insert" ON public.firms
FOR INSERT TO authenticated
WITH CHECK (true);
