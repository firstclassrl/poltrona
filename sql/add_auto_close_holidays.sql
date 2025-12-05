-- Script per aggiungere la colonna auto_close_holidays alla tabella shops
-- Questo script aggiunge il campo per la chiusura automatica nei giorni festivi nazionali italiani

-- Aggiungere colonna per chiusura automatica feste nazionali
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS auto_close_holidays BOOLEAN DEFAULT true;

-- Aggiungere commento per documentare la colonna
COMMENT ON COLUMN public.shops.auto_close_holidays IS 'Se true, il negozio chiude automaticamente nei giorni festivi nazionali italiani (feste rosse)';

-- Verificare che la colonna sia stata aggiunta
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'shops' 
  AND column_name = 'auto_close_holidays';

