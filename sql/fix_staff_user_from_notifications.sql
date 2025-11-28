-- ============================================
-- FIX: Collegamento Staff a User Auth usando Notifications
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- 1. Assicurati che la colonna user_id esista nella tabella staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Collega staff usando i user_id dalle notifications
-- Prima prova: se notifications.user_id corrisponde a staff.id, trova l'auth.users.id tramite profiles
UPDATE public.staff s
SET user_id = p.user_id
FROM public.notifications n
JOIN public.profiles p ON p.user_id IN (
  -- Trova l'auth.users.id che corrisponde a questo staff tramite profiles
  SELECT p2.user_id 
  FROM public.profiles p2
  WHERE p2.role IN ('barber', 'admin', 'staff', 'owner')
)
WHERE n.user_type = 'staff'
  AND n.user_id = s.id  -- notifications.user_id è lo staff.id
  AND s.user_id IS NULL
  AND EXISTS (
    -- Verifica che ci sia un profilo collegato a questo staff
    SELECT 1 FROM public.profiles p3
    WHERE p3.user_id = p.user_id
  );

-- 3. Se notifications.user_id è già un auth.users.id, usalo direttamente
-- (se notifications.user_id corrisponde a un auth.users.id esistente)
UPDATE public.staff s
SET user_id = n.user_id
FROM public.notifications n
WHERE n.user_type = 'staff'
  AND n.user_id IN (SELECT id FROM auth.users)  -- Verifica che sia un auth.users.id valido
  AND EXISTS (
    -- Trova lo staff corrispondente tramite profiles (full_name match)
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = n.user_id
      AND LOWER(TRIM(p.full_name)) = LOWER(TRIM(s.full_name))
      AND p.role IN ('barber', 'admin', 'staff', 'owner')
  )
  AND s.user_id IS NULL;

-- 4. Metodo alternativo: collega tramite staff.id = notifications.user_id
-- e poi trova l'auth.users.id tramite profiles che ha lo stesso full_name
UPDATE public.staff s
SET user_id = p.user_id
FROM public.notifications n
JOIN public.profiles p ON LOWER(TRIM(p.full_name)) = LOWER(TRIM(s.full_name))
WHERE n.user_type = 'staff'
  AND n.user_id = s.id  -- notifications.user_id è lo staff.id
  AND p.role IN ('barber', 'admin', 'staff', 'owner')
  AND s.user_id IS NULL;

-- 5. Verifica i collegamenti creati
SELECT 
    s.id as staff_id,
    s.full_name,
    s.email,
    s.user_id as linked_user_id,
    p.role,
    p.user_id as profile_user_id,
    CASE 
        WHEN s.user_id IS NOT NULL THEN '✅ Collegato'
        ELSE '❌ Non collegato'
    END as status
FROM public.staff s
LEFT JOIN public.profiles p ON s.user_id = p.user_id
ORDER BY s.full_name;

-- 6. Mostra le notifiche usate per il collegamento
SELECT DISTINCT
    n.user_id as notification_user_id,
    n.user_type,
    s.id as staff_id,
    s.full_name as staff_name,
    s.user_id as staff_linked_user_id,
    CASE 
        WHEN s.user_id IS NOT NULL THEN '✅ Staff collegato'
        ELSE '❌ Staff non collegato'
    END as link_status
FROM public.notifications n
LEFT JOIN public.staff s ON (
    s.id = n.user_id OR  -- notifications.user_id è staff.id
    s.user_id = n.user_id  -- notifications.user_id è auth.users.id
)
WHERE n.user_type = 'staff'
ORDER BY n.created_at DESC;

