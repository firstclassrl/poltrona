-- Script per aggiungere la colonna notification_email alla tabella shops
-- Questo script aggiunge il campo per l'email di notifica del negozio

-- Aggiungere colonna per email notifiche
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS notification_email TEXT;

-- Aggiungere commento per documentare la colonna
COMMENT ON COLUMN public.shops.notification_email IS 'Email dove ricevere notifiche per nuove registrazioni clienti';

-- Verificare che la colonna sia stata aggiunta
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'shops' 
  AND column_name = 'notification_email';

-- Mostrare la struttura aggiornata della tabella shops
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'shops'
ORDER BY ordinal_position;
