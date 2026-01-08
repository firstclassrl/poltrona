-- ============================================
-- VERIFICA FINALE FIX (Versione Tabellare)
-- Esegui questo script per vedere i risultati dei check
-- ============================================

WITH checks AS (
    -- 1. Verifica Policies RLS
    SELECT 
        'RLS Policies' as check_name,
        CASE 
            WHEN COUNT(*) >= 3 THEN '✅ PASS'
            ELSE '❌ FAIL (Attese >= 3)'
        END as status,
        'Trovate ' || COUNT(*) || ' policies sicure' as details
    FROM pg_policy 
    WHERE polrelid = 'public.notifications'::regclass
    AND polname LIKE '%with shop_id%'

    UNION ALL

    -- 2. Verifica Trigger handle_new_user
    SELECT 
        'Trigger Logic' as check_name,
        CASE 
            WHEN pg_get_functiondef(p.oid) LIKE '%retro-barbershop%' OR pg_get_functiondef(p.oid) LIKE '%ORDER BY created_at ASC%LIMIT 1%' THEN '❌ FAIL'
            ELSE '✅ PASS'
        END as status,
        CASE 
            WHEN pg_get_functiondef(p.oid) LIKE '%retro-barbershop%' THEN 'Contiene ancora fallback su retro-barbershop'
            ELSE 'Nessun fallback pericoloso rilevato'
        END as details
    FROM pg_proc p
    WHERE proname = 'handle_new_user'

    UNION ALL

    -- 3. Verifica Colonna shop_id
    SELECT 
        'Database Schema' as check_name,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'shop_id') THEN '✅ PASS'
            ELSE '❌ FAIL'
        END as status,
        'Colonna shop_id presente' as details
)
SELECT * FROM checks;
