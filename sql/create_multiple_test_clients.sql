-- Script per creare più utenti clienti di test
-- Questo script crea diversi utenti con dati vari per testare il sistema

-- Funzione helper per creare un utente cliente
CREATE OR REPLACE FUNCTION create_test_client(
  client_email TEXT,
  client_name TEXT,
  client_password TEXT DEFAULT 'password123'
) RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
  shop_id UUID;
BEGIN
  -- Ottieni l'ID del primo negozio
  SELECT id INTO shop_id FROM public.shops LIMIT 1;
  
  -- Genera un nuovo UUID per l'utente
  new_user_id := gen_random_uuid();
  
  -- Crea l'utente in auth.users
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
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    client_email,
    crypt(client_password, gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    json_build_object('full_name', client_name),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );
  
  -- Crea il profilo nella tabella public.profiles
  INSERT INTO public.profiles (
    user_id,
    shop_id,
    role,
    full_name,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    shop_id,
    'client',
    client_name,
    NOW(),
    NOW()
  );
  
  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

-- Crea diversi utenti di test
SELECT create_test_client('mario.rossi@example.com', 'Mario Rossi') as user_1;
SELECT create_test_client('giulia.bianchi@example.com', 'Giulia Bianchi') as user_2;
SELECT create_test_client('luca.verdi@example.com', 'Luca Verdi') as user_3;
SELECT create_test_client('anna.neri@example.com', 'Anna Neri') as user_4;
SELECT create_test_client('francesco.rossi@example.com', 'Francesco Rossi') as user_5;

-- Mostra tutti gli utenti di test creati
SELECT 
  'UTENTI DI TEST CREATI' as info,
  u.email,
  p.full_name,
  p.role,
  u.created_at
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
WHERE u.email LIKE '%@example.com'
ORDER BY u.created_at DESC;

-- Mostra le credenziali di test
SELECT 
  'CREDENZIALI DI TEST' as info,
  'Email: mario.rossi@example.com' as email_1,
  'Password: password123' as password_1,
  '---' as separator_1,
  'Email: giulia.bianchi@example.com' as email_2,
  'Password: password123' as password_2,
  '---' as separator_2,
  'Email: luca.verdi@example.com' as email_3,
  'Password: password123' as password_3;

-- Pulisci la funzione helper
DROP FUNCTION IF EXISTS create_test_client(TEXT, TEXT, TEXT);
