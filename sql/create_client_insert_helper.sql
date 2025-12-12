-- =====================================================
-- CREA FUNZIONE HELPER PER INSERIMENTO CLIENTI
-- =====================================================
-- Questa funzione verifica se l'utente può inserire
-- un cliente con un determinato shop_id
-- =====================================================

-- Crea funzione helper
CREATE OR REPLACE FUNCTION public.can_insert_client(shop_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile_shop_id UUID;
BEGIN
  -- Service role può sempre inserire
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;
  
  -- Platform admin può sempre inserire
  IF public.is_platform_admin() THEN
    RETURN true;
  END IF;
  
  -- Se shop_id è NULL, permettere (compatibilità)
  IF shop_id_param IS NULL THEN
    RETURN true;
  END IF;
  
  -- Ottieni user_id corrente
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verifica shop_id nel profilo
  SELECT p.shop_id INTO v_profile_shop_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id;
  
  -- Permetti se shop_id corrisponde
  RETURN (v_profile_shop_id = shop_id_param);
END;
$$;

COMMENT ON FUNCTION public.can_insert_client(UUID) IS 'Verifica se l''utente corrente può inserire un cliente con il shop_id specificato';

-- Ricrea policy INSERT usando la funzione helper
DO $$
BEGIN
  -- Rimuovi policy INSERT esistenti
  DROP POLICY IF EXISTS clients_insert_shop ON public.clients;
  DROP POLICY IF EXISTS clients_insert ON public.clients;
  
  -- Crea nuova policy usando la funzione helper
  CREATE POLICY clients_insert_shop ON public.clients
    FOR INSERT 
    WITH CHECK (public.can_insert_client(shop_id));
  
  RAISE NOTICE '✅ Policy clients_insert_shop ricreata usando funzione helper';
  RAISE NOTICE '';
END $$;

-- Test della funzione
DO $$
DECLARE
  v_test_shop_id UUID := '4139fac4-127f-42f6-ba10-74ee03ffb160'; -- MODIFICA QUI
  v_can_insert BOOLEAN;
BEGIN
  RAISE NOTICE '=== TEST FUNZIONE can_insert_client() ===';
  
  v_can_insert := public.can_insert_client(v_test_shop_id);
  
  RAISE NOTICE 'can_insert_client(%) = %', v_test_shop_id, v_can_insert;
  
  IF v_can_insert THEN
    RAISE NOTICE '✅ La funzione permette l''inserimento';
  ELSE
    RAISE WARNING '❌ La funzione BLOCCA l''inserimento';
    RAISE NOTICE '';
    RAISE NOTICE 'Verifica:';
    RAISE NOTICE '  - auth.uid(): %', auth.uid();
    RAISE NOTICE '  - auth.role(): %', auth.role();
    RAISE NOTICE '  - is_platform_admin(): %', public.is_platform_admin();
    RAISE NOTICE '  - shop_id nel profilo: %', (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid());
  END IF;
  
  RAISE NOTICE '';
END $$;
