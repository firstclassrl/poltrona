-- Script per verificare la struttura reale della tabella products
-- Eseguire questo script nel Supabase SQL Editor per verificare la struttura

-- 1. Verifica struttura colonne della tabella products
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verifica se esiste colonna price o price_cents
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND table_schema = 'public'
  AND (column_name LIKE '%price%')
ORDER BY column_name;

-- 3. Mostra alcuni prodotti di esempio (query dinamica basata su Query 1)
-- PRIMA esegui la Query 1 per vedere quali colonne esistono, poi usa questa:
SELECT * FROM public.products ORDER BY created_at DESC LIMIT 5;

-- 4. Verifica conteggio prodotti
SELECT COUNT(*) as total_products FROM public.products;
