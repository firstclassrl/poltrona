-- =====================================================
-- FIX: Verifica app_settings per isolamento multi-shop
-- =====================================================
-- Questo script verifica se app_settings deve essere per-shop o globale
-- =====================================================

-- 1) VERIFICA STRUTTURA app_settings
-- =====================================================
DO $$
DECLARE
  v_has_shop_id BOOLEAN;
  v_row_count INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA app_settings ===';
  
  -- Verifica se ha colonna shop_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_settings'
      AND column_name = 'shop_id'
  ) INTO v_has_shop_id;
  
  -- Conta record esistenti
  SELECT COUNT(*) INTO v_row_count
  FROM public.app_settings;
  
  RAISE NOTICE 'app_settings ha colonna shop_id: %', v_has_shop_id;
  RAISE NOTICE 'Record esistenti: %', v_row_count;
  
  IF v_has_shop_id THEN
    RAISE NOTICE '✅ app_settings ha shop_id - è già per-shop';
  ELSE
    RAISE NOTICE 'ℹ️ app_settings NON ha shop_id - è globale';
    RAISE NOTICE '';
    RAISE NOTICE 'DECISIONE RICHIESTA:';
    RAISE NOTICE 'Se app_settings contiene impostazioni per-shop (es. temi, configurazioni),';
    RAISE NOTICE 'aggiungere shop_id. Se contiene solo impostazioni di sistema globali,';
    RAISE NOTICE 'mantenere così e verificare che le RLS policies permettano solo a platform admin.';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) VERIFICA RLS POLICIES
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
  v_has_platform_admin_check BOOLEAN;
BEGIN
  RAISE NOTICE '=== VERIFICA RLS app_settings ===';
  
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'app_settings';
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_settings'
      AND (qual::text LIKE '%platform_admin%' OR qual::text LIKE '%is_platform_admin%')
  ) INTO v_has_platform_admin_check;
  
  RAISE NOTICE 'Policy totali: %', v_policy_count;
  RAISE NOTICE 'Policy con controllo platform_admin: %', v_has_platform_admin_check;
  
  IF v_has_platform_admin_check THEN
    RAISE NOTICE '✅ Le policy limitano l''accesso a platform admin';
  ELSE
    RAISE WARNING '⚠️ Le policy potrebbero permettere accesso a utenti non autorizzati!';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 3) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Verifica completata';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Decidere se app_settings deve essere per-shop o globale';
  RAISE NOTICE '2. Se per-shop, eseguire: ALTER TABLE app_settings ADD COLUMN shop_id UUID REFERENCES shops(id);';
  RAISE NOTICE '3. Se globale, verificare che le RLS policies limitino accesso a platform admin';
  RAISE NOTICE '';
END $$;




