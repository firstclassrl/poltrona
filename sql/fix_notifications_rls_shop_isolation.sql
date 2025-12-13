-- =====================================================
-- FIX CRITICO: RLS Policies per notifications con shop_id
-- =====================================================
-- Questo script aggiorna le RLS policies per notifications
-- per includere il controllo shop_id = current_shop_id()
-- =====================================================

-- 1) RIMUOVI POLICY ESISTENTI PER notifications
-- =====================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- 2) CREA POLICY SELECT CON CONTROLLO shop_id
-- =====================================================
CREATE POLICY "Users can view own notifications with shop_id" ON public.notifications
    FOR SELECT
    USING (
        -- L'utente può vedere le notifiche dove è il destinatario (user_id)
        -- E appartengono al suo shop (shop_id = current_shop_id())
        (
          user_id = auth.uid()
          AND (
            shop_id = current_shop_id()
            OR shop_id IS NULL  -- Permetti notifiche senza shop_id per retrocompatibilità temporanea
          )
        )
        OR
        -- Service role può vedere tutto
        auth.role() = 'service_role'
        OR
        -- Platform admin può vedere tutto
        is_platform_admin()
    );

-- 3) CREA POLICY UPDATE CON CONTROLLO shop_id
-- =====================================================
CREATE POLICY "Users can update own notifications with shop_id" ON public.notifications
    FOR UPDATE
    USING (
        -- L'utente può aggiornare solo le proprie notifiche
        -- E appartengono al suo shop (shop_id = current_shop_id())
        (
          user_id = auth.uid()
          AND (
            shop_id = current_shop_id()
            OR shop_id IS NULL  -- Permetti notifiche senza shop_id per retrocompatibilità temporanea
          )
        )
        OR auth.role() = 'service_role'
        OR is_platform_admin()
    )
    WITH CHECK (
        (
          user_id = auth.uid()
          AND (
            shop_id = current_shop_id()
            OR shop_id IS NULL  -- Permetti notifiche senza shop_id per retrocompatibilità temporanea
          )
        )
        OR auth.role() = 'service_role'
        OR is_platform_admin()
    );

-- 4) CREA POLICY DELETE CON CONTROLLO shop_id
-- =====================================================
CREATE POLICY "Users can delete own notifications with shop_id" ON public.notifications
    FOR DELETE
    USING (
        -- L'utente può eliminare solo le proprie notifiche
        -- E appartengono al suo shop (shop_id = current_shop_id())
        (
          user_id = auth.uid()
          AND (
            shop_id = current_shop_id()
            OR shop_id IS NULL  -- Permetti notifiche senza shop_id per retrocompatibilità temporanea
          )
        )
        OR auth.role() = 'service_role'
        OR is_platform_admin()
    );

-- 5) VERIFICA CHE LE POLICY ESISTANO
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA POLICY NOTIFICATIONS ===';
  
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'notifications'
    AND policyname LIKE '%shop_id%';
  
  RAISE NOTICE 'Policy con shop_id: %', v_policy_count;
  
  IF v_policy_count < 3 THEN
    RAISE WARNING '⚠️ Manca almeno una policy con shop_id!';
  ELSE
    RAISE NOTICE '✅ Tutte le policy con shop_id sono presenti';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 6) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Policy notifications aggiornate:';
  RAISE NOTICE '   - SELECT: include controllo shop_id = current_shop_id()';
  RAISE NOTICE '   - UPDATE: include controllo shop_id = current_shop_id()';
  RAISE NOTICE '   - DELETE: include controllo shop_id = current_shop_id()';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: Le policy permettono temporaneamente shop_id IS NULL per retrocompatibilità.';
  RAISE NOTICE 'Dopo aver aggiornato tutti i record esistenti, rimuovere questa condizione.';
  RAISE NOTICE '';
END $$;

