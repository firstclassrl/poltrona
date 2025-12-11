-- ============================================
-- FIX: Collegamento Staff a User Auth (SOLUZIONE SEMPLICE)
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- 1. Assicurati che la colonna user_id esista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Collega staff a user tramite profiles (full_name match)
UPDATE public.staff s
SET user_id = p.user_id
FROM public.profiles p
WHERE LOWER(TRIM(s.full_name)) = LOWER(TRIM(p.full_name))
  AND p.role IN ('barber', 'admin', 'staff', 'owner')
  AND s.user_id IS NULL;

-- 3. Collega staff a user tramite email (se disponibile)
UPDATE public.staff s
SET user_id = au.id
FROM auth.users au
WHERE s.email IS NOT NULL 
  AND LOWER(s.email) = LOWER(au.email)
  AND s.user_id IS NULL;

-- 4. Se notifications.user_id è già un auth.users.id, usalo direttamente
UPDATE public.staff s
SET user_id = n.user_id
FROM public.notifications n
WHERE n.user_type = 'staff'
  AND n.user_id IN (SELECT id FROM auth.users)
  AND s.user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = n.user_id
      AND LOWER(TRIM(p.full_name)) = LOWER(TRIM(s.full_name))
      AND p.role IN ('barber', 'admin', 'staff', 'owner')
  );

-- 5. Verifica i collegamenti
SELECT 
    s.id as staff_id,
    s.full_name,
    s.email,
    s.user_id as linked_user_id,
    p.role,
    CASE 
        WHEN s.user_id IS NOT NULL THEN '✅ Collegato'
        ELSE '❌ Non collegato'
    END as status
FROM public.staff s
LEFT JOIN public.profiles p ON s.user_id = p.user_id
ORDER BY s.full_name;













