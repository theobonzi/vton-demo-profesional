-- Fix RLS pour les tables avatar
-- Option 1: Désactiver RLS temporairement (pour test)

-- Désactiver RLS sur les tables body et body_masks
ALTER TABLE body DISABLE ROW LEVEL SECURITY;
ALTER TABLE body_masks DISABLE ROW LEVEL SECURITY;

-- Vérifier l'état RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('body', 'body_masks');

-- Si vous voulez réactiver plus tard:
-- ALTER TABLE body ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE body_masks ENABLE ROW LEVEL SECURITY;