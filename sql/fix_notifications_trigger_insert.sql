-- ============================================
-- FIX: Permetti inserimento notifiche da trigger
-- Esegui questo script su Supabase SQL Editor
-- ============================================
-- Questo script assicura che le funzioni trigger SECURITY DEFINER
-- possano inserire notifiche nella tabella notifications

-- 1. Verifica che il tipo 'new_client' sia presente nel constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('new_appointment', 'appointment_cancelled', 'appointment_reminder', 'system', 'waitlist_available', 'new_client'));

-- 2. Aggiungi una policy che permetta l'inserimento da funzioni SECURITY DEFINER
-- Questa policy permette l'inserimento anche quando non c'è un utente autenticato
-- (come quando viene eseguito un trigger durante la creazione di un nuovo utente)
DROP POLICY IF EXISTS "Functions can insert notifications" ON public.notifications;
CREATE POLICY "Functions can insert notifications" ON public.notifications
    FOR INSERT
    WITH CHECK (true);

-- 3. Verifica che RLS sia abilitato
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Verifica le policy create
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;

