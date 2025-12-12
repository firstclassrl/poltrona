-- =====================================================
-- FORZA CORREZIONE shop_id NEL PROFILO
-- =====================================================
-- Questo script forza il shop_id corretto nel profilo
-- per permettere l'inserimento di clienti
-- =====================================================

-- CONFIGURAZIONE
DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai'; -- MODIFICA QUI
  v_shop_slug TEXT := 'abruzzo-barber'; -- MODIFICA QUI
  v_admin_user_id UUID;
  v_shop_id UUID;
  v_profile_shop_id UUID;
BEGIN
  RAISE NOTICE '=== FORZA CORREZIONE PROFILO ===';
  RAISE NOTICE '';
  
  -- Trova user_id
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = v_admin_email;
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente con email % non trovato', v_admin_email;
  END IF;
  RAISE NOTICE 'User ID: %', v_admin_user_id;
  
  -- Trova shop_id
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = v_shop_slug;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop con slug % non trovato', v_shop_slug;
  END IF;
  RAISE NOTICE 'Shop ID corretto: %', v_shop_id;
  
  -- Verifica profilo attuale
  SELECT shop_id INTO v_profile_shop_id
  FROM public.profiles
  WHERE user_id = v_admin_user_id;
  
  RAISE NOTICE 'Shop ID nel profilo (prima): %', v_profile_shop_id;
  
  -- FORZA AGGIORNAMENTO
  UPDATE public.profiles 
  SET shop_id = v_shop_id, role = 'admin'
  WHERE user_id = v_admin_user_id;
  
  RAISE NOTICE '✅ Profilo aggiornato: shop_id = %, role = admin', v_shop_id;
  RAISE NOTICE '';
  
  -- Verifica dopo aggiornamento
  SELECT shop_id INTO v_profile_shop_id
  FROM public.profiles
  WHERE user_id = v_admin_user_id;
  
  RAISE NOTICE 'Shop ID nel profilo (dopo): %', v_profile_shop_id;
  
  IF v_profile_shop_id = v_shop_id THEN
    RAISE NOTICE '✅✅✅ PROFILO CORRETTO! ✅✅✅';
  ELSE
    RAISE WARNING '❌ Qualcosa è andato storto!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Logout completo dall''app';
  RAISE NOTICE '2. Pulisci localStorage (current_shop_id, current_shop_slug, auth_token)';
  RAISE NOTICE '3. Rientra con ?shop=abruzzo-barber';
  RAISE NOTICE '4. Prova a creare un cliente';
  RAISE NOTICE '';
END $$;

-- Mostra profilo aggiornato
SELECT 
  u.email,
  p.user_id,
  p.shop_id,
  p.role,
  s.slug,
  s.name as shop_name
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
LEFT JOIN public.shops s ON p.shop_id = s.id
WHERE u.email = 'barbiere@abruzzo.ai';
