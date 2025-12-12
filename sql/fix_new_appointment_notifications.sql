-- ============================================
-- FIX: Notifiche in-app per nuove prenotazioni
-- Esegui questo script su Supabase SQL Editor
-- ============================================
-- Questo script assicura che le notifiche in-app vengano create
-- quando viene inserito un nuovo appuntamento tramite trigger del database

-- 1. Verifica che il tipo 'new_appointment' sia presente nel constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('new_appointment', 'appointment_cancelled', 'appointment_rescheduled', 'appointment_reminder', 'system', 'waitlist_available', 'new_client', 'chat_message'));

-- 2. Aggiungi una policy che permetta l'inserimento da funzioni SECURITY DEFINER
-- Questa policy è ESSENZIALE per permettere ai trigger di inserire notifiche
-- Le funzioni SECURITY DEFINER non hanno sempre un utente autenticato
DROP POLICY IF EXISTS "Functions can insert notifications" ON public.notifications;
CREATE POLICY "Functions can insert notifications" ON public.notifications
    FOR INSERT
    WITH CHECK (true);

-- 3. Mantieni anche la policy per utenti autenticati (per chiamate dirette dall'app)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 4. Verifica che RLS sia abilitato
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Verifica/crea la funzione trigger per notificare quando viene creato un appuntamento
CREATE OR REPLACE FUNCTION public.notify_barber_on_appointment_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
    -- Solo su INSERT
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
    WHERE sh.id = NEW.shop_id;
    
    -- Prepara i dati per la notifica
    v_client_name := COALESCE(v_client_record.full_name, 'Cliente');
    v_client_email := v_client_record.email;
    v_client_phone := v_client_record.phone_e164;
    v_service_name := COALESCE(v_service_record.name, 'Servizio');
    v_barber_name := COALESCE(v_staff_record.full_name, 'Barbiere');
    v_barber_email := v_staff_record.email;
    v_shop_name := COALESCE(v_shop_record.name, 'Negozio');
    v_shop_email := v_shop_record.notification_email;
    
    -- Formatta data e ora nel fuso orario Europe/Rome per evitare sfasamenti
    v_appointment_date := TO_CHAR(NEW.start_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY');
    v_appointment_time := TO_CHAR(NEW.start_at AT TIME ZONE 'Europe/Rome', 'HH24:MI');
    
    -- Crea notifica in-app per il barbiere
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
        NEW.shop_id,
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
            'created_at', NOW()
        ),
        NOW()
    );
    
    RAISE LOG 'Notifica in-app creata per appuntamento % - barbiere user_id: %', NEW.id, v_staff_record.user_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log dell'errore ma continua l'esecuzione (non blocca la creazione dell'appuntamento)
        RAISE LOG 'Errore nella creazione notifica per appuntamento %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- 6. Crea/ricrea il trigger
DROP TRIGGER IF EXISTS trigger_notify_barber_on_created ON public.appointments;
CREATE TRIGGER trigger_notify_barber_on_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_barber_on_appointment_created();

-- 7. Commenti per documentazione
COMMENT ON FUNCTION public.notify_barber_on_appointment_created() IS 'Funzione trigger per notificare il barbiere (in-app) quando viene creato un nuovo appuntamento. Richiede che il barbiere abbia user_id collegato.';
COMMENT ON TRIGGER trigger_notify_barber_on_created ON public.appointments IS 'Trigger che crea notifica in-app quando viene inserito un nuovo appuntamento';

-- 8. Verifica le policy create
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;

-- 9. Verifica che il trigger esista
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'appointments'
    AND trigger_name = 'trigger_notify_barber_on_created';

-- 10. Test: Verifica che i barbieri abbiano user_id collegato
-- (se non ce l'hanno, le notifiche non verranno create)
SELECT 
    s.id as staff_id,
    s.full_name,
    s.user_id,
    CASE 
        WHEN s.user_id IS NULL THEN '⚠️ Nessun user_id - notifiche non funzioneranno'
        ELSE '✅ user_id presente'
    END as status
FROM public.staff s
WHERE s.active = true
ORDER BY s.full_name;


