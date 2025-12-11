-- Aggiunge la colonna slug alla tabella shops (idempotente) e crea indice unico
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.shops
      ADD COLUMN slug TEXT;
  END IF;
END $$;

-- Rende slug NOT NULL e univoco (se la colonna esiste ma è nullable, imposta default temporaneo)
DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM public.shops WHERE slug IS NULL;
  IF missing_count > 0 THEN
    -- Assegna slug provvisorio basato su id (solo se mancante)
    UPDATE public.shops
    SET slug = CONCAT('shop-', id::text)
    WHERE slug IS NULL;
  END IF;

  -- Imposta NOT NULL e unicità
  ALTER TABLE public.shops ALTER COLUMN slug SET NOT NULL;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'shops' AND indexname = 'shops_slug_key'
  ) THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Indice dedicato per ricerche per slug
CREATE INDEX IF NOT EXISTS idx_shops_slug ON public.shops (slug);
