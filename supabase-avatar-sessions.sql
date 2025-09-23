-- Création de la table avatar_sessions pour persistance
CREATE TABLE IF NOT EXISTS avatar_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    progress INTEGER NOT NULL DEFAULT 0,
    current_step TEXT,
    error_message TEXT,
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_avatar_sessions_user_id ON avatar_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_sessions_status ON avatar_sessions(status);
CREATE INDEX IF NOT EXISTS idx_avatar_sessions_created_at ON avatar_sessions(created_at);

-- RLS policies
ALTER TABLE avatar_sessions ENABLE ROW LEVEL SECURITY;

-- Policy pour le backend service (accès complet)
CREATE POLICY "Backend service can manage avatar_sessions" ON avatar_sessions
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Policy pour les utilisateurs (lecture seulement de leurs sessions)
CREATE POLICY "Users can read own avatar_sessions" ON avatar_sessions
  FOR SELECT 
  USING (auth.uid()::text = user_id);

-- Trigger pour mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_avatar_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_avatar_sessions_updated_at
    BEFORE UPDATE ON avatar_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_avatar_sessions_updated_at();