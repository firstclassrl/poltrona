-- Script per testare il sistema di notifiche email
-- Questo script simula la creazione di un nuovo cliente e verifica che tutto funzioni

-- 1. Verifica che il negozio abbia l'email di notifica configurata
SELECT 
  'CONFIGURAZIONE NEGOZIO' as check_type,
  id,
  name,
  notification_email,
  CASE 
    WHEN notification_email IS NOT NULL AND notification_email != '' 
    THEN '✅ Configurata' 
    ELSE '❌ Non configurata' 
  END as status
FROM public.shops
LIMIT 1;

-- 2. Conta gli utenti esistenti prima del test
SELECT 
  'UTENTI PRIMA DEL TEST' as check_type,
  COUNT(*) as total_users,
  COUNT(CASE WHEN p.role = 'client' THEN 1 END) as client_users
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id;

-- 3. Crea un utente di test per simulare una nuova registrazione
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
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
  'test.notification@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Test Notification User"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- 4. Il trigger dovrebbe aver creato automaticamente il profilo
-- Verifichiamo se è stato creato
SELECT 
  'PROFILO CREATO DAL TRIGGER' as check_type,
  u.id as user_id,
  u.email,
  p.role,
  p.full_name,
  p.shop_id,
  CASE 
    WHEN p.user_id IS NOT NULL 
    THEN '✅ Profilo creato automaticamente' 
    ELSE '❌ Profilo non creato' 
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = 'test.notification@example.com';

-- 5. Verifica che l'email di notifica sia configurata per il negozio
SELECT 
  'EMAIL NOTIFICA CONFIGURATA' as check_type,
  s.name as shop_name,
  s.notification_email,
  CASE 
    WHEN s.notification_email IS NOT NULL AND s.notification_email != '' 
    THEN '✅ Email configurata: ' || s.notification_email
    ELSE '❌ Email non configurata'
  END as status
FROM public.shops s
LIMIT 1;

-- 6. Mostra i dati che verrebbero inviati nell'email di notifica
SELECT 
  'DATI PER EMAIL NOTIFICA' as check_type,
  u.email as client_email,
  COALESCE(p.full_name, u.email) as client_name,
  s.name as shop_name,
  s.notification_email as notification_email,
  u.created_at as registration_date
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
JOIN public.shops s ON p.shop_id = s.id
WHERE u.email = 'test.notification@example.com';

-- 7. Conta gli utenti dopo il test
SELECT 
  'UTENTI DOPO IL TEST' as check_type,
  COUNT(*) as total_users,
  COUNT(CASE WHEN p.role = 'client' THEN 1 END) as client_users
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id;

-- 8. Pulisci l'utente di test (opzionale)
-- DELETE FROM public.profiles WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'test.notification@example.com');
-- DELETE FROM auth.users WHERE email = 'test.notification@example.com';
