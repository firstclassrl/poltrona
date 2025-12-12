-- ============================================
-- FIX: RLS Policies per chat_messages (SOLUZIONE SEMPLICE)
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- 1. Rimuovi tutte le policy esistenti
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.chat_messages;
DROP POLICY IF EXISTS "Staff can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Clients can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can read own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update own chat messages" ON public.chat_messages;

-- 2. Policy per INSERT: Staff può inserire messaggi se è collegato all'utente autenticato
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

-- 3. Policy per INSERT: Clienti possono inserire messaggi se partecipano alla chat
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
  AND (
    -- Il client_id corrisponde a un cliente collegato all'utente autenticato
    EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.id = sender_id
        AND cl.email IN (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    -- Oppure il client_id è direttamente l'auth.uid() (se i clienti usano auth.uid come id)
    sender_id = auth.uid()
  )
);

-- 4. Policy per SELECT: Chiunque può leggere messaggi delle chat a cui partecipa
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
        OR
        EXISTS (
          SELECT 1 FROM public.clients cl
          WHERE cl.id = c.client_id
            AND cl.email IN (SELECT email FROM auth.users WHERE id = auth.uid())
        )
      )
  )
);

-- 5. Policy per UPDATE: Permette di aggiornare read_at
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
        OR
        EXISTS (
          SELECT 1 FROM public.clients cl
          WHERE cl.id = c.client_id
            AND cl.email IN (SELECT email FROM auth.users WHERE id = auth.uid())
        )
      )
  )
)
WITH CHECK (read_at IS NOT NULL);

-- 6. Verifica le policy create
SELECT policyname, cmd, definition
FROM pg_policies
WHERE tablename = 'chat_messages'
ORDER BY policyname;















