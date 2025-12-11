-- ============================================
-- Tabella Waitlist - Lista d'attesa clienti
-- ============================================
-- Permette ai clienti di mettersi in coda per oggi, domani e dopodomani
-- Quando un appuntamento viene cancellato, il sistema notifica i clienti in coda

-- 1. Creiamo la tabella waitlist
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    preferred_dates DATE[] NOT NULL, -- Array di date (oggi, domani, dopodomani)
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL, -- Scade automaticamente dopo l'ultima data preferita
    notes TEXT
);

-- 2. Indici per query performanti
CREATE INDEX IF NOT EXISTS idx_waitlist_shop ON public.waitlist(shop_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_client ON public.waitlist(client_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_dates ON public.waitlist USING GIN(preferred_dates);
CREATE INDEX IF NOT EXISTS idx_waitlist_expires ON public.waitlist(expires_at);

-- 3. Abilita RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Gli utenti autenticati possono vedere le proprie richieste in coda
CREATE POLICY "Clients can view own waitlist entries" ON public.waitlist
    FOR SELECT
    USING (
        client_id = auth.uid()
        OR 
        -- Staff può vedere waitlist del proprio shop
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.id = auth.uid() 
            AND staff.shop_id = waitlist.shop_id
        )
    );

-- 5. Policy: I clienti possono inserire richieste
CREATE POLICY "Clients can insert waitlist entries" ON public.waitlist
    FOR INSERT
    WITH CHECK (client_id = auth.uid() OR auth.role() = 'authenticated');

-- 6. Policy: I clienti possono aggiornare le proprie richieste
CREATE POLICY "Clients can update own waitlist entries" ON public.waitlist
    FOR UPDATE
    USING (client_id = auth.uid() OR auth.role() = 'service_role')
    WITH CHECK (client_id = auth.uid() OR auth.role() = 'service_role');

-- 7. Policy: I clienti possono eliminare le proprie richieste
CREATE POLICY "Clients can delete own waitlist entries" ON public.waitlist
    FOR DELETE
    USING (client_id = auth.uid());

-- 8. Policy: Service role (N8N) può fare tutto
CREATE POLICY "Service role full access" ON public.waitlist
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- Estendere la tabella notifications
-- ============================================

-- Aggiorniamo il check constraint per includere 'waitlist_available'
-- Prima rimuoviamo il vecchio constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Aggiungiamo il nuovo constraint con 'waitlist_available'
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('new_appointment', 'appointment_cancelled', 'appointment_reminder', 'system', 'waitlist_available'));

-- ============================================
-- Funzione per trovare clienti in waitlist per una data
-- ============================================

CREATE OR REPLACE FUNCTION public.find_waitlist_clients_for_date(p_shop_id UUID, p_date DATE)
RETURNS TABLE (
    waitlist_id UUID,
    client_id UUID,
    client_email TEXT,
    client_name TEXT,
    client_phone TEXT,
    service_id UUID,
    staff_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id as waitlist_id,
        w.client_id,
        c.email as client_email,
        CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) as client_name,
        c.phone_e164 as client_phone,
        w.service_id,
        w.staff_id
    FROM public.waitlist w
    JOIN public.clients c ON c.id = w.client_id
    WHERE w.shop_id = p_shop_id
    AND w.status = 'waiting'
    AND p_date = ANY(w.preferred_dates)
    AND w.expires_at >= NOW()
    ORDER BY w.created_at ASC;
END;
$$;

-- ============================================
-- Funzione per pulire waitlist scadute
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_waitlist()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.waitlist
    SET status = 'expired'
    WHERE status = 'waiting'
    AND expires_at < NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- ============================================
-- Trigger per notificare clienti quando un appuntamento viene cancellato
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    waitlist_record RECORD;
    appointment_date DATE;
BEGIN
    -- Solo se lo status cambia a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        -- Ottieni la data dell'appuntamento cancellato
        appointment_date := DATE(NEW.start_at);
        
        -- Trova tutti i clienti in waitlist per questa data e shop
        FOR waitlist_record IN 
            SELECT * FROM public.find_waitlist_clients_for_date(NEW.shop_id, appointment_date)
        LOOP
            -- Inserisci notifica in-app per ogni cliente in coda
            INSERT INTO public.notifications (
                shop_id,
                user_id,
                user_type,
                type,
                title,
                message,
                data
            ) VALUES (
                NEW.shop_id,
                waitlist_record.client_id,
                'client',
                'waitlist_available',
                'Posto disponibile!',
                'Si è liberato un posto per il ' || TO_CHAR(appointment_date, 'DD/MM/YYYY') || '. Prenota subito!',
                jsonb_build_object(
                    'available_date', appointment_date,
                    'waitlist_id', waitlist_record.waitlist_id,
                    'cancelled_appointment_id', NEW.id
                )
            );
            
            -- Aggiorna lo stato della waitlist entry
            UPDATE public.waitlist 
            SET status = 'notified', notified_at = NOW()
            WHERE id = waitlist_record.waitlist_id;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crea il trigger sull'aggiornamento degli appuntamenti
DROP TRIGGER IF EXISTS trigger_notify_waitlist_on_cancellation ON public.appointments;
CREATE TRIGGER trigger_notify_waitlist_on_cancellation
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_waitlist_on_cancellation();

-- ============================================
-- Commenti per documentazione
-- ============================================

COMMENT ON TABLE public.waitlist IS 'Lista d''attesa per clienti che vogliono essere notificati quando si libera un posto';
COMMENT ON COLUMN public.waitlist.preferred_dates IS 'Array di date preferite (oggi, domani, dopodomani)';
COMMENT ON COLUMN public.waitlist.status IS 'Stato: waiting (in attesa), notified (notificato), booked (ha prenotato), expired (scaduto)';
COMMENT ON COLUMN public.waitlist.expires_at IS 'Scadenza automatica dopo l''ultima data preferita';
COMMENT ON FUNCTION public.notify_waitlist_on_cancellation() IS 'Trigger function che notifica i clienti in waitlist quando un appuntamento viene cancellato';












