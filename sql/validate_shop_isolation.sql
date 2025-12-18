-- =====================================================
-- SCRIPT DI VALIDAZIONE COMPLETA ISOLAMENTO MULTI-SHOP
-- =====================================================
-- Questo script verifica che non ci siano crossing tra negozi
-- Esegui questo script periodicamente per monitorare l'isolamento
-- =====================================================

-- 1) VERIFICA RECORD SENZA shop_id
-- =====================================================
DO $$
DECLARE
  v_appointments_without_shop_id INTEGER;
  v_clients_without_shop_id INTEGER;
  v_staff_without_shop_id INTEGER;
  v_services_without_shop_id INTEGER;
  v_products_without_shop_id INTEGER;
  v_chats_without_shop_id INTEGER;
  v_chat_messages_without_shop_id INTEGER;
  v_notifications_without_shop_id INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA RECORD SENZA shop_id ===';
  RAISE NOTICE '';
  
  SELECT COUNT(*) INTO v_appointments_without_shop_id
  FROM public.appointments WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_clients_without_shop_id
  FROM public.clients WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_staff_without_shop_id
  FROM public.staff WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_services_without_shop_id
  FROM public.services WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_products_without_shop_id
  FROM public.products WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_chats_without_shop_id
  FROM public.chats WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_chat_messages_without_shop_id
  FROM public.chat_messages WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_notifications_without_shop_id
  FROM public.notifications WHERE shop_id IS NULL;
  
  RAISE NOTICE 'Appointments senza shop_id: %', v_appointments_without_shop_id;
  RAISE NOTICE 'Clients senza shop_id: %', v_clients_without_shop_id;
  RAISE NOTICE 'Staff senza shop_id: %', v_staff_without_shop_id;
  RAISE NOTICE 'Services senza shop_id: %', v_services_without_shop_id;
  RAISE NOTICE 'Products senza shop_id: %', v_products_without_shop_id;
  RAISE NOTICE 'Chats senza shop_id: %', v_chats_without_shop_id;
  RAISE NOTICE 'Chat messages senza shop_id: %', v_chat_messages_without_shop_id;
  RAISE NOTICE 'Notifications senza shop_id: %', v_notifications_without_shop_id;
  
  IF v_appointments_without_shop_id > 0 OR
     v_clients_without_shop_id > 0 OR
     v_staff_without_shop_id > 0 OR
     v_services_without_shop_id > 0 OR
     v_products_without_shop_id > 0 OR
     v_chats_without_shop_id > 0 OR
     v_chat_messages_without_shop_id > 0 OR
     v_notifications_without_shop_id > 0 THEN
    RAISE WARNING '⚠️ Ci sono record senza shop_id!';
  ELSE
    RAISE NOTICE '✅ Tutti i record hanno shop_id assegnato';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) VERIFICA INCONSISTENZE CROSS-REFERENCE
-- =====================================================
DO $$
DECLARE
  v_inconsistent_appointments INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA INCONSISTENZE CROSS-REFERENCE ===';
  RAISE NOTICE '';
  
  -- Appointments con riferimenti a shop diversi
  SELECT COUNT(*) INTO v_inconsistent_appointments
  FROM public.appointments a
  WHERE a.shop_id IS NOT NULL
    AND (
      -- Client appartiene a shop diverso
      (a.client_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = a.client_id
          AND c.shop_id IS NOT NULL
          AND c.shop_id != a.shop_id
      ))
      OR
      -- Staff appartiene a shop diverso
      (a.staff_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = a.staff_id
          AND s.shop_id IS NOT NULL
          AND s.shop_id != a.shop_id
      ))
      OR
      -- Service appartiene a shop diverso
      (a.service_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.services sv
        WHERE sv.id = a.service_id
          AND sv.shop_id IS NOT NULL
          AND sv.shop_id != a.shop_id
      ))
    );
  
  IF v_inconsistent_appointments > 0 THEN
    RAISE WARNING '⚠️ Trovati % appointments con riferimenti a shop diversi!', v_inconsistent_appointments;
  ELSE
    RAISE NOTICE '✅ Nessuna inconsistenza cross-reference trovata';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 3) VERIFICA RLS POLICIES
-- =====================================================
DO $$
DECLARE
  v_tables_without_shop_rls TEXT[];
  v_table_name TEXT;
BEGIN
  RAISE NOTICE '=== VERIFICA RLS POLICIES ===';
  RAISE NOTICE '';
  
  -- Verifica che tutte le tabelle principali abbiano policy con shop_id
  FOR v_table_name IN 
    SELECT unnest(ARRAY['appointments', 'clients', 'staff', 'services', 'products', 'chats', 'chat_messages', 'notifications'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table_name
        AND (qual::text LIKE '%shop_id%' OR qual::text LIKE '%current_shop_id%' 
             OR with_check::text LIKE '%shop_id%' OR with_check::text LIKE '%current_shop_id%')
    ) THEN
      v_tables_without_shop_rls := array_append(v_tables_without_shop_rls, v_table_name);
    END IF;
  END LOOP;
  
  IF array_length(v_tables_without_shop_rls, 1) > 0 THEN
    RAISE WARNING '⚠️ Tabelle senza RLS policy con shop_id: %', array_to_string(v_tables_without_shop_rls, ', ');
  ELSE
    RAISE NOTICE '✅ Tutte le tabelle hanno RLS policies con shop_id';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 4) VERIFICA TRIGGER AUTO-ASSIGN
-- =====================================================
DO $$
DECLARE
  v_missing_triggers TEXT[];
BEGIN
  RAISE NOTICE '=== VERIFICA TRIGGER AUTO-ASSIGN shop_id ===';
  RAISE NOTICE '';
  
  -- Verifica trigger per appointments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'appointments'
      AND trigger_name = 'trigger_auto_assign_shop_id_to_appointment'
  ) THEN
    v_missing_triggers := array_append(v_missing_triggers, 'appointments');
  END IF;
  
  -- Verifica trigger per chats
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'chats'
      AND trigger_name = 'trigger_auto_assign_shop_id_to_chat'
  ) THEN
    v_missing_triggers := array_append(v_missing_triggers, 'chats');
  END IF;
  
  -- Verifica trigger per chat_messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'chat_messages'
      AND trigger_name = 'trigger_auto_assign_shop_id_to_chat_message'
  ) THEN
    v_missing_triggers := array_append(v_missing_triggers, 'chat_messages');
  END IF;
  
  IF array_length(v_missing_triggers, 1) > 0 THEN
    RAISE WARNING '⚠️ Tabelle senza trigger auto-assign shop_id: %', array_to_string(v_missing_triggers, ', ');
  ELSE
    RAISE NOTICE '✅ Tutti i trigger auto-assign shop_id sono presenti';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 5) VERIFICA DISTRIBUZIONE DATI PER SHOP
-- =====================================================
DO $$
DECLARE
  v_shop_record RECORD;
BEGIN
  RAISE NOTICE '=== DISTRIBUZIONE DATI PER SHOP ===';
  RAISE NOTICE '';
  
  FOR v_shop_record IN
    SELECT 
      s.id,
      s.name,
      (SELECT COUNT(*) FROM public.appointments WHERE shop_id = s.id) as appointments_count,
      (SELECT COUNT(*) FROM public.clients WHERE shop_id = s.id) as clients_count,
      (SELECT COUNT(*) FROM public.staff WHERE shop_id = s.id) as staff_count,
      (SELECT COUNT(*) FROM public.services WHERE shop_id = s.id) as services_count,
      (SELECT COUNT(*) FROM public.products WHERE shop_id = s.id) as products_count,
      (SELECT COUNT(*) FROM public.chats WHERE shop_id = s.id) as chats_count,
      (SELECT COUNT(*) FROM public.chat_messages WHERE shop_id = s.id) as messages_count,
      (SELECT COUNT(*) FROM public.notifications WHERE shop_id = s.id) as notifications_count
    FROM public.shops s
    ORDER BY s.name
  LOOP
    RAISE NOTICE 'Shop: % (%)', v_shop_record.name, v_shop_record.id;
    RAISE NOTICE '  - Appointments: %', v_shop_record.appointments_count;
    RAISE NOTICE '  - Clients: %', v_shop_record.clients_count;
    RAISE NOTICE '  - Staff: %', v_shop_record.staff_count;
    RAISE NOTICE '  - Services: %', v_shop_record.services_count;
    RAISE NOTICE '  - Products: %', v_shop_record.products_count;
    RAISE NOTICE '  - Chats: %', v_shop_record.chats_count;
    RAISE NOTICE '  - Messages: %', v_shop_record.messages_count;
    RAISE NOTICE '  - Notifications: %', v_shop_record.notifications_count;
    RAISE NOTICE '';
  END LOOP;
END $$;

-- 6) RIEPILOGO FINALE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO VALIDAZIONE ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Validazione completata';
  RAISE NOTICE '';
  RAISE NOTICE 'Se sono stati trovati problemi, eseguire gli script di fix corrispondenti:';
  RAISE NOTICE '- fix_chats_triggers_shop_id.sql';
  RAISE NOTICE '- fix_chat_messages_triggers_shop_id.sql';
  RAISE NOTICE '- fix_rls_remove_permissive_policies.sql';
  RAISE NOTICE '- fix_notifications_rls_shop_isolation.sql';
  RAISE NOTICE '- validate_shop_consistency.sql';
  RAISE NOTICE '';
END $$;





