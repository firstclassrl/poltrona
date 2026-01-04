-- =====================================================
-- DIAGNOSTICA DETTAGLIATA: STAFF E PROFILI COLLEGATI
-- =====================================================
-- Questo script mostra i dettagli dei 4 staff e dei loro profili collegati
-- =====================================================

-- 1) DETTAGLI COMPLETI STAFF CON PROFILI COLLEGATI
-- =====================================================
SELECT 
    '=== DETTAGLI STAFF E PROFILI COLLEGATI ===' as section;

SELECT 
    s.id as staff_id,
    s.full_name as staff_name,
    s.role as staff_role,
    s.user_id as staff_user_id,
    s.shop_id as staff_shop_id,
    s.active as staff_active,
    s.email as staff_email,
    s.phone as staff_phone,
    p.user_id as profile_user_id,
    p.full_name as profile_name,
    p.role as profile_role,
    p.shop_id as profile_shop_id,
    CASE 
        WHEN p.user_id IS NULL THEN '❌ Nessun profile trovato per questo user_id'
        WHEN p.role = 'barber' THEN '✅ Profile.role=barber (corretto)'
        WHEN p.role = 'admin' THEN '⚠️ Profile.role=admin (dovrebbe essere barber?)'
        WHEN p.role = 'client' THEN '⚠️ Profile.role=client (dovrebbe essere barber?)'
        ELSE '⚠️ Profile.role=' || p.role || ' (non barber)'
    END as status,
    CASE 
        WHEN s.user_id IS NOT NULL AND p.user_id IS NULL THEN 'CRITICO: Staff ha user_id ma profile non esiste'
        WHEN s.user_id IS NOT NULL AND p.role != 'barber' THEN 'PROBLEMA: Staff collegato ma profile.role != barber'
        WHEN s.user_id IS NOT NULL AND p.role = 'barber' THEN 'OK: Tutto corretto'
        ELSE 'INFO: Staff senza user_id (normale per staff non collegati)'
    END as issue
FROM public.staff s
LEFT JOIN public.profiles p ON p.user_id = s.user_id
ORDER BY s.full_name;

-- 2) PROFILI ADMIN CON STAFF COLLEGATO
-- =====================================================
SELECT 
    '=== PROFILI ADMIN CON STAFF COLLEGATO ===' as section;

SELECT 
    p.user_id,
    p.full_name,
    p.role as profile_role,
    p.shop_id as profile_shop_id,
    s.id as staff_id,
    s.full_name as staff_name,
    s.role as staff_role,
    s.user_id as staff_user_id,
    '⚠️ Questo admin ha un record staff - potrebbe essere un barber?' as note
FROM public.profiles p
INNER JOIN public.staff s ON s.user_id = p.user_id
WHERE p.role = 'admin'
ORDER BY p.full_name;

-- 3) PROFILI CLIENT CON STAFF COLLEGATO (se esistono)
-- =====================================================
SELECT 
    '=== PROFILI CLIENT CON STAFF COLLEGATO ===' as section;

SELECT 
    p.user_id,
    p.full_name,
    p.role as profile_role,
    p.shop_id as profile_shop_id,
    s.id as staff_id,
    s.full_name as staff_name,
    s.role as staff_role,
    s.user_id as staff_user_id,
    '⚠️ CRITICO: Questo client ha un record staff - dovrebbe essere barber!' as note
FROM public.profiles p
INNER JOIN public.staff s ON s.user_id = p.user_id
WHERE p.role = 'client'
ORDER BY p.full_name;

-- 4) RIEPILOGO: QUANTI STAFF DOVREBBERO AVERE ROLE=BARBER
-- =====================================================
SELECT 
    '=== RIEPILOGO: STAFF CHE DOVREBBERO ESSERE BARBER ===' as section;

SELECT 
    COUNT(*) as total_staff_with_user_id,
    COUNT(CASE WHEN p.role = 'barber' THEN 1 END) as profiles_with_role_barber,
    COUNT(CASE WHEN p.role = 'admin' THEN 1 END) as profiles_with_role_admin,
    COUNT(CASE WHEN p.role = 'client' THEN 1 END) as profiles_with_role_client,
    COUNT(CASE WHEN p.role IS NULL THEN 1 END) as profiles_missing,
    COUNT(CASE WHEN p.role NOT IN ('barber', 'admin', 'client') THEN 1 END) as profiles_with_other_role
FROM public.staff s
LEFT JOIN public.profiles p ON p.user_id = s.user_id
WHERE s.user_id IS NOT NULL;

-- 5) EMAIL DEGLI STAFF (se disponibile)
-- =====================================================
SELECT 
    '=== EMAIL DEGLI STAFF ===' as section;

SELECT 
    s.id as staff_id,
    s.full_name as staff_name,
    s.email as staff_email,
    s.user_id as staff_user_id,
    COALESCE(au.email, 'N/A') as auth_user_email,
    p.role as profile_role
FROM public.staff s
LEFT JOIN auth.users au ON au.id = s.user_id
LEFT JOIN public.profiles p ON p.user_id = s.user_id
WHERE s.user_id IS NOT NULL
ORDER BY s.full_name;
