
-- Sync public.users IDs with auth.users IDs for seed users
UPDATE public.users
SET id = au.id
FROM auth.users au
WHERE public.users.email = au.email
  AND public.users.id != au.id;
