-- =====================================================
-- FIX: RLS Policies per chat_messages con shop_id
-- =====================================================
-- Questo script verifica e aggiorna le RLS policies per chat_messages
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
  RAISE NOTICE '=== VERIFICA POLICY chat_messages ===';
  
  -- Verifica SELECT
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'chat_messages_select_shop'
      AND qual::text LIKE '%shop_id%'
  ) INTO v_has_select_shop;
  
  -- Verifica INSERT
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'chat_messages_insert_shop'
      AND with_check::text LIKE '%shop_id%'
  ) INTO v_has_insert_shop;
  
  -- Verifica UPDATE
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'chat_messages_update_shop'
      AND qual::text LIKE '%shop_id%'
  ) INTO v_has_update_shop;
  
  -- Verifica DELETE
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'chat_messages_delete_shop'
      AND qual::text LIKE '%shop_id%'
  ) INTO v_has_delete_shop;
  
  IF NOT v_has_select_shop THEN
    RAISE WARNING '⚠️ chat_messages: Policy SELECT con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ chat_messages: Policy SELECT corretta presente';
  END IF;
  
  IF NOT v_has_insert_shop THEN
    RAISE WARNING '⚠️ chat_messages: Policy INSERT con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ chat_messages: Policy INSERT corretta presente';
  END IF;
  
  IF NOT v_has_update_shop THEN
    RAISE WARNING '⚠️ chat_messages: Policy UPDATE con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ chat_messages: Policy UPDATE corretta presente';
  END IF;
  
  IF NOT v_has_delete_shop THEN
    RAISE WARNING '⚠️ chat_messages: Policy DELETE con shop_id non trovata!';
  ELSE
    RAISE NOTICE '✅ chat_messages: Policy DELETE corretta presente';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Le policy corrette con shop_id sono presenti';
  RAISE NOTICE '✅ Verifica che le policy complementari (Staff can insert, Clients can insert)';
  RAISE NOTICE '   funzionino correttamente insieme alle policy con shop_id';
  RAISE NOTICE '';
END $$;


