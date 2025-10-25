-- Script per debuggare il problema products_enabled

-- 1. Verifica struttura tabella shops
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'shops' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Mostra tutti i dati della tabella shops
SELECT * FROM public.shops;

-- 3. Verifica se products_enabled esiste e il suo valore
SELECT 
  id, 
  name, 
  products_enabled,
  CASE 
    WHEN products_enabled IS NULL THEN 'NULL'
    WHEN products_enabled = true THEN 'TRUE'
    WHEN products_enabled = false THEN 'FALSE'
    ELSE 'UNKNOWN'
  END as products_enabled_status
FROM public.shops;

-- 4. Se products_enabled non esiste, aggiungilo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shops' 
      AND table_schema = 'public'
      AND column_name = 'products_enabled'
  ) THEN
    ALTER TABLE public.shops ADD COLUMN products_enabled BOOLEAN DEFAULT true;
    RAISE NOTICE 'Colonna products_enabled aggiunta con valore di default TRUE';
  ELSE
    RAISE NOTICE 'Colonna products_enabled già esistente';
  END IF;
END $$;

-- 5. Aggiorna tutti i record esistenti per assicurarsi che abbiano un valore
UPDATE public.shops 
SET products_enabled = true 
WHERE products_enabled IS NULL;

-- 6. Verifica il risultato finale
SELECT 
  id, 
  name, 
  products_enabled,
  created_at,
  updated_at
FROM public.shops 
ORDER BY created_at DESC;
