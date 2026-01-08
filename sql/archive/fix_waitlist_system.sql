-- ============================================
-- FIX COMPLETO: Sistema Waitlist Funzionale
-- ============================================
-- Questo script corregge tutti i problemi critici del sistema waitlist:
-- 1. Corregge il mapping client_id -> user_id per le notifiche
-- 2. Implementa notifica solo al primo cliente in coda
-- 3. Aggiunge matching intelligente per servizio/barbiere
-- 4. Corregge RLS policies
-- 5. Aggiunge trigger per aggiornare stato a "booked"

-- ============================================
-- PARTE 1: Verifica/Aggiungi user_id in clients
-- ============================================

-- Aggiungi colonna user_id se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
  END IF;
END $$;

-- Collega clienti esistenti agli utenti tramite email (se disponibile)
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
-- PARTE 2: Corregge funzione find_waitlist_clients_for_date
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
-- PARTE 3: Corregge trigger notify_waitlist_on_cancellation
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
        
        -- Trova SOLO IL PRIMO cliente in waitlist per questa data e shop
        SELECT * INTO waitlist_record
        FROM public.find_waitlist_clients_for_date(
            NEW.shop_id, 
            appointment_date,
            NEW.service_id,  -- Passa service_id per matching intelligente
            NEW.staff_id     -- Passa staff_id per matching intelligente
        );
        
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
                        NEW.shop_id,
                        v_client_user_id,
                        'client',
                        'waitlist_available',
                        v_title,
                        v_message,
                        jsonb_build_object(
                            'available_date', appointment_date,
                            'available_time', appointment_time,
                            'waitlist_id', waitlist_record.waitlist_id,
                            'cancelled_appointment_id', NEW.id,
                            'service_id', NEW.service_id,
                            'service_name', service_name,
                            'staff_id', NEW.staff_id,
                            'staff_name', staff_name,
                            'client_id', waitlist_record.client_id
                        ),
                        NOW()
                    );
                END;
                
                -- Aggiorna lo stato della waitlist entry
                UPDATE public.waitlist 
                SET status = 'notified', notified_at = NOW()
                WHERE id = waitlist_record.waitlist_id;
            ELSE
                -- Log errore se user_id non trovato
                RAISE LOG 'Waitlist: Cliente % non ha user_id collegato - notifica non inviata', waitlist_record.client_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log errore ma continua l'esecuzione
        RAISE LOG 'Errore nella notifica waitlist per appuntamento %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Ricrea il trigger
DROP TRIGGER IF EXISTS trigger_notify_waitlist_on_cancellation ON public.appointments;
CREATE TRIGGER trigger_notify_waitlist_on_cancellation
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_waitlist_on_cancellation();

-- ============================================
-- PARTE 4: Trigger per aggiornare waitlist a "booked"
-- ============================================

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
        -- Match opzionale per servizio/barbiere se specificati nella waitlist
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

-- Crea trigger per aggiornare waitlist quando viene creato un appuntamento
DROP TRIGGER IF EXISTS trigger_update_waitlist_on_appointment_created ON public.appointments;
CREATE TRIGGER trigger_update_waitlist_on_appointment_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_waitlist_on_appointment_created();

-- ============================================
-- PARTE 5: Corregge RLS Policies per waitlist
-- ============================================

-- Rimuovi policy esistenti problematiche
DROP POLICY IF EXISTS "Clients can view own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Clients can insert waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Clients can update own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Clients can delete own waitlist entries" ON public.waitlist;

-- Policy corretta: SELECT - Clienti vedono le proprie entry tramite client_id collegato a user_id
CREATE POLICY "Clients can view own waitlist entries" ON public.waitlist
    FOR SELECT
    USING (
        -- Cliente autenticato può vedere entry dove client.user_id = auth.uid()
        EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = waitlist.client_id
            AND c.user_id = auth.uid()
        )
        OR
        -- Oppure tramite profiles se clients.user_id non è popolato
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
        -- Staff può vedere waitlist del proprio shop
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.profiles p ON p.user_id = s.user_id
            WHERE p.user_id = auth.uid()
            AND s.shop_id = waitlist.shop_id
        )
    );

-- Policy: INSERT - Clienti possono inserire entry per se stessi
CREATE POLICY "Clients can insert waitlist entries" ON public.waitlist
    FOR INSERT
    WITH CHECK (
        -- Cliente può inserire solo per se stesso (tramite client_id collegato)
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

-- Policy: UPDATE - Clienti possono aggiornare le proprie entry
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

-- Policy: DELETE - Clienti possono eliminare le proprie entry
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

-- Policy: Service role può fare tutto
DROP POLICY IF EXISTS "Service role full access" ON public.waitlist;
CREATE POLICY "Service role full access" ON public.waitlist
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- PARTE 6: Migliora funzione cleanup_expired_waitlist
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_waitlist()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Marca come expired le entry scadute che sono ancora in stato waiting o notified
    UPDATE public.waitlist
    SET status = 'expired'
    WHERE status IN ('waiting', 'notified')
    AND expires_at < NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- ============================================
-- Commenti per documentazione
-- ============================================

COMMENT ON FUNCTION public.find_waitlist_clients_for_date() IS 'Trova il primo cliente in waitlist per una data specifica con matching intelligente per servizio/barbiere';
COMMENT ON FUNCTION public.notify_waitlist_on_cancellation() IS 'Trigger function che notifica SOLO il primo cliente in waitlist quando un appuntamento viene cancellato, con matching intelligente';
COMMENT ON FUNCTION public.update_waitlist_on_appointment_created() IS 'Trigger function che aggiorna automaticamente lo stato waitlist a booked quando un cliente prenota dopo essere stato notificato';
COMMENT ON FUNCTION public.cleanup_expired_waitlist() IS 'Funzione per pulire waitlist scadute, marca come expired entry in stato waiting o notified';

-- ============================================
-- Verifica finale
-- ============================================

-- Verifica che la colonna user_id esista
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id'
        ) THEN '✅ Colonna user_id presente in clients'
        ELSE '❌ Colonna user_id mancante in clients'
    END as check_user_id;

-- Verifica che i trigger siano creati
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
    'trigger_notify_waitlist_on_cancellation',
    'trigger_update_waitlist_on_appointment_created'
)
ORDER BY trigger_name;

