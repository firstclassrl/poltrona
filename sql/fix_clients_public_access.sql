-- Fix RLS policies per clients: permette accesso per utenti autenticati
-- Questo è necessario per permettere agli utenti autenticati di creare il proprio record client
-- durante la prenotazione
-- 
-- IMPORTANTE: Esegui questo script dopo aver verificato che i servizi e lo staff abbiano shop_id corretto nel database

-- ============================================
-- PARTE 1: RIMUOVI TUTTE LE POLICY ESISTENTI
-- ============================================

-- Rimuovi TUTTE le policy esistenti su clients per evitare conflitti
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
    RAISE NOTICE 'Rimossa policy: %', v_policy_name;
  END LOOP;
END $$;

-- ============================================
-- PARTE 2: CREA NUOVE POLICY CORRETTE
-- ============================================

-- 1. Policy SELECT: permette agli utenti autenticati di vedere i clienti
CREATE POLICY "Enable select for authenticated users" ON public.clients
  FOR SELECT 
  USING (
    auth.role() = 'service_role' 
    OR auth.role() = 'authenticated'
  );

-- 2. Policy INSERT: permette agli utenti autenticati di creare clienti
--    IMPORTANTE: usa WITH CHECK per INSERT, non solo USING
CREATE POLICY "Enable insert for authenticated users" ON public.clients
  FOR INSERT 
  WITH CHECK (
    auth.role() = 'service_role' 
    OR auth.role() = 'authenticated'
  );

-- 3. Policy UPDATE: permette agli utenti autenticati di aggiornare clienti
CREATE POLICY "Enable update for authenticated users" ON public.clients
  FOR UPDATE 
  USING (
    auth.role() = 'service_role' 
    OR auth.role() = 'authenticated'
  )
  WITH CHECK (
    auth.role() = 'service_role' 
    OR auth.role() = 'authenticated'
  );

-- 4. Policy DELETE: permette agli utenti autenticati di eliminare clienti (opzionale)
CREATE POLICY "Enable delete for authenticated users" ON public.clients
  FOR DELETE 
  USING (
    auth.role() = 'service_role' 
    OR auth.role() = 'authenticated'
  );

-- ============================================
-- PARTE 3: VERIFICA
-- ============================================

-- Verifica le policy create per clients
SELECT 
  'CLIENTS POLICIES' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'clients'
ORDER BY policyname;

-- Test: verifica che le policy siano attive
SELECT 
  'SUCCESS: Policies enabled for clients table' as status,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'clients';
