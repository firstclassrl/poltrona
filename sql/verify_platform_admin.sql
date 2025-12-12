-- Script di verifica per Platform Admin
-- Esegui queste query per verificare che tutto funzioni correttamente

-- ============================================
-- 1. Verifica che la colonna is_platform_admin esista
-- ============================================
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'is_platform_admin';

-- Risultato atteso: una riga con is_platform_admin, boolean, false, NO

-- ============================================
-- 2. Verifica che la funzione is_platform_admin() esista
-- ============================================
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'is_platform_admin';

-- Risultato atteso: una riga con is_platform_admin, FUNCTION, boolean

-- ============================================
-- 3. Verifica che le policy siano state create
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND (
    policyname LIKE '%platform_admin%'
    OR policyname LIKE '%profiles_select_platform_admin%'
    OR policyname LIKE '%profiles_update_platform_admin%'
    OR policyname LIKE '%shops_select_platform_admin%'
    OR policyname LIKE '%shops_all_platform_admin%'
  )
ORDER BY tablename, policyname;

-- Risultato atteso: almeno 4 policy (profiles_select, profiles_update, shops_select, shops_all)

-- ============================================
-- 4. Verifica quali utenti sono Platform Admin
-- ============================================
SELECT 
  p.user_id,
  p.full_name,
  p.role,
  p.shop_id,
  p.is_platform_admin,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE p.is_platform_admin = true;

-- Risultato atteso: lista degli utenti con is_platform_admin = true
-- Se non vedi risultati, significa che nessun utente è ancora stato promosso a platform admin

-- ============================================
-- 5. Test della funzione is_platform_admin() con un user_id specifico
-- ============================================
-- Sostituisci 'TUO_USER_ID_QUI' con il tuo user_id reale
-- SELECT public.is_platform_admin('TUO_USER_ID_QUI'::UUID);

-- Oppure testa con l'utente corrente (se sei loggato):
-- SELECT public.is_platform_admin();

-- Risultato atteso: true se sei platform admin, false altrimenti

-- ============================================
-- 6. Verifica che l'indice esista
-- ============================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'profiles' 
  AND indexname = 'idx_profiles_is_platform_admin';

-- Risultato atteso: una riga con l'indice

-- ============================================
-- 7. Test completo: verifica accesso ai negozi
-- ============================================
-- Questa query mostra quanti negozi puoi vedere in base al tuo ruolo
-- Esegui questa query mentre sei loggato come platform admin
SELECT 
  COUNT(*) as total_shops,
  CASE 
    WHEN public.is_platform_admin() THEN 'Platform Admin - Vedi tutti i negozi'
    ELSE 'Utente normale - Vedi solo il tuo negozio'
  END as access_level
FROM public.shops;

-- Se sei platform admin, vedrai il conteggio di TUTTI i negozi
-- Se sei utente normale, vedrai solo il conteggio del tuo negozio (o 0 se non hai shop_id)

-- ============================================
-- 8. Istruzioni per promuovere un utente a Platform Admin
-- ============================================
-- Prima trova il tuo user_id:
-- SELECT id, email FROM auth.users WHERE email = 'tua-email@example.com';

-- Poi promuovi a platform admin:
-- UPDATE public.profiles 
-- SET is_platform_admin = true 
-- WHERE user_id = 'TUO_USER_ID_QUI';

-- Verifica che sia stato promosso:
-- SELECT user_id, full_name, is_platform_admin 
-- FROM public.profiles 
-- WHERE user_id = 'TUO_USER_ID_QUI';
