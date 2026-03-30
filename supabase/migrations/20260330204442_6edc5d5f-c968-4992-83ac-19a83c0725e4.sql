
-- Clean up any orphaned public records for jose.nevada00@gmail.com
DELETE FROM public.users WHERE email = 'jose.nevada00@gmail.com';
DELETE FROM public.firms WHERE primary_contact_email = 'jose.nevada00@gmail.com';
