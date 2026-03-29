
-- Create signature_requests table
CREATE TABLE IF NOT EXISTS public.signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id),
  status TEXT CHECK (status IN (
    'pending_client',
    'client_signed',
    'pending_attorney',
    'attorney_signed',
    'complete',
    'expired',
    'cancelled'
  )) DEFAULT 'pending_client',
  
  client_token TEXT UNIQUE NOT NULL,
  client_token_expires_at TIMESTAMPTZ NOT NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_signed_at TIMESTAMPTZ,
  client_ip_address TEXT,
  client_user_agent TEXT,
  client_signature_data TEXT,
  client_typed_name TEXT,
  
  spouse_token TEXT UNIQUE,
  spouse_token_expires_at TIMESTAMPTZ,
  spouse_name TEXT,
  spouse_email TEXT,
  spouse_signed_at TIMESTAMPTZ,
  spouse_ip_address TEXT,
  spouse_signature_data TEXT,
  spouse_typed_name TEXT,
  
  attorney_id UUID REFERENCES public.users(id),
  attorney_signed_at TIMESTAMPTZ,
  attorney_ip_address TEXT,
  attorney_typed_name TEXT,
  
  unsigned_packet_path TEXT,
  signed_packet_path TEXT,
  
  reminder_count INTEGER DEFAULT 0,
  last_reminder_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(case_id)
);

CREATE INDEX IF NOT EXISTS idx_signature_requests_case ON public.signature_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_client_token ON public.signature_requests(client_token);
CREATE INDEX IF NOT EXISTS idx_signature_requests_spouse_token ON public.signature_requests(spouse_token);

-- Create signature_audit_log table
CREATE TABLE IF NOT EXISTS public.signature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT CHECK (actor_type IN ('client', 'spouse', 'attorney', 'paralegal', 'system')),
  actor_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_request ON public.signature_audit_log(signature_request_id);

-- Enable RLS
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS for signature_requests: firm staff access
CREATE POLICY "sig_requests_auth_select" ON public.signature_requests
  FOR SELECT TO authenticated
  USING (
    case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    OR public.is_super_admin()
  );

CREATE POLICY "sig_requests_auth_insert" ON public.signature_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    OR public.is_super_admin()
  );

CREATE POLICY "sig_requests_auth_update" ON public.signature_requests
  FOR UPDATE TO authenticated
  USING (
    case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    OR public.is_super_admin()
  )
  WITH CHECK (
    case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    OR public.is_super_admin()
  );

CREATE POLICY "sig_requests_auth_delete" ON public.signature_requests
  FOR DELETE TO authenticated
  USING (
    case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    OR public.is_super_admin()
  );

-- Anon select for public signing page (token lookup)
CREATE POLICY "sig_requests_anon_select" ON public.signature_requests
  FOR SELECT TO anon
  USING (client_token IS NOT NULL);

-- Anon update for signing (edge function uses service role, but just in case)
CREATE POLICY "sig_requests_anon_update" ON public.signature_requests
  FOR UPDATE TO anon
  USING (client_token IS NOT NULL)
  WITH CHECK (client_token IS NOT NULL);

-- RLS for signature_audit_log
CREATE POLICY "sig_audit_auth_all" ON public.signature_audit_log
  FOR ALL TO authenticated
  USING (
    signature_request_id IN (
      SELECT sr.id FROM public.signature_requests sr
      WHERE sr.case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    signature_request_id IN (
      SELECT sr.id FROM public.signature_requests sr
      WHERE sr.case_id IN (SELECT id FROM public.cases WHERE firm_id = public.get_user_firm_id())
    )
    OR public.is_super_admin()
  );

CREATE POLICY "sig_audit_anon_select" ON public.signature_audit_log
  FOR SELECT TO anon
  USING (
    signature_request_id IN (
      SELECT id FROM public.signature_requests WHERE client_token IS NOT NULL
    )
  );
