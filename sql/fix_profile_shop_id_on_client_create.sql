-- =====================================================
-- FIX: AGGIORNA shop_id NEL PROFILO QUANDO VIENE CREATO UN CLIENTE
-- =====================================================
-- Questo script crea un trigger che aggiorna automaticamente
-- il profilo con shop_id quando viene creato un cliente
-- =====================================================

-- 1) CREA FUNZIONE TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_profile_shop_id_on_client_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_user_id UUID;
BEGIN
  -- Se il cliente ha shop_id, aggiorna il profilo associato
  IF NEW.shop_id IS NOT NULL THEN
    -- Cerca il profilo per email (se il cliente ha email)
    IF NEW.email IS NOT NULL THEN
      -- Trova user_id dall'email
      SELECT u.id INTO v_profile_user_id
      FROM auth.users u
      WHERE u.email = NEW.email
      LIMIT 1;
      
      -- Se trovato, aggiorna il profilo
      IF v_profile_user_id IS NOT NULL THEN
        UPDATE public.profiles
        SET shop_id = NEW.shop_id
        WHERE user_id = v_profile_user_id
          AND (shop_id IS NULL OR shop_id != NEW.shop_id);
        
        RAISE LOG 'Profilo aggiornato per cliente %: shop_id = %', NEW.email, NEW.shop_id;
      END IF;
    END IF;
    
    -- Se il cliente ha user_id (collegato direttamente), aggiorna il profilo
    IF NEW.user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET shop_id = NEW.shop_id
      WHERE user_id = NEW.user_id
        AND (shop_id IS NULL OR shop_id != NEW.shop_id);
      
      RAISE LOG 'Profilo aggiornato per user_id %: shop_id = %', NEW.user_id, NEW.shop_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_profile_shop_id_on_client_create() IS 'Aggiorna automaticamente shop_id nel profilo quando viene creato o aggiornato un cliente';

-- 2) CREA TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_profile_shop_id_on_client_create ON public.clients;
CREATE TRIGGER trigger_update_profile_shop_id_on_client_create
  AFTER INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  WHEN (NEW.shop_id IS NOT NULL)
  EXECUTE FUNCTION public.update_profile_shop_id_on_client_create();

-- 3) AGGIORNA PROFILI ESISTENTI
-- =====================================================
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  RAISE NOTICE '=== AGGIORNAMENTO PROFILI ESISTENTI ===';
  
  -- Aggiorna profili di clienti esistenti
  UPDATE public.profiles p
  SET shop_id = c.shop_id
  FROM public.clients c
  WHERE (
    -- Match per email
    (c.email IS NOT NULL AND EXISTS (
      SELECT 1 FROM auth.users u 
      WHERE u.id = p.user_id AND u.email = c.email
    ))
    OR
    -- Match per user_id (se clients ha user_id)
    (c.user_id IS NOT NULL AND c.user_id = p.user_id)
  )
  AND c.shop_id IS NOT NULL
  AND (p.shop_id IS NULL OR p.shop_id != c.shop_id);
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Profili aggiornati: %', v_updated_count;
  RAISE NOTICE '';
END $$;

-- 4) VERIFICA
-- =====================================================
DO $$
DECLARE
  v_clients_without_profile_shop_id INTEGER;
  v_profiles_without_shop_id INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA ===';
  
  -- Conta clienti senza profilo con shop_id
  SELECT COUNT(*) INTO v_clients_without_profile_shop_id
  FROM public.clients c
  WHERE c.shop_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN auth.users u ON p.user_id = u.id
      WHERE (u.email = c.email OR (c.user_id IS NOT NULL AND c.user_id = p.user_id))
        AND p.shop_id = c.shop_id
    );
  
  -- Conta profili senza shop_id
  SELECT COUNT(*) INTO v_profiles_without_shop_id
  FROM public.profiles
  WHERE shop_id IS NULL
    AND role = 'client';
  
  RAISE NOTICE 'Clienti senza profilo con shop_id corrispondente: %', v_clients_without_profile_shop_id;
  RAISE NOTICE 'Profili clienti senza shop_id: %', v_profiles_without_shop_id;
  
  IF v_clients_without_profile_shop_id > 0 OR v_profiles_without_shop_id > 0 THEN
    RAISE WARNING '⚠️ Ci sono ancora profili/clienti senza shop_id corrispondente';
  ELSE
    RAISE NOTICE '✅ Tutti i profili hanno shop_id corrispondente ai clienti';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 5) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Trigger creato: trigger_update_profile_shop_id_on_client_create';
  RAISE NOTICE '   Questo trigger aggiorna automaticamente shop_id nel profilo';
  RAISE NOTICE '   quando viene creato o aggiornato un cliente';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Prova a creare un nuovo cliente dall''app';
  RAISE NOTICE '2. Verifica che il profilo associato abbia shop_id corretto';
  RAISE NOTICE '3. Se funziona, il problema è risolto!';
  RAISE NOTICE '';
END $$;
