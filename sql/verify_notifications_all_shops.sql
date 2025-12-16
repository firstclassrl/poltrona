-- ============================================
-- VERIFICA: Notifiche per tutti i negozi
-- Esegui questo script su Supabase SQL Editor
-- ============================================
-- Questo script verifica che le notifiche funzionino correttamente
-- per tutti i negozi e identifica eventuali problemi

-- 1. Verifica tutti i negozi esistenti
-- ============================================
SELECT 
    id as shop_id,
    name as shop_name,
    created_at
FROM public.shops
ORDER BY name;

-- 2. Verifica notifiche per negozio
-- ============================================
SELECT 
    n.shop_id,
    sh.name as shop_name,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE n.read_at IS NULL) as unread_notifications,
    COUNT(*) FILTER (WHERE n.read_at IS NOT NULL) as read_notifications,
    MIN(n.created_at) as first_notification,
    MAX(n.created_at) as last_notification
FROM public.notifications n
LEFT JOIN public.shops sh ON n.shop_id = sh.id
GROUP BY n.shop_id, sh.name
ORDER BY sh.name;

-- 3. Verifica notifiche senza shop_id (problema!)
-- ============================================
SELECT 
    COUNT(*) as notifications_without_shop_id,
    COUNT(*) FILTER (WHERE read_at IS NULL) as unread_without_shop_id
FROM public.notifications
WHERE shop_id IS NULL;

-- 4. Verifica notifiche per tipo e negozio
-- ============================================
SELECT 
    n.shop_id,
    sh.name as shop_name,
    n.type,
    COUNT(*) as count
FROM public.notifications n
LEFT JOIN public.shops sh ON n.shop_id = sh.id
GROUP BY n.shop_id, sh.name, n.type
ORDER BY sh.name, n.type;

-- 5. Verifica staff con user_id per negozio
-- ============================================
SELECT 
    s.shop_id,
    sh.name as shop_name,
    COUNT(*) as total_staff,
    COUNT(s.user_id) as staff_with_user_id,
    COUNT(*) FILTER (WHERE s.user_id IS NULL) as staff_without_user_id,
    COUNT(*) FILTER (WHERE s.active = true) as active_staff,
    COUNT(*) FILTER (WHERE s.active = true AND s.user_id IS NOT NULL) as active_staff_with_user_id
FROM public.staff s
LEFT JOIN public.shops sh ON s.shop_id = sh.id
GROUP BY s.shop_id, sh.name
ORDER BY sh.name;

-- 6. Verifica ultime notifiche create per negozio
-- ============================================
SELECT 
    n.shop_id,
    sh.name as shop_name,
    n.type,
    n.title,
    n.user_id,
    n.created_at,
    CASE WHEN n.read_at IS NULL THEN 'Non letta' ELSE 'Letta' END as status
FROM public.notifications n
LEFT JOIN public.shops sh ON n.shop_id = sh.id
ORDER BY n.created_at DESC
LIMIT 20;

-- 7. Verifica appuntamenti recenti e relative notifiche
-- ============================================
SELECT 
    a.id as appointment_id,
    a.shop_id,
    sh.name as shop_name,
    a.start_at,
    a.created_at as appointment_created_at,
    COUNT(n.id) as notification_count,
    STRING_AGG(n.id::text, ', ') as notification_ids
FROM public.appointments a
LEFT JOIN public.shops sh ON a.shop_id = sh.id
LEFT JOIN public.notifications n ON n.data->>'appointment_id' = a.id::text
WHERE a.created_at > NOW() - INTERVAL '7 days'
GROUP BY a.id, a.shop_id, sh.name, a.start_at, a.created_at
ORDER BY a.created_at DESC
LIMIT 20;

-- 8. Verifica trigger attivo
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'appointments'
    AND trigger_name = 'trigger_notify_barber_on_created';

-- 9. Verifica RLS policies per notifications
-- ============================================
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- 10. Test: Conta notifiche per user_id e shop_id
-- ============================================
SELECT 
    n.user_id,
    n.shop_id,
    sh.name as shop_name,
    COUNT(*) as notification_count,
    COUNT(*) FILTER (WHERE n.read_at IS NULL) as unread_count
FROM public.notifications n
LEFT JOIN public.shops sh ON n.shop_id = sh.id
GROUP BY n.user_id, n.shop_id, sh.name
ORDER BY notification_count DESC
LIMIT 20;


