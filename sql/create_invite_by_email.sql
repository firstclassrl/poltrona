-- Script per creare un token di invito usando l'EMAIL dell'admin (più semplice!)
-- 
-- ISTRUZIONI:
-- 1. Sostituisci 'barbiere@abruzzo.ai' con l'email dell'admin
-- 2. Esegui lo script in Supabase SQL Editor

DO $$
DECLARE
  v_admin_email TEXT := 'barbiere@abruzzo.ai'; -- ⚠️ SOSTITUISCI CON L'EMAIL DELL'ADMIN
  v_admin_user_id UUID;
  v_token TEXT;
  v_invite_id UUID;
BEGIN
  -- Trova l'ID dell'utente dall'email
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE email = v_admin_email;
  
  -- Verifica che l'utente esista
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente con email % non trovato in auth.users. Verifica che l''utente sia stato creato in Supabase Auth.', v_admin_email;
  END IF;

  -- Verifica che l'utente abbia un profilo
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_admin_user_id) THEN
    RAISE EXCEPTION 'Profilo non trovato per l''utente %. Assicurati che il trigger handle_new_user() abbia creato il profilo.', v_admin_email;
  END IF;

  -- Verifica/aggiorna che l'utente sia admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = v_admin_user_id 
    AND role = 'admin'
  ) THEN
    RAISE NOTICE 'L''utente % non ha ruolo "admin". Aggiornamento automatico a "admin".', v_admin_email;
    
    UPDATE public.profiles
    SET role = 'admin'
    WHERE user_id = v_admin_user_id;
  END IF;

  -- Genera token univoco (32 caratteri alfanumerici)
  v_token := UPPER(
    SUBSTRING(
      MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) 
      || MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT),
      1, 32
    )
  );
  
  -- Verifica che il token sia unico (se esiste già, rigenera)
  WHILE EXISTS (SELECT 1 FROM public.shop_invites WHERE token = v_token) LOOP
    v_token := UPPER(
      SUBSTRING(
        MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) 
        || MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT),
        1, 32
      )
    );
  END LOOP;

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
    'platform_admin',
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO v_invite_id;

  -- Output del risultato
  RAISE NOTICE '';
  RAISE NOTICE '✅ Token di invito creato con successo!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📋 Dettagli:';
  RAISE NOTICE '   Email Admin: %', v_admin_email;
  RAISE NOTICE '   User ID: %', v_admin_user_id;
  RAISE NOTICE '   Token ID: %', v_invite_id;
  RAISE NOTICE '   Token: %', v_token;
  RAISE NOTICE '   Scadenza: %', NOW() + INTERVAL '30 days';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 Link di setup:';
  RAISE NOTICE '   https://poltrona.abruzzo.ai/setup?token=%', v_token;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';

END $$;

-- ============================================
-- Verifica che il token sia stato creato
-- ============================================

SELECT 
  si.id,
  si.token,
  si.admin_user_id,
  p.full_name as admin_name,
  u.email as admin_email,
  si.created_at,
  si.expires_at,
  si.used_at,
  CASE 
    WHEN si.used_at IS NOT NULL THEN '✅ Usato'
    WHEN si.expires_at < NOW() THEN '❌ Scaduto'
    ELSE '✅ Valido'
  END as status,
  'https://poltrona.abruzzo.ai/setup?token=' || si.token as setup_link
FROM public.shop_invites si
LEFT JOIN public.profiles p ON si.admin_user_id = p.user_id
LEFT JOIN auth.users u ON si.admin_user_id = u.id
WHERE u.email = 'barbiere@abruzzo.ai' -- ⚠️ SOSTITUISCI CON L'EMAIL DELL'ADMIN
ORDER BY si.created_at DESC
LIMIT 5;
