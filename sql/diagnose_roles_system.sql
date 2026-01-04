-- =====================================================
-- SCRIPT DI DIAGNOSTICA COMPLETA SISTEMA RUOLI
-- =====================================================
-- Questo script esporta tutte le informazioni necessarie
-- per capire come funziona il sistema ruoli nel database
-- =====================================================

-- 1) STRUTTURA TABELLA PROFILES
-- =====================================================
SELECT 
    '=== STRUTTURA TABELLA PROFILES ===' as section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 2) STRUTTURA TABELLA STAFF
-- =====================================================
SELECT 
    '=== STRUTTURA TABELLA STAFF ===' as section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'staff'
ORDER BY ordinal_position;

-- 3) CONSTRAINT SUI RUOLI
-- =====================================================
SELECT 
    '=== CONSTRAINT SUI RUOLI ===' as section;

SELECT 
    tc.constraint_name,
    tc.table_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'profiles'
  AND tc.constraint_type = 'CHECK'
  AND cc.check_clause LIKE '%role%';

-- 4) TUTTI I RUOLI PRESENTI NELLA TABELLA PROFILES
-- =====================================================
SELECT 
    '=== DISTRIBUZIONE RUOLI IN PROFILES ===' as section;

SELECT 
    role,
    COUNT(*) as count,
    STRING_AGG(DISTINCT full_name, ', ' ORDER BY full_name) as users
FROM public.profiles
GROUP BY role
ORDER BY count DESC;

-- 5) TUTTI I RUOLI PRESENTI NELLA TABELLA STAFF
-- =====================================================
SELECT 
    '=== DISTRIBUZIONE RUOLI IN STAFF ===' as section;

SELECT 
    role,
    COUNT(*) as count,
    STRING_AGG(DISTINCT full_name, ', ' ORDER BY full_name) as staff_members
FROM public.staff
GROUP BY role
ORDER BY count DESC;

-- 6) UTENTI CON RUOLO BARBER IN PROFILES
-- =====================================================
SELECT 
    '=== UTENTI CON ROLE=BARBER IN PROFILES ===' as section;

SELECT 
    p.user_id,
    p.full_name,
    p.role as profile_role,
    p.shop_id as profile_shop_id,
    s.id as staff_id,
    s.role as staff_role,
    s.user_id as staff_user_id,
    s.active as staff_active,
    CASE 
        WHEN s.id IS NULL THEN '❌ Nessun record staff collegato'
        WHEN s.user_id IS NULL THEN '⚠️ Staff esiste ma user_id NULL'
        WHEN s.user_id != p.user_id THEN '⚠️ Staff.user_id diverso da profile.user_id'
        ELSE '✅ Staff collegato correttamente'
    END as status
FROM public.profiles p
LEFT JOIN public.staff s ON s.user_id = p.user_id
WHERE p.role = 'barber'
ORDER BY p.full_name;

-- 7) UTENTI CON RUOLO CLIENT MA CON RECORD STAFF
-- =====================================================
SELECT 
    '=== UTENTI CON ROLE=CLIENT MA CON RECORD STAFF ===' as section;

SELECT 
    p.user_id,
    p.full_name,
    p.role as profile_role,
    p.shop_id as profile_shop_id,
    s.id as staff_id,
    s.role as staff_role,
    s.user_id as staff_user_id,
    s.active as staff_active,
    '⚠️ Possibile inconsistenza: profile.role=client ma esiste staff' as warning
FROM public.profiles p
INNER JOIN public.staff s ON s.user_id = p.user_id
WHERE p.role = 'client'
ORDER BY p.full_name;

-- 8) STAFF CON USER_ID MA PROFILE.ROLE DIVERSO DA BARBER/ADMIN
-- =====================================================
SELECT 
    '=== STAFF CON USER_ID MA PROFILE.ROLE NON BARBER/ADMIN ===' as section;

SELECT 
    s.id as staff_id,
    s.full_name as staff_name,
    s.role as staff_role,
    s.user_id as staff_user_id,
    p.role as profile_role,
    p.full_name as profile_name,
    CASE 
        WHEN p.role IS NULL THEN '❌ Nessun profile trovato'
        WHEN p.role = 'client' THEN '⚠️ Profile.role=client (dovrebbe essere barber/admin)'
        ELSE '⚠️ Profile.role=' || p.role || ' (non barber/admin)'
    END as warning
FROM public.staff s
LEFT JOIN public.profiles p ON p.user_id = s.user_id
WHERE s.user_id IS NOT NULL
  AND (p.role IS NULL OR p.role NOT IN ('barber', 'admin', 'staff', 'owner'))
ORDER BY s.full_name;

-- 9) RLS POLICIES SULLA TABELLA PROFILES
-- =====================================================
SELECT 
    '=== RLS POLICIES SU PROFILES ===' as section;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY policyname;

-- 10) TRIGGER SULLA TABELLA PROFILES
-- =====================================================
SELECT 
    '=== TRIGGER SU PROFILES ===' as section;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
  AND event_object_table = 'profiles'
ORDER BY trigger_name;

-- 11) TRIGGER SULLA TABELLA STAFF
-- =====================================================
SELECT 
    '=== TRIGGER SU STAFF ===' as section;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
  AND event_object_table = 'staff'
ORDER BY trigger_name;

-- 12) FUNZIONI TRIGGER RELATIVE AI RUOLI
-- =====================================================
SELECT 
    '=== FUNZIONI TRIGGER RELATIVE AI RUOLI ===' as section;

SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%role%' 
    OR routine_name LIKE '%staff%'
    OR routine_name LIKE '%profile%'
    OR routine_name LIKE '%user%'
  )
ORDER BY routine_name;

-- 13) RELAZIONI TRA PROFILES E STAFF (JOIN COMPLETO)
-- =====================================================
SELECT 
    '=== RELAZIONI COMPLETE PROFILES <-> STAFF ===' as section;

SELECT 
    p.user_id,
    p.full_name as profile_name,
    p.role as profile_role,
    p.shop_id as profile_shop_id,
    s.id as staff_id,
    s.full_name as staff_name,
    s.role as staff_role,
    s.user_id as staff_user_id,
    s.shop_id as staff_shop_id,
    s.active as staff_active,
    CASE 
        WHEN s.id IS NULL AND p.role IN ('barber', 'admin', 'staff', 'owner') THEN '⚠️ Profile ha ruolo barber/admin ma nessun staff'
        WHEN s.id IS NOT NULL AND s.user_id IS NULL THEN '⚠️ Staff esiste ma user_id NULL'
        WHEN s.id IS NOT NULL AND s.user_id != p.user_id THEN '⚠️ Staff.user_id != Profile.user_id'
        WHEN s.id IS NOT NULL AND s.user_id = p.user_id THEN '✅ Collegamento corretto'
        WHEN p.role = 'client' AND s.id IS NULL THEN '✅ Cliente senza staff (normale)'
        ELSE 'ℹ️ Altro'
    END as status
FROM public.profiles p
LEFT JOIN public.staff s ON s.user_id = p.user_id
ORDER BY p.role, p.full_name;

-- 14) UTENTI CON EMAIL (se disponibile da auth.users)
-- =====================================================
-- Nota: Questo potrebbe non funzionare se non hai accesso diretto ad auth.users
-- In tal caso, usa solo i dati da profiles
SELECT 
    '=== UTENTI CON EMAIL (se disponibile) ===' as section;

SELECT 
    p.user_id,
    p.full_name,
    p.role,
    p.shop_id,
    COALESCE(au.email, 'N/A') as email,
    au.created_at as user_created_at
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
ORDER BY p.role, p.full_name
LIMIT 50; -- Limita per non sovraccaricare

-- 15) RIEPILOGO FINALE
-- =====================================================
SELECT 
    '=== RIEPILOGO FINALE ===' as section;

SELECT 
    'Total profiles' as metric,
    COUNT(*)::text as value
FROM public.profiles
UNION ALL
SELECT 
    'Profiles with role=barber' as metric,
    COUNT(*)::text as value
FROM public.profiles
WHERE role = 'barber'
UNION ALL
SELECT 
    'Profiles with role=client' as metric,
    COUNT(*)::text as value
FROM public.profiles
WHERE role = 'client'
UNION ALL
SELECT 
    'Profiles with role=admin' as metric,
    COUNT(*)::text as value
FROM public.profiles
WHERE role = 'admin'
UNION ALL
SELECT 
    'Total staff' as metric,
    COUNT(*)::text as value
FROM public.staff
UNION ALL
SELECT 
    'Staff with user_id' as metric,
    COUNT(*)::text as value
FROM public.staff
WHERE user_id IS NOT NULL
UNION ALL
SELECT 
    'Staff without user_id' as metric,
    COUNT(*)::text as value
FROM public.staff
WHERE user_id IS NULL
UNION ALL
SELECT 
    'Barber profiles without staff' as metric,
    COUNT(*)::text as value
FROM public.profiles p
WHERE p.role = 'barber'
  AND NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = p.user_id)
UNION ALL
SELECT 
    'Client profiles with staff' as metric,
    COUNT(*)::text as value
FROM public.profiles p
WHERE p.role = 'client'
  AND EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = p.user_id);
