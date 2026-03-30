CREATE TABLE IF NOT EXISTS agent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_category TEXT NOT NULL,
  platform_selected TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop')),
  deep_link_clicked BOOLEAN DEFAULT false,
  gif_viewed BOOLEAN DEFAULT false,
  document_uploaded_after BOOLEAN DEFAULT false,
  session_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_interactions_case ON agent_interactions(case_id);

ALTER TABLE agent_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_interactions_anon_insert" ON agent_interactions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "agent_interactions_anon_select" ON agent_interactions
  FOR SELECT TO anon USING (true);

CREATE POLICY "agent_interactions_auth_select" ON agent_interactions
  FOR SELECT TO authenticated
  USING (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));

CREATE POLICY "agent_interactions_auth_insert" ON agent_interactions
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR case_id IN (SELECT get_firm_case_ids()));

INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-gifs', 'agent-gifs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "agent_gifs_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'agent-gifs');