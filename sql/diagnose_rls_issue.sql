-- =====================================================
-- SCRIPT DI DIAGNOSTICA PER PROBLEMA RLS
-- =====================================================
-- Esegui questo script per capire perché le RLS
-- non filtrano correttamente i dati
-- =====================================================

-- 1) VERIFICA PROFILO ADMIN
-- =====================================================
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai'; -- MODIFICA QUI
  v_admin_user_id UUID;
  v_shop_slug TEXT := 'abruzzo-barber'; -- MODIFICA QUI
  v_shop_id UUID;
  v_profile_shop_id UUID;
  v_profile_role TEXT;
BEGIN
  RAISE NOTICE '=== 1. VERIFICA PROFILO ADMIN ===';
  RAISE NOTICE '';
  
  -- Trova user_id
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = v_admin_email;
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Utente con email % non trovato', v_admin_email;
  END IF;
  RAISE NOTICE '✅ User ID trovato: %', v_admin_user_id;
  
  -- Trova shop_id
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = v_shop_slug;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION '❌ Shop con slug % non trovato', v_shop_slug;
  END IF;
  RAISE NOTICE '✅ Shop ID corretto: %', v_shop_id;
  
  -- Verifica profilo
  SELECT shop_id, role INTO v_profile_shop_id, v_profile_role
  FROM public.profiles 
  WHERE user_id = v_admin_user_id;
  
  IF v_profile_shop_id IS NULL THEN
    RAISE WARNING '❌ PROBLEMA: Profilo non ha shop_id!';
    RAISE NOTICE '   Aggiornamento profilo...';
    UPDATE public.profiles 
    SET shop_id = v_shop_id, role = 'admin'
    WHERE user_id = v_admin_user_id;
    RAISE NOTICE '   ✅ Profilo aggiornato';
  ELSIF v_profile_shop_id != v_shop_id THEN
    RAISE WARNING '❌ PROBLEMA: Profilo ha shop_id sbagliato!';
    RAISE NOTICE '   Shop ID nel profilo: %', v_profile_shop_id;
    RAISE NOTICE '   Shop ID corretto: %', v_shop_id;
    RAISE NOTICE '   Aggiornamento profilo...';
    UPDATE public.profiles 
    SET shop_id = v_shop_id, role = 'admin'
    WHERE user_id = v_admin_user_id;
    RAISE NOTICE '   ✅ Profilo aggiornato';
  ELSE
    RAISE NOTICE '✅ Profilo corretto: shop_id = %, role = %', v_profile_shop_id, v_profile_role;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) VERIFICA FUNZIONE current_shop_id()
-- =====================================================
DO $$
DECLARE
  v_function_exists BOOLEAN;
  v_function_definition TEXT;
BEGIN
  RAISE NOTICE '=== 2. VERIFICA FUNZIONE current_shop_id() ===';
  RAISE NOTICE '';
  
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'current_shop_id'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE WARNING '❌ PROBLEMA: Funzione current_shop_id() NON ESISTE!';
    RAISE NOTICE '   Creazione funzione...';
    
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
      v_user_id := auth.uid();
      IF v_user_id IS NULL THEN
        RETURN NULL;
      END IF;
      SELECT shop_id INTO v_shop_id
      FROM public.profiles
      WHERE user_id = v_user_id;
      RETURN v_shop_id;
    END;
    $$;
    
    RAISE NOTICE '   ✅ Funzione creata';
  ELSE
    RAISE NOTICE '✅ Funzione current_shop_id() esiste';
    
    -- Mostra la definizione
    SELECT pg_get_functiondef(p.oid) INTO v_function_definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'current_shop_id';
    
    RAISE NOTICE '   Definizione: %', substring(v_function_definition, 1, 200);
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 3) VERIFICA RLS POLICIES
-- =====================================================
DO $$
DECLARE
  v_table TEXT;
  v_rls_enabled BOOLEAN;
  v_policy_count INTEGER;
BEGIN
  RAISE NOTICE '=== 3. VERIFICA RLS POLICIES ===';
  RAISE NOTICE '';
  
  FOR v_table IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('shops', 'clients', 'services', 'products', 'appointments', 'staff', 'chats', 'chat_messages', 'waitlist', 'notifications')
    ORDER BY tablename
  LOOP
    -- Verifica RLS
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = v_table
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    -- Conta policies
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = v_table;
    
    IF NOT v_rls_enabled THEN
      RAISE WARNING '❌ %: RLS NON ABILITATO!', v_table;
    ELSIF v_policy_count = 0 THEN
      RAISE WARNING '❌ %: RLS abilitato ma NESSUNA POLICY!', v_table;
    ELSE
      RAISE NOTICE '✅ %: RLS abilitato, % policies', v_table, v_policy_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
END $$;

-- 4) VERIFICA POLICY PERMISSIVE SU SHOPS
-- =====================================================
DO $$
DECLARE
  v_permissive_policies TEXT[];
BEGIN
  RAISE NOTICE '=== 4. VERIFICA POLICY PERMISSIVE SU SHOPS ===';
  RAISE NOTICE '';
  
  SELECT array_agg(policyname) INTO v_permissive_policies
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'shops'
    AND (
      qual::text LIKE '%true%' 
      OR qual::text = ''
      OR (qual::text NOT LIKE '%current_shop_id%' AND qual::text NOT LIKE '%is_platform_admin%')
    );
  
  IF v_permissive_policies IS NOT NULL AND array_length(v_permissive_policies, 1) > 0 THEN
    RAISE WARNING '❌ PROBLEMA: Trovate policy permissive su shops: %', array_to_string(v_permissive_policies, ', ');
    RAISE NOTICE '   Rimozione policy permissive...';
    
    FOREACH v_table IN ARRAY v_permissive_policies
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.shops', v_table);
    END LOOP;
    
    RAISE NOTICE '   ✅ Policy permissive rimosse';
  ELSE
    RAISE NOTICE '✅ Nessuna policy permissiva trovata su shops';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 5) TEST CONTA RECORDS PER SHOP
-- =====================================================
DO $$
DECLARE
  v_shop_slug TEXT := 'abruzzo-barber'; -- MODIFICA QUI
  v_shop_id UUID;
  v_total_appointments INTEGER;
  v_shop_appointments INTEGER;
  v_total_clients INTEGER;
  v_shop_clients INTEGER;
  v_total_services INTEGER;
  v_shop_services INTEGER;
BEGIN
  RAISE NOTICE '=== 5. TEST CONTA RECORDS ===';
  RAISE NOTICE '';
  
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = v_shop_slug;
  
  IF v_shop_id IS NULL THEN
    RAISE WARNING '❌ Shop non trovato';
    RETURN;
  END IF;
  
  -- Conta appointments
  SELECT COUNT(*) INTO v_total_appointments FROM public.appointments;
  SELECT COUNT(*) INTO v_shop_appointments FROM public.appointments WHERE shop_id = v_shop_id;
  
  -- Conta clients
  SELECT COUNT(*) INTO v_total_clients FROM public.clients;
  SELECT COUNT(*) INTO v_shop_clients FROM public.clients WHERE shop_id = v_shop_id;
  
  -- Conta services
  SELECT COUNT(*) INTO v_total_services FROM public.services;
  SELECT COUNT(*) INTO v_shop_services FROM public.services WHERE shop_id = v_shop_id;
  
  RAISE NOTICE 'Appointments:';
  RAISE NOTICE '  Totale nel database: %', v_total_appointments;
  RAISE NOTICE '  Per shop %: %', v_shop_slug, v_shop_appointments;
  
  RAISE NOTICE 'Clients:';
  RAISE NOTICE '  Totale nel database: %', v_total_clients;
  RAISE NOTICE '  Per shop %: %', v_shop_slug, v_shop_clients;
  
  RAISE NOTICE 'Services:';
  RAISE NOTICE '  Totale nel database: %', v_total_services;
  RAISE NOTICE '  Per shop %: %', v_shop_slug, v_shop_services;
  
  IF v_total_appointments > v_shop_appointments THEN
    RAISE WARNING '⚠️ Ci sono % appointments di altri negozi nel database', v_total_appointments - v_shop_appointments;
  END IF;
  
  IF v_total_clients > v_shop_clients THEN
    RAISE WARNING '⚠️ Ci sono % clients di altri negozi nel database', v_total_clients - v_shop_clients;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 6) RIEPILOGO E RACCOMANDAZIONI
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== 6. RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Se vedi ancora tutti i dati dopo questo script:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Verifica che il profilo abbia shop_id corretto (vedi sezione 1)';
  RAISE NOTICE '2. Verifica che current_shop_id() esista (vedi sezione 2)';
  RAISE NOTICE '3. Verifica che RLS sia abilitato su tutte le tabelle (vedi sezione 3)';
  RAISE NOTICE '4. Verifica che non ci siano policy permissive su shops (vedi sezione 4)';
  RAISE NOTICE '';
  RAISE NOTICE '5. DOPO IL LOGIN, testa la funzione:';
  RAISE NOTICE '   SELECT public.current_shop_id();';
  RAISE NOTICE '   (Dovrebbe restituire l''UUID del negozio, non NULL)';
  RAISE NOTICE '';
  RAISE NOTICE '6. Se current_shop_id() restituisce NULL dopo il login:';
  RAISE NOTICE '   - Il profilo non ha shop_id';
  RAISE NOTICE '   - O il token JWT non contiene user_id corretto';
  RAISE NOTICE '';
  RAISE NOTICE '7. Esegui fix_rls_complete_isolation.sql per correggere tutto';
  RAISE NOTICE '';
END $$;




