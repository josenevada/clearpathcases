CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  submitted_by_user_id uuid NOT NULL,
  submitted_by_name text NOT NULL,
  submitted_by_email text NOT NULL,
  firm_name text,
  subject text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_firm ON public.support_tickets(firm_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created ON public.support_tickets(created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_tickets_auth_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (is_super_admin() OR firm_id = get_user_firm_id());

CREATE POLICY support_tickets_auth_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by_user_id = auth.uid()
    AND (is_super_admin() OR firm_id = get_user_firm_id())
  );

CREATE POLICY support_tickets_super_update ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY support_tickets_super_delete ON public.support_tickets
  FOR DELETE TO authenticated
  USING (is_super_admin());

CREATE OR REPLACE FUNCTION public.set_support_tickets_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_support_tickets_updated_at();