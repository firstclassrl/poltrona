-- ============================================
-- Script per verificare trigger duplicati e problemi
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- 1. Verifica tutti i trigger sulla tabella auth.users
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'users'
    AND event_object_schema = 'auth'
ORDER BY trigger_name;

-- 2. Verifica tutte le funzioni che potrebbero creare notifiche
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_definition LIKE '%notifications%'
ORDER BY routine_name;

-- 3. Verifica se ci sono notifiche duplicate per lo stesso cliente
SELECT 
    data->>'client_user_id' as client_id,
    COUNT(*) as notification_count,
    array_agg(id ORDER BY created_at) as notification_ids,
    array_agg(created_at ORDER BY created_at) as created_times
FROM public.notifications
WHERE type = 'new_client'
    AND created_at > NOW() - INTERVAL '1 day'
GROUP BY data->>'client_user_id'
HAVING COUNT(*) > 1
ORDER BY notification_count DESC;

-- 4. Verifica quanti barbieri attivi ci sono con user_id
SELECT 
    COUNT(*) as total_barbers,
    COUNT(DISTINCT user_id) as unique_user_ids,
    array_agg(DISTINCT user_id) as user_ids
FROM public.staff
WHERE active = true
    AND user_id IS NOT NULL
    AND (
        LOWER(role) LIKE '%barber%' 
        OR LOWER(role) IN ('barber', 'barbiere', 'barbiere senior', 'barbiere junior', 'master barber', 'junior barber', 'owner', 'admin', 'proprietario')
    );















