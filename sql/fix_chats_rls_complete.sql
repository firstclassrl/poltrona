-- ============================================
-- FIX COMPLETO: RLS Policies per chats (clienti vedono solo le proprie chat)
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- PARTE 1: Aggiungi user_id alla tabella clients
-- ============================================

-- 1. Aggiungi colonna user_id alla tabella clients (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Collega clienti esistenti agli utenti tramite profiles (full_name match)
-- Nota: Il collegamento tramite email richiede accesso a auth.users che non è disponibile
-- Usiamo il full_name come metodo principale
UPDATE public.clients c
SET user_id = p.user_id
FROM public.profiles p
WHERE c.user_id IS NULL
  AND p.role = 'client'
  AND LOWER(TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')))) = LOWER(TRIM(p.full_name));


-- PARTE 2: Fix RLS Policies per chats
-- ============================================

-- 4. Rimuovi la policy generica esistente
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.chats;
DROP POLICY IF EXISTS "Clients can view own chats" ON public.chats;
DROP POLICY IF EXISTS "Staff can view own chats" ON public.chats;
DROP POLICY IF EXISTS "Staff can create chats" ON public.chats;
DROP POLICY IF EXISTS "Staff can update chats" ON public.chats;

-- 5. Policy per SELECT: Clienti vedono solo le proprie chat
CREATE POLICY "Clients can view own chats"
ON public.chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = chats.client_id
      AND c.user_id = auth.uid()
  )
);

-- 6. Policy per SELECT: Staff vede le chat dove è coinvolto
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

-- 7. Policy per INSERT: Solo staff può creare chat
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

-- 8. Policy per UPDATE: Solo staff può aggiornare chat
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

-- PARTE 3: Verifica
-- ============================================

-- 9. Verifica collegamenti clienti
SELECT 
    c.id as client_id,
    c.first_name || ' ' || COALESCE(c.last_name, '') as client_name,
    c.email,
    c.user_id as linked_user_id,
    CASE 
        WHEN c.user_id IS NOT NULL THEN '✅ Collegato'
        ELSE '❌ Non collegato'
    END as status
FROM public.clients c
ORDER BY c.first_name, c.last_name
LIMIT 20;

-- 10. Verifica policy create
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'chats'
ORDER BY policyname;

