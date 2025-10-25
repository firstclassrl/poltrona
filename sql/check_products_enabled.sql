-- Script per verificare e aggiungere il campo products_enabled alla tabella shops

-- 1. Verifica se la colonna products_enabled esiste
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'shops' 
  AND table_schema = 'public'
  AND column_name = 'products_enabled';

-- 2. Se la colonna non esiste, aggiungila
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS products_enabled BOOLEAN DEFAULT true;

-- 3. Aggiungi commento alla colonna
COMMENT ON COLUMN public.shops.products_enabled IS 'Controlla se il sistema prodotti è abilitato per questo negozio';

-- 4. Verifica il risultato
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'shops' 
  AND table_schema = 'public'
  AND column_name = 'products_enabled';

-- 5. Mostra i dati attuali della tabella shops
SELECT id, name, products_enabled, created_at 
FROM public.shops 
ORDER BY created_at DESC;
