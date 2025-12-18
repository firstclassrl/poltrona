-- =========================================================
-- Friendly store URLs: slug univoci e leggibili
-- =========================================================
-- 1) Normalizza gli slug (accenti → ascii, lower, dash)
-- 2) Backfill slug mancanti o duplicati con suffissi numerici
-- 3) Impone unicità globale e NOT NULL su public.shops.slug
-- =========================================================

-- Estensione per rimuovere gli accenti
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Funzione di slugify coerente con il frontend
CREATE OR REPLACE FUNCTION public.slugify_shop_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            unaccent(lower(COALESCE(value, ''))),
            '[^a-z0-9]+',
            '-',
            'g'
          ),
          '-+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    ),
    'retro-barbershop'
  );
$$;

-- Assicurati che la colonna slug esista
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slug mancanti/duplicati con suffissi deterministici
WITH base AS (
  SELECT
    id,
    slugify_shop_name(
      NULLIF(slug, '')::text
    ) AS existing_slug,
    slugify_shop_name(name) AS name_slug,
    created_at
  FROM public.shops
),
resolved AS (
  SELECT
    id,
    CASE
      WHEN existing_slug IS NOT NULL THEN existing_slug
      ELSE name_slug
    END AS base_slug,
    created_at
  FROM base
),
numbered AS (
  SELECT
    id,
    CASE
      WHEN base_slug = '' THEN 'retro-barbershop'
      ELSE base_slug
    END AS clean_slug,
    ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY created_at, id) AS rn
  FROM resolved
)
UPDATE public.shops s
SET slug = CASE
  WHEN n.rn = 1 THEN n.clean_slug
  ELSE n.clean_slug || '-' || n.rn
END
FROM numbered n
WHERE s.id = n.id;

-- Enforce NOT NULL e unicità globale
ALTER TABLE public.shops ALTER COLUMN slug SET NOT NULL;

-- Sostituisci l'indice non univoco con uno univoco
DROP INDEX IF EXISTS idx_shops_slug;
CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_unique ON public.shops(slug);

-- Nota: nessun redirect legacy (richiesto dal business)
-- Esegui questo script in prod e negli ambienti di staging/preview.





