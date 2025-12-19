-- Script per assicurarsi che shop_id nella tabella staff possa essere NULL
-- e che i barbieri non vengano assegnati allo shop di default

-- 1. Verifica che la tabella staff esista
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  role TEXT,
  calendar_id TEXT,
  active BOOLEAN DEFAULT true,
  chair_id TEXT,
  profile_photo_url TEXT,
  email TEXT,
  phone TEXT,
  specialties TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Assicurati che shop_id possa essere NULL (rimuovi eventuali constraint NOT NULL)
DO $$
BEGIN
  -- Verifica se esiste un constraint NOT NULL su shop_id e rimuovilo
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'staff' 
    AND column_name = 'shop_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.staff ALTER COLUMN shop_id DROP NOT NULL;
  END IF;
END $$;

-- 3. Aggiorna eventuali record con shop_id = '1' o shop_id di default a NULL
-- (solo se vuoi pulire i dati esistenti - commenta se non necessario)
-- UPDATE public.staff 
-- SET shop_id = NULL 
-- WHERE shop_id = '1' OR shop_id IS NULL AND EXISTS (
--   SELECT 1 FROM public.shops WHERE id = '1'
-- );

-- 4. Verifica che la foreign key permetta NULL
-- La foreign key già permette NULL grazie a ON DELETE SET NULL
-- Ma verifichiamo che non ci siano constraint aggiuntivi

-- 5. Crea un indice per migliorare le query
CREATE INDEX IF NOT EXISTS idx_staff_shop_id ON public.staff(shop_id) WHERE shop_id IS NOT NULL;

-- 6. Commento esplicativo
COMMENT ON COLUMN public.staff.shop_id IS 'ID del negozio di appartenenza. NULL indica che il barbiere non è ancora assegnato a nessun negozio.';

