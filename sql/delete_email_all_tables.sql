-- ============================================
-- Script per eliminare cliente@abruzzo.ai da tutte le tabelle
-- ATTENZIONE: Questo script elimina definitivamente i dati!
-- ============================================

-- Prima verifichiamo cosa verrà eliminato
DO $$
DECLARE
  clients_count INT;
  staff_count INT;
  shops_count INT;
  auth_users_count INT;
  appointments_count INT;
  chats_count INT;
  waitlist_count INT;
BEGIN
  -- Conta i record che verranno eliminati
  SELECT COUNT(*) INTO clients_count FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');
  SELECT COUNT(*) INTO staff_count FROM public.staff WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');
  SELECT COUNT(*) INTO shops_count FROM public.shops WHERE LOWER(notification_email) = LOWER('cliente@abruzzo.ai');
  SELECT COUNT(*) INTO auth_users_count FROM auth.users WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');
  
  -- Conta i record correlati che verranno eliminati
  SELECT COUNT(*) INTO appointments_count 
  FROM public.appointments 
  WHERE client_id IN (SELECT id FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'))
     OR staff_id IN (SELECT id FROM public.staff WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'));
  
  SELECT COUNT(*) INTO chats_count 
  FROM public.chats 
  WHERE client_id IN (SELECT id FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'))
     OR staff_id IN (SELECT id FROM public.staff WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'));
  
  SELECT COUNT(*) INTO waitlist_count 
  FROM public.waitlist 
  WHERE client_id IN (SELECT id FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'));
  
  -- Mostra il riepilogo
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RIEPILOGO ELIMINAZIONI:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Clients da eliminare: %', clients_count;
  RAISE NOTICE 'Staff da eliminare: %', staff_count;
  RAISE NOTICE 'Shops da aggiornare: %', shops_count;
  RAISE NOTICE 'Auth users da eliminare: %', auth_users_count;
  RAISE NOTICE 'Appointments correlati: %', appointments_count;
  RAISE NOTICE 'Chats correlate: %', chats_count;
  RAISE NOTICE 'Waitlist correlate: %', waitlist_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- ELIMINAZIONE EFFETTIVA
-- ============================================

BEGIN;

-- 1. Elimina dalla waitlist (ON DELETE CASCADE con clients)
DELETE FROM public.waitlist 
WHERE client_id IN (
  SELECT id FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')
);

-- 2. Elimina i chat_messages correlati alle chats che verranno eliminate
DELETE FROM public.chat_messages 
WHERE chat_id IN (
  SELECT id FROM public.chats 
  WHERE client_id IN (SELECT id FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'))
     OR staff_id IN (SELECT id FROM public.staff WHERE LOWER(email) = LOWER('cliente@abruzzo.ai'))
);

-- 3. Elimina le chats (ON DELETE CASCADE con clients/staff)
DELETE FROM public.chats 
WHERE client_id IN (
  SELECT id FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')
)
OR staff_id IN (
  SELECT id FROM public.staff WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')
);

-- 4. Elimina gli appointments correlati (ON DELETE SET NULL, quindi dobbiamo eliminarli manualmente)
DELETE FROM public.appointments 
WHERE client_id IN (
  SELECT id FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')
)
OR staff_id IN (
  SELECT id FROM public.staff WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')
);

-- 5. Elimina i clients
DELETE FROM public.clients 
WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');

-- 6. Elimina lo staff
DELETE FROM public.staff 
WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');

-- 7. Aggiorna shops (rimuove solo l'email, non elimina il negozio)
UPDATE public.shops 
SET notification_email = NULL 
WHERE LOWER(notification_email) = LOWER('cliente@abruzzo.ai');

-- 8. Elimina gli utenti auth (questo elimina anche i profili correlati per ON DELETE CASCADE)
-- ATTENZIONE: Potrebbe richiedere privilegi elevati
DELETE FROM auth.users 
WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');

-- Mostra il risultato finale
DO $$
DECLARE
  remaining_clients INT;
  remaining_staff INT;
  remaining_shops INT;
  remaining_auth INT;
BEGIN
  SELECT COUNT(*) INTO remaining_clients FROM public.clients WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');
  SELECT COUNT(*) INTO remaining_staff FROM public.staff WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');
  SELECT COUNT(*) INTO remaining_shops FROM public.shops WHERE LOWER(notification_email) = LOWER('cliente@abruzzo.ai');
  SELECT COUNT(*) INTO remaining_auth FROM auth.users WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RISULTATO ELIMINAZIONE:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Clients rimanenti: %', remaining_clients;
  RAISE NOTICE 'Staff rimanenti: %', remaining_staff;
  RAISE NOTICE 'Shops con email: %', remaining_shops;
  RAISE NOTICE 'Auth users rimanenti: %', remaining_auth;
  
  IF remaining_clients = 0 AND remaining_staff = 0 AND remaining_shops = 0 AND remaining_auth = 0 THEN
    RAISE NOTICE '✅ SUCCESS: Email eliminata da tutte le tabelle!';
  ELSE
    RAISE NOTICE '⚠️  WARNING: Alcuni record potrebbero essere rimasti.';
  END IF;
  RAISE NOTICE '========================================';
END $$;

-- Conferma le modifiche (rimuovi il COMMIT se vuoi solo testare)
COMMIT;

-- ============================================
-- VERSIONE SICURA: Solo mostra cosa verrebbe eliminato (senza eliminare)
-- ============================================
-- Per testare senza eliminare, esegui solo questa query:

/*
SELECT 
  'clients' AS tabella,
  COUNT(*) AS record_da_eliminare,
  STRING_AGG(id::TEXT, ', ') AS ids
FROM public.clients 
WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')

UNION ALL

SELECT 
  'staff' AS tabella,
  COUNT(*) AS record_da_eliminare,
  STRING_AGG(id::TEXT, ', ') AS ids
FROM public.staff 
WHERE LOWER(email) = LOWER('cliente@abruzzo.ai')

UNION ALL

SELECT 
  'shops' AS tabella,
  COUNT(*) AS record_da_eliminare,
  STRING_AGG(id::TEXT, ', ') AS ids
FROM public.shops 
WHERE LOWER(notification_email) = LOWER('cliente@abruzzo.ai')

UNION ALL

SELECT 
  'auth.users' AS tabella,
  COUNT(*) AS record_da_eliminare,
  STRING_AGG(id::TEXT, ', ') AS ids
FROM auth.users 
WHERE LOWER(email) = LOWER('cliente@abruzzo.ai');
*/
