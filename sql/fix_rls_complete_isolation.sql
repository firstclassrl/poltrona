-- =====================================================
-- SCRIPT COMPLETO PER ISOLAMENTO DATI MULTI-TENANT
-- =====================================================
-- Questo script verifica e corregge TUTTE le RLS policies
-- per garantire l'isolamento completo tra negozi
-- =====================================================

-- 0) CREA/VERIFICA FUNZIONE current_shop_id()
-- =====================================================
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

COMMENT ON FUNCTION public.current_shop_id() IS 'Restituisce il shop_id dell''utente corrente dal profilo. Usato dalle RLS policies per filtrare i dati per negozio.';

-- 1) VERIFICA PROFILO ADMIN E SHOP_ID
-- =====================================================
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai'; -- MODIFICA QUI L'EMAIL
  v_admin_user_id UUID;
  v_shop_slug TEXT := 'abruzzo-barber'; -- MODIFICA QUI LO SLUG
  v_shop_id UUID;
  v_current_shop_id UUID;
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
  
  -- Verifica shop_id attuale nel profilo
  SELECT shop_id INTO v_current_shop_id FROM public.profiles WHERE user_id = v_admin_user_id;
  
  RAISE NOTICE '=== VERIFICA PROFILO ===';
  RAISE NOTICE 'Email admin: %', v_admin_email;
  RAISE NOTICE 'User ID: %', v_admin_user_id;
  RAISE NOTICE 'Shop slug: %', v_shop_slug;
  RAISE NOTICE 'Shop ID corretto: %', v_shop_id;
  RAISE NOTICE 'Shop ID attuale nel profilo: %', v_current_shop_id;
  
  -- Forza shop_id corretto se diverso
  IF v_current_shop_id IS DISTINCT FROM v_shop_id THEN
    UPDATE public.profiles 
    SET shop_id = v_shop_id, role = 'admin'
    WHERE user_id = v_admin_user_id;
    RAISE NOTICE '✅ Shop ID aggiornato nel profilo';
  ELSE
    RAISE NOTICE '✅ Shop ID già corretto nel profilo';
  END IF;
END $$;

-- 2) VERIFICA E CORREGGE RLS SU SHOPS
-- =====================================================
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- Rimuovi tutte le policy esistenti su shops (tranne platform admin)
DO $$
BEGIN
  -- Rimuovi policy permissive
  DROP POLICY IF EXISTS shops_select_public ON public.shops;
  DROP POLICY IF EXISTS shops_select_all ON public.shops;
  
  -- Mantieni solo platform admin se esiste
  -- (non la rimuoviamo perché serve per il super admin)
END $$;

-- Crea policy strict per shops
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shops' AND policyname='shops_select_shop') THEN
    CREATE POLICY shops_select_shop ON public.shops
      FOR SELECT 
      USING (
        id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shops' AND policyname='shops_insert_shop') THEN
    CREATE POLICY shops_insert_shop ON public.shops
      FOR INSERT 
      WITH CHECK (
        public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shops' AND policyname='shops_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shops' AND policyname='shops_delete_shop') THEN
    CREATE POLICY shops_delete_shop ON public.shops
      FOR DELETE 
      USING (
        public.is_platform_admin()
      );
  END IF;
END $$;

-- 3) VERIFICA E CORREGGE RLS SU CLIENTS
-- =====================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='clients_select_shop') THEN
    CREATE POLICY clients_select_shop ON public.clients
      FOR SELECT 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='clients_insert_shop') THEN
    CREATE POLICY clients_insert_shop ON public.clients
      FOR INSERT 
      WITH CHECK (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='clients_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='clients_delete_shop') THEN
    CREATE POLICY clients_delete_shop ON public.clients
      FOR DELETE 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

-- 4) VERIFICA E CORREGGE RLS SU SERVICES
-- =====================================================
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='services_select_shop') THEN
    CREATE POLICY services_select_shop ON public.services
      FOR SELECT 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='services_insert_shop') THEN
    CREATE POLICY services_insert_shop ON public.services
      FOR INSERT 
      WITH CHECK (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='services_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='services_delete_shop') THEN
    CREATE POLICY services_delete_shop ON public.services
      FOR DELETE 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

-- 5) VERIFICA E CORREGGE RLS SU PRODUCTS
-- =====================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='products_select_shop') THEN
    CREATE POLICY products_select_shop ON public.products
      FOR SELECT 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='products_insert_shop') THEN
    CREATE POLICY products_insert_shop ON public.products
      FOR INSERT 
      WITH CHECK (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='products_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='products_delete_shop') THEN
    CREATE POLICY products_delete_shop ON public.products
      FOR DELETE 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

-- 6) VERIFICA E CORREGGE RLS SU APPOINTMENTS
-- =====================================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_select_shop') THEN
    CREATE POLICY appointments_select_shop ON public.appointments
      FOR SELECT 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_insert_shop') THEN
    CREATE POLICY appointments_insert_shop ON public.appointments
      FOR INSERT 
      WITH CHECK (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appointments' AND policyname='appointments_delete_shop') THEN
    CREATE POLICY appointments_delete_shop ON public.appointments
      FOR DELETE 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

-- 7) VERIFICA E CORREGGE RLS SU STAFF
-- =====================================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='staff_select_shop') THEN
    CREATE POLICY staff_select_shop ON public.staff
      FOR SELECT 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='staff_insert_shop') THEN
    CREATE POLICY staff_insert_shop ON public.staff
      FOR INSERT 
      WITH CHECK (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='staff_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff' AND policyname='staff_delete_shop') THEN
    CREATE POLICY staff_delete_shop ON public.staff
      FOR DELETE 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

-- 8) VERIFICA E CORREGGE RLS SU CHATS E CHAT_MESSAGES
-- =====================================================
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chats' AND policyname='chats_select_shop') THEN
    CREATE POLICY chats_select_shop ON public.chats
      FOR SELECT 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chats' AND policyname='chats_insert_shop') THEN
    CREATE POLICY chats_insert_shop ON public.chats
      FOR INSERT 
      WITH CHECK (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chats' AND policyname='chats_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chats' AND policyname='chats_delete_shop') THEN
    CREATE POLICY chats_delete_shop ON public.chats
      FOR DELETE 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='chat_messages_select_shop') THEN
    CREATE POLICY chat_messages_select_shop ON public.chat_messages
      FOR SELECT 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='chat_messages_insert_shop') THEN
    CREATE POLICY chat_messages_insert_shop ON public.chat_messages
      FOR INSERT 
      WITH CHECK (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='chat_messages_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chat_messages' AND policyname='chat_messages_delete_shop') THEN
    CREATE POLICY chat_messages_delete_shop ON public.chat_messages
      FOR DELETE 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

-- 9) VERIFICA E CORREGGE RLS SU WAITLIST
-- =====================================================
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waitlist' AND policyname='waitlist_select_shop') THEN
    CREATE POLICY waitlist_select_shop ON public.waitlist
      FOR SELECT 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waitlist' AND policyname='waitlist_insert_shop') THEN
    CREATE POLICY waitlist_insert_shop ON public.waitlist
      FOR INSERT 
      WITH CHECK (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waitlist' AND policyname='waitlist_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waitlist' AND policyname='waitlist_delete_shop') THEN
    CREATE POLICY waitlist_delete_shop ON public.waitlist
      FOR DELETE 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

-- 10) VERIFICA E CORREGGE RLS SU NOTIFICATIONS
-- =====================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_select_shop') THEN
    CREATE POLICY notifications_select_shop ON public.notifications
      FOR SELECT 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_insert_shop') THEN
    CREATE POLICY notifications_insert_shop ON public.notifications
      FOR INSERT 
      WITH CHECK (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_update_shop') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications_delete_shop') THEN
    CREATE POLICY notifications_delete_shop ON public.notifications
      FOR DELETE 
      USING (
        auth.role() = 'service_role' 
        OR shop_id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

-- 11) VERIFICA FINALE
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA FINALE RLS POLICIES ===';
  
  SELECT COUNT(*) INTO v_policy_count 
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename IN ('shops', 'clients', 'services', 'products', 'appointments', 'staff', 'chats', 'chat_messages', 'waitlist', 'notifications');
  
  RAISE NOTICE 'Totale policies attive: %', v_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Script completato!';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Logout completo dall''applicazione';
  RAISE NOTICE '2. Pulisci localStorage (current_shop_id, current_shop_slug)';
  RAISE NOTICE '3. Rientra con ?shop=abruzzo-barber usando l''account admin';
  RAISE NOTICE '4. Verifica che vedi solo i dati del nuovo negozio';
END $$;
