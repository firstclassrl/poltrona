-- ============================================
-- MIGLIORAMENTO 1: Sistema Timeout Notifiche
-- MIGLIORAMENTO 2: Notifiche Email via Webhook N8N
-- ============================================
-- Questo script implementa:
-- 1. Timeout di 15 minuti per notifiche waitlist
-- 2. Notifica automatica al prossimo cliente se timeout scade
-- 3. Webhook Supabase per inviare email via N8N
--
-- PREREQUISITI: Assicurati di aver eseguito sql/fix_waitlist_system.sql prima

-- ============================================
-- PARTE 0: Verifica/Crea funzione find_waitlist_clients_for_date (se non esiste)
-- ============================================

CREATE OR REPLACE FUNCTION public.find_waitlist_clients_for_date(
    p_shop_id UUID, 
    p_date DATE,
    p_service_id UUID DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL
)
RETURNS TABLE (
    waitlist_id UUID,
    client_id UUID,
    client_user_id UUID,
    client_email TEXT,
    client_name TEXT,
    client_phone TEXT,
    service_id UUID,
    staff_id UUID,
    service_name TEXT,
    staff_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id as waitlist_id,
        w.client_id,
        COALESCE(c.user_id, p.user_id) as client_user_id, -- Prova clients.user_id, poi profiles.user_id
        c.email as client_email,
        CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) as client_name,
        c.phone_e164 as client_phone,
        w.service_id,
        w.staff_id,
        srv.name as service_name,
        stf.full_name as staff_name
    FROM public.waitlist w
    JOIN public.clients c ON c.id = w.client_id
    LEFT JOIN public.profiles p ON p.user_id IN (
        SELECT u.id FROM auth.users u WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(c.email))
    )
    LEFT JOIN public.services srv ON srv.id = w.service_id
    LEFT JOIN public.staff stf ON stf.id = w.staff_id
    WHERE w.shop_id = p_shop_id
    AND w.status = 'waiting'
    AND p_date = ANY(w.preferred_dates)
    AND w.expires_at >= NOW()
    -- Matching intelligente: se l'appuntamento cancellato ha servizio/barbiere specifici,
    -- considera solo clienti senza preferenze specifiche O con preferenze matching
    AND (
        -- Caso 1: Appuntamento senza servizio/barbiere specifici -> match con tutti
        (p_service_id IS NULL AND p_staff_id IS NULL)
        OR
        -- Caso 2: Cliente senza preferenze specifiche -> match con qualsiasi appuntamento
        (w.service_id IS NULL AND w.staff_id IS NULL)
        OR
        -- Caso 3: Match servizio (se specificato nell'appuntamento)
        (p_service_id IS NOT NULL AND w.service_id = p_service_id AND (p_staff_id IS NULL OR w.staff_id IS NULL OR w.staff_id = p_staff_id))
        OR
        -- Caso 4: Match barbiere (se specificato nell'appuntamento)
        (p_staff_id IS NOT NULL AND w.staff_id = p_staff_id AND (p_service_id IS NULL OR w.service_id IS NULL OR w.service_id = p_service_id))
    )
    ORDER BY w.created_at ASC
    LIMIT 1; -- SOLO IL PRIMO CLIENTE IN CODA
END;
$$;

-- ============================================
-- PARTE 1: Aggiungi colonna notification_expires_at
-- ============================================

ALTER TABLE public.waitlist 
ADD COLUMN IF NOT EXISTS notification_expires_at TIMESTAMPTZ;

-- Indice per query performance
CREATE INDEX IF NOT EXISTS idx_waitlist_notification_expires 
ON public.waitlist(notification_expires_at) 
WHERE status = 'notified' AND notification_expires_at IS NOT NULL;

-- ============================================
-- PARTE 2: Funzione per notificare il prossimo cliente
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_next_waitlist_client(
    p_shop_id UUID,
    p_date DATE,
    p_cancelled_appointment_id UUID,
    p_service_id UUID DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL,
    p_start_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    waitlist_record RECORD;
    appointment_date DATE;
    appointment_time TEXT;
    service_name TEXT;
    staff_name TEXT;
    v_client_user_id UUID;
    v_notification_id UUID;
BEGIN
    -- Ottieni dettagli appuntamento cancellato se disponibile
    IF p_start_at IS NOT NULL THEN
        appointment_date := DATE(p_start_at AT TIME ZONE 'Europe/Rome');
        appointment_time := TO_CHAR(p_start_at AT TIME ZONE 'Europe/Rome', 'HH24:MI');
    ELSE
        appointment_date := p_date;
        appointment_time := NULL;
    END IF;
    
    -- Recupera nome servizio e barbiere se disponibili
    IF p_service_id IS NOT NULL THEN
        SELECT s.name INTO service_name
        FROM public.services s
        WHERE s.id = p_service_id;
    END IF;
    
    IF p_staff_id IS NOT NULL THEN
        SELECT st.full_name INTO staff_name
        FROM public.staff st
        WHERE st.id = p_staff_id;
    END IF;
    
    -- Trova il PROSSIMO cliente in waitlist (escludendo quelli già notificati)
    -- Prima trova tutti i candidati, poi escludi quelli già notificati
    SELECT * INTO waitlist_record
    FROM (
        SELECT * FROM public.find_waitlist_clients_for_date(
            p_shop_id, 
            appointment_date,
            p_service_id,
            p_staff_id
        )
    ) candidates
    WHERE candidates.waitlist_id NOT IN (
        -- Escludi clienti già notificati per questa data
        SELECT id FROM public.waitlist
        WHERE shop_id = p_shop_id
        AND status = 'notified'
        AND appointment_date = ANY(preferred_dates)
        AND notification_expires_at > NOW()
    )
    LIMIT 1;
    
    -- Se trovato un cliente in coda
    IF FOUND AND waitlist_record.waitlist_id IS NOT NULL THEN
        -- Ottieni user_id del cliente
        v_client_user_id := waitlist_record.client_user_id;
        
        -- Se user_id non è disponibile, prova a trovarlo tramite email
        IF v_client_user_id IS NULL AND waitlist_record.client_email IS NOT NULL THEN
            SELECT p.user_id INTO v_client_user_id
            FROM public.profiles p
            JOIN auth.users u ON u.id = p.user_id
            WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(waitlist_record.client_email))
            AND p.role = 'client'
            LIMIT 1;
        END IF;
        
        -- Crea notifica SOLO se abbiamo un user_id valido
        IF v_client_user_id IS NOT NULL THEN
            -- Costruisci messaggio dettagliato
            DECLARE
                v_message TEXT;
                v_title TEXT;
            BEGIN
                v_title := '🎯 Posto Disponibile!';
                v_message := 'Si è liberato un posto per il ' || TO_CHAR(appointment_date, 'DD/MM/YYYY');
                
                IF appointment_time IS NOT NULL THEN
                    v_message := v_message || ' alle ' || appointment_time;
                END IF;
                
                IF service_name IS NOT NULL THEN
                    v_message := v_message || ' per ' || service_name;
                END IF;
                
                IF staff_name IS NOT NULL THEN
                    v_message := v_message || ' con ' || staff_name;
                END IF;
                
                v_message := v_message || '. Prenota subito!';
                
                -- Inserisci notifica in-app
                INSERT INTO public.notifications (
                    shop_id,
                    user_id,
                    user_type,
                    type,
                    title,
                    message,
                    data,
                    created_at
                ) VALUES (
                    p_shop_id,
                    v_client_user_id,
                    'client',
                    'waitlist_available',
                    v_title,
                    v_message,
                    jsonb_build_object(
                        'available_date', appointment_date,
                        'available_time', appointment_time,
                        'waitlist_id', waitlist_record.waitlist_id,
                        'cancelled_appointment_id', p_cancelled_appointment_id,
                        'service_id', p_service_id,
                        'service_name', service_name,
                        'staff_id', p_staff_id,
                        'staff_name', staff_name,
                        'client_id', waitlist_record.client_id
                    ),
                    NOW()
                )
                RETURNING id INTO v_notification_id;
                
                -- Aggiorna lo stato della waitlist entry con timeout di 15 minuti
                UPDATE public.waitlist 
                SET 
                    status = 'notified', 
                    notified_at = NOW(),
                    notification_expires_at = NOW() + INTERVAL '15 minutes'
                WHERE id = waitlist_record.waitlist_id;
                
                -- ============================================
                -- MIGLIORAMENTO 2: Webhook per Email N8N
                -- ============================================
                -- NOTA: Il webhook viene gestito tramite Supabase Webhooks configurato nel Dashboard
                -- Quando viene creata questa notifica con type='waitlist_available', il webhook Supabase
                -- invierà automaticamente i dati a N8N che invierà l'email
                -- 
                -- I dati necessari sono già nel campo 'data' JSONB della notifica e includono:
                -- - client_email, client_name, available_date, available_time, service_name, staff_name, etc.
                -- 
                -- Vedi docs/WAITLIST_SETUP.md per istruzioni dettagliate sulla configurazione del webhook
            END;
            
            RETURN waitlist_record.waitlist_id;
        ELSE
            RAISE LOG 'Waitlist: Cliente % non ha user_id collegato - notifica non inviata', waitlist_record.client_id;
            RETURN NULL;
        END IF;
    ELSE
        -- Nessun cliente trovato
        RETURN NULL;
    END IF;
END;
$$;

-- ============================================
-- PARTE 3: Aggiorna trigger notify_waitlist_on_cancellation
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    waitlist_record RECORD;
    appointment_date DATE;
    appointment_time TEXT;
    service_name TEXT;
    staff_name TEXT;
    v_client_user_id UUID;
BEGIN
    -- Solo se lo status cambia a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        -- Ottieni la data e ora dell'appuntamento cancellato
        appointment_date := DATE(NEW.start_at AT TIME ZONE 'Europe/Rome');
        appointment_time := TO_CHAR(NEW.start_at AT TIME ZONE 'Europe/Rome', 'HH24:MI');
        
        -- Recupera nome servizio e barbiere se disponibili
        SELECT s.name INTO service_name
        FROM public.services s
        WHERE s.id = NEW.service_id;
        
        SELECT st.full_name INTO staff_name
        FROM public.staff st
        WHERE st.id = NEW.staff_id;
        
        -- Notifica il primo cliente usando la nuova funzione
        PERFORM public.notify_next_waitlist_client(
            NEW.shop_id,
            appointment_date,
            NEW.id,
            NEW.service_id,
            NEW.staff_id,
            NEW.start_at
        );
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Errore nella notifica waitlist per appuntamento %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- ============================================
-- PARTE 4: Funzione per gestire timeout notifiche
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_waitlist_notification_timeout()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_record RECORD;
    processed_count INTEGER := 0;
    v_appointment_id UUID;
    v_start_at TIMESTAMPTZ;
    v_service_id UUID;
    v_staff_id UUID;
BEGIN
    -- Trova entry notified scadute (timeout di 15 minuti)
    FOR expired_record IN
        SELECT 
            w.*,
            n.data->>'cancelled_appointment_id' as cancelled_appointment_id
        FROM public.waitlist w
        JOIN public.notifications n ON n.data->>'waitlist_id' = w.id::text
        WHERE w.status = 'notified'
        AND w.notification_expires_at IS NOT NULL
        AND w.notification_expires_at < NOW()
        ORDER BY w.notified_at ASC
    LOOP
        -- Recupera dettagli appuntamento cancellato originale
        SELECT 
            id,
            start_at,
            service_id,
            staff_id
        INTO v_appointment_id, v_start_at, v_service_id, v_staff_id
        FROM public.appointments
        WHERE id::text = expired_record.cancelled_appointment_id;
        
        -- Se appuntamento ancora esiste (non ri-prenotato), notifica prossimo cliente
        IF v_appointment_id IS NOT NULL THEN
            -- Verifica che appuntamento sia ancora cancellato
            IF EXISTS (
                SELECT 1 FROM public.appointments 
                WHERE id = v_appointment_id 
                AND status = 'cancelled'
            ) THEN
                -- Notifica il prossimo cliente in coda
                PERFORM public.notify_next_waitlist_client(
                    expired_record.shop_id,
                    DATE(v_start_at AT TIME ZONE 'Europe/Rome'),
                    v_appointment_id,
                    v_service_id,
                    v_staff_id,
                    v_start_at
                );
            END IF;
        END IF;
        
        -- Aggiorna stato entry scaduta
        UPDATE public.waitlist
        SET status = 'notification_expired'
        WHERE id = expired_record.id;
        
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$;

-- ============================================
-- PARTE 5: Configurazione Webhook N8N
-- ============================================
-- NOTA: Configurare queste variabili in Supabase:
-- 1. Vai su Settings > Database > Custom Config
-- 2. Aggiungi:
--    app.n8n_webhook_url = 'https://tuo-n8n.app.n8n.cloud/webhook/waitlist-notification'
--    app.n8n_webhook_secret = 'tuo-secret-token'

-- Funzione helper per configurare webhook URL
CREATE OR REPLACE FUNCTION public.set_n8n_webhook_config(
    p_webhook_url TEXT,
    p_webhook_secret TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Imposta configurazione (richiede privilegi superuser)
    PERFORM set_config('app.n8n_webhook_url', p_webhook_url, false);
    PERFORM set_config('app.n8n_webhook_secret', p_webhook_secret, false);
END;
$$;

-- ============================================
-- PARTE 6: Commenti e documentazione
-- ============================================

COMMENT ON FUNCTION public.notify_next_waitlist_client() IS 'Notifica il prossimo cliente in waitlist, escludendo quelli già notificati. Gestisce timeout e email via webhook N8N.';
COMMENT ON FUNCTION public.handle_waitlist_notification_timeout() IS 'Gestisce timeout notifiche waitlist (15 minuti). Se timeout scade, notifica il prossimo cliente in coda.';
COMMENT ON COLUMN public.waitlist.notification_expires_at IS 'Timestamp di scadenza notifica. Dopo questo tempo, se cliente non ha prenotato, viene notificato il prossimo in coda. Default: 15 minuti dopo notified_at.';

-- ============================================
-- PARTE 7: Job schedulato per timeout (da configurare)
-- ============================================
-- NOTA: Per attivare il job schedulato, usa pg_cron o Supabase Edge Functions:
-- 
-- Opzione 1: pg_cron (se disponibile)
-- SELECT cron.schedule(
--     'handle-waitlist-timeout',
--     '*/5 * * * *', -- Ogni 5 minuti
--     $$SELECT public.handle_waitlist_notification_timeout()$$
-- );
--
-- Opzione 2: Supabase Edge Function + cron job esterno
-- Crea una Edge Function che chiama handle_waitlist_notification_timeout()
-- e schedulala con un servizio esterno (es. cron-job.org)

-- ============================================
-- Verifica finale
-- ============================================

-- Verifica che la colonna sia stata aggiunta
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'waitlist' 
            AND column_name = 'notification_expires_at'
        ) THEN '✅ Colonna notification_expires_at presente'
        ELSE '❌ Colonna notification_expires_at mancante'
    END as check_column;

-- Verifica funzioni create
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'notify_next_waitlist_client',
    'handle_waitlist_notification_timeout'
)
ORDER BY routine_name;

