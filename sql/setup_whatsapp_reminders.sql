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
