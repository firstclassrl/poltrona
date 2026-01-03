-- ============================================
-- TEST: Verifica auth.uid() con token
-- ============================================
-- IMPORTANTE: Questo script deve essere eseguito con un token valido
-- nell'header Authorization della richiesta REST API
-- ============================================

-- Test 1: Verifica cosa restituisce auth.uid() e auth.role()
SELECT 
  'AUTH TEST' as test_type,
  auth.uid() as "auth.uid()",
  auth.role() as "auth.role()",
  auth.jwt() ->> 'sub' as "jwt.sub (user_id)",
  CASE 
    WHEN auth.uid() IS NOT NULL THEN '✅ auth.uid() funziona'
    WHEN auth.role() = 'authenticated' THEN '⚠️ auth.role() = authenticated ma auth.uid() è NULL'
    WHEN auth.role() = 'anon' THEN '❌ auth.role() = anon (token non valido o mancante)'
    ELSE '❓ Stato sconosciuto'
  END as status;

-- Test 2: Prova a vedere se riesci a vedere i clienti esistenti
SELECT 
  'CLIENTS COUNT' as test_type,
  COUNT(*) as total_clients,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✅ Policy SELECT permette la query (anche se 0 risultati)'
    ELSE '❌ Policy SELECT blocca la query'
  END as status
FROM public.clients;

-- Test 3: Verifica le policy INSERT attuali
SELECT 
  'POLICY INSERT CHECK' as test_type,
  policyname,
  cmd,
  with_check as "WITH CHECK clause",
  CASE 
    WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ INSERT ha WITH CHECK'
    WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ INSERT manca WITH CHECK'
    ELSE 'OK'
  END as policy_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients'
  AND cmd = 'INSERT';
