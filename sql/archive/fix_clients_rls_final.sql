-- =====================================================
-- FIX DEFINITIVO RLS POLICY PER CLIENTS
-- =====================================================
-- Questo script rimuove TUTTE le policy su clients
-- e ricrea solo quelle necessarie con logica corretta
-- =====================================================

-- 1) RIMUOVI TUTTE LE POLICY ESISTENTI SU CLIENTS
-- =====================================================
DO $$
DECLARE
  v_policy_name TEXT;
BEGIN
  RAISE NOTICE '=== RIMOZIONE POLICY ESISTENTI SU CLIENTS ===';
  
  FOR v_policy_name IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'clients'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clients', v_policy_name);
    RAISE NOTICE '  Rimosso: clients.%', v_policy_name;
  END LOOP;
  
  RAISE NOTICE '✅ Tutte le policy rimosse';
  RAISE NOTICE '';
END $$;

-- 2) ABILITA RLS
-- =====================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3) CREA POLICY SELECT
-- =====================================================
DO $$
BEGIN
  CREATE POLICY clients_select_shop ON public.clients
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR public.is_platform_admin()
      OR shop_id = public.current_shop_id()
      OR shop_id IS NULL
    );
  
  RAISE NOTICE '✅ Policy clients_select_shop creata';
END $$;

-- 4) CREA POLICY INSERT (LOGICA SEMPLIFICATA)
-- =====================================================
DO $$
BEGIN
  -- Policy INSERT: permette inserimento se:
  -- 1. service_role (backend)
  -- 2. platform admin
  -- 3. shop_id corrisponde al shop_id nel profilo dell'utente corrente
  CREATE POLICY clients_insert_shop ON public.clients
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR public.is_platform_admin()
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
  
  RAISE NOTICE '✅ Policy clients_insert_shop creata';
  RAISE NOTICE '   La policy permette inserimento se:';
  RAISE NOTICE '   - service_role';
  RAISE NOTICE '   - platform admin';
  RAISE NOTICE '   - shop_id corrisponde al shop_id nel profilo dell''utente';
END $$;

-- 5) CREA POLICY UPDATE
-- =====================================================
DO $$
BEGIN
  CREATE POLICY clients_update_shop ON public.clients
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR public.is_platform_admin()
      OR shop_id = public.current_shop_id()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR public.is_platform_admin()
      OR shop_id = public.current_shop_id()
    );
  
  RAISE NOTICE '✅ Policy clients_update_shop creata';
END $$;

-- 6) CREA POLICY DELETE
-- =====================================================
DO $$
BEGIN
  CREATE POLICY clients_delete_shop ON public.clients
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR public.is_platform_admin()
      OR shop_id = public.current_shop_id()
    );
  
  RAISE NOTICE '✅ Policy clients_delete_shop creata';
END $$;

-- 7) VERIFICA PROFILO UTENTE
-- =====================================================
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai'; -- MODIFICA QUI
  v_admin_user_id UUID;
  v_shop_slug TEXT := 'abruzzo-barber'; -- MODIFICA QUI
  v_shop_id UUID;
  v_profile_shop_id UUID;
BEGIN
  RAISE NOTICE '';
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

-- 8) VERIFICA FINALE
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA FINALE ===';
  
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'clients';
  
  RAISE NOTICE 'Policies su clients: %', v_policy_count;
  
  IF v_policy_count >= 4 THEN
    RAISE NOTICE '✅ Tutte le policies create correttamente';
  ELSE
    RAISE WARNING '⚠️ Manca qualche policy!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Logout completo';
  RAISE NOTICE '2. Pulisci localStorage (current_shop_id, current_shop_slug, auth_token)';
  RAISE NOTICE '3. Rientra con ?shop=abruzzo-barber';
  RAISE NOTICE '4. Prova a creare un cliente';
  RAISE NOTICE '';
END $$;
