-- ============================================
-- FIX: Collegamento Staff a User Auth
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- 1. Aggiungi colonna email alla tabella staff (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN email TEXT;
  END IF;
END $$;

-- 2. Aggiungi colonna user_id alla tabella staff (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Collega gli staff esistenti ai loro user tramite full_name -> profiles
-- (più affidabile se email non è popolata)
UPDATE public.staff s
SET user_id = p.user_id
FROM public.profiles p
WHERE LOWER(TRIM(s.full_name)) = LOWER(TRIM(p.full_name))
AND s.user_id IS NULL
AND p.role IN ('barber', 'admin', 'staff', 'owner');

-- 4. Se c'è email, prova anche con quella
UPDATE public.staff s
SET user_id = au.id
FROM auth.users au
WHERE s.email IS NOT NULL 
AND LOWER(s.email) = LOWER(au.email)
AND s.user_id IS NULL;

-- 3. Aggiorna la RLS policy delle notifiche per usare sia staff.id che staff.user_id
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT
    USING (
        -- L'utente può vedere le notifiche dove è il destinatario diretto
        user_id = auth.uid()
        OR 
        -- O dove è uno staff member del negozio
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE (staff.id = notifications.user_id OR staff.user_id = auth.uid())
            AND staff.shop_id = notifications.shop_id
        )
        OR
        -- O se notifications.user_id corrisponde a uno staff con user_id = auth.uid()
        EXISTS (
            SELECT 1 FROM public.staff
            WHERE staff.id = notifications.user_id
            AND staff.user_id = auth.uid()
        )
    );

-- 4. Verifica il collegamento
SELECT 
    s.id as staff_id,
    s.full_name,
    s.email,
    s.user_id as linked_user_id,
    p.role
FROM public.staff s
LEFT JOIN public.profiles p ON s.user_id = p.user_id
ORDER BY s.full_name;

-- 5. Mostra le notifiche esistenti
SELECT id, user_id, user_type, type, title, created_at 
FROM public.notifications 
ORDER BY created_at DESC 
LIMIT 10;

