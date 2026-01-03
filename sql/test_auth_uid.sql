-- ============================================
-- TEST: Verifica se auth.uid() funziona
-- ============================================
-- Esegui questo script per verificare se auth.uid() riconosce gli utenti autenticati
-- ============================================

-- Test 1: Verifica auth.uid() e auth.role()
SELECT 
  'AUTH TEST' as test_type,
  auth.uid() as "auth.uid()",
  auth.role() as "auth.role()",
  CASE 
    WHEN auth.uid() IS NOT NULL THEN '✅ Utente autenticato'
    ELSE '❌ Nessun utente autenticato'
  END as status;

-- Test 2: Prova a vedere se riesci a vedere i clienti esistenti
SELECT 
  'CLIENTS COUNT' as test_type,
  COUNT(*) as total_clients,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Policy SELECT funziona'
    ELSE '⚠️ Nessun cliente trovato (potrebbe essere normale)'
  END as status
FROM public.clients;

-- Test 3: Verifica le policy attuali
SELECT 
  'POLICY CHECK' as test_type,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' AND with_check IS NOT NULL THEN '✅ INSERT ha WITH CHECK'
    WHEN cmd = 'INSERT' AND with_check IS NULL THEN '❌ INSERT manca WITH CHECK'
    ELSE 'OK'
  END as policy_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients'
  AND cmd = 'INSERT';
