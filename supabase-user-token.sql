-- Option 3: Politiques RLS basées sur l'utilisateur authentifié
-- Utilise le token utilisateur au lieu du service key

-- 1. Politiques simples basées sur l'utilisateur authentifié
CREATE POLICY "Users can manage own bodies" ON body
  FOR ALL 
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can manage own body_masks" ON body_masks
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM body 
      WHERE body.body_id = body_masks.body_id 
      AND body.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM body 
      WHERE body.body_id = body_masks.body_id 
      AND body.user_id = auth.uid()::text
    )
  );

-- Activer RLS
ALTER TABLE body ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_masks ENABLE ROW LEVEL SECURITY;