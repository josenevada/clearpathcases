GRANT EXECUTE ON FUNCTION public.get_user_firm_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_firm_case_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_case_id_by_code(text) TO anon, authenticated;