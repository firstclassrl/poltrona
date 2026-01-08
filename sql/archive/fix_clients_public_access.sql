-- ============================================
-- FIX RLS POLICIES PER CLIENTS TABLE
-- ============================================
-- Questo script risolve l'errore "new row violates row-level security policy"
-- permettendo agli utenti autenticati di creare record nella tabella clients
--
-- IMPORTANTE: Esegui questo script nel SQL Editor di Supabase
-- ============================================

-- ============================================
-- PARTE 1: RIMUOVI TUTTE LE POLICY ESISTENTI
-- ============================================

-- Rimuovi TUTTE le policy esistenti su clients per evitare conflitti
DO $$
DECLARE
  v_policy_name TEXT;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Rimozione policy esistenti su clients ===';
  
  FOR v_policy_name IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'clients'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clients', v_policy_name);
    RAISE NOTICE '  ✓ Rimossa policy: %', v_policy_name;
    v_count := v_count + 1;
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE '  ℹ Nessuna policy esistente trovata';
  ELSE
    RAISE NOTICE '  ✓ Rimosse % policy', v_count;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ============================================
-- PARTE 2: VERIFICA CHE RLS SIA ABILITATO
-- ============================================

-- Assicurati che RLS sia abilitato sulla tabella clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 3: CREA NUOVE POLICY CORRETTE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== Creazione nuove policy ===';
  
  -- 1. Policy SELECT: permette agli utenti autenticati di vedere i clienti
  CREATE POLICY "Enable select for authenticated users" ON public.clients
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR auth.role() = 'authenticated'
    );
  RAISE NOTICE '  ✓ Policy SELECT creata';
  
  -- 2. Policy INSERT: permette agli utenti autenticati di creare clienti
  --    IMPORTANTE: usa WITH CHECK per INSERT, non solo USING
  CREATE POLICY "Enable insert for authenticated users" ON public.clients
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR auth.role() = 'authenticated'
    );
  RAISE NOTICE '  ✓ Policy INSERT creata (con WITH CHECK)';
  
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
  RAISE NOTICE '  ✓ Policy UPDATE creata';
  
  -- 4. Policy DELETE: permette agli utenti autenticati di eliminare clienti
  CREATE POLICY "Enable delete for authenticated users" ON public.clients
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR auth.role() = 'authenticated'
    );
  RAISE NOTICE '  ✓ Policy DELETE creata';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Tutte le policy create con successo!';
  RAISE NOTICE '';
END $$;

-- ============================================
-- PARTE 4: VERIFICA FINALE
-- ============================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_policy_info TEXT;
BEGIN
  RAISE NOTICE '=== Verifica finale ===';
  
  -- Conta le policy create
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'clients';
  
  RAISE NOTICE '  Policy totali su clients: %', v_policy_count;
  
  IF v_policy_count >= 4 THEN
    RAISE NOTICE '  ✅ Tutte le policy sono state create correttamente';
  ELSE
    RAISE WARNING '  ⚠️ Manca qualche policy! Dovrebbero essere 4 (SELECT, INSERT, UPDATE, DELETE)';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Elenco policy create ===';
  
  -- Mostra tutte le policy
  FOR v_policy_info IN 
    SELECT policyname || ' (' || cmd || ')'
    FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'clients'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  - %', v_policy_info;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Script completato con successo!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 PROSSIMI PASSI:';
  RAISE NOTICE '1. Ricarica la pagina dell''applicazione';
  RAISE NOTICE '2. Prova a creare un appuntamento';
  RAISE NOTICE '3. Se l''errore persiste, verifica che l''utente sia autenticato correttamente';
  RAISE NOTICE '';
END $$;

-- Query finale per visualizzazione
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
