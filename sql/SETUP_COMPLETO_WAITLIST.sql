-- ============================================
-- SETUP COMPLETO WAITLIST (ANTICIPO APPUNTAMENTO)
-- ============================================
-- Modello: il cliente prenota normalmente e, nella modale di conferma,
-- può attivare "Avvisami se si libera un posto prima".
--
-- Matching: stesso barbiere + stessa DURATA (minuti). Non serve lo stesso servizio.
-- Evento: quando un appuntamento viene cancellato o spostato, si libera uno slot.
-- Se lo slot liberato è prima dell'appuntamento del cliente ed è della stessa durata,
-- inviamo una notifica in-app (e webhook email via Supabase, se configurato).
--
-- ESEGUI QUESTO FILE (Supabase SQL Editor) dopo aver creato le tabelle base.

-- ============================================
-- PARTE 1: clients.user_id (link a auth.users)
-- ============================================

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- Tenta link per email (se profiles/auth.users presenti)
UPDATE public.clients c
SET user_id = p.user_id
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND c.email <> ''
  AND LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
  AND p.role = 'client';

-- ============================================
-- PARTE 2: notifications_type_check (aggiunge appointment_earlier_available)
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
  'appointment_earlier_available',
  'new_client',
  'chat_message'
));

-- ============================================
-- PARTE 2B: Webhook outbox (tabella dedicata per N8N/push/email)
-- ============================================
-- Supabase Database Webhook NON ha filtro lato DB: se lo punti su notifications
-- scatterà per qualunque notifica (new_appointment, ecc).
-- Soluzione: usa una tabella "outbox" che popoliamo SOLO per eventi waitlist.

CREATE TABLE IF NOT EXISTS public.webhook_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_outbox_event_created
  ON public.webhook_outbox(event_type, created_at DESC);

-- (opzionale) RLS: di default abilitiamo e lasciamo accesso solo al service_role
ALTER TABLE public.webhook_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access (webhook_outbox)" ON public.webhook_outbox;
CREATE POLICY "Service role full access (webhook_outbox)" ON public.webhook_outbox
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- PARTE 3: Migrazione tabella waitlist (per-appuntamento)
-- ============================================

-- La tabella `public.waitlist` potrebbe esistere già in versione "a date".
-- Qui la migriamo in modo compatibile.

-- Nuove colonne
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS appointment_duration_min INTEGER,
  ADD COLUMN IF NOT EXISTS notify_if_earlier BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS offered_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offered_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Colonne vecchie (non più usate)
ALTER TABLE public.waitlist
  DROP COLUMN IF EXISTS preferred_dates,
  DROP COLUMN IF EXISTS service_id;

-- Assicura colonne base (in caso di schema incompleto)
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Constraint status (nuovo set valori)
ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_status_check;
ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_status_check
  CHECK (status IN ('active', 'notified', 'accepted', 'expired', 'disabled'));

ALTER TABLE public.waitlist ALTER COLUMN status SET DEFAULT 'active';

-- Migrazione valori vecchi se presenti
UPDATE public.waitlist SET status = 'active'   WHERE status = 'waiting';
UPDATE public.waitlist SET status = 'accepted' WHERE status = 'booked';

-- Indici
CREATE INDEX IF NOT EXISTS idx_waitlist_shop_staff_status
  ON public.waitlist(shop_id, staff_id, status);

CREATE INDEX IF NOT EXISTS idx_waitlist_appointment_id
  ON public.waitlist(appointment_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_active_per_appointment
  ON public.waitlist(appointment_id)
  WHERE status IN ('active', 'notified');

-- ============================================
-- PARTE 4: RLS policies per waitlist
-- ============================================

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Clients can insert waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Clients can update own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Clients can delete own waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Staff can view shop waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Staff can update shop waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Service role full access" ON public.waitlist;

-- Client SELECT
CREATE POLICY "Clients can view own waitlist entries" ON public.waitlist
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = waitlist.client_id
        AND c.user_id = auth.uid()
    )
  );

-- Client INSERT (solo per il proprio appuntamento)
CREATE POLICY "Clients can insert waitlist entries" ON public.waitlist
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.appointments a ON a.id = waitlist.appointment_id
      WHERE c.id = waitlist.client_id
        AND c.user_id = auth.uid()
        AND a.client_id = c.id
        AND a.staff_id = waitlist.staff_id
        AND a.shop_id = waitlist.shop_id
        AND a.status <> 'cancelled'
    )
  );

-- Client UPDATE (per declinare/riattivare)
CREATE POLICY "Clients can update own waitlist entries" ON public.waitlist
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = waitlist.client_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = waitlist.client_id
        AND c.user_id = auth.uid()
    )
  );

-- Client DELETE
CREATE POLICY "Clients can delete own waitlist entries" ON public.waitlist
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = waitlist.client_id
        AND c.user_id = auth.uid()
    )
  );

-- Staff SELECT (stesso shop)
CREATE POLICY "Staff can view shop waitlist" ON public.waitlist
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.user_id = auth.uid()
        AND s.shop_id = waitlist.shop_id
    )
  );

-- Staff UPDATE (stesso shop)
CREATE POLICY "Staff can update shop waitlist" ON public.waitlist
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.user_id = auth.uid()
        AND s.shop_id = waitlist.shop_id
    )
  );

-- Service role
CREATE POLICY "Service role full access" ON public.waitlist
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- PARTE 5: Funzione candidato per slot liberato (stesso barbiere + stessa durata)
-- ============================================

CREATE OR REPLACE FUNCTION public.find_waitlist_candidate_for_freed_slot(
  p_shop_id UUID,
  p_staff_id UUID,
  p_freed_start_at TIMESTAMPTZ,
  p_freed_end_at TIMESTAMPTZ
)
RETURNS TABLE (
  waitlist_id UUID,
  appointment_id UUID,
  client_id UUID,
  client_user_id UUID,
  client_email TEXT,
  client_name TEXT,
  current_start_at TIMESTAMPTZ,
  current_end_at TIMESTAMPTZ,
  duration_min INTEGER
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH freed AS (
    SELECT
      p_freed_start_at AS start_at,
      p_freed_end_at AS end_at,
      GREATEST(1, ROUND(EXTRACT(EPOCH FROM (p_freed_end_at - p_freed_start_at)) / 60.0))::int AS duration_min
  )
  SELECT
    w.id AS waitlist_id,
    a.id AS appointment_id,
    w.client_id,
    c.user_id AS client_user_id,
    c.email AS client_email,
    CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')) AS client_name,
    a.start_at AS current_start_at,
    a.end_at AS current_end_at,
    f.duration_min
  FROM public.waitlist w
  JOIN public.appointments a ON a.id = w.appointment_id
  JOIN public.clients c ON c.id = w.client_id
  CROSS JOIN freed f
  WHERE w.shop_id = p_shop_id
    AND w.staff_id = p_staff_id
    AND w.status = 'active'
    AND w.notify_if_earlier = TRUE
    AND (w.expires_at IS NULL OR w.expires_at >= NOW())
    AND a.status <> 'cancelled'
    AND a.start_at > p_freed_start_at
    AND p_freed_start_at >= NOW()
    AND GREATEST(1, ROUND(EXTRACT(EPOCH FROM (a.end_at - a.start_at)) / 60.0))::int = f.duration_min
  ORDER BY (a.start_at - p_freed_start_at) ASC, w.created_at ASC
  LIMIT 1;
$$;

-- ============================================
-- PARTE 6: Trigger su appointments UPDATE (cancellazione o spostamento)
-- ============================================

-- Disattiva eventuali trigger vecchi della waitlist "a date" (se presenti)
DROP TRIGGER IF EXISTS trigger_notify_waitlist_on_cancellation ON public.appointments;
DROP TRIGGER IF EXISTS trigger_update_waitlist_on_appointment_created ON public.appointments;

CREATE OR REPLACE FUNCTION public.notify_client_earlier_slot_available()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_freed_start TIMESTAMPTZ;
  v_freed_end TIMESTAMPTZ;
  v_candidate RECORD;
  v_staff_name TEXT;
  v_offer_timeout INTERVAL := INTERVAL '15 minutes';
BEGIN
  -- Slot liberato: OLD era valido, NEW è cancellato oppure è stato spostato/cambiato barbiere
  IF (OLD.status IS DISTINCT FROM 'cancelled') AND (
      NEW.status = 'cancelled'
      OR NEW.start_at IS DISTINCT FROM OLD.start_at
      OR NEW.end_at IS DISTINCT FROM OLD.end_at
      OR NEW.staff_id IS DISTINCT FROM OLD.staff_id
    ) THEN
    v_freed_start := OLD.start_at;
    v_freed_end := OLD.end_at;

    -- Ignora slot nel passato
    IF v_freed_start < NOW() THEN
      RETURN NEW;
    END IF;

    -- Cerca candidato (stesso shop+barbiere)
    SELECT * INTO v_candidate
    FROM public.find_waitlist_candidate_for_freed_slot(OLD.shop_id, OLD.staff_id, v_freed_start, v_freed_end);

    IF FOUND AND v_candidate.client_user_id IS NOT NULL THEN
      SELECT full_name INTO v_staff_name FROM public.staff WHERE id = OLD.staff_id;

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
        OLD.shop_id,
        v_candidate.client_user_id,
        'client',
        'appointment_earlier_available',
        '⏩ Posto disponibile prima!',
        'Si è liberato uno slot prima del tuo appuntamento. Clicca per anticipare la prenotazione.',
        jsonb_build_object(
          'waitlist_id', v_candidate.waitlist_id,
          'appointment_id', v_candidate.appointment_id,
          'earlier_start_at', v_freed_start,
          'earlier_end_at', v_freed_end,
          'current_start_at', v_candidate.current_start_at,
          'current_end_at', v_candidate.current_end_at,
          'staff_id', OLD.staff_id,
          'staff_name', COALESCE(v_staff_name, ''),
          'duration_min', v_candidate.duration_min
        ),
        NOW()
      );

      -- Inserisci evento SOLO per N8N/push/email nella outbox dedicata
      -- (così il database webhook non si triggera su tutte le notifiche)
      INSERT INTO public.webhook_outbox (
        shop_id,
        event_type,
        payload,
        created_at
      ) VALUES (
        OLD.shop_id,
        'appointment_earlier_available',
        jsonb_build_object(
          'notification_type', 'appointment_earlier_available',
          'user_id', v_candidate.client_user_id,
          'client_email', COALESCE(v_candidate.client_email, ''),
          'client_name', COALESCE(v_candidate.client_name, ''),
          'waitlist_id', v_candidate.waitlist_id,
          'appointment_id', v_candidate.appointment_id,
          'earlier_start_at', v_freed_start,
          'earlier_end_at', v_freed_end,
          'current_start_at', v_candidate.current_start_at,
          'current_end_at', v_candidate.current_end_at,
          'staff_id', OLD.staff_id,
          'staff_name', COALESCE(v_staff_name, ''),
          'duration_min', v_candidate.duration_min
        ),
        NOW()
      );

      UPDATE public.waitlist
      SET
        status = 'notified',
        notified_at = NOW(),
        offered_start_at = v_freed_start,
        offered_end_at = v_freed_end,
        offer_expires_at = NOW() + v_offer_timeout
      WHERE id = v_candidate.waitlist_id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Errore notify_client_earlier_slot_available per appointment %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_client_earlier_slot_available ON public.appointments;
CREATE TRIGGER trigger_notify_client_earlier_slot_available
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_earlier_slot_available();

-- ============================================
-- PARTE 7: Reset offerte scadute (da schedulare)
-- ============================================

CREATE OR REPLACE FUNCTION public.expire_earlier_slot_offers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.waitlist
  SET
    status = 'active',
    offered_start_at = NULL,
    offered_end_at = NULL,
    offer_expires_at = NULL
  WHERE status = 'notified'
    AND offer_expires_at IS NOT NULL
    AND offer_expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_earlier_slot_offers() IS 'Resetta offerte scadute (notified -> active). Da schedulare (es. ogni 5 minuti).';

-- ============================================
-- FINE
-- ============================================

