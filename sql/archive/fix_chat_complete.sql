-- ============================================
-- FIX COMPLETO: Chat funzionante
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- PARTE 1: Collega Staff a User Auth
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

-- PARTE 2: Fix RLS Policies per chat_messages
-- ============================================

-- 4. Rimuovi tutte le policy esistenti
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.chat_messages;
DROP POLICY IF EXISTS "Staff can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Clients can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can read own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can read chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update chat messages" ON public.chat_messages;

-- 5. Policy per INSERT: Staff può inserire messaggi
CREATE POLICY "Staff can insert chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_type = 'staff'
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = sender_id
      AND s.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id
      AND c.staff_id = sender_id
  )
);

-- 6. Policy per INSERT: Clienti possono inserire messaggi
CREATE POLICY "Clients can insert chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_type = 'client'
  AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id
      AND c.client_id = sender_id
  )
  AND EXISTS (
    -- Verifica che esista un profilo per l'utente autenticato
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
  )
);

-- 7. Policy per SELECT: Leggere messaggi delle proprie chat
CREATE POLICY "Users can read chat messages"
ON public.chat_messages
FOR SELECT
USING (
  -- Staff può leggere messaggi delle chat dove è coinvolto
  EXISTS (
    SELECT 1 FROM public.chats c
    JOIN public.staff s ON s.id = c.staff_id
    WHERE c.id = chat_id
      AND s.user_id = auth.uid()
  )
  OR
  -- Client può leggere messaggi delle chat dove è coinvolto
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id
      AND (
        c.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.clients cl
          JOIN public.profiles p ON p.user_id = auth.uid()
          WHERE cl.id = c.client_id
        )
      )
  )
);

-- 8. Policy per UPDATE: Aggiornare read_at
CREATE POLICY "Users can update chat messages"
ON public.chat_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chats c
    JOIN public.staff s ON s.id = c.staff_id
    WHERE c.id = chat_id
      AND s.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id
      AND (
        c.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.clients cl
          JOIN public.profiles p ON p.user_id = auth.uid()
          WHERE cl.id = c.client_id
        )
      )
  )
)
WITH CHECK (read_at IS NOT NULL);

-- PARTE 3: Verifica
-- ============================================

-- 9. Verifica collegamenti staff
SELECT 
    s.id as staff_id,
    s.full_name,
    s.user_id as linked_user_id,
    CASE 
        WHEN s.user_id IS NOT NULL THEN '✅ Collegato'
        ELSE '❌ Non collegato'
    END as status
FROM public.staff s
ORDER BY s.full_name;

-- 10. Verifica policy create
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'chat_messages'
ORDER BY policyname;

