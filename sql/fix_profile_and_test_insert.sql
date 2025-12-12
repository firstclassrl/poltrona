-- =====================================================
-- FIX PROFILO E TEST INSERIMENTO
-- =====================================================
-- Questo script forza la correzione del profilo
-- e testa l'inserimento di un cliente
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
  RAISE NOTICE '=== CONFIGURAZIONE ===';
  RAISE NOTICE 'Email admin: %', v_admin_email;
  RAISE NOTICE 'Shop slug: %', v_shop_slug;
  RAISE NOTICE '';
  
  -- Trova user_id
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = v_admin_email;
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente con email % non trovato', v_admin_email;
  END IF;
  
  -- Trova shop_id
  SELECT id INTO v_shop_id FROM public.shops WHERE slug = v_shop_slug;
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Shop con slug % non trovato', v_shop_slug;
  END IF;
  
  -- Verifica profilo
  SELECT shop_id INTO v_profile_shop_id
  FROM public.profiles
  WHERE user_id = v_admin_user_id;
  
  RAISE NOTICE '=== STATO ATTUALE ===';
  RAISE NOTICE 'User ID: %', v_admin_user_id;
  RAISE NOTICE 'Shop ID corretto: %', v_shop_id;
  RAISE NOTICE 'Shop ID nel profilo: %', v_profile_shop_id;
  RAISE NOTICE '';
  
  -- FORZA CORREZIONE
  IF v_profile_shop_id IS DISTINCT FROM v_shop_id THEN
    RAISE NOTICE '=== AGGIORNAMENTO PROFILO ===';
    UPDATE public.profiles 
    SET shop_id = v_shop_id, role = 'admin'
    WHERE user_id = v_admin_user_id;
    RAISE NOTICE '✅ Profilo aggiornato: shop_id = %', v_shop_id;
  ELSE
    RAISE NOTICE '✅ Profilo già corretto';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- Verifica profilo dopo correzione
SELECT 
  user_id,
  shop_id,
  role,
  is_platform_admin,
  (SELECT email FROM auth.users WHERE id = profiles.user_id) as email
FROM public.profiles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'barbiere@abruzzo.ai');

-- Test funzione can_insert_client
SELECT 
  public.can_insert_client('4139fac4-127f-42f6-ba10-74ee03ffb160'::UUID) as can_insert;

-- Test inserimento
DO $$
DECLARE
  v_shop_id UUID := '4139fac4-127f-42f6-ba10-74ee03ffb160';
  v_client_id UUID;
  v_can_insert BOOLEAN;
  v_user_id UUID;
  v_profile_shop_id UUID;
BEGIN
  RAISE NOTICE '=== TEST INSERIMENTO ===';
  
  v_user_id := auth.uid();
  RAISE NOTICE 'auth.uid(): %', v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE WARNING '❌ auth.uid() è NULL - esegui questo script come utente autenticato!';
    RAISE NOTICE '';
    RAISE NOTICE 'Per eseguire come utente autenticato:';
    RAISE NOTICE '1. Vai su Supabase Dashboard > SQL Editor';
    RAISE NOTICE '2. Clicca su "Run as" e seleziona l''utente barbiere@abruzzo.ai';
    RAISE NOTICE '3. Oppure usa il JWT token nell''header della query';
    RETURN;
  END IF;
  
  -- Verifica profilo
  SELECT shop_id INTO v_profile_shop_id
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  RAISE NOTICE 'Shop ID nel profilo: %', v_profile_shop_id;
  RAISE NOTICE 'Shop ID da inserire: %', v_shop_id;
  RAISE NOTICE 'Corrispondono: %', (v_profile_shop_id = v_shop_id);
  
  -- Test funzione
  v_can_insert := public.can_insert_client(v_shop_id);
  RAISE NOTICE 'can_insert_client(): %', v_can_insert;
  
  IF NOT v_can_insert THEN
    RAISE WARNING '❌ can_insert_client() restituisce FALSE!';
    RETURN;
  END IF;
  
  -- Prova inserimento
  BEGIN
    INSERT INTO public.clients (
      shop_id,
      first_name,
      last_name,
      phone_e164,
      email
    ) VALUES (
      v_shop_id,
      'Test',
      'Cliente',
      '+39123456789',
      'test-' || extract(epoch from now())::text || '@test.it'
    ) RETURNING id INTO v_client_id;
    
    RAISE NOTICE '✅✅✅ INSERIMENTO RIUSCITO! ✅✅✅';
    RAISE NOTICE 'Client ID: %', v_client_id;
    
    -- Rimuovi cliente di test
    DELETE FROM public.clients WHERE id = v_client_id;
    RAISE NOTICE '✅ Cliente di test rimosso';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌❌❌ INSERIMENTO FALLITO! ❌❌❌';
    RAISE NOTICE 'Errore: %', SQLERRM;
    RAISE NOTICE 'Codice: %', SQLSTATE;
  END;
END $$;
