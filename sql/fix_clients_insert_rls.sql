-- =====================================================
-- FIX RLS POLICY PER INSERIMENTO CLIENTI
-- =====================================================
-- Questo script verifica e corregge la RLS policy
-- per permettere l'inserimento di clienti con shop_id corretto
-- =====================================================

-- 1) VERIFICA FUNZIONE current_shop_id()
-- =====================================================
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  RAISE NOTICE '=== VERIFICA current_shop_id() ===';
  
  SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'current_shop_id'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE WARNING '⚠️ Funzione current_shop_id() NON ESISTE!';
  ELSE
    RAISE NOTICE '✅ Funzione current_shop_id() esiste';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) VERIFICA RLS POLICY SU CLIENTS
-- =====================================================
DO $$
DECLARE
  v_policy_exists BOOLEAN;
  v_policy_rec RECORD;
BEGIN
  RAISE NOTICE '=== VERIFICA RLS POLICY CLIENTS ===';
  
  SELECT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'clients' 
      AND policyname = 'clients_insert_shop'
  ) INTO v_policy_exists;
  
  IF NOT v_policy_exists THEN
    RAISE WARNING '⚠️ Policy clients_insert_shop NON ESISTE!';
  ELSE
    RAISE NOTICE '✅ Policy clients_insert_shop esiste';
    
    -- Mostra la definizione della policy
    RAISE NOTICE 'Definizione policy:';
    FOR v_policy_rec IN 
      SELECT qual, with_check
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'clients' 
        AND policyname = 'clients_insert_shop'
    LOOP
      RAISE NOTICE '  WITH CHECK: %', v_policy_rec.with_check;
    END LOOP;
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 3) RICREA POLICY INSERT CON LOGICA MIGLIORATA
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RICREA POLICY clients_insert_shop ===';
  
  -- Rimuovi policy esistente
  DROP POLICY IF EXISTS clients_insert_shop ON public.clients;
  
  -- Crea nuova policy che permette inserimento se:
  -- 1. shop_id corrisponde al shop_id nel profilo dell'utente corrente
  -- 2. auth.role() = 'service_role' (chiamate da backend)
  -- 3. is_platform_admin() (platform admin)
  -- 4. shop_id IS NULL (per compatibilità con dati esistenti)
  -- Nota: In WITH CHECK per INSERT, possiamo riferirci direttamente alle colonne della nuova riga
  -- La policy permette inserimento se:
  -- 1. service_role (backend)
  -- 2. platform admin
  -- 3. shop_id IS NULL (compatibilità)
  -- 4. shop_id corrisponde al shop_id nel profilo dell'utente corrente
  CREATE POLICY clients_insert_shop ON public.clients
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR public.is_platform_admin()
      OR shop_id IS NULL
      OR (
        auth.uid() IS NOT NULL
        AND shop_id = (
          SELECT p.shop_id 
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
          LIMIT 1
        )
      )
    );
  
  RAISE NOTICE '✅ Policy clients_insert_shop ricreata';
  RAISE NOTICE '   La policy permette inserimento se:';
  RAISE NOTICE '   - service_role';
  RAISE NOTICE '   - platform admin';
  RAISE NOTICE '   - shop_id IS NULL';
  RAISE NOTICE '   - shop_id corrisponde al shop_id nel profilo dell''utente';
  RAISE NOTICE '';
END $$;

-- 4) VERIFICA PROFILO UTENTE
-- =====================================================
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai'; -- MODIFICA QUI
  v_admin_user_id UUID;
  v_shop_slug TEXT := 'abruzzo-barber'; -- MODIFICA QUI
  v_shop_id UUID;
  v_profile_shop_id UUID;
BEGIN
  RAISE NOTICE '=== VERIFICA PROFILO UTENTE ===';
  
  -- Trova user_id
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = v_admin_email;
  IF v_admin_user_id IS NULL THEN
    RAISE WARNING '⚠️ Utente con email % non trovato', v_admin_email;
    RETURN;
  END IF;
  
  -- Trova shop_id
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = v_shop_slug;
  IF v_shop_id IS NULL THEN
    RAISE WARNING '⚠️ Shop con slug % non trovato', v_shop_slug;
    RETURN;
  END IF;
  
  -- Verifica profilo
  SELECT shop_id INTO v_profile_shop_id 
  FROM public.profiles 
  WHERE user_id = v_admin_user_id;
  
  RAISE NOTICE 'Email: %', v_admin_email;
  RAISE NOTICE 'User ID: %', v_admin_user_id;
  RAISE NOTICE 'Shop slug: %', v_shop_slug;
  RAISE NOTICE 'Shop ID corretto: %', v_shop_id;
  RAISE NOTICE 'Shop ID nel profilo: %', v_profile_shop_id;
  
  IF v_profile_shop_id IS DISTINCT FROM v_shop_id THEN
    RAISE WARNING '⚠️ Shop ID nel profilo non corrisponde!';
    RAISE NOTICE 'Aggiornamento profilo...';
    UPDATE public.profiles 
    SET shop_id = v_shop_id, role = 'admin'
    WHERE user_id = v_admin_user_id;
    RAISE NOTICE '✅ Profilo aggiornato';
  ELSE
    RAISE NOTICE '✅ Profilo corretto';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 5) TEST INSERIMENTO CLIENTE (simulazione)
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== TEST INSERIMENTO CLIENTE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Per testare se la policy funziona:';
  RAISE NOTICE '1. Esegui questa query come utente autenticato:';
  RAISE NOTICE '';
  RAISE NOTICE '   SELECT public.current_shop_id();';
  RAISE NOTICE '';
  RAISE NOTICE '   (Dovrebbe restituire l''UUID del negozio, non NULL)';
  RAISE NOTICE '';
  RAISE NOTICE '2. Se restituisce NULL, il profilo non ha shop_id corretto';
  RAISE NOTICE '3. Se restituisce un UUID, prova a inserire un cliente:';
  RAISE NOTICE '';
  RAISE NOTICE '   INSERT INTO public.clients (shop_id, first_name, last_name, phone_e164, email)';
  RAISE NOTICE '   VALUES (public.current_shop_id(), ''Test'', ''Cliente'', ''+39123456789'', ''test@test.it'');';
  RAISE NOTICE '';
  RAISE NOTICE '4. Se l''inserimento funziona, la policy è corretta';
  RAISE NOTICE '5. Se fallisce, controlla i log per vedere quale condizione non è soddisfatta';
  RAISE NOTICE '';
END $$;




