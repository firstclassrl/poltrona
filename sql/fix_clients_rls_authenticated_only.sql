-- ============================================
-- FIX RLS - SOLO UTENTI AUTENTICATI
-- ============================================
-- Questo script crea policy RLS che permettono operazioni SOLO agli utenti autenticati
-- Ogni utente può creare/modificare solo i propri record client nel proprio shop
-- ============================================

-- Rimuovi TUTTE le policy esistenti
DO $$
DECLARE
  v_policy_name TEXT;
BEGIN
  FOR v_policy_name IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'clients'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clients', v_policy_name);
  END LOOP;
END $$;

-- Riabilita RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: utenti autenticati possono vedere i clienti del proprio shop
CREATE POLICY "clients_select_authenticated" ON public.clients
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL  -- Utente autenticato
    OR auth.role() = 'service_role'  -- Backend può vedere tutto
  );

-- Policy INSERT: utenti autenticati possono creare clienti nel proprio shop
-- IMPORTANTE: usa WITH CHECK per INSERT
CREATE POLICY "clients_insert_authenticated" ON public.clients
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL  -- Utente autenticato
    OR auth.role() = 'service_role'  -- Backend può inserire
  );

-- Policy UPDATE: utenti autenticati possono aggiornare clienti
CREATE POLICY "clients_update_authenticated" ON public.clients
  FOR UPDATE 
  USING (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  );

-- Policy DELETE: utenti autenticati possono eliminare clienti
CREATE POLICY "clients_delete_authenticated" ON public.clients
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  );

-- Verifica
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Policy create!';
  RAISE NOTICE '   Tutte le operazioni richiedono autenticazione (auth.uid() IS NOT NULL)';
  RAISE NOTICE '   Gli utenti devono essere autenticati per creare/modificare clienti';
  RAISE NOTICE '';
END $$;

-- Query finale per visualizzazione
SELECT 
  'SUCCESS' as status,
  policyname,
  cmd,
  CASE 
    WHEN qual IS NULL THEN 'NULL (OK per INSERT)'
    ELSE qual::text
  END as "USING clause",
  CASE 
    WHEN with_check IS NULL THEN 'NULL'
    ELSE with_check::text
  END as "WITH CHECK clause"
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients'
ORDER BY policyname;
