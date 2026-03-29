
CREATE TABLE IF NOT EXISTS exemption_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_state TEXT NOT NULL,
  recommended_system TEXT CHECK (recommended_system IN ('federal', 'state', 'state_system1', 'state_system2')) NOT NULL,
  federal_total_protected NUMERIC DEFAULT 0,
  state_total_protected NUMERIC DEFAULT 0,
  total_assets NUMERIC DEFAULT 0,
  total_exposed NUMERIC DEFAULT 0,
  analysis_notes TEXT,
  attorney_approved BOOLEAN DEFAULT false,
  attorney_approved_by UUID REFERENCES users(id),
  attorney_approved_at TIMESTAMPTZ,
  selected_system TEXT CHECK (selected_system IN ('federal', 'state', 'state_system1', 'state_system2')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id)
);

CREATE INDEX IF NOT EXISTS idx_exemption_analyses_case ON exemption_analyses(case_id);

CREATE TABLE IF NOT EXISTS exemption_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES exemption_analyses(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  asset_description TEXT NOT NULL,
  asset_value NUMERIC NOT NULL DEFAULT 0,
  exemption_system TEXT CHECK (exemption_system IN ('federal', 'state', 'state_system1', 'state_system2')) NOT NULL,
  exemption_name TEXT NOT NULL,
  exemption_statute TEXT,
  exemption_amount NUMERIC NOT NULL DEFAULT 0,
  protected_amount NUMERIC NOT NULL DEFAULT 0,
  exposed_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT CHECK (status IN ('fully_protected', 'partially_protected', 'unprotected', 'unknown')) NOT NULL,
  attorney_notes TEXT,
  attorney_override_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exemption_items_analysis ON exemption_line_items(analysis_id);

ALTER TABLE exemption_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE exemption_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Firm access to exemption analyses" ON exemption_analyses
  FOR ALL USING (
    case_id IN (SELECT id FROM cases WHERE firm_id = (SELECT firm_id FROM users WHERE id = auth.uid()))
  );

CREATE POLICY "Firm access to exemption line items" ON exemption_line_items
  FOR ALL USING (
    analysis_id IN (
      SELECT id FROM exemption_analyses WHERE case_id IN (
        SELECT id FROM cases WHERE firm_id = (SELECT firm_id FROM users WHERE id = auth.uid())
      )
    )
  );
