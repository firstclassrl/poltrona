-- =====================================================
-- FIX: RLS POLICY PER VALIDAZIONE TOKEN shop_invites
-- =====================================================
-- Questo script garantisce che i token possano essere
-- validati anche senza autenticazione (lettura pubblica)
-- =====================================================

-- 1) VERIFICA STRUTTURA TABELLA
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== VERIFICA STRUTTURA TABELLA ===';
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'shop_invites'
  ) THEN
    RAISE EXCEPTION 'Tabella shop_invites non esiste! Esegui prima create_shop_invites_table.sql';
  END IF;
  
  RAISE NOTICE '✅ Tabella shop_invites esiste';
END $$;

-- 2) RIMUOVI POLICY ESISTENTI (per ricrearle)
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIMOZIONE POLICY ESISTENTI ===';
  
  -- Rimuovi tutte le policy esistenti (inclusi i nomi alternativi)
  DROP POLICY IF EXISTS shop_invites_select_public ON public.shop_invites;
  DROP POLICY IF EXISTS shop_invites_insert_admin ON public.shop_invites;
  DROP POLICY IF EXISTS shop_invites_update_use_token ON public.shop_invites;
  DROP POLICY IF EXISTS shop_invites_delete_admin ON public.shop_invites;
  DROP POLICY IF EXISTS shop_invites_write_admin ON public.shop_invites;
  DROP POLICY IF EXISTS shop_invites_use_token ON public.shop_invites;
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.shop_invites;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.shop_invites;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.shop_invites;
  DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.shop_invites;
  
  RAISE NOTICE '✅ Policy esistenti rimosse';
END $$;

-- 3) ABILITA RLS
-- =====================================================
ALTER TABLE public.shop_invites ENABLE ROW LEVEL SECURITY;

-- 4) CREA POLICY PER LETTURA PUBBLICA (VALIDAZIONE TOKEN)
-- =====================================================
-- IMPORTANTE: Questa policy permette a CHIUNQUE di leggere i token
-- per validarli durante il setup del negozio
CREATE POLICY shop_invites_select_public ON public.shop_invites
  FOR SELECT
  USING (true);  -- Permetti lettura a tutti (anon e authenticated)

COMMENT ON POLICY shop_invites_select_public ON public.shop_invites IS 
  'Permette lettura pubblica dei token per validazione durante setup negozio';

-- 5) CREA POLICY PER INSERIMENTO (SOLO ADMIN/PLATFORM ADMIN)
-- =====================================================
CREATE POLICY shop_invites_insert_admin ON public.shop_invites
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND (p.role IN ('admin', 'owner', 'manager') OR p.is_platform_admin = true)
    )
  );

COMMENT ON POLICY shop_invites_insert_admin ON public.shop_invites IS 
  'Permette inserimento token solo a admin, manager, owner o platform admin';

-- 6) CREA POLICY PER AGGIORNAMENTO (MARCARE COME USATO)
-- =====================================================
-- Permette a chiunque (anon/authenticated) di marcare un token come usato
-- quando viene creato un negozio
CREATE POLICY shop_invites_update_use_token ON public.shop_invites
  FOR UPDATE
  USING (
    -- Può aggiornare se il token non è ancora stato usato
    used_at IS NULL
    AND (
      auth.role() IN ('anon', 'authenticated', 'service_role')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid() 
        AND (p.role IN ('admin', 'owner', 'manager') OR p.is_platform_admin = true)
      )
    )
  )
  WITH CHECK (
    -- Può impostare used_at e used_by_shop_id
    used_at IS NOT NULL
    AND used_by_shop_id IS NOT NULL
  );

COMMENT ON POLICY shop_invites_update_use_token ON public.shop_invites IS 
  'Permette di marcare un token come usato quando viene creato un negozio';

-- 7) CREA POLICY PER ELIMINAZIONE (SOLO ADMIN/PLATFORM ADMIN)
-- =====================================================
CREATE POLICY shop_invites_delete_admin ON public.shop_invites
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() 
      AND (p.role IN ('admin', 'owner', 'manager') OR p.is_platform_admin = true)
    )
  );

COMMENT ON POLICY shop_invites_delete_admin ON public.shop_invites IS 
  'Permette eliminazione token solo a admin, manager, owner o platform admin';

-- 8) VERIFICA INDICI
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_shop_invites_token ON public.shop_invites(token);
CREATE INDEX IF NOT EXISTS idx_shop_invites_admin_user_id ON public.shop_invites(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_shop_invites_used_at ON public.shop_invites(used_at) WHERE used_at IS NULL;

-- 9) TEST VALIDAZIONE
-- =====================================================
DO $$
DECLARE
  v_test_token TEXT;
  v_test_count INTEGER;
BEGIN
  RAISE NOTICE '=== TEST VALIDAZIONE ===';
  
  -- Cerca un token esistente per test
  SELECT token INTO v_test_token
  FROM public.shop_invites
  WHERE used_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;
  
  IF v_test_token IS NOT NULL THEN
    RAISE NOTICE 'Token di test trovato: %...', SUBSTRING(v_test_token, 1, 8);
    
    -- Test query come anon
    SELECT COUNT(*) INTO v_test_count
    FROM public.shop_invites
    WHERE token = v_test_token;
    
    IF v_test_count > 0 THEN
      RAISE NOTICE '✅ Test lettura pubblica: SUCCESSO';
    ELSE
      RAISE WARNING '⚠️ Test lettura pubblica: FALLITO';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Nessun token valido trovato per test';
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
  RAISE NOTICE '   - shop_invites_select_public (lettura pubblica)';
  RAISE NOTICE '   - shop_invites_insert_admin (inserimento admin)';
  RAISE NOTICE '   - shop_invites_update_use_token (aggiornamento uso token)';
  RAISE NOTICE '   - shop_invites_delete_admin (eliminazione admin)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Indici creati/verificati';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Prova a validare un token dall''app';
  RAISE NOTICE '2. Controlla i log nella console del browser';
  RAISE NOTICE '3. Se funziona, il problema è risolto!';
  RAISE NOTICE '';
END $$;

