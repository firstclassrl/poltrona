-- =====================================================
-- FIX: Aggiorna profiles.role a 'barber' per staff con user_id
-- =====================================================
-- Questo script corregge i profili degli utenti che hanno
-- un record staff collegato ma non hanno role='barber'
-- =====================================================

-- 1) VERIFICA SITUAZIONE ATTUALE
-- =====================================================
SELECT 
    '=== SITUAZIONE PRIMA DEL FIX ===' as section;

SELECT 
    s.id as staff_id,
    s.full_name as staff_name,
    s.user_id as staff_user_id,
    p.role as current_profile_role,
    CASE 
        WHEN p.role = 'barber' THEN '✅ Già corretto'
        WHEN p.role = 'admin' THEN '⚠️ Sarà aggiornato a barber (mantieni admin se necessario)'
        WHEN p.role = 'client' THEN '⚠️ Sarà aggiornato a barber'
        WHEN p.role IS NULL THEN '❌ Profile non trovato'
        ELSE '⚠️ Sarà aggiornato a barber'
    END as status
FROM public.staff s
LEFT JOIN public.profiles p ON p.user_id = s.user_id
WHERE s.user_id IS NOT NULL
ORDER BY s.full_name;

-- 2) AGGIORNA PROFILES.ROLE A 'barber' PER STAFF CON USER_ID
-- =====================================================
-- IMPORTANTE: Questo aggiorna i profili degli staff a 'barber'
-- Se alcuni utenti devono rimanere 'admin', escludili manualmente prima di eseguire
-- 
-- Per mantenere alcuni utenti come 'admin', modifica la query aggiungendo:
-- AND p.user_id NOT IN ('user_id_1', 'user_id_2', ...)

UPDATE public.profiles p
SET role = 'barber',
    updated_at = NOW()
FROM public.staff s
WHERE s.user_id = p.user_id
  AND s.user_id IS NOT NULL
  AND p.role != 'barber'
  -- Se vuoi mantenere alcuni admin specifici, aggiungi qui:
  -- AND p.user_id NOT IN ('dec2dd5c-8045-4ab2-a834-750b522728de') -- Esempio: DARIO rimane admin
;

-- 3) VERIFICA RISULTATO
-- =====================================================
SELECT 
    '=== SITUAZIONE DOPO IL FIX ===' as section;

SELECT 
    s.id as staff_id,
    s.full_name as staff_name,
    s.user_id as staff_user_id,
    p.role as profile_role,
    CASE 
        WHEN p.role = 'barber' THEN '✅ Corretto'
        WHEN p.role = 'admin' THEN 'ℹ️ Mantenuto come admin'
        ELSE '⚠️ Ancora non barber'
    END as status
FROM public.staff s
LEFT JOIN public.profiles p ON p.user_id = s.user_id
WHERE s.user_id IS NOT NULL
ORDER BY s.full_name;

-- 4) STATISTICHE FINALI
-- =====================================================
SELECT 
    '=== STATISTICHE FINALI ===' as section;

SELECT 
    'Profiles with role=barber' as metric,
    COUNT(*)::text as value
FROM public.profiles
WHERE role = 'barber'
UNION ALL
SELECT 
    'Staff with user_id and profile.role=barber' as metric,
    COUNT(*)::text as value
FROM public.staff s
INNER JOIN public.profiles p ON p.user_id = s.user_id
WHERE s.user_id IS NOT NULL
  AND p.role = 'barber';
