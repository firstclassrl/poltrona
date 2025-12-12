-- =====================================================
-- DEBUG FUNZIONE can_insert_client()
-- =====================================================
-- Questo script mostra esattamente perché
-- can_insert_client() restituisce FALSE
-- =====================================================

-- 1) Verifica condizioni
SELECT 
  auth.uid() as user_id,
  auth.role() as role,
  (auth.role() = 'service_role') as is_service_role,
  public.is_platform_admin() as is_platform_admin;

-- 2) Verifica profilo
SELECT 
  user_id,
  shop_id,
  role,
  is_platform_admin
FROM public.profiles
WHERE user_id = auth.uid();

-- 3) Verifica shop_id da inserire
SELECT 
  '4139fac4-127f-42f6-ba10-74ee03ffb160'::UUID as shop_id_to_insert;

-- 4) Confronta shop_id
SELECT 
  p.shop_id as profile_shop_id,
  '4139fac4-127f-42f6-ba10-74ee03ffb160'::UUID as shop_id_to_insert,
  (p.shop_id = '4139fac4-127f-42f6-ba10-74ee03ffb160'::UUID) as shop_ids_match
FROM public.profiles p
WHERE p.user_id = auth.uid();

-- 5) Test passo-passo della funzione
DO $$
DECLARE
  v_shop_id_param UUID := '4139fac4-127f-42f6-ba10-74ee03ffb160';
  v_user_id UUID;
  v_profile_shop_id UUID;
  v_is_service_role BOOLEAN;
  v_is_platform_admin BOOLEAN;
  v_result BOOLEAN;
BEGIN
  RAISE NOTICE '=== DEBUG can_insert_client() ===';
  RAISE NOTICE '';
  
  -- Condizione 1: service_role
  v_is_service_role := (auth.role() = 'service_role');
  RAISE NOTICE '1. auth.role() = service_role: %', v_is_service_role;
  
  IF v_is_service_role THEN
    RAISE NOTICE '   ✅ PASS - è service_role';
    RETURN;
  END IF;
  
  -- Condizione 2: platform admin
  v_is_platform_admin := public.is_platform_admin();
  RAISE NOTICE '2. is_platform_admin(): %', v_is_platform_admin;
  
  IF v_is_platform_admin THEN
    RAISE NOTICE '   ✅ PASS - è platform admin';
    RETURN;
  END IF;
  
  -- Condizione 3: shop_id NULL
  RAISE NOTICE '3. shop_id_param IS NULL: %', (v_shop_id_param IS NULL);
  
  IF v_shop_id_param IS NULL THEN
    RAISE NOTICE '   ✅ PASS - shop_id è NULL';
    RETURN;
  END IF;
  
  -- Condizione 4: verifica profilo
  v_user_id := auth.uid();
  RAISE NOTICE '4. auth.uid(): %', v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE WARNING '   ❌ FAIL - auth.uid() è NULL!';
    RETURN;
  END IF;
  
  SELECT p.shop_id INTO v_profile_shop_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id;
  
  RAISE NOTICE '5. shop_id nel profilo: %', v_profile_shop_id;
  
  IF v_profile_shop_id IS NULL THEN
    RAISE WARNING '   ❌ FAIL - profilo non ha shop_id!';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUZIONE: Aggiorna il profilo con shop_id corretto';
    RETURN;
  END IF;
  
  -- Condizione 5: confronto shop_id
  RAISE NOTICE '6. shop_id corrisponde: %', (v_profile_shop_id = v_shop_id_param);
  RAISE NOTICE '   Profilo shop_id: %', v_profile_shop_id;
  RAISE NOTICE '   Shop_id da inserire: %', v_shop_id_param;
  
  IF v_profile_shop_id = v_shop_id_param THEN
    RAISE NOTICE '   ✅ PASS - shop_id corrisponde';
    v_result := true;
  ELSE
    RAISE WARNING '   ❌ FAIL - shop_id NON corrisponde!';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUZIONE:';
    RAISE NOTICE '  UPDATE public.profiles';
    RAISE NOTICE '  SET shop_id = ''%''', v_shop_id_param;
    RAISE NOTICE '  WHERE user_id = ''%'';', v_user_id;
    v_result := false;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'RISULTATO FINALE: %', v_result;
END $$;
