
-- Drop the overly permissive anon SELECT policy
DROP POLICY IF EXISTS "sig_requests_anon_select" ON public.signature_requests;

-- Token-gated lookup RPC: returns only minimal, non-sensitive fields
CREATE OR REPLACE FUNCTION public.get_signature_request_by_token(_token text)
RETURNS TABLE(
  id uuid,
  case_id uuid,
  signer_type text,
  signer_name text,
  token_expires_at timestamptz,
  signed_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, case_id,
         'client'::text AS signer_type,
         client_name AS signer_name,
         client_token_expires_at AS token_expires_at,
         client_signed_at AS signed_at
  FROM public.signature_requests
  WHERE client_token = _token
  UNION ALL
  SELECT id, case_id,
         'spouse'::text AS signer_type,
         spouse_name AS signer_name,
         spouse_token_expires_at AS token_expires_at,
         spouse_signed_at AS signed_at
  FROM public.signature_requests
  WHERE spouse_token = _token
$$;

REVOKE EXECUTE ON FUNCTION public.get_signature_request_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_signature_request_by_token(text) TO anon, authenticated;
