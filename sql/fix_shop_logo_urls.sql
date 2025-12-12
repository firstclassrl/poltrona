-- =====================================================
-- SCRIPT PER VERIFICARE E CORREGGERE logo_url
-- =====================================================
-- Questo script verifica i logo_url salvati e li corregge
-- se necessario, generando URL pubblici corretti
-- =====================================================

-- 1) VERIFICA LOGO_URL ESISTENTI
-- =====================================================
DO $$
DECLARE
  v_shop RECORD;
  v_public_url TEXT;
  v_supabase_url TEXT := 'https://tlwxsluoqzdluzneugbe.supabase.co'; -- MODIFICA SE NECESSARIO
BEGIN
  RAISE NOTICE '=== VERIFICA LOGO_URL ===';
  RAISE NOTICE '';
  
  FOR v_shop IN 
    SELECT id, slug, name, logo_path, logo_url
    FROM public.shops
    WHERE logo_path IS NOT NULL
    ORDER BY slug
  LOOP
    RAISE NOTICE 'Shop: % (slug: %)', v_shop.name, v_shop.slug;
    RAISE NOTICE '  logo_path: %', v_shop.logo_path;
    RAISE NOTICE '  logo_url attuale: %', v_shop.logo_url;
    
    -- Genera URL pubblico corretto
    IF v_shop.logo_path IS NOT NULL THEN
      v_public_url := v_supabase_url || '/storage/v1/object/public/shop-logos/' || v_shop.logo_path;
      RAISE NOTICE '  logo_url corretto: %', v_public_url;
      
      -- Aggiorna se diverso o NULL
      IF v_shop.logo_url IS NULL OR v_shop.logo_url != v_public_url THEN
        UPDATE public.shops
        SET logo_url = v_public_url
        WHERE id = v_shop.id;
        RAISE NOTICE '  ✅ logo_url aggiornato';
      ELSE
        RAISE NOTICE '  ✅ logo_url già corretto';
      END IF;
    END IF;
    
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '=== VERIFICA COMPLETATA ===';
END $$;

-- 2) VERIFICA SHOP SENZA LOGO
-- =====================================================
DO $$
DECLARE
  v_shop_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== SHOP SENZA LOGO ===';
  
  SELECT COUNT(*) INTO v_shop_count
  FROM public.shops
  WHERE logo_path IS NULL AND logo_url IS NULL;
  
  IF v_shop_count > 0 THEN
    RAISE NOTICE 'Trovati % shop senza logo', v_shop_count;
    RAISE NOTICE 'Slug degli shop senza logo:';
    
    FOR v_shop IN 
      SELECT slug, name
      FROM public.shops
      WHERE logo_path IS NULL AND logo_url IS NULL
      ORDER BY slug
    LOOP
      RAISE NOTICE '  - % (%)', v_shop.slug, v_shop.name;
    END LOOP;
  ELSE
    RAISE NOTICE '✅ Tutti gli shop hanno un logo configurato';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 3) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Se i loghi non si vedono ancora:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Verifica che il bucket "shop-logos" esista in Supabase Storage';
  RAISE NOTICE '2. Verifica che i file esistano nel bucket:';
  RAISE NOTICE '   - Vai su Supabase Dashboard > Storage > shop-logos';
  RAISE NOTICE '   - Controlla che i file siano presenti in shops/{shop_id}/logo.*';
  RAISE NOTICE '';
  RAISE NOTICE '3. Se il bucket è PRIVATO:';
  RAISE NOTICE '   - Le RLS policies devono permettere la lettura';
  RAISE NOTICE '   - Oppure usa signed URLs (già implementato nel codice)';
  RAISE NOTICE '';
  RAISE NOTICE '4. Se il bucket è PUBBLICO:';
  RAISE NOTICE '   - Gli URL pubblici dovrebbero funzionare';
  RAISE NOTICE '   - Verifica che logo_url sia corretto (vedi sopra)';
  RAISE NOTICE '';
  RAISE NOTICE '5. Testa manualmente un logo_url:';
  RAISE NOTICE '   SELECT logo_url FROM public.shops WHERE slug = ''abruzzo-barber'';';
  RAISE NOTICE '   - Copia l''URL e aprilo nel browser';
  RAISE NOTICE '   - Se non funziona, il bucket è privato o il file non esiste';
  RAISE NOTICE '';
END $$;
