-- Script per creare utenti di test con email uniche
-- Questo script crea utenti con timestamp per evitare conflitti

-- Funzione per generare email uniche
CREATE OR REPLACE FUNCTION create_unique_test_client(
  base_name TEXT,
  base_email TEXT
) RETURNS TEXT AS $$
DECLARE
  unique_email TEXT;
  new_user_id UUID;
  shop_id UUID;
BEGIN
  -- Genera email unica con timestamp
  unique_email := base_email || '.' || EXTRACT(EPOCH FROM NOW())::TEXT || '@example.com';
  
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
    unique_email,
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    json_build_object('full_name', base_name),
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
    base_name,
    NOW(),
    NOW()
  );
  
  RETURN unique_email;
END;
$$ LANGUAGE plpgsql;

-- Crea diversi utenti di test con email uniche
SELECT 
  'Utente 1 creato: ' || create_unique_test_client('Mario Rossi', 'mario.rossi') as result_1;
SELECT 
  'Utente 2 creato: ' || create_unique_test_client('Giulia Bianchi', 'giulia.bianchi') as result_2;
SELECT 
  'Utente 3 creato: ' || create_unique_test_client('Luca Verdi', 'luca.verdi') as result_3;

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
  'Password per tutti: password123' as password,
  'Ruolo: client' as role;

-- Pulisci la funzione helper
DROP FUNCTION IF EXISTS create_unique_test_client(TEXT, TEXT);
