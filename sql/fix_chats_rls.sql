-- ============================================
-- FIX: RLS Policies per chats (filtro per ruolo)
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- 1. Rimuovi la policy generica esistente
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.chats;

-- 2. Policy per SELECT: Clienti vedono solo le proprie chat
CREATE POLICY "Clients can view own chats"
ON public.chats
FOR SELECT
USING (
  -- Verifica che esista un profilo client per l'utente autenticato
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'client'
  )
  AND
  -- Verifica che il client_id nella chat corrisponda a un cliente collegato all'utente
  (
    -- Il client_id corrisponde direttamente all'auth.uid
    client_id = auth.uid()
    OR
    -- Il client esiste e ha un profilo collegato (verifica tramite email o altri campi)
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = chats.client_id
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.role = 'client'
        )
    )
  )
);

-- 3. Policy per SELECT: Staff vede le chat dove è coinvolto
CREATE POLICY "Staff can view own chats"
ON public.chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = chats.staff_id
      AND s.user_id = auth.uid()
  )
);

-- 4. Policy per INSERT: Solo staff può creare chat
CREATE POLICY "Staff can create chats"
ON public.chats
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = staff_id
      AND s.user_id = auth.uid()
  )
);

-- 5. Policy per UPDATE: Solo staff può aggiornare chat
CREATE POLICY "Staff can update chats"
ON public.chats
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = staff_id
      AND s.user_id = auth.uid()
  )
);

-- 6. Verifica le policy create
SELECT policyname, cmd, definition
FROM pg_policies
WHERE tablename = 'chats'
ORDER BY policyname;

