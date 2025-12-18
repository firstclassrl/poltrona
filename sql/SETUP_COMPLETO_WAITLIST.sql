-- ============================================
-- SCRIPT COMPLETO SETUP WAITLIST
-- ============================================
-- ESEGUI QUESTO FILE E BASTA!
-- Contiene tutto il necessario per il sistema waitlist completo
-- 
-- Ordine di esecuzione:
-- 1. Questo script (SETUP_COMPLETO_WAITLIST.sql)
-- 
-- Fine. Non serve altro.

-- ============================================
-- PARTE 1: Aggiungi colonna user_id in clients
-- ============================================

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- Collega clienti esistenti agli utenti tramite email
UPDATE public.clients c
SET user_id = p.user_id
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND c.email != ''
  AND LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
  AND p.role = 'client';

-- ============================================
-- PARTE 2: Crea funzione find_waitlist_clients_for_date
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
        COALESCE(c.user_id, p.user_id) as client_user_id,
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
    AND (
        (p_service_id IS NULL AND p_staff_id IS NULL)
        OR
        (w.service_id IS NULL AND w.staff_id IS NULL)
        OR
        (p_service_id IS NOT NULL AND w.service_id = p_service_id AND (p_staff_id IS NULL OR w.staff_id IS NULL OR w.staff_id = p_staff_id))
        OR
        (p_staff_id IS NOT NULL AND w.staff_id = p_staff_id AND (p_service_id IS NULL OR w.service_id IS NULL OR w.service_id = p_service_id))
    )
    ORDER BY w.created_at ASC
    LIMIT 1;
END;
$$;

-- ============================================
-- PARTE 3: Aggiungi colonna notification_expires_at
-- ============================================

ALTER TABLE public.waitlist 
ADD COLUMN IF NOT EXISTS notification_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_waitlist_notification_expires 
ON public.waitlist(notification_expires_at) 
WHERE status = 'notified' AND notification_expires_at IS NOT NULL;

-- ============================================
-- PARTE 4: Crea funzione notify_next_waitlist_client
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
                        'client_id', waitlist_record.client_id,
                        'client_email', waitlist_record.client_email
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
-- PARTE 5: Aggiorna trigger notify_waitlist_on_cancellation
-- ============================================

DROP TRIGGER IF EXISTS trigger_notify_waitlist_on_cancellation ON public.appointments;

CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo se lo status cambia a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        -- Notifica il primo cliente usando la nuova funzione
        PERFORM public.notify_next_waitlist_client(
            NEW.shop_id,
            DATE(NEW.start_at AT TIME ZONE 'Europe/Rome'),
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

CREATE TRIGGER trigger_notify_waitlist_on_cancellation
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_waitlist_on_cancellation();

-- ============================================
-- PARTE 6: Crea funzione handle_waitlist_notification_timeout
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
-- PARTE 7: Crea trigger update_waitlist_on_appointment_created
-- ============================================

DROP TRIGGER IF EXISTS trigger_update_waitlist_on_appointment_created ON public.appointments;

CREATE OR REPLACE FUNCTION public.update_waitlist_on_appointment_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    appointment_date DATE;
    v_waitlist_id UUID;
BEGIN
    -- Solo su INSERT di nuovo appuntamento (non cancellato)
    IF NEW.status != 'cancelled' THEN
        appointment_date := DATE(NEW.start_at AT TIME ZONE 'Europe/Rome');
        
        -- Trova waitlist entry notified per questo cliente, data e shop
        SELECT id INTO v_waitlist_id
        FROM public.waitlist
        WHERE client_id = NEW.client_id
        AND shop_id = NEW.shop_id
        AND status = 'notified'
        AND appointment_date = ANY(preferred_dates)
        AND (
            service_id IS NULL OR service_id = NEW.service_id
        )
        AND (
            staff_id IS NULL OR staff_id = NEW.staff_id
        )
        ORDER BY notified_at DESC
        LIMIT 1;
        
        -- Se trovata, aggiorna lo stato a "booked"
        IF v_waitlist_id IS NOT NULL THEN
            UPDATE public.waitlist
            SET status = 'booked'
            WHERE id = v_waitlist_id;
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Errore nell''aggiornamento waitlist per appuntamento %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_waitlist_on_appointment_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_waitlist_on_appointment_created();

-- ============================================
-- PARTE 8: Aggiorna constraint notifications
-- ============================================

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'new_appointment', 
    'appointment_cancelled', 
    'appointment_rescheduled',
    'appointment_reminder', 
    'system', 
    'waitlist_available',
    'waitlist_summary',
    'new_client', 
    'chat_message'
));

-- ============================================
-- PARTE 9: Crea funzioni per notifiche staff
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_staff_new_waitlist_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    waitlist_count INTEGER;
    staff_member RECORD;
    client_record RECORD;
    v_message TEXT;
BEGIN
    -- Conta quanti clienti sono già in waitlist per questo shop
    SELECT COUNT(DISTINCT client_id) INTO waitlist_count
    FROM public.waitlist
    WHERE shop_id = NEW.shop_id
    AND status = 'waiting'
    AND expires_at >= NOW();
    
    -- Se ci sono già più di 3 clienti in coda, notifica staff
    IF waitlist_count > 3 THEN
        -- Recupera dati cliente
        SELECT 
            first_name,
            last_name,
            email
        INTO client_record
        FROM public.clients
        WHERE id = NEW.client_id;
        
        v_message := COALESCE(
            client_record.first_name || ' ' || COALESCE(client_record.last_name, ''),
            'Un nuovo cliente'
        ) || ' si è iscritto alla lista d''attesa. Totale: ' || waitlist_count || ' clienti.';
        
        -- Notifica tutti gli staff del negozio
        FOR staff_member IN
            SELECT DISTINCT s.user_id, s.id, s.full_name
            FROM public.staff s
            JOIN public.profiles p ON p.user_id = s.user_id
            WHERE s.shop_id = NEW.shop_id
            AND s.active = true
            AND s.user_id IS NOT NULL
            AND p.role IN ('barber', 'admin', 'owner')
        LOOP
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
                NEW.shop_id,
                staff_member.user_id,
                'staff',
                'waitlist_summary',
                '➕ Nuovo Cliente in Waitlist',
                v_message,
                jsonb_build_object(
                    'waitlist_id', NEW.id,
                    'client_id', NEW.client_id,
                    'client_name', COALESCE(client_record.first_name || ' ' || COALESCE(client_record.last_name, ''), 'Cliente'),
                    'total_waitlist_count', waitlist_count,
                    'preferred_dates', NEW.preferred_dates
                ),
                NOW()
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Errore nella notifica staff per nuova waitlist entry %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_staff_new_waitlist ON public.waitlist;

CREATE TRIGGER trigger_notify_staff_new_waitlist
    AFTER INSERT ON public.waitlist
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_staff_new_waitlist_entry();

CREATE OR REPLACE FUNCTION public.notify_staff_waitlist_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    shop_record RECORD;
    waitlist_count INTEGER;
    staff_member RECORD;
    v_message TEXT;
    v_dates_summary TEXT;
    date_counts RECORD;
BEGIN
    -- Per ogni shop, controlla se ci sono molti clienti in waitlist
    FOR shop_record IN
        SELECT DISTINCT shop_id FROM public.waitlist WHERE status = 'waiting'
    LOOP
        -- Conta clienti in waitlist per questo shop
        SELECT COUNT(DISTINCT client_id) INTO waitlist_count
        FROM public.waitlist
        WHERE shop_id = shop_record.shop_id
        AND status = 'waiting'
        AND expires_at >= NOW();
        
        -- Se ci sono più di 5 clienti in waitlist, notifica staff
        IF waitlist_count > 5 THEN
            -- Prepara summary date
            SELECT string_agg(
                TO_CHAR(date_val, 'DD/MM') || ' (' || count_val || ')',
                ', '
                ORDER BY date_val
            ) INTO v_dates_summary
            FROM (
                SELECT 
                    date_val,
                    COUNT(*) as count_val
                FROM (
                    SELECT unnest(preferred_dates) as date_val
                    FROM public.waitlist
                    WHERE shop_id = shop_record.shop_id
                    AND status = 'waiting'
                    AND expires_at >= NOW()
                ) dates
                GROUP BY date_val
                ORDER BY date_val
                LIMIT 5
            ) date_counts;
            
            v_message := 'Ci sono ' || waitlist_count || ' clienti in lista d''attesa';
            IF v_dates_summary IS NOT NULL THEN
                v_message := v_message || ' per le date: ' || v_dates_summary;
            END IF;
            v_message := v_message || '. Controlla la dashboard waitlist.';
            
            -- Notifica tutti gli staff del negozio
            FOR staff_member IN
                SELECT DISTINCT s.user_id, s.id, s.full_name
                FROM public.staff s
                JOIN public.profiles p ON p.user_id = s.user_id
                WHERE s.shop_id = shop_record.shop_id
                AND s.active = true
                AND s.user_id IS NOT NULL
                AND p.role IN ('barber', 'admin', 'owner')
            LOOP
                -- Controlla se esiste già una notifica simile nelle ultime 2 ore
                IF NOT EXISTS (
                    SELECT 1 FROM public.notifications
                    WHERE shop_id = shop_record.shop_id
                    AND user_id = staff_member.user_id
                    AND type = 'waitlist_summary'
                    AND created_at > NOW() - INTERVAL '2 hours'
                ) THEN
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
                        shop_record.shop_id,
                        staff_member.user_id,
                        'staff',
                        'waitlist_summary',
                        '📋 Lista d''Attesa Attiva',
                        v_message,
                        jsonb_build_object(
                            'waitlist_count', waitlist_count,
                            'shop_id', shop_record.shop_id,
                            'dates_summary', v_dates_summary
                        ),
                        NOW()
                    );
                END IF;
            END LOOP;
        END IF;
    END LOOP;
END;
$$;

-- ============================================
-- PARTE 10: Corregge RLS Policies
-- ============================================

DROP POLICY IF EXISTS "Clients can view own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Clients can insert waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Clients can update own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Clients can delete own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Service role full access" ON public.waitlist;

CREATE POLICY "Clients can view own waitlist entries" ON public.waitlist
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = waitlist.client_id
            AND c.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.clients c
            JOIN public.profiles p ON p.user_id = auth.uid()
            JOIN auth.users u ON u.id = p.user_id
            WHERE c.id = waitlist.client_id
            AND c.email IS NOT NULL
            AND LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
            AND p.role = 'client'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.profiles p ON p.user_id = s.user_id
            WHERE p.user_id = auth.uid()
            AND s.shop_id = waitlist.shop_id
        )
    );

CREATE POLICY "Clients can insert waitlist entries" ON public.waitlist
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = waitlist.client_id
            AND (
                c.user_id = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    JOIN auth.users u ON u.id = p.user_id
                    WHERE p.user_id = auth.uid()
                    AND c.email IS NOT NULL
                    AND LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
                    AND p.role = 'client'
                )
            )
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY "Clients can update own waitlist entries" ON public.waitlist
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = waitlist.client_id
            AND (
                c.user_id = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    JOIN auth.users u ON u.id = p.user_id
                    WHERE p.user_id = auth.uid()
                    AND c.email IS NOT NULL
                    AND LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
                    AND p.role = 'client'
                )
            )
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = waitlist.client_id
            AND (
                c.user_id = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    JOIN auth.users u ON u.id = p.user_id
                    WHERE p.user_id = auth.uid()
                    AND c.email IS NOT NULL
                    AND LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
                    AND p.role = 'client'
                )
            )
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY "Clients can delete own waitlist entries" ON public.waitlist
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = waitlist.client_id
            AND (
                c.user_id = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    JOIN auth.users u ON u.id = p.user_id
                    WHERE p.user_id = auth.uid()
                    AND c.email IS NOT NULL
                    AND LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
                    AND p.role = 'client'
                )
            )
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY "Service role full access" ON public.waitlist
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- FINE SETUP
-- ============================================
-- 
-- Verifica che tutto sia stato creato correttamente:
-- 
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' AND routine_name LIKE '%waitlist%';
-- 
-- SELECT trigger_name FROM information_schema.triggers 
-- WHERE trigger_schema = 'public' AND trigger_name LIKE '%waitlist%';
-- 
-- Dovresti vedere almeno 7 funzioni e 3 trigger.

