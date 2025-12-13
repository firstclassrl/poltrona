-- =====================================================
-- FIX: RLS Policies per shop_daily_time_slots con shop_id
-- =====================================================
-- Questo script verifica che le policy corrette esistano
-- (le policy pubbliche sono già state rimosse)
-- =====================================================

-- 1) NOTA: shop_daily_time_slots non ha shop_id diretto
-- =====================================================
-- La tabella shop_daily_time_slots ha solo daily_hours_id,
-- che a sua volta ha shop_id. Le RLS policies devono filtrare
-- attraverso la relazione con shop_daily_hours.

-- 2) VERIFICA STRUTTURA
-- =====================================================
DO $$
DECLARE
  v_has_shop_id_column BOOLEAN;
BEGIN
  RAISE NOTICE '=== VERIFICA STRUTTURA shop_daily_time_slots ===';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shop_daily_time_slots'
      AND column_name = 'shop_id'
  ) INTO v_has_shop_id_column;
  
  IF v_has_shop_id_column THEN
    RAISE NOTICE '✅ shop_daily_time_slots ha colonna shop_id';
  ELSE
    RAISE NOTICE 'ℹ️ shop_daily_time_slots non ha colonna shop_id diretta';
    RAISE NOTICE '   Le RLS policies devono filtrare tramite shop_daily_hours.shop_id';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 3) VERIFICA CHE LE POLICY PUBBLICHE SIANO STATE RIMOSSE
-- =====================================================
DO $$
DECLARE
  v_public_policy_count INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA RIMOZIONE POLICY PUBBLICHE ===';
  
  SELECT COUNT(*) INTO v_public_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shop_daily_time_slots'
    AND (
      policyname LIKE '%all users%'
      OR policyname LIKE '%authenticated users%'
      OR qual::text = 'true'
      OR with_check::text = 'true'
    );
  
  IF v_public_policy_count > 0 THEN
    RAISE WARNING '⚠️ Ci sono ancora % policy pubbliche su shop_daily_time_slots!', v_public_policy_count;
  ELSE
    RAISE NOTICE '✅ Tutte le policy pubbliche sono state rimosse';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 4) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Le policy pubbliche sono state rimosse da fix_rls_remove_permissive_policies.sql';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: shop_daily_time_slots può essere letto pubblicamente per il calendario clienti,';
  RAISE NOTICE 'ma le modifiche devono essere filtrate per shop_id tramite shop_daily_hours.';
  RAISE NOTICE '';
  RAISE NOTICE 'Se necessario, aggiungere policy che filtrano tramite JOIN con shop_daily_hours.';
  RAISE NOTICE '';
END $$;

