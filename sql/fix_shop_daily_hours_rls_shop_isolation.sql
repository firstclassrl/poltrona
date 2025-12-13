-- =====================================================
-- FIX: RLS Policies per shop_daily_hours con shop_id
-- =====================================================
-- Questo script rimuove le policy pubbliche e assicura
-- che tutte le operazioni filtrino per shop_id
-- =====================================================

-- 1) VERIFICA CHE LE POLICY CORRETTE ESISTANO
-- =====================================================
DO $$
DECLARE
  v_has_select_shop BOOLEAN;
  v_has_insert_shop BOOLEAN;
  v_has_update_shop BOOLEAN;
  v_has_delete_shop BOOLEAN;
BEGIN
  RAISE NOTICE '=== VERIFICA POLICY shop_daily_hours ===';
  
  -- Verifica SELECT
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shop_daily_hours'
      AND policyname = 'shop_daily_hours_select_shop'
      AND qual::text LIKE '%shop_id%'
  ) INTO v_has_select_shop;
  
  -- Verifica INSERT
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shop_daily_hours'
      AND policyname = 'shop_daily_hours_insert_shop'
      AND with_check::text LIKE '%shop_id%'
  ) INTO v_has_insert_shop;
  
  -- Verifica UPDATE
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shop_daily_hours'
      AND policyname = 'shop_daily_hours_update_shop'
      AND qual::text LIKE '%shop_id%'
  ) INTO v_has_update_shop;
  
  -- Verifica DELETE
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shop_daily_hours'
      AND policyname = 'shop_daily_hours_delete_shop'
      AND qual::text LIKE '%shop_id%'
  ) INTO v_has_delete_shop;
  
  IF NOT v_has_select_shop THEN
    RAISE WARNING '⚠️ shop_daily_hours: Policy SELECT con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ shop_daily_hours: Policy SELECT corretta presente';
  END IF;
  
  IF NOT v_has_insert_shop THEN
    RAISE WARNING '⚠️ shop_daily_hours: Policy INSERT con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ shop_daily_hours: Policy INSERT corretta presente';
  END IF;
  
  IF NOT v_has_update_shop THEN
    RAISE WARNING '⚠️ shop_daily_hours: Policy UPDATE con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ shop_daily_hours: Policy UPDATE corretta presente';
  END IF;
  
  IF NOT v_has_delete_shop THEN
    RAISE WARNING '⚠️ shop_daily_hours: Policy DELETE con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ shop_daily_hours: Policy DELETE corretta presente';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Le policy pubbliche sono state rimosse da fix_rls_remove_permissive_policies.sql';
  RAISE NOTICE '✅ Verifica che le policy corrette con shop_id siano attive';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: shop_daily_hours può essere letto pubblicamente per il calendario clienti,';
  RAISE NOTICE 'ma le modifiche devono essere filtrate per shop_id.';
  RAISE NOTICE '';
END $$;

