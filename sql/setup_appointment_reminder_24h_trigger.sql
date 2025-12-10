-- ============================================
-- Setup Trigger per Reminder 24h Appuntamenti
-- ============================================
-- Questo script crea un trigger che chiama N8N quando un appuntamento
-- viene creato o aggiornato e si trova nella finestra temporale 24h prima

-- 1. Aggiungi il campo reminder_24h_sent se non esiste
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false;

-- 2. Crea un indice per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_24h 
ON public.appointments(start_at, status, reminder_24h_sent) 
WHERE reminder_24h_sent = false 
  AND status IN ('scheduled', 'confirmed', 'rescheduled');

-- 3. Elimina il trigger esistente se presente (per evitare duplicati)
DROP TRIGGER IF EXISTS n8n_appointment_reminder_24h ON public.appointments;

-- 4. Crea il trigger migliorato
-- ATTENZIONE: Questo trigger si attiva SOLO quando:
-- - L'appuntamento viene creato/aggiornato
-- - L'appuntamento è tra 23h e 25h nel futuro (finestra di 2 ore)
-- - reminder_24h_sent = false
-- - status IN ('scheduled', 'confirmed', 'rescheduled')
--
-- LIMITAZIONE: Se crei un appuntamento per tra 2 giorni, il trigger NON si attiva.
-- Per questo motivo, è consigliabile anche avere un job N8N che gira periodicamente
-- per catturare gli appuntamenti che sono entrati nella finestra 24h.
CREATE TRIGGER n8n_appointment_reminder_24h
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW
WHEN (
  -- Condizioni per attivare il trigger
  NEW.start_at IS NOT NULL
  AND NEW.status IN ('scheduled', 'confirmed', 'rescheduled')
  AND (NEW.reminder_24h_sent IS NULL OR NEW.reminder_24h_sent = false)
  -- L'appuntamento è tra 23h e 25h nel futuro (finestra di 2 ore)
  AND NEW.start_at > NOW() + INTERVAL '23 hours'
  AND NEW.start_at <= NOW() + INTERVAL '25 hours'
  -- Solo se è un nuovo record o se start_at/status sono cambiati
  AND (
    TG_OP = 'INSERT'
    OR (TG_OP = 'UPDATE' AND (
      OLD.start_at IS DISTINCT FROM NEW.start_at
      OR OLD.status IS DISTINCT FROM NEW.status
      OR (OLD.reminder_24h_sent = true AND NEW.reminder_24h_sent = false)
    ))
  )
)
EXECUTE FUNCTION supabase_functions.http_request(
  'https://poltrona.app.n8n.cloud/webhook/appointment-reminder-24h',
  'POST',
  '{"Authorization":"Bearer poltrona_secret_24h","Content-Type":"application/json"}',
  '{}',
  '5000'
);

-- 5. Commenti per documentazione
COMMENT ON COLUMN public.appointments.reminder_24h_sent IS 'Flag per indicare se il reminder 24h è stato inviato. Evita invii duplicati.';
COMMENT ON TRIGGER n8n_appointment_reminder_24h ON public.appointments IS 'Trigger che chiama N8N quando un appuntamento entra nella finestra 24h prima. Si attiva su INSERT/UPDATE quando start_at è tra 23h e 25h nel futuro.';

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Questo trigger ha una LIMITAZIONE:
-- 
-- Se crei un appuntamento per tra 2 giorni, il trigger NON si attiva
-- perché l'appuntamento non è ancora nella finestra 24h.
--
-- SOLUZIONE CONSIGLIATA:
-- 1. Usa questo trigger per appuntamenti creati/aggiornati quando sono già
--    nella finestra 24h (es. appuntamenti last-minute o modifiche)
-- 2. Crea anche un workflow N8N con CRON che gira ogni ora (o ogni giorno)
--    per cercare appuntamenti che sono entrati nella finestra 24h:
--
--    Query Supabase REST API:
--    GET /rest/v1/appointments?select=*
--      &status=in.(scheduled,confirmed,rescheduled)
--      &reminder_24h_sent=eq.false
--      &start_at=gte.{NOW + 23h}
--      &start_at=lte.{NOW + 25h}
--
--    Per ogni appuntamento trovato:
--    - Invia WhatsApp
--    - PATCH /rest/v1/appointments?id=eq.{id}
--      Body: {"reminder_24h_sent": true}
--
-- ============================================







