-- =====================================================
-- DEBUG COMPLETO INSERIMENTO CLIENTI
-- =====================================================
-- Questo script verifica TUTTO e mostra esattamente
-- cosa sta succedendo quando provi a inserire un cliente
-- =====================================================

-- CONFIGURAZIONE
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai'; -- MODIFICA QUI
  v_shop_slug TEXT := 'abruzzo-barber'; -- MODIFICA QUI
BEGIN
  RAISE NOTICE '=== CONFIGURAZIONE ===';
  RAISE NOTICE 'Email admin: %', v_admin_email;
  RAISE NOTICE 'Shop slug: %', v_shop_slug;
  RAISE NOTICE '';
END $$;

-- 1) VERIFICA UTENTE E PROFILO
-- =====================================================
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai';
  v_shop_slug TEXT := 'abruzzo-barber';
  v_admin_user_id UUID;
  v_shop_id UUID;
  v_profile_shop_id UUID;
  v_profile_role TEXT;
  v_current_user_id UUID;
BEGIN
  RAISE NOTICE '=== 1. VERIFICA UTENTE E PROFILO ===';
  
  -- Utente corrente
  v_current_user_id := auth.uid();
  RAISE NOTICE 'auth.uid() corrente: %', v_current_user_id;
  
  IF v_current_user_id IS NULL THEN
    RAISE WARNING '❌ PROBLEMA: auth.uid() è NULL - esegui questo script come utente autenticato!';
  END IF;
  
  -- Trova admin user
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = v_admin_email;
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente con email % non trovato', v_admin_email;
  END IF;
  
  -- Trova shop
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = v_shop_slug;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop con slug % non trovato', v_shop_slug;
  END IF;
  
  -- Verifica profilo admin
  SELECT shop_id, role INTO v_profile_shop_id, v_profile_role
  FROM public.profiles 
  WHERE user_id = v_admin_user_id;
  
  RAISE NOTICE 'Admin User ID: %', v_admin_user_id;
  RAISE NOTICE 'Shop ID corretto: %', v_shop_id;
  RAISE NOTICE 'Shop ID nel profilo admin: %', v_profile_shop_id;
  RAISE NOTICE 'Role nel profilo admin: %', v_profile_role;
  
  -- FORZA CORREZIONE
  IF v_profile_shop_id IS DISTINCT FROM v_shop_id THEN
    RAISE WARNING '⚠️ Shop ID non corrisponde - AGGIORNAMENTO...';
    UPDATE public.profiles 
    SET shop_id = v_shop_id, role = 'admin'
    WHERE user_id = v_admin_user_id;
    RAISE NOTICE '✅ Profilo aggiornato';
    v_profile_shop_id := v_shop_id;
  END IF;
  
  -- Se stai eseguendo come utente corrente, verifica anche il suo profilo
  IF v_current_user_id IS NOT NULL AND v_current_user_id != v_admin_user_id THEN
    DECLARE
      v_current_profile_shop_id UUID;
    BEGIN
      SELECT shop_id INTO v_current_profile_shop_id
      FROM public.profiles
      WHERE user_id = v_current_user_id;
      
      RAISE NOTICE '';
      RAISE NOTICE 'Profilo utente corrente (auth.uid()):';
      RAISE NOTICE '  User ID: %', v_current_user_id;
      RAISE NOTICE '  Shop ID: %', v_current_profile_shop_id;
      
      IF v_current_profile_shop_id IS NULL THEN
        RAISE WARNING '⚠️ L''utente corrente non ha shop_id nel profilo!';
      END IF;
    END;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) VERIFICA current_shop_id()
-- =====================================================
DO $$
DECLARE
  v_current_shop_id UUID;
BEGIN
  RAISE NOTICE '=== 2. VERIFICA current_shop_id() ===';
  
  v_current_shop_id := public.current_shop_id();
  
  RAISE NOTICE 'current_shop_id() restituisce: %', v_current_shop_id;
  
  IF v_current_shop_id IS NULL THEN
    RAISE WARNING '❌ PROBLEMA: current_shop_id() restituisce NULL!';
    RAISE NOTICE '   Questo significa che il profilo non ha shop_id o l''utente non è autenticato';
  ELSE
    RAISE NOTICE '✅ current_shop_id() funziona correttamente';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 3) VERIFICA RLS POLICIES SU CLIENTS
-- =====================================================
DO $$
DECLARE
  v_policy RECORD;
  v_rls_enabled BOOLEAN;
BEGIN
  RAISE NOTICE '=== 3. VERIFICA RLS POLICIES ===';
  
  -- Verifica RLS abilitato
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'clients'
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  RAISE NOTICE 'RLS abilitato: %', v_rls_enabled;
  
  IF NOT v_rls_enabled THEN
    RAISE WARNING '⚠️ RLS non abilitato su clients!';
  END IF;
  
  -- Mostra tutte le policy
  RAISE NOTICE '';
  RAISE NOTICE 'Policy esistenti:';
  FOR v_policy IN 
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  Policy: % (comando: %)', v_policy.policyname, v_policy.cmd;
    IF v_policy.with_check IS NOT NULL THEN
      RAISE NOTICE '    WITH CHECK: %', v_policy.with_check;
    END IF;
    IF v_policy.qual IS NOT NULL THEN
      RAISE NOTICE '    USING: %', v_policy.qual;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
END $$;

-- 4) RIMUOVI TUTTE LE POLICY E RICREALE
-- =====================================================
DO $$
DECLARE
  v_policy_name TEXT;
BEGIN
  RAISE NOTICE '=== 4. RICREA POLICY INSERT ===';
  
  -- Rimuovi tutte le policy INSERT
  FOR v_policy_name IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'clients'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clients', v_policy_name);
    RAISE NOTICE '  Rimosso: %', v_policy_name;
  END LOOP;
  
  -- Crea nuova policy INSERT con logica SEMPLIFICATA
  -- Permette inserimento se shop_id corrisponde al shop_id nel profilo
  CREATE POLICY clients_insert_shop ON public.clients
    FOR INSERT 
    WITH CHECK (
      -- Backend/service_role può sempre inserire
      auth.role() = 'service_role' 
      -- Platform admin può sempre inserire
      OR public.is_platform_admin()
      -- Utente autenticato può inserire se shop_id corrisponde al suo profilo
      OR (
        auth.uid() IS NOT NULL
        AND shop_id IS NOT NULL
        AND shop_id = (
          SELECT p.shop_id 
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
          LIMIT 1
        )
      )
    );
  
  RAISE NOTICE '✅ Policy clients_insert_shop ricreata';
  RAISE NOTICE '';
END $$;

-- 5) TEST INSERIMENTO DIRETTO
-- =====================================================
DO $$
DECLARE
  v_test_shop_id UUID;
  v_test_client_id UUID;
  v_current_user_id UUID;
  v_profile_shop_id UUID;
BEGIN
  RAISE NOTICE '=== 5. TEST INSERIMENTO DIRETTO ===';
  
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE WARNING '❌ Impossibile testare: auth.uid() è NULL';
    RAISE NOTICE '   Esegui questo script come utente autenticato!';
    RETURN;
  END IF;
  
  -- Ottieni shop_id dal profilo
  SELECT shop_id INTO v_profile_shop_id
  FROM public.profiles
  WHERE user_id = v_current_user_id;
  
  IF v_profile_shop_id IS NULL THEN
    RAISE WARNING '❌ Impossibile testare: profilo non ha shop_id';
    RAISE NOTICE '   User ID: %', v_current_user_id;
    RETURN;
  END IF;
  
  v_test_shop_id := v_profile_shop_id;
  
  RAISE NOTICE 'User ID: %', v_current_user_id;
  RAISE NOTICE 'Shop ID dal profilo: %', v_test_shop_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Tentativo inserimento cliente...';
  
  BEGIN
    INSERT INTO public.clients (
      shop_id,
      first_name,
      last_name,
      phone_e164,
      email
    ) VALUES (
      v_test_shop_id,
      'Test',
      'Cliente',
      '+39123456789',
      'test-' || extract(epoch from now())::text || '@test.it'
    ) RETURNING id INTO v_test_client_id;
    
    RAISE NOTICE '✅✅✅ INSERIMENTO RIUSCITO! ✅✅✅';
    RAISE NOTICE 'Client ID creato: %', v_test_client_id;
    
    -- Rimuovi il cliente di test
    DELETE FROM public.clients WHERE id = v_test_client_id;
    RAISE NOTICE '✅ Cliente di test rimosso';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌❌❌ INSERIMENTO FALLITO! ❌❌❌';
    RAISE NOTICE 'Errore: %', SQLERRM;
    RAISE NOTICE 'Codice: %', SQLSTATE;
    RAISE NOTICE '';
    RAISE NOTICE 'Dettagli:';
    RAISE NOTICE '  - User ID: %', v_current_user_id;
    RAISE NOTICE '  - Shop ID nel profilo: %', v_profile_shop_id;
    RAISE NOTICE '  - Shop ID usato nell''INSERT: %', v_test_shop_id;
    RAISE NOTICE '  - auth.role(): %', auth.role();
    RAISE NOTICE '  - is_platform_admin(): %', public.is_platform_admin();
  END;
  
  RAISE NOTICE '';
END $$;

-- 6) VERIFICA CONDIZIONI POLICY
-- =====================================================
DO $$
DECLARE
  v_current_user_id UUID;
  v_profile_shop_id UUID;
  v_test_shop_id UUID := '4139fac4-127f-42f6-ba10-74ee03ffb160'; -- MODIFICA QUI CON IL TUO SHOP_ID
  v_is_service_role BOOLEAN;
  v_is_platform_admin BOOLEAN;
  v_shop_id_matches BOOLEAN;
BEGIN
  RAISE NOTICE '=== 6. VERIFICA CONDIZIONI POLICY ===';
  
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE WARNING '❌ auth.uid() è NULL';
    RETURN;
  END IF;
  
  -- Verifica condizioni
  v_is_service_role := (auth.role() = 'service_role');
  v_is_platform_admin := public.is_platform_admin();
  
  SELECT shop_id INTO v_profile_shop_id
  FROM public.profiles
  WHERE user_id = v_current_user_id;
  
  v_shop_id_matches := (v_profile_shop_id = v_test_shop_id);
  
  RAISE NOTICE 'Condizioni policy INSERT:';
  RAISE NOTICE '  auth.role() = service_role: %', v_is_service_role;
  RAISE NOTICE '  is_platform_admin(): %', v_is_platform_admin;
  RAISE NOTICE '  shop_id nel profilo: %', v_profile_shop_id;
  RAISE NOTICE '  shop_id da testare: %', v_test_shop_id;
  RAISE NOTICE '  shop_id corrisponde: %', v_shop_id_matches;
  RAISE NOTICE '';
  
  IF v_is_service_role OR v_is_platform_admin OR v_shop_id_matches THEN
    RAISE NOTICE '✅ ALMENO UNA condizione è TRUE - la policy DOVREBBE permettere l''inserimento';
  ELSE
    RAISE WARNING '❌ NESSUNA condizione è TRUE - la policy BLOCCA l''inserimento!';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUZIONE:';
    IF v_profile_shop_id IS NULL THEN
      RAISE NOTICE '  - Il profilo non ha shop_id - aggiorna il profilo';
    ELSIF v_profile_shop_id != v_test_shop_id THEN
      RAISE NOTICE '  - Il shop_id nel profilo (%) non corrisponde al shop_id da inserire (%)', v_profile_shop_id, v_test_shop_id;
      RAISE NOTICE '  - Aggiorna il profilo con il shop_id corretto';
    END IF;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 7) RIEPILOGO FINALE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== 7. RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Se l''inserimento è ancora bloccato:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Verifica che auth.uid() non sia NULL (utente autenticato)';
  RAISE NOTICE '2. Verifica che il profilo abbia shop_id corretto';
  RAISE NOTICE '3. Verifica che shop_id nel payload corrisponda al shop_id nel profilo';
  RAISE NOTICE '4. Controlla la sezione 6 per vedere quale condizione fallisce';
  RAISE NOTICE '';
  RAISE NOTICE 'Se tutto è corretto ma ancora non funziona:';
  RAISE NOTICE '  - Potrebbe esserci un problema con la cache delle policy';
  RAISE NOTICE '  - Prova a disabilitare e riabilitare RLS:';
  RAISE NOTICE '    ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;';
  RAISE NOTICE '    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;';
  RAISE NOTICE '';
END $$;
