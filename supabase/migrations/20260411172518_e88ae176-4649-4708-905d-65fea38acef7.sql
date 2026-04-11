
-- Remove anon ALL policies from internal/staff-only tables

-- users table
DROP POLICY IF EXISTS "users_anon" ON public.users;

-- attorney_notes table
DROP POLICY IF EXISTS "attorney_notes_anon" ON public.attorney_notes;

-- case_extracted_data table
DROP POLICY IF EXISTS "extracted_data_anon" ON public.case_extracted_data;

-- document_validation_feedback table
DROP POLICY IF EXISTS "dvf_anon" ON public.document_validation_feedback;

-- form_extraction_runs table
DROP POLICY IF EXISTS "extraction_runs_anon" ON public.form_extraction_runs;

-- generated_federal_forms table
DROP POLICY IF EXISTS "generated_forms_anon" ON public.generated_federal_forms;

-- means_test_calculations table
DROP POLICY IF EXISTS "means_test_anon" ON public.means_test_calculations;

-- means_test_income_months table
DROP POLICY IF EXISTS "means_test_months_anon" ON public.means_test_income_months;

-- notes table
DROP POLICY IF EXISTS "notes_anon" ON public.notes;

-- packet_history table
DROP POLICY IF EXISTS "packet_history_anon" ON public.packet_history;

-- Fix agent_interactions: remove anon SELECT (not needed for wizard), keep anon INSERT for tracking
DROP POLICY IF EXISTS "agent_interactions_anon_select" ON public.agent_interactions;
