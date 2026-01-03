-- ============================================
-- DEBUG: Verifica perché RLS fallisce
-- ============================================
-- Esegui questo script DOPO aver fatto una richiesta con token valido
-- per vedere cosa restituisce auth.uid() e auth.role()
-- ============================================

-- IMPORTANTE: Questo script deve essere eseguito con un token valido nell'header Authorization
-- Esegui una query REST API prima e poi questo script per vedere cosa succede

-- Verifica le policy attuali
SELECT 
  'POLICY CHECK' as check_type,
  policyname,
  cmd,
  qual as "USING",
  with_check as "WITH CHECK"
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients'
ORDER BY cmd;

-- Test: prova a vedere se auth.uid() funziona
-- NOTA: Questo funziona solo se eseguito con un token valido
SELECT 
  'AUTH TEST' as test_type,
  auth.uid() as "auth.uid()",
  auth.role() as "auth.role()",
  CASE 
    WHEN auth.uid() IS NOT NULL THEN '✅ auth.uid() funziona'
    WHEN auth.role() = 'authenticated' THEN '⚠️ auth.role() = authenticated ma auth.uid() è NULL'
    WHEN auth.role() = 'anon' THEN '❌ auth.role() = anon (token non valido o mancante)'
    ELSE '❓ Stato sconosciuto'
  END as status;
