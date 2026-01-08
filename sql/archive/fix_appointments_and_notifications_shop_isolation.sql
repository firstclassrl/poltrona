-- =====================================================
-- FIX: ISOLAMENTO appointments E notifications PER shop_id
-- =====================================================
-- Questo script garantisce che:
-- 1. Gli appointments abbiano shop_id assegnato automaticamente
-- 2. Le notifiche abbiano shop_id corretto dal trigger
-- 3. Le RLS policies filtrino correttamente per shop_id
-- =====================================================

-- 1) VERIFICA TRIGGER AUTO-ASSIGN shop_id PER APPOINTMENTS
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== VERIFICA TRIGGER APPOINTMENTS ===';
  
  -- Verifica se il trigger esiste
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_auto_assign_shop_id_to_appointment'
  ) THEN
    RAISE NOTICE '✅ Trigger auto-assign shop_id per appointments esiste';
  ELSE
    RAISE WARNING '⚠️ Trigger auto-assign shop_id per appointments NON esiste';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 2) VERIFICA/AGGIORNA TRIGGER NOTIFICHE PER GARANTIRE shop_id CORRETTO
-- =====================================================
CREATE OR REPLACE FUNCTION public.notify_barber_on_appointment_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    v_final_shop_id UUID;
BEGIN
    -- IMPORTANTE: Determina shop_id con priorità
    -- 1. shop_id dall'appuntamento (se presente)
    -- 2. shop_id dal client
    -- 3. shop_id dallo staff
    v_final_shop_id := NEW.shop_id;
    
    IF v_final_shop_id IS NULL AND NEW.client_id IS NOT NULL THEN
        SELECT shop_id INTO v_final_shop_id
        FROM public.clients
        WHERE id = NEW.client_id
        LIMIT 1;
    END IF;
    
    IF v_final_shop_id IS NULL AND NEW.staff_id IS NOT NULL THEN
        SELECT shop_id INTO v_final_shop_id
        FROM public.staff
        WHERE id = NEW.staff_id
        LIMIT 1;
    END IF;
    
    -- Se ancora NULL, usa get_user_shop_id() se disponibile
    IF v_final_shop_id IS NULL THEN
        SELECT shop_id INTO v_final_shop_id
        FROM public.profiles
        WHERE user_id = auth.uid()
        LIMIT 1;
    END IF;
    
    -- Se ancora NULL, logga errore ma continua
    IF v_final_shop_id IS NULL THEN
        RAISE WARNING '⚠️ Impossibile determinare shop_id per appuntamento %', NEW.id;
        RETURN NEW;
    END IF;
    
    -- Aggiorna shop_id nell'appuntamento se era NULL
    IF NEW.shop_id IS NULL THEN
        UPDATE public.appointments
        SET shop_id = v_final_shop_id
        WHERE id = NEW.id;
    END IF;
    
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
    
    -- Verifica che il barbiere appartenga allo stesso shop
    IF v_staff_record.shop_id IS NOT NULL AND v_staff_record.shop_id != v_final_shop_id THEN
        RAISE WARNING '⚠️ Barbiere % appartiene a shop diverso (% vs %), notifica non creata', 
            v_staff_record.id, v_staff_record.shop_id, v_final_shop_id;
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
        c.phone_e164,
        c.shop_id
    INTO v_client_record
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    
    -- Verifica che il cliente appartenga allo stesso shop
    IF v_client_record.shop_id IS NOT NULL AND v_client_record.shop_id != v_final_shop_id THEN
        RAISE WARNING '⚠️ Cliente % appartiene a shop diverso (% vs %), notifica non creata', 
            v_client_record.id, v_client_record.shop_id, v_final_shop_id;
        RETURN NEW;
    END IF;
    
    -- Recupera i dati del servizio
    SELECT 
        s.name,
        s.shop_id
    INTO v_service_record
    FROM public.services s
    WHERE s.id = NEW.service_id;
    
    -- Verifica che il servizio appartenga allo stesso shop
    IF v_service_record.shop_id IS NOT NULL AND v_service_record.shop_id != v_final_shop_id THEN
        RAISE WARNING '⚠️ Servizio % appartiene a shop diverso (% vs %), notifica non creata', 
            NEW.service_id, v_service_record.shop_id, v_final_shop_id;
        RETURN NEW;
    END IF;
    
    -- Recupera i dati dello shop
    SELECT 
        sh.id,
        sh.name,
        sh.notification_email
    INTO v_shop_record
    FROM public.shops sh
    WHERE sh.id = v_final_shop_id;
    
    -- Prepara i dati per la notifica
    v_client_name := COALESCE(v_client_record.full_name, 'Cliente');
    v_client_email := v_client_record.email;
    v_client_phone := v_client_record.phone_e164;
    v_service_name := COALESCE(v_service_record.name, 'Servizio');
    v_barber_name := COALESCE(v_staff_record.full_name, 'Barbiere');
    v_barber_email := v_staff_record.email;
    v_shop_name := COALESCE(v_shop_record.name, 'Negozio');
    v_shop_email := v_shop_record.notification_email;
    
    -- Formatta data e ora nel fuso orario Europe/Rome
    v_appointment_date := TO_CHAR(NEW.start_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY');
    v_appointment_time := TO_CHAR(NEW.start_at AT TIME ZONE 'Europe/Rome', 'HH24:MI');
    
    -- Crea notifica in-app per il barbiere CON shop_id CORRETTO
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
        v_final_shop_id,  -- IMPORTANTE: Usa shop_id determinato, non NEW.shop_id (potrebbe essere NULL)
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
            'shop_id', v_final_shop_id,
            'created_at', NOW()
        ),
        NOW()
    );
    
    RAISE LOG 'Notifica in-app creata per appuntamento % - shop_id: %, barbiere user_id: %', 
        NEW.id, v_final_shop_id, v_staff_record.user_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log dell'errore ma continua l'esecuzione (non blocca la creazione dell'appuntamento)
        RAISE LOG 'Errore nella creazione notifica per appuntamento %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- 3) RICREA TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_notify_barber_on_created ON public.appointments;
CREATE TRIGGER trigger_notify_barber_on_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_barber_on_appointment_created();

COMMENT ON FUNCTION public.notify_barber_on_appointment_created() IS 
    'Funzione trigger per notificare il barbiere quando viene creato un nuovo appuntamento. Garantisce shop_id corretto e isolamento tra negozi.';

-- 4) VERIFICA/AGGIORNA TRIGGER AUTO-ASSIGN shop_id PER APPOINTMENTS
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_assign_shop_id_to_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Se shop_id è NULL, prova a ottenerlo dal client, staff, o profilo
  IF NEW.shop_id IS NULL THEN
    -- Priorità 1: Prova dal client
    IF NEW.client_id IS NOT NULL THEN
      SELECT shop_id INTO v_shop_id
      FROM public.clients
      WHERE id = NEW.client_id
      LIMIT 1;
    END IF;
    
    -- Priorità 2: Se non trovato, prova dallo staff
    IF v_shop_id IS NULL AND NEW.staff_id IS NOT NULL THEN
      SELECT shop_id INTO v_shop_id
      FROM public.staff
      WHERE id = NEW.staff_id
      LIMIT 1;
    END IF;
    
    -- Priorità 3: Se non trovato, prova dal servizio
    IF v_shop_id IS NULL AND NEW.service_id IS NOT NULL THEN
      SELECT shop_id INTO v_shop_id
      FROM public.services
      WHERE id = NEW.service_id
      LIMIT 1;
    END IF;
    
    -- Priorità 4: Se non trovato, prova dal profilo dell'utente autenticato
    IF v_shop_id IS NULL THEN
      v_shop_id := public.get_user_shop_id();
    END IF;
    
    IF v_shop_id IS NOT NULL THEN
      NEW.shop_id := v_shop_id;
      RAISE LOG 'Appointment: shop_id assegnato automaticamente: %', v_shop_id;
    ELSE
      RAISE WARNING 'Appointment: Impossibile assegnare shop_id - nessuna fonte disponibile';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_shop_id_to_appointment ON public.appointments;
CREATE TRIGGER trigger_auto_assign_shop_id_to_appointment
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (NEW.shop_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_shop_id_to_appointment();

COMMENT ON FUNCTION public.auto_assign_shop_id_to_appointment() IS 
    'Assegna automaticamente shop_id agli appuntamenti se mancante, con priorità: client > staff > service > user profile';

-- 5) AGGIORNA APPOINTMENTS ESISTENTI SENZA shop_id
-- =====================================================
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  RAISE NOTICE '=== AGGIORNAMENTO APPOINTMENTS ESISTENTI ===';
  
  -- Aggiorna appointments senza shop_id (dal client)
  UPDATE public.appointments a
  SET shop_id = c.shop_id
  FROM public.clients c
  WHERE a.client_id = c.id
    AND a.shop_id IS NULL
    AND c.shop_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Appointments aggiornati da client: %', v_updated_count;
  
  -- Aggiorna appointments senza shop_id (dallo staff)
  UPDATE public.appointments a
  SET shop_id = s.shop_id
  FROM public.staff s
  WHERE a.staff_id = s.id
    AND a.shop_id IS NULL
    AND s.shop_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Appointments aggiornati da staff: %', v_updated_count;
  
  -- Aggiorna appointments senza shop_id (dal servizio)
  UPDATE public.appointments a
  SET shop_id = s.shop_id
  FROM public.services s
  WHERE a.service_id = s.id
    AND a.shop_id IS NULL
    AND s.shop_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Appointments aggiornati da service: %', v_updated_count;
  
  RAISE NOTICE '';
END $$;

-- 6) VERIFICA RLS POLICIES SU APPOINTMENTS
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
  v_has_shop_id_filter INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA RLS APPOINTMENTS ===';
  
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'appointments';
  
  SELECT COUNT(*) INTO v_has_shop_id_filter
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'appointments'
    AND (qual::text LIKE '%shop_id%' OR with_check::text LIKE '%shop_id%');
  
  RAISE NOTICE 'Policies totali: %', v_policy_count;
  RAISE NOTICE 'Policies con filtro shop_id: %', v_has_shop_id_filter;
  
  IF v_policy_count = 0 THEN
    RAISE WARNING '⚠️ Nessuna policy RLS trovata per appointments!';
  ELSIF v_has_shop_id_filter < v_policy_count THEN
    RAISE WARNING '⚠️ Alcune policies non filtrano per shop_id!';
  ELSE
    RAISE NOTICE '✅ Policies RLS corrette';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 7) VERIFICA RLS POLICIES SU NOTIFICATIONS
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
  v_has_shop_id_filter INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA RLS NOTIFICATIONS ===';
  
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'notifications';
  
  SELECT COUNT(*) INTO v_has_shop_id_filter
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'notifications'
    AND (qual::text LIKE '%shop_id%' OR with_check::text LIKE '%shop_id%');
  
  RAISE NOTICE 'Policies totali: %', v_policy_count;
  RAISE NOTICE 'Policies con filtro shop_id: %', v_has_shop_id_filter;
  
  IF v_policy_count = 0 THEN
    RAISE WARNING '⚠️ Nessuna policy RLS trovata per notifications!';
  ELSIF v_has_shop_id_filter < v_policy_count THEN
    RAISE WARNING '⚠️ Alcune policies non filtrano per shop_id!';
  ELSE
    RAISE NOTICE '✅ Policies RLS corrette';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 8) VERIFICA FINALE
-- =====================================================
DO $$
DECLARE
  v_appointments_without_shop_id INTEGER;
  v_notifications_without_shop_id INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA FINALE ===';
  
  SELECT COUNT(*) INTO v_appointments_without_shop_id
  FROM public.appointments
  WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_notifications_without_shop_id
  FROM public.notifications
  WHERE shop_id IS NULL;
  
  RAISE NOTICE 'Appointments senza shop_id: %', v_appointments_without_shop_id;
  RAISE NOTICE 'Notifications senza shop_id: %', v_notifications_without_shop_id;
  
  IF v_appointments_without_shop_id > 0 OR v_notifications_without_shop_id > 0 THEN
    RAISE WARNING '⚠️ Ci sono ancora record senza shop_id';
  ELSE
    RAISE NOTICE '✅ Tutti i record hanno shop_id assegnato';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 9) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Funzione aggiornata: notify_barber_on_appointment_created()';
  RAISE NOTICE '   - Determina shop_id con priorità: appointment > client > staff > service > user';
  RAISE NOTICE '   - Verifica isolamento shop per client, staff, service';
  RAISE NOTICE '   - Crea notifica con shop_id corretto';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Trigger aggiornato: trigger_notify_barber_on_created';
  RAISE NOTICE '✅ Trigger aggiornato: trigger_auto_assign_shop_id_to_appointment';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Prova a creare una prenotazione dall''app';
  RAISE NOTICE '2. Verifica che abbia shop_id corretto';
  RAISE NOTICE '3. Verifica che la notifica abbia shop_id corretto';
  RAISE NOTICE '4. Se funziona, il problema è risolto!';
  RAISE NOTICE '';
END $$;




