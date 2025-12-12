-- Aggiunge la colonna theme_palette alla tabella shops (idempotente)
-- Necessaria per salvare il tema scelto nel setup/login

ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS theme_palette TEXT;

-- (Opzionale) commento di documentazione
COMMENT ON COLUMN public.shops.theme_palette IS 'ID della palette tema scelta per il negozio';

