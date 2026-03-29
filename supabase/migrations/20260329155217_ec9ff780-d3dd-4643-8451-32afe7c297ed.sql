
-- Add unique constraint on case_extracted_data for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_extracted_data_case_field 
ON case_extracted_data(case_id, field_key);
