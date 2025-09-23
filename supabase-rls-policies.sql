-- Fix RLS avec des politiques appropriées
-- Option 2: Créer des politiques RLS pour le backend

-- 1. D'abord, supprimer toutes les politiques existantes si elles existent
DROP POLICY IF EXISTS "Backend can manage bodies" ON body;
DROP POLICY IF EXISTS "Users can read own bodies" ON body;
DROP POLICY IF EXISTS "Backend can manage body_masks" ON body_masks;
DROP POLICY IF EXISTS "Users can read own body_masks" ON body_masks;

-- 2. Politiques pour la table body
-- Permettre au backend (service key) de tout faire
CREATE POLICY "Backend service can manage bodies" ON body
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Permettre aux utilisateurs authentifiés de lire leurs propres bodies
CREATE POLICY "Users can read own bodies" ON body
  FOR SELECT 
  USING (auth.uid()::text = user_id);

-- 3. Politiques pour la table body_masks
-- Permettre au backend (service key) de tout faire
CREATE POLICY "Backend service can manage body_masks" ON body_masks
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Permettre aux utilisateurs de lire les masques de leurs bodies
CREATE POLICY "Users can read own body_masks" ON body_masks
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM body 
      WHERE body.body_id = body_masks.body_id 
      AND body.user_id = auth.uid()::text
    )
  );

-- 4. S'assurer que RLS est activé
ALTER TABLE body ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_masks ENABLE ROW LEVEL SECURITY;

-- 5. Vérification
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename IN ('body', 'body_masks')
ORDER BY tablename, policyname;