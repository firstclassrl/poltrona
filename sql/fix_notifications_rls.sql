-- ============================================
-- FIX NOTIFICHE - Esegui questo script su Supabase
-- ============================================

-- 1. Aggiorna il vincolo CHECK per includere tutti i tipi di notifica
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('new_appointment', 'appointment_cancelled', 'appointment_reminder', 'system', 'waitlist_available', 'new_client'));

-- 2. Rimuovi tutte le policy esistenti per le notifiche
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

-- 3. Crea nuove policy permissive

-- SELECT: Gli utenti possono vedere le notifiche dove sono destinatari
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR 
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.id = auth.uid() 
            AND staff.shop_id = notifications.shop_id
        )
    );

-- INSERT: Qualsiasi utente autenticato può creare notifiche
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: Gli utenti possono aggiornare solo le proprie notifiche
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DELETE: Gli utenti possono eliminare solo le proprie notifiche  
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- 4. Verifica che RLS sia abilitato
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Test: Verifica le policy create
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'notifications';

-- 6. Verifica il vincolo
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.notifications'::regclass;






