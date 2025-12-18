-- Aggiunge il campo theme_palette alla tabella shops (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shops'
      AND column_name = 'theme_palette'
  ) THEN
    ALTER TABLE public.shops
      ADD COLUMN theme_palette TEXT;
  END IF;
END $$;

-- Imposta un valore di default sulle righe esistenti se nullo
UPDATE public.shops
SET theme_palette = COALESCE(theme_palette, 'heritage')
WHERE theme_palette IS NULL;

COMMENT ON COLUMN public.shops.theme_palette IS 'Identificatore palette tema frontend (es. heritage, aurora, sunset-neon, terra-soft, cyber-lilac)';







