-- ============================================
-- Setup WhatsApp Reminders per Appuntamenti
-- ============================================
-- Questo script aggiunge i campi necessari per il sistema di reminder WhatsApp
-- che invia messaggi alle 20:00 di ogni giorno per gli appuntamenti del giorno successivo

-- ============================================
-- 1. Tabella appointments: Campi reminder
-- ============================================

-- Aggiungi campo reminder_sent se non esiste
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Aggiungi campo reminder_sent_at per tracciare quando è stato inviato
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Commenti per documentazione
COMMENT ON COLUMN public.appointments.reminder_sent IS 'Flag per indicare se il reminder WhatsApp è stato inviato. Evita invii duplicati.';
COMMENT ON COLUMN public.appointments.reminder_sent_at IS 'Timestamp che indica quando è stato inviato il reminder WhatsApp.';

-- ============================================
-- 2. Tabella shops: Configurazione reminder
-- ============================================

-- Abilita/disabilita reminder WhatsApp per negozio
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS whatsapp_reminder_enabled BOOLEAN DEFAULT true;

-- Orario in cui inviare i reminder (default 20:00)
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS whatsapp_reminder_time TIME DEFAULT '20:00';

-- Phone Number ID di WhatsApp Cloud API (opzionale, può essere globale in n8n)
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;

-- Access Token di WhatsApp Cloud API (opzionale, può essere globale in n8n)
-- NOTA: Per sicurezza, si consiglia di usare variabili ambiente n8n invece di salvare nel DB
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

-- Commenti per documentazione
COMMENT ON COLUMN public.shops.whatsapp_reminder_enabled IS 'Abilita o disabilita l''invio automatico di reminder WhatsApp per questo negozio.';
COMMENT ON COLUMN public.shops.whatsapp_reminder_time IS 'Orario in cui inviare i reminder WhatsApp ogni giorno (formato HH:MM). Default: 20:00.';
COMMENT ON COLUMN public.shops.whatsapp_phone_number_id IS 'Phone Number ID di WhatsApp Cloud API per questo negozio (opzionale). Se non specificato, usa quello globale configurato in n8n.';
COMMENT ON COLUMN public.shops.whatsapp_access_token IS 'Access Token di WhatsApp Cloud API per questo negozio (opzionale). Si consiglia di usare variabili ambiente n8n per sicurezza.';

-- ============================================
-- 3. Indici per performance
-- ============================================

-- Indice composito per query efficienti sui reminder
-- Usato dal workflow n8n per trovare appuntamenti del giorno dopo che non hanno ancora ricevuto reminder
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_query 
ON public.appointments(start_at, status, reminder_sent) 
WHERE reminder_sent = false 
  AND status IN ('scheduled', 'confirmed', 'rescheduled');

-- Indice per filtrare per data (utile per query range)
CREATE INDEX IF NOT EXISTS idx_appointments_start_at 
ON public.appointments(start_at) 
WHERE status IN ('scheduled', 'confirmed', 'rescheduled');

-- ============================================
-- 4. Funzione helper per resettare reminder quando appuntamento viene modificato
-- ============================================

-- Funzione che resetta reminder_sent quando un appuntamento viene riprogrammato
-- Questo permette di inviare un nuovo reminder se la data/ora cambia
CREATE OR REPLACE FUNCTION public.reset_reminder_on_reschedule()
RETURNS TRIGGER AS $$
BEGIN
  -- Se start_at è cambiato o status è cambiato da cancelled a scheduled/confirmed
  IF (OLD.start_at IS DISTINCT FROM NEW.start_at) 
     OR (OLD.status = 'cancelled' AND NEW.status IN ('scheduled', 'confirmed', 'rescheduled'))
     OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('scheduled', 'confirmed', 'rescheduled')) THEN
    NEW.reminder_sent = false;
    NEW.reminder_sent_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger per resettare reminder quando appuntamento viene modificato
DROP TRIGGER IF EXISTS trigger_reset_reminder_on_reschedule ON public.appointments;
CREATE TRIGGER trigger_reset_reminder_on_reschedule
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (
    OLD.start_at IS DISTINCT FROM NEW.start_at
    OR (OLD.status = 'cancelled' AND NEW.status IN ('scheduled', 'confirmed', 'rescheduled'))
    OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('scheduled', 'confirmed', 'rescheduled'))
  )
  EXECUTE FUNCTION public.reset_reminder_on_reschedule();

COMMENT ON FUNCTION public.reset_reminder_on_reschedule() IS 'Resetta il flag reminder_sent quando un appuntamento viene riprogrammato o riattivato, permettendo l''invio di un nuovo reminder.';

-- ============================================
-- 4. Tabella whatsapp_outbox per tracciare invii
-- ============================================

-- Crea tabella per tracciare tutti i messaggi WhatsApp inviati
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  shop_id UUID NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  to_phone TEXT NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '2h', '15m', 'daily')), -- 'daily' per reminder del giorno dopo
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  provider_message_id TEXT, -- ID messaggio restituito da WhatsApp Cloud API
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Indice unico per evitare duplicati (un reminder per tipo per appuntamento)
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_outbox_appt_type
  ON public.whatsapp_outbox (appointment_id, reminder_type);

-- Indice per query efficienti sui messaggi pending (per retry)
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_pending
  ON public.whatsapp_outbox (status, created_at)
  WHERE status = 'pending';

-- Indice per query per shop
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_shop
  ON public.whatsapp_outbox (shop_id, created_at);

-- Indice per query per cliente
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_client
  ON public.whatsapp_outbox (client_id, created_at);

-- Commenti per documentazione
COMMENT ON TABLE public.whatsapp_outbox IS 'Tabella per tracciare tutti i messaggi WhatsApp inviati come reminder per appuntamenti. Supporta retry automatico e tracking dello stato.';
COMMENT ON COLUMN public.whatsapp_outbox.reminder_type IS 'Tipo di reminder: 24h (24 ore prima), 2h (2 ore prima), 15m (15 minuti prima), daily (reminder del giorno dopo alle 20:00)';
COMMENT ON COLUMN public.whatsapp_outbox.status IS 'Stato del messaggio: pending (in attesa di invio), sent (inviato con successo), failed (invio fallito)';
COMMENT ON COLUMN public.whatsapp_outbox.attempts IS 'Numero di tentativi di invio effettuati';
COMMENT ON COLUMN public.whatsapp_outbox.provider_message_id IS 'ID messaggio restituito da WhatsApp Cloud API per tracking';

-- Abilita RLS
ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

-- Policy: Staff può vedere i messaggi del proprio shop
-- NOTA: service_role bypassa RLS automaticamente, quindi n8n può inserire/aggiornare senza policy
CREATE POLICY "Staff can view shop whatsapp_outbox" ON public.whatsapp_outbox
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE staff.user_id = auth.uid()
      AND staff.shop_id = whatsapp_outbox.shop_id
    )
  );

-- ============================================
-- 5. Verifica setup
-- ============================================

-- Verifica che i campi siano stati aggiunti correttamente
DO $$
BEGIN
  -- Verifica appointments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'appointments' 
      AND column_name = 'reminder_sent'
  ) THEN
    RAISE EXCEPTION 'Campo reminder_sent non trovato nella tabella appointments';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'appointments' 
      AND column_name = 'reminder_sent_at'
  ) THEN
    RAISE EXCEPTION 'Campo reminder_sent_at non trovato nella tabella appointments';
  END IF;
  
  -- Verifica shops
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'shops' 
      AND column_name = 'whatsapp_reminder_enabled'
  ) THEN
    RAISE EXCEPTION 'Campo whatsapp_reminder_enabled non trovato nella tabella shops';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'shops' 
      AND column_name = 'whatsapp_reminder_time'
  ) THEN
    RAISE EXCEPTION 'Campo whatsapp_reminder_time non trovato nella tabella shops';
  END IF;
  
  -- Verifica whatsapp_outbox
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'whatsapp_outbox'
  ) THEN
    RAISE EXCEPTION 'Tabella whatsapp_outbox non trovata';
  END IF;
  
  RAISE NOTICE '✅ Setup completato con successo!';
END $$;

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Questo script prepara il database per il sistema di reminder WhatsApp.
-- 
-- PROSSIMI PASSI:
-- 1. Configurare WhatsApp Cloud API (vedi docs/WHATSAPP_REMINDER_SETUP.md)
-- 2. Configurare workflow n8n (vedi docs/n8n-workflows/whatsapp-reminder-workflow.md)
-- 3. Testare il sistema con appuntamenti di prova
--
-- Il workflow n8n eseguirà ogni giorno alle 20:00 (o orario configurato) e:
-- - Cercherà tutti gli appuntamenti del giorno successivo
-- - Invierà reminder WhatsApp ai clienti
-- - Aggiornerà reminder_sent = true dopo l'invio riuscito
-- ============================================
