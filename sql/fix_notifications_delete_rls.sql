-- ============================================
-- FIX DELETE NOTIFICHE - Esegui questo script su Supabase
-- ============================================
-- Questo script aggiorna le RLS policies per permettere l'eliminazione delle notifiche

-- 1. Rimuovi la policy DELETE esistente se presente
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- 2. Crea una nuova policy DELETE più permissiva
-- Permette agli utenti autenticati di eliminare le notifiche dove sono destinatari
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE
    TO authenticated
    USING (
        -- L'utente può eliminare se è il destinatario diretto
        user_id = auth.uid()
        OR
        -- Oppure se è uno staff member dello stesso shop
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.user_id = auth.uid() 
            AND staff.shop_id = notifications.shop_id
        )
        OR
        -- Oppure se è un admin (role = 'admin' nel profilo)
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.user_id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- 3. Verifica che RLS sia abilitato
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Test: Verifica le policy create
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
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- 5. Verifica le notifiche esistenti e i loro user_id
-- Questo ti aiuta a capire se ci sono notifiche con user_id che non corrispondono a auth.uid()
SELECT 
    id,
    user_id,
    user_type,
    type,
    title,
    created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;






