-- Script per creare un token di invito e associarlo a un admin esistente
-- Questo token verrà usato per il setup di un nuovo negozio con la nuova logica di onboarding
--
-- ISTRUZIONI:
-- 1. Sostituisci 'ADMIN_USER_ID_QUI' con l'ID dell'utente admin creato in Supabase Auth
-- 2. (Opzionale) Modifica la data di scadenza (default: 30 giorni da oggi)
-- 3. Esegui lo script in Supabase SQL Editor

-- ============================================
-- 1. Funzione helper per generare token randomico univoco
-- ============================================

-- Funzione per generare token alfanumerico casuale
CREATE OR REPLACE FUNCTION generate_shop_invite_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
  random_char TEXT;
BEGIN
  -- Genera token di 32 caratteri
  FOR i IN 1..32 LOOP
    random_char := SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
    result := result || random_char;
  END LOOP;
  
  -- Verifica che il token sia unico (se esiste già, rigenera)
  WHILE EXISTS (SELECT 1 FROM public.shop_invites WHERE token = result) LOOP
    result := '';
    FOR i IN 1..32 LOOP
      random_char := SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
      result := result || random_char;
    END LOOP;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Crea il token di invito per l'admin
-- ============================================

-- IMPORTANTE: Sostituisci 'ADMIN_USER_ID_QUI' con l'ID reale dell'utente admin
-- Per trovare l'ID: SELECT id, email FROM auth.users WHERE email = 'admin@example.com';

DO $$
DECLARE
  v_admin_user_id UUID := 'ADMIN_USER_ID_QUI'::UUID; -- ⚠️ SOSTITUISCI QUESTO VALORE
  v_token TEXT;
  v_invite_id UUID;
BEGIN
  -- Verifica che l'utente esista
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_user_id) THEN
    RAISE EXCEPTION 'Utente con ID % non trovato in auth.users. Verifica che l''utente sia stato creato in Supabase Auth.', v_admin_user_id;
  END IF;

  -- Verifica che l'utente abbia un profilo
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_admin_user_id) THEN
    RAISE EXCEPTION 'Profilo non trovato per l''utente %. Assicurati che il trigger handle_new_user() abbia creato il profilo.', v_admin_user_id;
  END IF;

  -- Verifica che l'utente sia admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = v_admin_user_id 
    AND role = 'admin'
  ) THEN
    RAISE WARNING 'L''utente % non ha ruolo "admin". Il profilo verrà aggiornato automaticamente a "admin".', v_admin_user_id;
    
    -- Aggiorna il ruolo a admin se non lo è già
    UPDATE public.profiles
    SET role = 'admin'
    WHERE user_id = v_admin_user_id;
  END IF;

  -- Genera token univoco
  v_token := generate_shop_invite_token();

  -- Crea il token di invito
  INSERT INTO public.shop_invites (
    token,
    admin_user_id,
    created_by,
    expires_at
  )
  VALUES (
    v_token,
    v_admin_user_id,
    'platform_admin', -- o il tuo user_id se vuoi tracciare chi ha creato il token
    NOW() + INTERVAL '30 days' -- Scadenza: 30 giorni da oggi (modifica se necessario)
  )
  RETURNING id INTO v_invite_id;

  -- Output del risultato
  RAISE NOTICE '✅ Token di invito creato con successo!';
  RAISE NOTICE '📋 Dettagli:';
  RAISE NOTICE '   - Token ID: %', v_invite_id;
  RAISE NOTICE '   - Token: %', v_token;
  RAISE NOTICE '   - Admin User ID: %', v_admin_user_id;
  RAISE NOTICE '   - Scadenza: %', NOW() + INTERVAL '30 days';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 Link di setup:';
  RAISE NOTICE '   %?token=%', 
    COALESCE(
      current_setting('app.url', true),
      'https://poltrona.abruzzo.ai'
    ),
    v_token;
  RAISE NOTICE '';
  RAISE NOTICE '📝 Copia il token qui sopra e usalo nel link di setup.';

END $$;

-- ============================================
-- 3. Query per verificare il token creato
-- ============================================

-- Esegui questa query per vedere tutti i token creati per questo admin:
-- SELECT 
--   si.id,
--   si.token,
--   si.admin_user_id,
--   p.full_name as admin_name,
--   u.email as admin_email,
--   si.created_at,
--   si.expires_at,
--   si.used_at,
--   CASE 
--     WHEN si.used_at IS NOT NULL THEN '✅ Usato'
--     WHEN si.expires_at < NOW() THEN '❌ Scaduto'
--     ELSE '✅ Valido'
--   END as status
-- FROM public.shop_invites si
-- LEFT JOIN public.profiles p ON si.admin_user_id = p.user_id
-- LEFT JOIN auth.users u ON si.admin_user_id = u.id
-- WHERE si.admin_user_id = 'ADMIN_USER_ID_QUI'::UUID
-- ORDER BY si.created_at DESC;

-- ============================================
-- 4. Query per trovare l'ID dell'utente admin
-- ============================================

-- Se non conosci l'ID dell'utente, esegui questa query:
-- SELECT 
--   u.id as user_id,
--   u.email,
--   p.full_name,
--   p.role,
--   p.is_platform_admin,
--   p.shop_id
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON u.id = p.user_id
-- WHERE u.email = 'admin@example.com'; -- ⚠️ Sostituisci con l'email dell'admin

-- ============================================
-- 5. Script completo con esempio pratico
-- ============================================

-- ESEMPIO: Crea token per admin con email 'admin@nuovonegozio.com'
-- 
-- STEP 1: Trova l'ID dell'utente
-- SELECT id, email FROM auth.users WHERE email = 'admin@nuovonegozio.com';
--
-- STEP 2: Copia l'ID e sostituiscilo nello script sopra
-- 
-- STEP 3: Esegui lo script modificato
--
-- STEP 4: Copia il token generato e usalo nel link:
-- https://poltrona.abruzzo.ai/setup?token=TOKEN_GENERATO
