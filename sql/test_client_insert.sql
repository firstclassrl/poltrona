-- =====================================================
-- TEST INSERIMENTO CLIENTE
-- =====================================================
-- Esegui questo script per testare se l'inserimento
-- di un cliente funziona correttamente
-- =====================================================

-- 1) VERIFICA current_shop_id()
-- =====================================================
DO $$
DECLARE
  v_current_shop_id UUID;
BEGIN
  RAISE NOTICE '=== TEST current_shop_id() ===';
  
  SELECT public.current_shop_id() INTO v_current_shop_id;
  
  IF v_current_shop_id IS NULL THEN
    RAISE WARNING '❌ current_shop_id() restituisce NULL!';
    RAISE NOTICE '   Questo significa che il profilo non ha shop_id o l''utente non è autenticato';
  ELSE
    RAISE NOTICE '✅ current_shop_id() = %', v_current_shop_id;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) VERIFICA PROFILO
-- =====================================================
DO $$
DECLARE
  v_user_id UUID;
  v_profile_shop_id UUID;
  v_profile_role TEXT;
BEGIN
  RAISE NOTICE '=== VERIFICA PROFILO ===';
  
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE WARNING '❌ auth.uid() è NULL - utente non autenticato!';
    RETURN;
  END IF;
  
  RAISE NOTICE 'User ID: %', v_user_id;
  
  SELECT shop_id, role INTO v_profile_shop_id, v_profile_role
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  IF v_profile_shop_id IS NULL THEN
    RAISE WARNING '❌ Profilo non ha shop_id!';
  ELSE
    RAISE NOTICE '✅ Profilo shop_id: %', v_profile_shop_id;
    RAISE NOTICE '✅ Profilo role: %', v_profile_role;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 3) TEST INSERIMENTO CLIENTE
-- =====================================================
DO $$
DECLARE
  v_test_shop_id UUID;
  v_test_client_id UUID;
BEGIN
  RAISE NOTICE '=== TEST INSERIMENTO CLIENTE ===';
  
  -- Ottieni shop_id dal profilo
  SELECT shop_id INTO v_test_shop_id
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  IF v_test_shop_id IS NULL THEN
    RAISE WARNING '❌ Impossibile testare: profilo non ha shop_id';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Tentativo inserimento cliente con shop_id: %', v_test_shop_id;
  
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
      'test@test.it'
    ) RETURNING id INTO v_test_client_id;
    
    RAISE NOTICE '✅ Inserimento riuscito! Client ID: %', v_test_client_id;
    
    -- Rimuovi il cliente di test
    DELETE FROM public.clients WHERE id = v_test_client_id;
    RAISE NOTICE '✅ Cliente di test rimosso';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Inserimento fallito: %', SQLERRM;
    RAISE NOTICE '   Codice errore: %', SQLSTATE;
  END;
  
  RAISE NOTICE '';
END $$;

-- 4) VERIFICA RLS POLICY
-- =====================================================
DO $$
DECLARE
  v_policy_def TEXT;
BEGIN
  RAISE NOTICE '=== VERIFICA RLS POLICY ===';
  
  SELECT with_check INTO v_policy_def
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'clients'
    AND policyname = 'clients_insert_shop';
  
  IF v_policy_def IS NULL THEN
    RAISE WARNING '❌ Policy clients_insert_shop non trovata!';
  ELSE
    RAISE NOTICE '✅ Policy trovata';
    RAISE NOTICE 'WITH CHECK: %', v_policy_def;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 5) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Se l''inserimento è fallito:';
  RAISE NOTICE '1. Verifica che current_shop_id() restituisca un UUID (non NULL)';
  RAISE NOTICE '2. Verifica che il profilo abbia shop_id corretto';
  RAISE NOTICE '3. Verifica che la RLS policy sia corretta';
  RAISE NOTICE '4. Esegui fix_clients_insert_rls.sql per correggere tutto';
  RAISE NOTICE '';
END $$;




