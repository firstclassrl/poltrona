-- =========================================================
-- Fix: Assegna shop_id di default ai profili esistenti senza shop_id
-- =========================================================
-- Questo script aggiorna tutti i profili esistenti che hanno shop_id NULL
-- assegnando loro lo shop_id di default (retro-barbershop)
-- =========================================================

DO $$
DECLARE
  v_default_shop_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Recupera lo shop_id di default (retro-barbershop)
  SELECT id INTO v_default_shop_id
  FROM public.shops
  WHERE slug = 'retro-barbershop'
  LIMIT 1;
  
  -- Se non trova lo shop di default, usa il primo shop disponibile come fallback
  IF v_default_shop_id IS NULL THEN
    SELECT id INTO v_default_shop_id
    FROM public.shops
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  -- Se non ci sono shop disponibili, esci
  IF v_default_shop_id IS NULL THEN
    RAISE WARNING '⚠️ Nessuno shop trovato nel database. Impossibile assegnare shop_id di default.';
    RETURN;
  END IF;
  
  -- Aggiorna tutti i profili con shop_id NULL
  UPDATE public.profiles
  SET shop_id = v_default_shop_id,
      updated_at = NOW()
  WHERE shop_id IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Aggiornati % profili con shop_id di default (shop_id: %)', v_updated_count, v_default_shop_id;
  
  -- Verifica che non ci siano più profili senza shop_id
  SELECT COUNT(*) INTO v_updated_count
  FROM public.profiles
  WHERE shop_id IS NULL;
  
  IF v_updated_count > 0 THEN
    RAISE WARNING '⚠️ Ci sono ancora % profili senza shop_id', v_updated_count;
  ELSE
    RAISE NOTICE '✅ Tutti i profili hanno ora uno shop_id assegnato';
  END IF;
  
END $$;

-- Verifica finale
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN shop_id IS NULL THEN 1 END) as profiles_without_shop_id,
  COUNT(CASE WHEN shop_id IS NOT NULL THEN 1 END) as profiles_with_shop_id
FROM public.profiles;


