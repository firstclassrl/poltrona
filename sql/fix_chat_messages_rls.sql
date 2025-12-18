-- ============================================
-- FIX: RLS Policies per chat_messages
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- 1. Rimuovi le policy esistenti (se ci sono)
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can read own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update own chat messages" ON public.chat_messages;

-- 2. Policy per INSERT: permette a staff e clienti di inserire messaggi
CREATE POLICY "Staff can insert chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_type = 'staff'
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = sender_id
      AND s.user_id = auth.uid()  -- Lo staff deve essere collegato all'utente autenticato
  )
  AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id
      AND c.staff_id = sender_id
  )
);

CREATE POLICY "Clients can insert chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_type = 'client'
  AND sender_id = auth.uid()  -- Il client_id deve corrispondere all'utente autenticato
  AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id
      AND c.client_id = sender_id
  )
);

-- 3. Policy per SELECT: permette di leggere i messaggi delle proprie chat
CREATE POLICY "Users can read own chat messages"
ON public.chat_messages
FOR SELECT
USING (
  -- Staff può leggere messaggi delle proprie chat
  (
    sender_type = 'staff'
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = sender_id
        AND s.user_id = auth.uid()
    )
  )
  OR
  -- Staff può leggere messaggi delle chat dove è coinvolto
  EXISTS (
    SELECT 1 FROM public.chats c
    JOIN public.staff s ON s.id = c.staff_id
    WHERE c.id = chat_id
      AND s.user_id = auth.uid()
  )
  OR
  -- Client può leggere messaggi delle proprie chat
  (
    sender_type = 'client'
    AND sender_id = auth.uid()
  )
  OR
  -- Client può leggere messaggi delle chat dove è coinvolto
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id
      AND c.client_id = auth.uid()
  )
);

-- 4. Policy per UPDATE: permette di aggiornare read_at
CREATE POLICY "Users can update own chat messages"
ON public.chat_messages
FOR UPDATE
USING (
  -- Staff può aggiornare messaggi delle proprie chat
  EXISTS (
    SELECT 1 FROM public.chats c
    JOIN public.staff s ON s.id = c.staff_id
    WHERE c.id = chat_id
      AND s.user_id = auth.uid()
  )
  OR
  -- Client può aggiornare messaggi delle proprie chat
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id
      AND c.client_id = auth.uid()
  )
)
WITH CHECK (
  -- Permetti solo aggiornamento di read_at
  read_at IS NOT NULL
);

-- 5. Verifica le policy create
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
WHERE tablename = 'chat_messages'
ORDER BY policyname;

-- 6. Test: verifica che i collegamenti staff-user siano corretti
SELECT 
    s.id as staff_id,
    s.full_name,
    s.user_id as staff_user_id,
    au.id as auth_user_id,
    au.email as auth_email,
    CASE 
        WHEN s.user_id = au.id THEN '✅ Collegato correttamente'
        WHEN s.user_id IS NULL THEN '❌ Staff non collegato'
        ELSE '⚠️ Collegamento non corrisponde'
    END as link_status
FROM public.staff s
LEFT JOIN auth.users au ON s.user_id = au.id
ORDER BY s.full_name;



















