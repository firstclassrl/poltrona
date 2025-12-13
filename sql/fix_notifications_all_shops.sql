-- ============================================
-- FIX: Notifiche funzionanti per tutti i negozi
-- Esegui questo script su Supabase SQL Editor
-- ============================================
-- Questo script assicura che le notifiche funzionino correttamente
-- per tutti i negozi (presenti e futuri) garantendo:
-- 1. Le notifiche vengono create con shop_id corretto dal trigger
-- 2. Le RLS policies permettono la lettura basandosi su user_id (non solo shop_id)
-- 3. Le policies per l'inserimento funzionano per trigger e utenti autenticati

-- 1. Rimuovi tutte le policy esistenti per notifications
-- ============================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Functions can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS notifications_select_shop ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_shop ON public.notifications;
DROP POLICY IF EXISTS notifications_update_shop ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_shop ON public.notifications;

-- 2. Crea policy per SELECT (lettura notifiche)
-- ============================================
-- Gli utenti possono vedere le proprie notifiche basandosi su user_id
-- Questo funziona per TUTTI i negozi perché user_id è univoco
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT
    USING (
        -- L'utente può vedere le notifiche dove è il destinatario (user_id)
        user_id = auth.uid()
        OR
        -- Service role può vedere tutto
        auth.role() = 'service_role'
        OR
        -- Platform admin può vedere tutto
        public.is_platform_admin()
    );

-- 3. Crea policy per INSERT (creazione notifiche)
-- ============================================
-- IMPORTANTE: Questa policy permette l'inserimento da trigger SECURITY DEFINER
-- e da utenti autenticati, per TUTTI i negozi
CREATE POLICY "Functions can insert notifications" ON public.notifications
    FOR INSERT
    WITH CHECK (true);

-- Policy aggiuntiva per utenti autenticati (per chiamate dirette dall'app)
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 4. Crea policy per UPDATE (aggiornamento notifiche - es. marcare come lette)
-- ============================================
-- Gli utenti possono aggiornare solo le proprie notifiche
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE
    USING (
        user_id = auth.uid()
        OR auth.role() = 'service_role'
        OR public.is_platform_admin()
    )
    WITH CHECK (
        user_id = auth.uid()
        OR auth.role() = 'service_role'
        OR public.is_platform_admin()
    );

-- 5. Crea policy per DELETE (eliminazione notifiche)
-- ============================================
-- Gli utenti possono eliminare solo le proprie notifiche
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE
    USING (
        user_id = auth.uid()
        OR auth.role() = 'service_role'
        OR public.is_platform_admin()
    );

-- 6. Verifica che RLS sia abilitato
-- ============================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 7. Verifica/aggiorna la funzione trigger per garantire shop_id corretto
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_barber_on_appointment_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff_record RECORD;
    v_client_record RECORD;
    v_service_record RECORD;
    v_shop_record RECORD;
    v_appointment_date TEXT;
    v_appointment_time TEXT;
    v_client_name TEXT;
    v_client_email TEXT;
    v_client_phone TEXT;
    v_service_name TEXT;
    v_barber_name TEXT;
    v_barber_email TEXT;
    v_shop_email TEXT;
    v_shop_name TEXT;
    v_final_shop_id UUID;
BEGIN
    -- IMPORTANTE: Determina shop_id con priorità
    -- 1. shop_id dall'appuntamento (se presente)
    -- 2. shop_id dal client
    -- 3. shop_id dallo staff
    -- 4. shop_id dal servizio
    v_final_shop_id := NEW.shop_id;
    
    IF v_final_shop_id IS NULL AND NEW.client_id IS NOT NULL THEN
        SELECT shop_id INTO v_final_shop_id
        FROM public.clients
        WHERE id = NEW.client_id
        LIMIT 1;
    END IF;
    
    IF v_final_shop_id IS NULL AND NEW.staff_id IS NOT NULL THEN
        SELECT shop_id INTO v_final_shop_id
        FROM public.staff
        WHERE id = NEW.staff_id
        LIMIT 1;
    END IF;
    
    IF v_final_shop_id IS NULL AND NEW.service_id IS NOT NULL THEN
        SELECT shop_id INTO v_final_shop_id
        FROM public.services
        WHERE id = NEW.service_id
        LIMIT 1;
    END IF;
    
    -- Se ancora NULL, logga errore ma continua
    IF v_final_shop_id IS NULL THEN
        RAISE WARNING '⚠️ Impossibile determinare shop_id per appuntamento %', NEW.id;
        RETURN NEW;
    END IF;
    
    -- Recupera i dati del barbiere (staff)
    SELECT 
        s.id,
        s.user_id,
        s.full_name,
        s.email,
        s.shop_id
    INTO v_staff_record
    FROM public.staff s
    WHERE s.id = NEW.staff_id;
    
    -- Se non trova il barbiere, esce senza creare notifica
    IF NOT FOUND OR v_staff_record.id IS NULL THEN
        RAISE LOG 'Barbiere non trovato per staff_id: %', NEW.staff_id;
        RETURN NEW;
    END IF;
    
    -- Se il barbiere non ha user_id collegato, non può ricevere notifiche in-app
    IF v_staff_record.user_id IS NULL THEN
        RAISE LOG 'Barbiere % non ha user_id collegato, notifica in-app non creata', v_staff_record.id;
        RETURN NEW;
    END IF;
    
    -- Recupera i dati del cliente
    SELECT 
        c.id,
        COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), 'Cliente') as full_name,
        c.email,
        c.phone_e164
    INTO v_client_record
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    
    -- Recupera i dati del servizio
    SELECT 
        s.name
    INTO v_service_record
    FROM public.services s
    WHERE s.id = NEW.service_id;
    
    -- Recupera i dati dello shop
    SELECT 
        sh.id,
        sh.name,
        sh.notification_email
    INTO v_shop_record
    FROM public.shops sh
    WHERE sh.id = v_final_shop_id;
    
    -- Prepara i dati per la notifica
    v_client_name := COALESCE(v_client_record.full_name, 'Cliente');
    v_client_email := v_client_record.email;
    v_client_phone := v_client_record.phone_e164;
    v_service_name := COALESCE(v_service_record.name, 'Servizio');
    v_barber_name := COALESCE(v_staff_record.full_name, 'Barbiere');
    v_barber_email := v_staff_record.email;
    v_shop_name := COALESCE(v_shop_record.name, 'Negozio');
    v_shop_email := v_shop_record.notification_email;
    
    -- Formatta data e ora nel fuso orario Europe/Rome
    v_appointment_date := TO_CHAR(NEW.start_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY');
    v_appointment_time := TO_CHAR(NEW.start_at AT TIME ZONE 'Europe/Rome', 'HH24:MI');
    
    -- Crea notifica in-app per il barbiere CON shop_id CORRETTO
    INSERT INTO public.notifications (
        shop_id,
        user_id,
        user_type,
        type,
        title,
        message,
        data,
        created_at
    )
    VALUES (
        v_final_shop_id,  -- IMPORTANTE: Usa shop_id determinato
        v_staff_record.user_id,
        'staff',
        'new_appointment',
        '📅 Nuovo Appuntamento',
        v_client_name || ' ha prenotato ' || v_service_name || ' per il ' || v_appointment_date || ' alle ' || v_appointment_time,
        jsonb_build_object(
            'appointment_id', NEW.id,
            'client_id', NEW.client_id,
            'client_name', v_client_name,
            'client_email', v_client_email,
            'client_phone', v_client_phone,
            'service_name', v_service_name,
            'appointment_date', v_appointment_date,
            'appointment_time', v_appointment_time,
            'staff_id', NEW.staff_id,
            'shop_id', v_final_shop_id,
            'created_at', NOW()
        ),
        NOW()
    );
    
    RAISE LOG 'Notifica in-app creata per appuntamento % - shop_id: %, barbiere user_id: %', 
        NEW.id, v_final_shop_id, v_staff_record.user_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log dell'errore ma continua l'esecuzione (non blocca la creazione dell'appuntamento)
        RAISE LOG 'Errore nella creazione notifica per appuntamento %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- 8. Ricrea il trigger
-- ============================================
DROP TRIGGER IF EXISTS trigger_notify_barber_on_created ON public.appointments;
CREATE TRIGGER trigger_notify_barber_on_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_barber_on_appointment_created();

COMMENT ON FUNCTION public.notify_barber_on_appointment_created() IS 
    'Funzione trigger per notificare il barbiere quando viene creato un nuovo appuntamento. Funziona per TUTTI i negozi.';

-- 9. Verifica le policy create
-- ============================================
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
ORDER BY policyname;

-- 10. Verifica che il trigger esista
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'appointments'
    AND trigger_name = 'trigger_notify_barber_on_created';

-- 11. Test: Verifica che i barbieri abbiano user_id collegato
-- ============================================
SELECT 
    s.id as staff_id,
    s.full_name,
    s.shop_id,
    s.user_id,
    sh.name as shop_name,
    CASE 
        WHEN s.user_id IS NULL THEN '⚠️ Nessun user_id - notifiche non funzioneranno'
        ELSE '✅ user_id presente'
    END as status
FROM public.staff s
LEFT JOIN public.shops sh ON s.shop_id = sh.id
WHERE s.active = true
ORDER BY sh.name, s.full_name;

-- 12. Test: Verifica notifiche esistenti per shop
-- ============================================
SELECT 
    n.shop_id,
    sh.name as shop_name,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE n.read_at IS NULL) as unread_notifications
FROM public.notifications n
LEFT JOIN public.shops sh ON n.shop_id = sh.id
GROUP BY n.shop_id, sh.name
ORDER BY sh.name;

