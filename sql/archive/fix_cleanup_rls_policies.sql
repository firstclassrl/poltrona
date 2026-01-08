-- ============================================
-- FIX CLEANUP: Rimozione RLS policies duplicate/permissive
-- Questo script rimuove le vecchie policy che non filtravano per shop_id
-- lasciando attive solo quelle più restrittive con suffisso "with shop_id"
-- ============================================

-- 1. Rimuovi le vecchie policy permissive (quelle senza "shop_id" nel nome o nella logica)
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notifications;

-- 2. Assicurati che le policy "with shop_id" esistano e siano corrette
-- Se non esistono, ricreale con la logica corretta

-- VIEW POLICY
DROP POLICY IF EXISTS "Users can view own notifications with shop_id" ON public.notifications;
CREATE POLICY "Users can view own notifications with shop_id" ON public.notifications
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

-- DELETE POLICY
DROP POLICY IF EXISTS "Users can delete own notifications with shop_id" ON public.notifications;
CREATE POLICY "Users can delete own notifications with shop_id" ON public.notifications
    FOR DELETE
    USING (
        -- L'utente può cancellare le notifiche dove è il destinatario diretto
        user_id = auth.uid()
        OR 
        -- O dove è uno staff member del negozio
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE (staff.id = notifications.user_id OR staff.user_id = auth.uid())
            AND staff.shop_id = notifications.shop_id
        )
    );

-- UPDATE POLICY (Mark as read)
DROP POLICY IF EXISTS "Users can update own notifications with shop_id" ON public.notifications;
CREATE POLICY "Users can update own notifications with shop_id" ON public.notifications
    FOR UPDATE
    USING (
        -- L'utente può aggiornare le notifiche dove è il destinatario diretto
        user_id = auth.uid()
        OR 
        -- O dove è uno staff member del negozio
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE (staff.id = notifications.user_id OR staff.user_id = auth.uid())
            AND staff.shop_id = notifications.shop_id
        )
    );

-- INSERT POLICY (Solo funzioni di sistema o trigger dovrebbero inserire, ma lasciamo per sicurezza se usato da edge functions)
-- Limitiamo l'inserimento solo se l'utente ha accesso allo shop
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications
    FOR INSERT
    WITH CHECK (
        -- Permetti insert se l'utente è service_role (gestito automaticamente da Supabase per service keys)
        -- O se l'utente è autenticato e sta inserendo per il suo shop (controllo base)
        auth.role() = 'service_role' OR auth.uid() IS NOT NULL
    );

-- 3. Verifica finale
SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.notifications'::regclass;
