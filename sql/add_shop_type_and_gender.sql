-- ============================================
-- MULTI-TIPOLOGIA: Aggiunta shop_type e gender
-- ============================================
-- Questo script aggiunge il supporto per diverse tipologie di attività:
-- - barbershop: barbieri e barber shop
-- - hairdresser: parrucchieri e saloni
-- - beauty_salon: estetiste e centri estetici

-- 1. Aggiungere colonna shop_type alla tabella shops
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS shop_type TEXT 
DEFAULT 'barbershop' 
CHECK (shop_type IN ('barbershop', 'hairdresser', 'beauty_salon'));

COMMENT ON COLUMN public.shops.shop_type IS 'Tipo di attività: barbershop, hairdresser, beauty_salon. Impostato alla creazione, non modificabile.';

-- 2. Aggiungere colonna gender alla tabella staff
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS gender TEXT 
DEFAULT 'male' 
CHECK (gender IN ('male', 'female', 'neutral'));

COMMENT ON COLUMN public.staff.gender IS 'Genere per declinazione terminologia: male, female, neutral';

-- 3. Migrazione shop esistenti → barbershop (per sicurezza)
UPDATE public.shops 
SET shop_type = 'barbershop' 
WHERE shop_type IS NULL;

-- 4. Migrazione staff esistenti → male (per sicurezza)
UPDATE public.staff 
SET gender = 'male' 
WHERE gender IS NULL;

-- 5. Creare indice per shop_type (utile per filtrare per tipologia)
CREATE INDEX IF NOT EXISTS idx_shops_shop_type ON public.shops(shop_type);

-- 6. Verifica
SELECT 
  'SUCCESS: shop_type and gender columns added' as status,
  (SELECT COUNT(*) FROM public.shops WHERE shop_type IS NOT NULL) as shops_with_type,
  (SELECT COUNT(*) FROM public.staff WHERE gender IS NOT NULL) as staff_with_gender;
