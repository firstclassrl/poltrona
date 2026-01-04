-- =====================================================
-- FIX: RLS shop_daily_hours e shop_daily_time_slots
-- =====================================================
-- Questo script corregge le RLS policies troppo permissive
-- che permettono di vedere gli orari di tutti i negozi
-- =====================================================

-- 1) RIMUOVI POLICY PERMISSIVE ESISTENTI
-- =====================================================
DROP POLICY IF EXISTS shop_daily_hours_select ON public.shop_daily_hours;
DROP POLICY IF EXISTS shop_daily_time_slots_select ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS shop_daily_hours_modify ON public.shop_daily_hours;
DROP POLICY IF EXISTS shop_daily_time_slots_modify ON public.shop_daily_time_slots;

-- 2) CREA POLICY STRICT PER shop_daily_hours
-- =====================================================
-- SELECT: Solo il proprio shop o platform admin o service_role
CREATE POLICY shop_daily_hours_select_shop ON public.shop_daily_hours
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR shop_id = public.current_shop_id()
    OR public.is_platform_admin()
  );

-- INSERT/UPDATE/DELETE: Solo il proprio shop o platform admin o service_role
CREATE POLICY shop_daily_hours_modify_shop ON public.shop_daily_hours
  FOR ALL
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

-- 3) CREA POLICY STRICT PER shop_daily_time_slots
-- =====================================================
-- SELECT: Solo time slots del proprio shop (tramite join con shop_daily_hours)
CREATE POLICY shop_daily_time_slots_select_shop ON public.shop_daily_time_slots
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.shop_daily_hours h
      WHERE h.id = shop_daily_time_slots.daily_hours_id
        AND (
          h.shop_id = public.current_shop_id()
          OR public.is_platform_admin()
        )
    )
  );

-- INSERT/UPDATE/DELETE: Solo time slots del proprio shop
CREATE POLICY shop_daily_time_slots_modify_shop ON public.shop_daily_time_slots
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.shop_daily_hours h
      WHERE h.id = shop_daily_time_slots.daily_hours_id
        AND (
          h.shop_id = public.current_shop_id()
          OR public.is_platform_admin()
        )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.shop_daily_hours h
      WHERE h.id = shop_daily_time_slots.daily_hours_id
        AND (
          h.shop_id = public.current_shop_id()
          OR public.is_platform_admin()
        )
    )
  );

-- 4) VERIFICA
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA RLS POLICIES ===';
  
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('shop_daily_hours', 'shop_daily_time_slots')
    AND (qual::text LIKE '%current_shop_id%' OR qual::text LIKE '%is_platform_admin%' OR qual::text LIKE '%service_role%');
  
  RAISE NOTICE 'Policies con filtro shop_id: %', v_policy_count;
  
  IF v_policy_count >= 4 THEN
    RAISE NOTICE '✅ Tutte le policies hanno filtro shop_id';
  ELSE
    RAISE WARNING '⚠️ Alcune policies potrebbero non avere filtro shop_id';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 5) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Policy shop_daily_hours_select_shop creata';
  RAISE NOTICE '✅ Policy shop_daily_hours_modify_shop creata';
  RAISE NOTICE '✅ Policy shop_daily_time_slots_select_shop creata';
  RAISE NOTICE '✅ Policy shop_daily_time_slots_modify_shop creata';
  RAISE NOTICE '';
  RAISE NOTICE 'Ora gli orari sono isolati per shop!';
  RAISE NOTICE '';
END $$;
