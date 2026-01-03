-- Verifica che la policy INSERT abbia il WITH CHECK corretto
-- Esegui questo script per verificare i dettagli della policy INSERT

SELECT 
  policyname,
  cmd,
  qual as "USING clause",
  with_check as "WITH CHECK clause"
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients'
  AND cmd = 'INSERT';

-- Se with_check è NULL, la policy non ha WITH CHECK e potrebbe non funzionare correttamente
-- Dovrebbe mostrare: ((auth.role() = 'service_role'::text) OR (auth.role() = 'authenticated'::text))
