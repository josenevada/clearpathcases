-- Drop the overly permissive anonymous SELECT policy on signature_audit_log.
-- It exposed IP addresses, user agents, and event history across ALL open
-- signature requests instead of scoping to the requester's own token.
-- Audit logs are for staff/compliance review only — anonymous signers do not
-- need to read them. Authenticated firm users retain access via sig_audit_auth_all.
DROP POLICY IF EXISTS sig_audit_anon_select ON public.signature_audit_log;