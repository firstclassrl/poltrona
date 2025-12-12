-- Script RAPIDO per creare un token di invito e associarlo a un admin esistente
-- 
-- PASSO 1: Trova l'ID dell'utente admin (sostituisci l'email)
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = 'admin@example.com'; -- ⚠️ SOSTITUISCI CON L'EMAIL DELL'ADMIN

-- PASSO 2: Copia l'ID dalla query sopra e sostituiscilo qui sotto, poi esegui:

-- ============================================
-- Crea il token di invito
-- ============================================

INSERT INTO public.shop_invites (
  token,
  admin_user_id,
  created_by,
  expires_at
)
VALUES (
  -- Genera token randomico (32 caratteri alfanumerici)
  UPPER(
    SUBSTRING(
      MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) 
      || MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT),
      1, 32
    )
  ),
  'ADMIN_USER_ID_QUI'::UUID, -- ⚠️ SOSTITUISCI CON L'ID DELL'ADMIN (dal PASSO 1)
  'platform_admin',
  NOW() + INTERVAL '30 days' -- Scadenza: 30 giorni (modifica se necessario)
)
RETURNING 
  id,
  token,
  admin_user_id,
  expires_at,
  'https://poltrona.abruzzo.ai/setup?token=' || token as setup_link;

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
WHERE si.admin_user_id = 'ADMIN_USER_ID_QUI'::UUID -- ⚠️ SOSTITUISCI CON L'ID DELL'ADMIN
ORDER BY si.created_at DESC
LIMIT 5;

