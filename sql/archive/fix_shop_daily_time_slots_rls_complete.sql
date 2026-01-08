-- =====================================================
-- FIX COMPLETO: RLS Policies per shop_daily_time_slots
-- =====================================================
-- Questo script assicura che le RLS policies permettano
-- correttamente l'inserimento, aggiornamento e eliminazione
-- dei time slots per utenti autenticati
-- =====================================================

-- 1) RIMUOVI TUTTE LE POLICY ESISTENTI
-- =====================================================
DROP POLICY IF EXISTS "shop_daily_time_slots_modify" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "shop_daily_time_slots_select" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.shop_daily_time_slots;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.shop_daily_time_slots;

-- 2) CREA POLICY PER SELECT (lettura pubblica per calendario clienti)
-- =====================================================
CREATE POLICY "shop_daily_time_slots_select"
ON public.shop_daily_time_slots
FOR SELECT
USING (true);

-- 3) CREA POLICY PER INSERT (utenti autenticati)
-- =====================================================
CREATE POLICY "shop_daily_time_slots_insert"
ON public.shop_daily_time_slots
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 4) CREA POLICY PER UPDATE (utenti autenticati)
-- =====================================================
CREATE POLICY "shop_daily_time_slots_update"
ON public.shop_daily_time_slots
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 5) CREA POLICY PER DELETE (utenti autenticati)
-- =====================================================
CREATE POLICY "shop_daily_time_slots_delete"
ON public.shop_daily_time_slots
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- 6) VERIFICA CHE LE POLICY SIANO STATE CREATE
-- =====================================================
DO $$
DECLARE
  v_select_count INTEGER;
  v_insert_count INTEGER;
  v_update_count INTEGER;
  v_delete_count INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA POLICY shop_daily_time_slots ===';
  
  SELECT COUNT(*) INTO v_select_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shop_daily_time_slots'
    AND policyname = 'shop_daily_time_slots_select';
  
  SELECT COUNT(*) INTO v_insert_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shop_daily_time_slots'
    AND policyname = 'shop_daily_time_slots_insert';
  
  SELECT COUNT(*) INTO v_update_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shop_daily_time_slots'
    AND policyname = 'shop_daily_time_slots_update';
  
  SELECT COUNT(*) INTO v_delete_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'shop_daily_time_slots'
    AND policyname = 'shop_daily_time_slots_delete';
  
  IF v_select_count = 1 THEN
    RAISE NOTICE '✅ Policy SELECT creata correttamente';
  ELSE
    RAISE WARNING '⚠️ Policy SELECT non trovata!';
  END IF;
  
  IF v_insert_count = 1 THEN
    RAISE NOTICE '✅ Policy INSERT creata correttamente';
  ELSE
    RAISE WARNING '⚠️ Policy INSERT non trovata!';
  END IF;
  
  IF v_update_count = 1 THEN
    RAISE NOTICE '✅ Policy UPDATE creata correttamente';
  ELSE
    RAISE WARNING '⚠️ Policy UPDATE non trovata!';
  END IF;
  
  IF v_delete_count = 1 THEN
    RAISE NOTICE '✅ Policy DELETE creata correttamente';
  ELSE
    RAISE WARNING '⚠️ Policy DELETE non trovata!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE 'Policy create: SELECT=% | INSERT=% | UPDATE=% | DELETE=%', 
    v_select_count, v_insert_count, v_update_count, v_delete_count;
  RAISE NOTICE '';
END $$;

