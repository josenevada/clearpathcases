
-- Add district and meeting_date columns to cases table
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS meeting_date date;

-- Create packet_history table
CREATE TABLE public.packet_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  generated_by text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  document_count integer NOT NULL DEFAULT 0,
  district text,
  chapter text,
  storage_path text,
  ssn_redactions_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.packet_history ENABLE ROW LEVEL SECURITY;

-- RLS policies matching existing pattern
CREATE POLICY "packet_history_anon" ON public.packet_history FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "packet_history_auth_select" ON public.packet_history FOR SELECT TO authenticated USING (is_super_admin() OR (case_id IN (SELECT get_firm_case_ids())));
CREATE POLICY "packet_history_auth_insert" ON public.packet_history FOR INSERT TO authenticated WITH CHECK (is_super_admin() OR (case_id IN (SELECT get_firm_case_ids())));
CREATE POLICY "packet_history_auth_delete" ON public.packet_history FOR DELETE TO authenticated USING (is_super_admin() OR (case_id IN (SELECT get_firm_case_ids())));
