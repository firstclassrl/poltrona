-- Script semplificato per verificare la struttura reale della tabella products
-- Eseguire questo script nel Supabase SQL Editor

-- Query 1: Verifica struttura colonne (ESEGUIRE PRIMA)
-- Questa ti dirà ESATTAMENTE quali colonne esistono
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Query 2: Verifica solo colonne che contengono "price" nel nome
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND table_schema = 'public'
  AND column_name LIKE '%price%'
ORDER BY column_name;

-- Query 3: Mostra tutti i dati di esempio (SELECT * è sicuro)
SELECT * 
FROM public.products 
ORDER BY created_at DESC 
LIMIT 5;

-- Query 4: Conteggio prodotti
SELECT COUNT(*) as total_products 
FROM public.products;
