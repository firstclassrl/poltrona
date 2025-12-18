-- ============================================
-- MIGLIORAMENTO 4: Notifiche Staff per Waitlist
-- ============================================
-- Questo script aggiunge notifiche in-app per staff quando:
-- 1. Ci sono molti clienti in waitlist (>5)
-- 2. Un nuovo cliente si iscrive alla waitlist (se >3 già in coda)
-- 3. Summary giornaliero delle waitlist attive

-- ============================================
-- PARTE 1: Aggiorna constraint notifications per includere waitlist_summary
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
-- PARTE 2: Funzione per notificare staff quando ci sono molti clienti in waitlist
-- ============================================

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
            
            v_message := 'Ci sono ' || waitlist_count || ' clienti in lista d\'attesa';
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
                        '📋 Lista d\'Attesa Attiva',
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
-- PARTE 3: Trigger per notificare staff quando nuovo cliente si iscrive
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
        ) || ' si è iscritto alla lista d\'attesa. Totale: ' || waitlist_count || ' clienti.';
        
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

-- Crea trigger per notificare staff quando nuovo cliente si iscrive
DROP TRIGGER IF EXISTS trigger_notify_staff_new_waitlist ON public.waitlist;
CREATE TRIGGER trigger_notify_staff_new_waitlist
    AFTER INSERT ON public.waitlist
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_staff_new_waitlist_entry();

-- ============================================
-- PARTE 4: Job schedulato per summary giornaliero
-- ============================================
-- NOTA: Per attivare il job schedulato, usa pg_cron o Supabase Edge Functions:
-- 
-- Opzione 1: pg_cron (se disponibile)
-- SELECT cron.schedule(
--     'waitlist-staff-summary',
--     '0 9 * * *', -- Ogni giorno alle 9:00
--     $$SELECT public.notify_staff_waitlist_summary()$$
-- );
--
-- Opzione 2: Supabase Edge Function + cron job esterno
-- Crea una Edge Function che chiama notify_staff_waitlist_summary()
-- e schedulala con un servizio esterno (es. cron-job.org)

-- ============================================
-- Commenti e documentazione
-- ============================================

COMMENT ON FUNCTION public.notify_staff_waitlist_summary() IS 'Notifica staff quando ci sono molti clienti in waitlist (>5). Da eseguire periodicamente (es. ogni ora o giornalmente).';
COMMENT ON FUNCTION public.notify_staff_new_waitlist_entry() IS 'Trigger function che notifica staff quando un nuovo cliente si iscrive alla waitlist e ci sono già >3 clienti in coda.';

