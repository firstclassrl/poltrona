-- Aggiunge il campo products_enabled alla tabella shops
-- Questo campo controlla se il sistema prodotti è abilitato per il negozio

ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS products_enabled BOOLEAN DEFAULT true;

-- Aggiungi un commento per documentare il campo
COMMENT ON COLUMN public.shops.products_enabled IS 'Controlla se il sistema prodotti e upsell è abilitato per questo negozio';

-- Verifica che il campo sia stato aggiunto correttamente
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'shops' 
  AND column_name = 'products_enabled';
