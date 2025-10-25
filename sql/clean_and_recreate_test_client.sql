-- Script per PULIRE e RICREARE un utente cliente di test
-- ATTENZIONE: Questo script ELIMINA l'utente esistente e lo ricrea

-- 1. ELIMINA l'utente di test esistente (se esiste)
DELETE FROM public.profiles 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'cliente.test@example.com'
);

DELETE FROM auth.users 
WHERE email = 'cliente.test@example.com';

-- 2. Verifica che sia stato eliminato
SELECT 
  'UTENTE ELIMINATO' as check_type,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Utente eliminato con successo'
    ELSE '❌ Utente ancora presente'
  END as status
FROM auth.users 
WHERE email = 'cliente.test@example.com';

-- 3. Crea il nuovo utente
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
) VALUES (
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
);

-- 4. Crea il profilo
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
FROM new_user;

-- 5. Verifica la creazione
SELECT 
  'UTENTE RICREATO' as check_type,
  u.id as user_id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.full_name,
  p.shop_id,
  '✅ Utente ricreato con successo' as status
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = 'cliente.test@example.com';

-- 6. Mostra le credenziali
SELECT 
  'CREDENZIALI DI TEST' as info,
  'Email: cliente.test@example.com' as email,
  'Password: password123' as password,
  'Ruolo: client' as role;
