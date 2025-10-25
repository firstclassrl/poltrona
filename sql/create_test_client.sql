-- Script per creare un utente cliente di test
-- Questo script crea un utente completo con profilo per testare il sistema

-- 1. Crea l'utente in auth.users (simula la registrazione)
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
  gen_random_uuid(),                    -- id
  '00000000-0000-0000-0000-000000000000', -- instance_id
  'authenticated',                      -- aud
  'authenticated',                      -- role
  'cliente.test@example.com',           -- email
  crypt('password123', gen_salt('bf')), -- encrypted_password (password: password123)
  NOW(),                               -- email_confirmed_at
  NULL,                                -- recovery_sent_at
  NULL,                                -- last_sign_in_at
  '{"provider": "email", "providers": ["email"]}', -- raw_app_meta_data
  '{"full_name": "Mario Rossi"}',      -- raw_user_meta_data
  NOW(),                               -- created_at
  NOW(),                               -- updated_at
  '',                                  -- confirmation_token
  '',                                  -- email_change
  '',                                  -- email_change_token_new
  ''                                   -- recovery_token
);

-- 2. Ottieni l'ID dell'utente appena creato
WITH new_user AS (
  SELECT id FROM auth.users 
  WHERE email = 'cliente.test@example.com'
  ORDER BY created_at DESC 
  LIMIT 1
)
-- 3. Crea il profilo nella tabella public.profiles
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
  (SELECT id FROM public.shops LIMIT 1), -- Associa al primo negozio
  'client',
  'Mario Rossi',
  NOW(),
  NOW()
FROM new_user;

-- 4. Verifica che tutto sia stato creato correttamente
SELECT 
  'Utente creato' as status,
  u.id as user_id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.full_name,
  p.shop_id
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = 'cliente.test@example.com';

-- 5. Mostra le credenziali di test
SELECT 
  'CREDENZIALI DI TEST' as info,
  'Email: cliente.test@example.com' as email,
  'Password: password123' as password,
  'Ruolo: client' as role;
