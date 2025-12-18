-- =====================================================
-- VERIFICA E CORREGGE current_shop_id() FUNCTION
-- =====================================================
-- Questo script verifica che la funzione current_shop_id()
-- esista e funzioni correttamente per le RLS policies
-- =====================================================

-- 1) VERIFICA SE LA FUNZIONE ESISTE
-- =====================================================
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'current_shop_id'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE NOTICE '⚠️ Funzione current_shop_id() NON ESISTE - Creazione...';
    
    -- Crea la funzione
    CREATE OR REPLACE FUNCTION public.current_shop_id()
    RETURNS UUID
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    AS $$
    DECLARE
      v_user_id UUID;
      v_shop_id UUID;
    BEGIN
      -- Ottieni l'ID dell'utente corrente
      v_user_id := auth.uid();
      
      -- Se non c'è un utente autenticato, restituisci NULL
      IF v_user_id IS NULL THEN
        RETURN NULL;
      END IF;
      
      -- Cerca il shop_id nel profilo dell'utente
      SELECT shop_id INTO v_shop_id
      FROM public.profiles
      WHERE user_id = v_user_id;
      
      -- Restituisci il shop_id (può essere NULL se l'utente non ha un shop associato)
      RETURN v_shop_id;
    END;
    $$;
    
    RAISE NOTICE '✅ Funzione current_shop_id() creata';
  ELSE
    RAISE NOTICE '✅ Funzione current_shop_id() già esistente';
  END IF;
END $$;

-- 2) VERIFICA CHE LA FUNZIONE FUNZIONI CORRETTAMENTE
-- =====================================================
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai'; -- MODIFICA QUI
  v_admin_user_id UUID;
  v_shop_slug TEXT := 'abruzzo-barber'; -- MODIFICA QUI
  v_shop_id UUID;
  v_profile_shop_id UUID;
  v_function_result UUID;
BEGIN
  -- Trova user_id dall'email
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = v_admin_email;
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente con email % non trovato', v_admin_email;
  END IF;
  
  -- Trova shop_id dallo slug
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = v_shop_slug;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop con slug % non trovato', v_shop_slug;
  END IF;
  
  -- Verifica shop_id nel profilo
  SELECT shop_id INTO v_profile_shop_id 
  FROM public.profiles 
  WHERE user_id = v_admin_user_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICA current_shop_id() ===';
  RAISE NOTICE 'Email admin: %', v_admin_email;
  RAISE NOTICE 'User ID: %', v_admin_user_id;
  RAISE NOTICE 'Shop ID nel profilo: %', v_profile_shop_id;
  RAISE NOTICE 'Shop ID atteso: %', v_shop_id;
  
  -- Forza shop_id corretto se diverso
  IF v_profile_shop_id IS DISTINCT FROM v_shop_id THEN
    UPDATE public.profiles 
    SET shop_id = v_shop_id, role = 'admin'
    WHERE user_id = v_admin_user_id;
    RAISE NOTICE '✅ Shop ID aggiornato nel profilo';
    v_profile_shop_id := v_shop_id;
  END IF;
  
  -- Test della funzione (simula chiamata come se fosse l'utente)
  -- Nota: questo test funziona solo se eseguito come service_role
  -- In produzione, la funzione verrà chiamata durante le query RLS
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: Per testare la funzione in produzione,';
  RAISE NOTICE '   esegui questa query come utente autenticato:';
  RAISE NOTICE '   SELECT public.current_shop_id();';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Verifica completata';
END $$;

-- 3) VERIFICA CHE LE RLS POLICIES USINO CORRETTAMENTE current_shop_id()
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
  v_policies_with_current_shop_id INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICA RLS POLICIES ===';
  
  -- Conta tutte le policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('shops', 'clients', 'services', 'products', 'appointments', 'staff', 'chats', 'chat_messages', 'waitlist', 'notifications');
  
  -- Conta policies che usano current_shop_id()
  SELECT COUNT(*) INTO v_policies_with_current_shop_id
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('shops', 'clients', 'services', 'products', 'appointments', 'staff', 'chats', 'chat_messages', 'waitlist', 'notifications')
    AND (
      qual::text LIKE '%current_shop_id%' 
      OR with_check::text LIKE '%current_shop_id%'
    );
  
  RAISE NOTICE 'Totale policies: %', v_policy_count;
  RAISE NOTICE 'Policies che usano current_shop_id(): %', v_policies_with_current_shop_id;
  
  IF v_policy_count = 0 THEN
    RAISE WARNING '⚠️ NESSUNA RLS POLICY TROVATA! Esegui fix_rls_complete_isolation.sql';
  ELSIF v_policies_with_current_shop_id < v_policy_count THEN
    RAISE WARNING '⚠️ Alcune policies non usano current_shop_id()!';
  ELSE
    RAISE NOTICE '✅ Tutte le policies usano current_shop_id()';
  END IF;
END $$;

-- 4) VERIFICA CHE LE TABELLE ABBIANO shop_id E RLS ATTIVO
-- =====================================================
DO $$
DECLARE
  v_table RECORD;
  v_has_shop_id BOOLEAN;
  v_rls_enabled BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICA TABELLE ===';
  
  FOR v_table IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('shops', 'clients', 'services', 'products', 'appointments', 'staff', 'chats', 'chat_messages', 'waitlist', 'notifications')
    ORDER BY tablename
  LOOP
    -- Verifica se ha colonna shop_id
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = v_table.tablename 
        AND column_name = 'shop_id'
    ) INTO v_has_shop_id;
    
    -- Verifica se RLS è abilitato
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = v_table.tablename
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    RAISE NOTICE 'Tabella: % | shop_id: % | RLS: %', 
      v_table.tablename, 
      CASE WHEN v_has_shop_id THEN '✅' ELSE '❌' END,
      CASE WHEN v_rls_enabled THEN '✅' ELSE '❌' END;
    
    IF NOT v_has_shop_id AND v_table.tablename != 'shops' THEN
      RAISE WARNING '⚠️ Tabella % non ha colonna shop_id!', v_table.tablename;
    END IF;
    
    IF NOT v_rls_enabled THEN
      RAISE WARNING '⚠️ RLS non abilitato su tabella %!', v_table.tablename;
    END IF;
  END LOOP;
END $$;

-- 5) RIEPILOGO FINALE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Verifica che il profilo admin abbia shop_id corretto (vedi sopra)';
  RAISE NOTICE '2. Se necessario, esegui fix_rls_complete_isolation.sql';
  RAISE NOTICE '3. Logout completo dall''applicazione';
  RAISE NOTICE '4. Pulisci localStorage (current_shop_id, current_shop_slug, auth_token)';
  RAISE NOTICE '5. Rientra con ?shop=abruzzo-barber usando l''account admin';
  RAISE NOTICE '6. Verifica che vedi solo i dati del nuovo negozio';
  RAISE NOTICE '';
  RAISE NOTICE 'Per testare current_shop_id() dopo il login:';
  RAISE NOTICE '  SELECT public.current_shop_id();';
  RAISE NOTICE '  (Dovrebbe restituire l''UUID del negozio)';
  RAISE NOTICE '';
END $$;




