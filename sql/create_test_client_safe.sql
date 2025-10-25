-- Script SICURO per creare un utente cliente di test
-- Questo script controlla se l'utente esiste già prima di crearlo

-- 1. Controlla se l'utente di test esiste già
SELECT 
  'CONTROLLO UTENTE ESISTENTE' as check_type,
  u.email,
  p.full_name,
  p.role,
  CASE 
    WHEN u.id IS NOT NULL THEN '✅ Utente già esistente'
    ELSE '❌ Utente non trovato'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = 'cliente.test@example.com';

-- 2. Crea l'utente SOLO se non esiste già
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT 
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'cliente.test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NULL,
  NULL,
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Mario Rossi"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'cliente.test@example.com'
);

-- 3. Crea il profilo SOLO se non esiste già
WITH new_user AS (
  SELECT id FROM auth.users 
  WHERE email = 'cliente.test@example.com'
  ORDER BY created_at DESC 
  LIMIT 1
)
INSERT INTO public.profiles (
  user_id,
  shop_id,
  role,
  full_name,
  created_at,
  updated_at
)
SELECT 
  new_user.id,
  (SELECT id FROM public.shops LIMIT 1),
  'client',
  'Mario Rossi',
  NOW(),
  NOW()
FROM new_user
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p
  JOIN auth.users u ON p.user_id = u.id
  WHERE u.email = 'cliente.test@example.com'
);

-- 4. Verifica il risultato finale
SELECT 
  'RISULTATO FINALE' as check_type,
  u.id as user_id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.full_name,
  p.shop_id,
  CASE 
    WHEN u.id IS NOT NULL AND p.user_id IS NOT NULL 
    THEN '✅ Utente e profilo creati/verificati'
    ELSE '❌ Errore nella creazione'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = 'cliente.test@example.com';

-- 5. Mostra le credenziali di test
SELECT 
  'CREDENZIALI DI TEST' as info,
  'Email: cliente.test@example.com' as email,
  'Password: password123' as password,
  'Ruolo: client' as role;
