-- =====================================================
-- FIX: RLS POLICY PER LETTURA PUBBLICA shops
-- =====================================================
-- Questo script garantisce che i negozi possano essere
-- letti pubblicamente per slug (necessario per login e setup)
-- =====================================================

-- 1) VERIFICA STRUTTURA TABELLA
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== VERIFICA STRUTTURA TABELLA ===';
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'shops'
  ) THEN
    RAISE EXCEPTION 'Tabella shops non esiste!';
  END IF;
  
  RAISE NOTICE '✅ Tabella shops esiste';
END $$;

-- 2) RIMUOVI POLICY ESISTENTI (per ricrearle)
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIMOZIONE POLICY ESISTENTI ===';
  
  -- Rimuovi tutte le policy esistenti
  DROP POLICY IF EXISTS "Enable all operations for shops" ON public.shops;
  DROP POLICY IF EXISTS shops_select_public ON public.shops;
  DROP POLICY IF EXISTS shops_select_authenticated ON public.shops;
  DROP POLICY IF EXISTS shops_insert_admin ON public.shops;
  DROP POLICY IF EXISTS shops_update_admin ON public.shops;
  DROP POLICY IF EXISTS shops_delete_admin ON public.shops;
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.shops;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.shops;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.shops;
  DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.shops;
  
  RAISE NOTICE '✅ Policy esistenti rimosse';
END $$;

-- 3) ABILITA RLS
-- =====================================================
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- 4) CREA POLICY PER LETTURA PUBBLICA (PER SLUG)
-- =====================================================
-- IMPORTANTE: Questa policy permette a CHIUNQUE di leggere i negozi
-- per slug (necessario per login page e setup)
CREATE POLICY shops_select_public ON public.shops
  FOR SELECT
  USING (true);  -- Permetti lettura a tutti (anon e authenticated)

COMMENT ON POLICY shops_select_public ON public.shops IS 
  'Permette lettura pubblica dei negozi per slug (necessario per login e setup)';

-- 5) CREA POLICY PER INSERIMENTO (SOLO ADMIN/PLATFORM ADMIN)
-- =====================================================
CREATE POLICY shops_insert_admin ON public.shops
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND (p.role IN ('admin', 'owner', 'manager') OR p.is_platform_admin = true)
    )
  );

COMMENT ON POLICY shops_insert_admin ON public.shops IS 
  'Permette inserimento negozi solo a admin, manager, owner o platform admin';

-- 6) CREA POLICY PER AGGIORNAMENTO (SOLO ADMIN DEL NEGOZIO O PLATFORM ADMIN)
-- =====================================================
CREATE POLICY shops_update_admin ON public.shops
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND (
        (p.role IN ('admin', 'owner', 'manager') AND p.shop_id = shops.id)
        OR p.is_platform_admin = true
      )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND (
        (p.role IN ('admin', 'owner', 'manager') AND p.shop_id = shops.id)
        OR p.is_platform_admin = true
      )
    )
  );

COMMENT ON POLICY shops_update_admin ON public.shops IS 
  'Permette aggiornamento negozi solo all''admin del negozio o platform admin';

-- 7) CREA POLICY PER ELIMINAZIONE (SOLO PLATFORM ADMIN)
-- =====================================================
CREATE POLICY shops_delete_platform_admin ON public.shops
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND p.is_platform_admin = true
    )
  );

COMMENT ON POLICY shops_delete_platform_admin ON public.shops IS 
  'Permette eliminazione negozi solo a platform admin';

-- 8) VERIFICA INDICI
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_shops_slug ON public.shops(slug);
CREATE INDEX IF NOT EXISTS idx_shops_id ON public.shops(id);

-- 9) TEST LETTURA PUBBLICA
-- =====================================================
DO $$
DECLARE
  v_test_slug TEXT := 'retro-barbershop';
  v_test_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST LETTURA PUBBLICA ===';
  
  -- Test query come anon (simula lettura pubblica)
  SELECT COUNT(*) INTO v_test_count
  FROM public.shops
  WHERE slug = v_test_slug;
  
  IF v_test_count > 0 THEN
    RAISE NOTICE '✅ Test lettura pubblica per slug: SUCCESSO (trovato %)', v_test_count;
  ELSE
    RAISE WARNING '⚠️ Test lettura pubblica: Nessun negozio trovato con slug %', v_test_slug;
    RAISE NOTICE '   Verifica che esista un negozio con questo slug nel database';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 10) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Policy create:';
  RAISE NOTICE '   - shops_select_public (lettura pubblica per tutti)';
  RAISE NOTICE '   - shops_insert_admin (inserimento admin)';
  RAISE NOTICE '   - shops_update_admin (aggiornamento admin negozio)';
  RAISE NOTICE '   - shops_delete_platform_admin (eliminazione platform admin)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Indici creati/verificati';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Verifica che esista un negozio con slug "retro-barbershop"';
  RAISE NOTICE '2. Prova a caricare il negozio dall''app senza autenticazione';
  RAISE NOTICE '3. Se funziona, il problema è risolto!';
  RAISE NOTICE '';
END $$;



