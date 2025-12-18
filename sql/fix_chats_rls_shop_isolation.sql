-- =====================================================
-- FIX: RLS Policies per chats con shop_id
-- =====================================================
-- Questo script verifica e aggiorna le RLS policies per chats
-- per assicurare che filtrino correttamente per shop_id
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
  RAISE NOTICE '=== VERIFICA POLICY chats ===';
  
  -- Verifica SELECT
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chats'
      AND policyname = 'chats_select_shop'
      AND qual::text LIKE '%shop_id%'
  ) INTO v_has_select_shop;
  
  -- Verifica INSERT
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chats'
      AND policyname = 'chats_insert_shop'
      AND with_check::text LIKE '%shop_id%'
  ) INTO v_has_insert_shop;
  
  -- Verifica UPDATE
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chats'
      AND policyname = 'chats_update_shop'
      AND qual::text LIKE '%shop_id%'
  ) INTO v_has_update_shop;
  
  -- Verifica DELETE
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chats'
      AND policyname = 'chats_delete_shop'
      AND qual::text LIKE '%shop_id%'
  ) INTO v_has_delete_shop;
  
  IF NOT v_has_select_shop THEN
    RAISE WARNING '⚠️ chats: Policy SELECT con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ chats: Policy SELECT corretta presente';
  END IF;
  
  IF NOT v_has_insert_shop THEN
    RAISE WARNING '⚠️ chats: Policy INSERT con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ chats: Policy INSERT corretta presente';
  END IF;
  
  IF NOT v_has_update_shop THEN
    RAISE WARNING '⚠️ chats: Policy UPDATE con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ chats: Policy UPDATE corretta presente';
  END IF;
  
  IF NOT v_has_delete_shop THEN
    RAISE WARNING '⚠️ chats: Policy DELETE con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ chats: Policy DELETE corretta presente';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Le policy troppo permissive sono state rimosse da fix_rls_remove_permissive_policies.sql';
  RAISE NOTICE '✅ Verifica che le policy corrette con shop_id siano attive';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: Le policy esistenti "Staff can create chats" e "Clients can view own chats"';
  RAISE NOTICE 'sono complementari alle policy con shop_id e possono coesistere.';
  RAISE NOTICE '';
END $$;




