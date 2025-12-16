-- =====================================================
-- SCRIPT FORZATO PER ISOLAMENTO COMPLETO
-- =====================================================
-- Questo script FORZA l'isolamento rimuovendo TUTTE
-- le policy permissive e creando solo policy strict
-- =====================================================

-- CONFIGURAZIONE - MODIFICA QUI
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai';
  v_shop_slug TEXT := 'abruzzo-barber';
BEGIN
  RAISE NOTICE '=== CONFIGURAZIONE ===';
  RAISE NOTICE 'Email admin: %', v_admin_email;
  RAISE NOTICE 'Shop slug: %', v_shop_slug;
  RAISE NOTICE '';
END $$;

-- 1) FORZA shop_id NEL PROFILO
-- =====================================================
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai';
  v_shop_slug TEXT := 'abruzzo-barber';
  v_admin_user_id UUID;
  v_shop_id UUID;
BEGIN
  RAISE NOTICE '=== 1. FORZA shop_id NEL PROFILO ===';
  
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = v_admin_email;
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente non trovato: %', v_admin_email;
  END IF;
  
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = v_shop_slug;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop non trovato: %', v_shop_slug;
  END IF;
  
  -- FORZA shop_id
  UPDATE public.profiles 
  SET shop_id = v_shop_id, role = 'admin'
  WHERE user_id = v_admin_user_id;
  
  RAISE NOTICE '✅ Profilo aggiornato: shop_id = %', v_shop_id;
  RAISE NOTICE '';
END $$;

-- 2) CREA/AGGIORNA FUNZIONE current_shop_id()
-- =====================================================
CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.current_shop_id() IS 'Restituisce il shop_id dell''utente corrente. Usato dalle RLS policies.';

-- 3) RIMUOVI TUTTE LE POLICY ESISTENTI (tranne platform admin)
-- =====================================================
DO $$
DECLARE
  v_policy_name TEXT;
  v_policy_rec RECORD;
BEGIN
  RAISE NOTICE '=== 2. RIMOZIONE POLICY PERMISSIVE ===';
  
  -- Rimuovi TUTTE le policy su shops (tranne platform admin)
  FOR v_policy_name IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'shops'
      AND policyname NOT LIKE '%platform_admin%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.shops', v_policy_name);
    RAISE NOTICE '  Rimosso: shops.%', v_policy_name;
  END LOOP;
  
  -- Rimuovi policy permissive su altre tabelle
  FOR v_policy_rec IN 
    SELECT tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('clients', 'services', 'products', 'appointments', 'staff', 'chats', 'chat_messages', 'waitlist', 'notifications')
      AND (
        qual::text LIKE '%true%' 
        OR qual::text = ''
        OR (qual::text NOT LIKE '%current_shop_id%' AND qual::text NOT LIKE '%is_platform_admin%' AND qual::text NOT LIKE '%service_role%')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy_rec.policyname, v_policy_rec.tablename);
    RAISE NOTICE '  Rimosso: %.%', v_policy_rec.tablename, v_policy_rec.policyname;
  END LOOP;
  
  RAISE NOTICE '✅ Policy permissive rimosse';
  RAISE NOTICE '';
END $$;

-- 4) ABILITA RLS SU TUTTE LE TABELLE
-- =====================================================
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5) CREA POLICY STRICT PER SHOPS
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== 3. CREAZIONE POLICY STRICT ===';
  
  -- Shops SELECT: solo il proprio shop o platform admin
  DROP POLICY IF EXISTS shops_select_shop ON public.shops;
  CREATE POLICY shops_select_shop ON public.shops
    FOR SELECT 
    USING (
      id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  -- Shops INSERT: solo platform admin
  DROP POLICY IF EXISTS shops_insert_shop ON public.shops;
  CREATE POLICY shops_insert_shop ON public.shops
    FOR INSERT 
    WITH CHECK (public.is_platform_admin());
  
  -- Shops UPDATE: solo il proprio shop o platform admin
  DROP POLICY IF EXISTS shops_update_shop ON public.shops;
  CREATE POLICY shops_update_shop ON public.shops
    FOR UPDATE 
    USING (
      id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  -- Shops DELETE: solo platform admin
  DROP POLICY IF EXISTS shops_delete_shop ON public.shops;
  CREATE POLICY shops_delete_shop ON public.shops
    FOR DELETE 
    USING (public.is_platform_admin());
  
  RAISE NOTICE '✅ Policy shops create';
END $$;

-- 6) CREA POLICY STRICT PER CLIENTS
-- =====================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS clients_select_shop ON public.clients;
  CREATE POLICY clients_select_shop ON public.clients
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS clients_insert_shop ON public.clients;
  CREATE POLICY clients_insert_shop ON public.clients
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS clients_update_shop ON public.clients;
  CREATE POLICY clients_update_shop ON public.clients
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS clients_delete_shop ON public.clients;
  CREATE POLICY clients_delete_shop ON public.clients
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  RAISE NOTICE '✅ Policy clients create';
END $$;

-- 7) CREA POLICY STRICT PER SERVICES
-- =====================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS services_select_shop ON public.services;
  CREATE POLICY services_select_shop ON public.services
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS services_insert_shop ON public.services;
  CREATE POLICY services_insert_shop ON public.services
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS services_update_shop ON public.services;
  CREATE POLICY services_update_shop ON public.services
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS services_delete_shop ON public.services;
  CREATE POLICY services_delete_shop ON public.services
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  RAISE NOTICE '✅ Policy services create';
END $$;

-- 8) CREA POLICY STRICT PER PRODUCTS
-- =====================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS products_select_shop ON public.products;
  CREATE POLICY products_select_shop ON public.products
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS products_insert_shop ON public.products;
  CREATE POLICY products_insert_shop ON public.products
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS products_update_shop ON public.products;
  CREATE POLICY products_update_shop ON public.products
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS products_delete_shop ON public.products;
  CREATE POLICY products_delete_shop ON public.products
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  RAISE NOTICE '✅ Policy products create';
END $$;

-- 9) CREA POLICY STRICT PER APPOINTMENTS
-- =====================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS appointments_select_shop ON public.appointments;
  CREATE POLICY appointments_select_shop ON public.appointments
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS appointments_insert_shop ON public.appointments;
  CREATE POLICY appointments_insert_shop ON public.appointments
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS appointments_update_shop ON public.appointments;
  CREATE POLICY appointments_update_shop ON public.appointments
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS appointments_delete_shop ON public.appointments;
  CREATE POLICY appointments_delete_shop ON public.appointments
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  RAISE NOTICE '✅ Policy appointments create';
END $$;

-- 10) CREA POLICY STRICT PER STAFF
-- =====================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS staff_select_shop ON public.staff;
  CREATE POLICY staff_select_shop ON public.staff
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS staff_insert_shop ON public.staff;
  CREATE POLICY staff_insert_shop ON public.staff
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS staff_update_shop ON public.staff;
  CREATE POLICY staff_update_shop ON public.staff
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS staff_delete_shop ON public.staff;
  CREATE POLICY staff_delete_shop ON public.staff
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  RAISE NOTICE '✅ Policy staff create';
END $$;

-- 11) CREA POLICY STRICT PER CHATS
-- =====================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS chats_select_shop ON public.chats;
  CREATE POLICY chats_select_shop ON public.chats
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS chats_insert_shop ON public.chats;
  CREATE POLICY chats_insert_shop ON public.chats
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS chats_update_shop ON public.chats;
  CREATE POLICY chats_update_shop ON public.chats
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS chats_delete_shop ON public.chats;
  CREATE POLICY chats_delete_shop ON public.chats
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  RAISE NOTICE '✅ Policy chats create';
END $$;

-- 12) CREA POLICY STRICT PER CHAT_MESSAGES
-- =====================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS chat_messages_select_shop ON public.chat_messages;
  CREATE POLICY chat_messages_select_shop ON public.chat_messages
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS chat_messages_insert_shop ON public.chat_messages;
  CREATE POLICY chat_messages_insert_shop ON public.chat_messages
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS chat_messages_update_shop ON public.chat_messages;
  CREATE POLICY chat_messages_update_shop ON public.chat_messages
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS chat_messages_delete_shop ON public.chat_messages;
  CREATE POLICY chat_messages_delete_shop ON public.chat_messages
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  RAISE NOTICE '✅ Policy chat_messages create';
END $$;

-- 13) CREA POLICY STRICT PER WAITLIST
-- =====================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS waitlist_select_shop ON public.waitlist;
  CREATE POLICY waitlist_select_shop ON public.waitlist
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS waitlist_insert_shop ON public.waitlist;
  CREATE POLICY waitlist_insert_shop ON public.waitlist
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS waitlist_update_shop ON public.waitlist;
  CREATE POLICY waitlist_update_shop ON public.waitlist
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS waitlist_delete_shop ON public.waitlist;
  CREATE POLICY waitlist_delete_shop ON public.waitlist
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  RAISE NOTICE '✅ Policy waitlist create';
END $$;

-- 14) CREA POLICY STRICT PER NOTIFICATIONS
-- =====================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS notifications_select_shop ON public.notifications;
  CREATE POLICY notifications_select_shop ON public.notifications
    FOR SELECT 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS notifications_insert_shop ON public.notifications;
  CREATE POLICY notifications_insert_shop ON public.notifications
    FOR INSERT 
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS notifications_update_shop ON public.notifications;
  CREATE POLICY notifications_update_shop ON public.notifications
    FOR UPDATE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    )
    WITH CHECK (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  DROP POLICY IF EXISTS notifications_delete_shop ON public.notifications;
  CREATE POLICY notifications_delete_shop ON public.notifications
    FOR DELETE 
    USING (
      auth.role() = 'service_role' 
      OR shop_id = public.current_shop_id() 
      OR public.is_platform_admin()
    );
  
  RAISE NOTICE '✅ Policy notifications create';
END $$;

-- 15) VERIFICA FINALE
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
  v_rls_tables INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== 4. VERIFICA FINALE ===';
  
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('shops', 'clients', 'services', 'products', 'appointments', 'staff', 'chats', 'chat_messages', 'waitlist', 'notifications');
  
  SELECT COUNT(*) INTO v_rls_tables
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname IN ('shops', 'clients', 'services', 'products', 'appointments', 'staff', 'chats', 'chat_messages', 'waitlist', 'notifications')
    AND c.relrowsecurity = true;
  
  RAISE NOTICE 'Tabelle con RLS abilitato: %/10', v_rls_tables;
  RAISE NOTICE 'Policies create: %', v_policy_count;
  
  IF v_rls_tables = 10 AND v_policy_count >= 40 THEN
    RAISE NOTICE '✅ Tutto configurato correttamente!';
  ELSE
    RAISE WARNING '⚠️ Qualcosa non va: RLS=% Policies=%', v_rls_tables, v_policy_count;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Logout completo';
  RAISE NOTICE '2. Pulisci localStorage (current_shop_id, current_shop_slug, auth_token)';
  RAISE NOTICE '3. Rientra con ?shop=abruzzo-barber';
  RAISE NOTICE '4. Verifica che vedi solo i dati del tuo negozio';
  RAISE NOTICE '';
END $$;

