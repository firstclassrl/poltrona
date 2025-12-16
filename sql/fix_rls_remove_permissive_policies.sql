-- =====================================================
-- FIX CRITICO: Rimuovere RLS Policies Troppo Permissive
-- =====================================================
-- Questo script rimuove tutte le policy RLS che permettono
-- accesso senza controllo shop_id, causando potenziali crossing tra negozi
-- =====================================================

-- 1) RIMUOVI POLICY TROPPO PERMISSIVE DA appointments
-- =====================================================
DROP POLICY IF EXISTS "Allow authenticated insert on appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.appointments;

-- 2) RIMUOVI POLICY TROPPO PERMISSIVE DA chats
-- =====================================================
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.chats;

-- 3) RIMUOVI POLICY TROPPO PERMISSIVE DA shop_daily_hours
-- =====================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.shop_daily_hours;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.shop_daily_hours;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.shop_daily_hours;
DROP POLICY IF EXISTS "shop_daily_hours_modify" ON public.shop_daily_hours;
DROP POLICY IF EXISTS "shop_daily_hours_select" ON public.shop_daily_hours;

-- 4) RIMUOVI POLICY TROPPO PERMISSIVE DA shop_daily_time_slots
-- =====================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "shop_daily_time_slots_modify" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "shop_daily_time_slots_select" ON public.shop_daily_time_slots;

-- 5) RIMUOVI POLICY TROPPO PERMISSIVE DA services
-- =====================================================
DROP POLICY IF EXISTS "p_services_insert" ON public.services;
DROP POLICY IF EXISTS "services_insert_authed" ON public.services;

-- 6) VERIFICA CHE LE POLICY CORRETTE ESISTANO
-- =====================================================
DO $$
DECLARE
  v_has_correct_policy BOOLEAN;
BEGIN
  RAISE NOTICE '=== VERIFICA POLICY CORRETTE ===';
  
  -- Verifica appointments
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'appointments_insert_shop'
      AND with_check::text LIKE '%shop_id%'
  ) INTO v_has_correct_policy;
  
  IF NOT v_has_correct_policy THEN
    RAISE WARNING '⚠️ appointments: Policy corretta con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ appointments: Policy corretta presente';
  END IF;
  
  -- Verifica chats
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chats'
      AND policyname = 'chats_insert_shop'
      AND with_check::text LIKE '%shop_id%'
  ) INTO v_has_correct_policy;
  
  IF NOT v_has_correct_policy THEN
    RAISE WARNING '⚠️ chats: Policy corretta con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ chats: Policy corretta presente';
  END IF;
  
  -- Verifica shop_daily_hours
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shop_daily_hours'
      AND policyname = 'shop_daily_hours_insert_shop'
      AND with_check::text LIKE '%shop_id%'
  ) INTO v_has_correct_policy;
  
  IF NOT v_has_correct_policy THEN
    RAISE WARNING '⚠️ shop_daily_hours: Policy corretta con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ shop_daily_hours: Policy corretta presente';
  END IF;
  
  -- Verifica services
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'services'
      AND policyname = 'services_insert_shop'
      AND with_check::text LIKE '%shop_id%'
  ) INTO v_has_correct_policy;
  
  IF NOT v_has_correct_policy THEN
    RAISE WARNING '⚠️ services: Policy corretta con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ services: Policy corretta presente';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 7) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Policy troppo permissive rimosse da:';
  RAISE NOTICE '   - appointments (2 policy)';
  RAISE NOTICE '   - chats (1 policy)';
  RAISE NOTICE '   - shop_daily_hours (5 policy)';
  RAISE NOTICE '   - shop_daily_time_slots (6 policy)';
  RAISE NOTICE '   - services (2 policy)';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANTE: Verifica che le policy corrette con shop_id siano attive!';
  RAISE NOTICE '';
END $$;


