-- Trigger per inserimento automatico in profiles quando si crea un utente in auth.users
-- Questo trigger si attiva automaticamente quando viene inserito un nuovo record in auth.users

-- Prima creiamo la funzione che verrà chiamata dal trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_full_name TEXT;
  v_client_email TEXT;
  v_barber_record RECORD;
BEGIN
  -- Estrai il nome completo e l'email del nuovo utente
  v_profile_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_client_email := NEW.email;
  
  -- Inserisce automaticamente un nuovo record nella tabella profiles
  -- collegato al nuovo utente creato in auth.users
  -- IMPORTANTE: Tutti i nuovi utenti hanno SEMPRE il ruolo 'client'
  -- indipendentemente da eventuali ruoli nei metadati
  INSERT INTO public.profiles (user_id, shop_id, role, full_name, created_at)
  VALUES (
    NEW.id,                    -- ID dell'utente appena creato
    NULL,                      -- shop_id inizialmente NULL (da assegnare successivamente)
    'client',                  -- ruolo SEMPRE 'client' per tutti i nuovi utenti
    v_profile_full_name,       -- nome completo o email come fallback
    NOW()                      -- timestamp di creazione
  );
  
  -- Invia notifica a un solo barbiere attivo (preferibilmente owner/admin, altrimenti il primo barbiere)
  -- IMPORTANTE: Verifica prima che non esista già una notifica per questo cliente
  -- per evitare duplicati in caso di trigger multipli o esecuzioni duplicate
  -- CONTROLLO: Verifica sia per client_user_id che per client_email per catturare tutti i casi
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE type = 'new_client' 
      AND (
        data->>'client_user_id' = NEW.id::text
        OR data->>'client_email' = NEW.email
      )
      AND created_at > NOW() - INTERVAL '1 minute'
  ) THEN
    -- Trova UN SOLO barbiere dalla tabella staff con ruolo 'barber' o simile
    -- IMPORTANTE: LIMIT 1 assicura che venga selezionato solo un barbiere
    SELECT 
      s.id as staff_id,
      s.user_id,
      s.shop_id,
      s.full_name as barber_name
    INTO v_barber_record
    FROM public.staff s
    WHERE s.active = true
      AND s.user_id IS NOT NULL  -- Solo barbieri con user_id collegato
      AND (
        LOWER(s.role) LIKE '%barber%' 
        OR LOWER(s.role) IN ('barber', 'barbiere', 'barbiere senior', 'barbiere junior', 'master barber', 'junior barber', 'owner', 'admin', 'proprietario')
      )
    ORDER BY 
      CASE 
        WHEN LOWER(s.role) IN ('owner', 'admin', 'proprietario') THEN 1
        WHEN LOWER(s.role) LIKE '%senior%' OR LOWER(s.role) LIKE '%master%' THEN 2
        ELSE 3
      END,
      s.created_at ASC  -- Prendi il più vecchio se stesso ruolo
    LIMIT 1;
    
    -- Crea la notifica solo se è stato trovato un barbiere
    IF FOUND AND v_barber_record.user_id IS NOT NULL THEN
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
        v_barber_record.shop_id,
        v_barber_record.user_id,  -- user_id deve essere un auth.users.id
        'staff',
        'new_client',
        '👤 Nuovo Cliente Registrato',
        v_profile_full_name || ' si è appena registrato' || 
        CASE WHEN v_client_email IS NOT NULL THEN ' (' || v_client_email || ')' ELSE '' END,
        jsonb_build_object(
          'client_user_id', NEW.id,
          'client_name', v_profile_full_name,
          'client_email', v_client_email,
          'registered_at', NOW()
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log dell'errore ma continua l'esecuzione
    RAISE LOG 'Errore nella creazione notifica per nuovo utente %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Creiamo il trigger che si attiva dopo l'inserimento in auth.users
-- IMPORTANTE: Elimina TUTTI i trigger esistenti per evitare duplicati
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Assicurati che non ci siano altri trigger con nomi simili
DO $$
DECLARE
  v_sql TEXT;
BEGIN
  -- Costruisci la query per eliminare eventuali trigger duplicati
  SELECT string_agg('DROP TRIGGER IF EXISTS ' || quote_ident(trigger_name) || ' ON auth.users;', ' ')
  INTO v_sql
  FROM information_schema.triggers
  WHERE event_object_table = 'users'
    AND event_object_schema = 'auth'
    AND trigger_name LIKE '%user%created%';
  
  -- Esegui solo se ci sono trigger da eliminare
  IF v_sql IS NOT NULL THEN
    EXECUTE v_sql;
  END IF;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Opzionale: Trigger per aggiornare il profilo quando cambiano i metadati utente
-- IMPORTANTE: Questo trigger NON modifica mai il ruolo, solo full_name e updated_at
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Aggiorna il profilo se cambiano i metadati utente
  -- Nota: Il ruolo NON viene mai modificato da questo trigger
  UPDATE public.profiles
  SET 
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', OLD.raw_user_meta_data->>'full_name', NEW.email),
    updated_at = NOW()
    -- Il ruolo NON viene modificato qui - rimane sempre quello impostato alla creazione
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger per aggiornamenti utente
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Opzionale: Trigger per eliminazione utente (cascade delete)
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Elimina il profilo quando viene eliminato l'utente
  DELETE FROM public.profiles WHERE user_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger per eliminazione utente
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- Aggiungiamo una colonna updated_at alla tabella profiles se non esiste
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Creiamo un indice per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_shop_id ON public.profiles(shop_id);

-- Commenti per documentazione
COMMENT ON FUNCTION public.handle_new_user() IS 'Funzione trigger per creare automaticamente un profilo quando viene creato un nuovo utente e inviare una notifica a tutti i barbieri attivi';
COMMENT ON FUNCTION public.handle_user_update() IS 'Funzione trigger per aggiornare il profilo quando cambiano i metadati utente';
COMMENT ON FUNCTION public.handle_user_delete() IS 'Funzione trigger per eliminare il profilo quando viene eliminato un utente';

-- ============================================
-- Trigger per notificare il barbiere quando un appuntamento viene cancellato
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_barber_on_appointment_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
    -- Solo se lo status cambia a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        
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
        
        -- Se non c'è un barbiere associato, esci
        IF NOT FOUND OR v_staff_record.id IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Recupera i dati del cliente
        SELECT 
            c.id,
            COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), 'Cliente') as full_name,
            c.email,
            c.phone_e164
        INTO v_client_record
        FROM public.clients c
        WHERE c.id = NEW.client_id;
        
        -- Recupera i dati del servizio
        SELECT 
            s.name
        INTO v_service_record
        FROM public.services s
        WHERE s.id = NEW.service_id;
        
        -- Recupera i dati dello shop
        SELECT 
            sh.id,
            sh.name,
            sh.notification_email
        INTO v_shop_record
        FROM public.shops sh
        WHERE sh.id = NEW.shop_id;
        
        -- Prepara i dati per la notifica
        v_client_name := COALESCE(v_client_record.full_name, 'Cliente');
        v_client_email := v_client_record.email;
        v_client_phone := v_client_record.phone_e164;
        v_service_name := COALESCE(v_service_record.name, 'Servizio');
        v_barber_name := COALESCE(v_staff_record.full_name, 'Barbiere');
        v_barber_email := v_staff_record.email;
        v_shop_name := COALESCE(v_shop_record.name, 'Negozio');
        v_shop_email := v_shop_record.notification_email;
        
        -- Formatta data e ora
        v_appointment_date := TO_CHAR(NEW.start_at, 'DD/MM/YYYY');
        v_appointment_time := TO_CHAR(NEW.start_at, 'HH24:MI');
        
        -- Crea notifica in-app per il barbiere (solo se ha user_id)
        IF v_staff_record.user_id IS NOT NULL THEN
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
                NEW.shop_id,
                v_staff_record.user_id,
                'staff',
                'appointment_cancelled',
                '❌ Appuntamento Annullato',
                v_client_name || ' ha annullato l''appuntamento per ' || v_service_name || ' del ' || v_appointment_date || ' alle ' || v_appointment_time,
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
                    'cancelled_at', NOW()
                ),
                NOW()
            );
        END IF;
        
        -- NOTA: Per inviare l'email automaticamente, configura un webhook Supabase:
        -- 1. Vai su Supabase Dashboard > Database > Webhooks
        -- 2. Crea un nuovo webhook:
        --    - Nome: appointment_cancelled_email
        --    - Tabella: appointments
        --    - Eventi: UPDATE
        --    - Filtro: status = 'cancelled'
        --    - URL: https://tuo-n8n.app.n8n.cloud/webhook/appointment-cancelled
        --    - Headers: Authorization: Bearer TUO_SECRET
        --
        -- Il webhook riceverà i dati dell'appuntamento e potrà inviare l'email via N8N
        --
        -- In alternativa, puoi usare pg_net (se disponibile) per chiamare direttamente N8N:
        -- PERFORM net.http_post(
        --     url := 'https://tuo-n8n.app.n8n.cloud/webhook/send-email',
        --     headers := jsonb_build_object('Content-Type', 'application/json'),
        --     body := jsonb_build_object(
        --         'to', COALESCE(v_barber_email, v_shop_email),
        --         'subject', '⚠️ Appuntamento Annullato - ' || v_client_name || ' - ' || v_appointment_date,
        --         'type', 'cancellation',
        --         'data', jsonb_build_object(
        --             'clientName', v_client_name,
        --             'clientEmail', COALESCE(v_client_email, ''),
        --             'clientPhone', COALESCE(v_client_phone, ''),
        --             'serviceName', v_service_name,
        --             'appointmentDate', v_appointment_date,
        --             'appointmentTime', v_appointment_time,
        --             'barberName', v_barber_name,
        --             'shopName', v_shop_name
        --         )
        --     )::text
        -- );
        
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log dell'errore ma continua l'esecuzione
        RAISE LOG 'Errore nella notifica cancellazione appuntamento %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Crea il trigger sull'aggiornamento degli appuntamenti
DROP TRIGGER IF EXISTS trigger_notify_barber_on_cancellation ON public.appointments;
CREATE TRIGGER trigger_notify_barber_on_cancellation
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_barber_on_appointment_cancellation();

-- Commento per documentazione
COMMENT ON FUNCTION public.notify_barber_on_appointment_cancellation() IS 'Funzione trigger per notificare il barbiere (in-app e email) quando un appuntamento viene cancellato';

-- ============================================
-- Trigger per notificare il barbiere quando un nuovo appuntamento viene creato
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_barber_on_appointment_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
    -- Solo su INSERT
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
    
    IF NOT FOUND OR v_staff_record.id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Recupera i dati del cliente
    SELECT 
        c.id,
        COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), 'Cliente') as full_name,
        c.email,
        c.phone_e164
    INTO v_client_record
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    
    -- Recupera i dati del servizio
    SELECT 
        s.name
    INTO v_service_record
    FROM public.services s
    WHERE s.id = NEW.service_id;
    
    -- Recupera i dati dello shop
    SELECT 
        sh.id,
        sh.name,
        sh.notification_email
    INTO v_shop_record
    FROM public.shops sh
    WHERE sh.id = NEW.shop_id;
    
    -- Prepara i dati per la notifica
    v_client_name := COALESCE(v_client_record.full_name, 'Cliente');
    v_client_email := v_client_record.email;
    v_client_phone := v_client_record.phone_e164;
    v_service_name := COALESCE(v_service_record.name, 'Servizio');
    v_barber_name := COALESCE(v_staff_record.full_name, 'Barbiere');
    v_barber_email := v_staff_record.email;
    v_shop_name := COALESCE(v_shop_record.name, 'Negozio');
    v_shop_email := v_shop_record.notification_email;
    
    -- Formatta data e ora
    v_appointment_date := TO_CHAR(NEW.start_at, 'DD/MM/YYYY');
    v_appointment_time := TO_CHAR(NEW.start_at, 'HH24:MI');
    
    -- Crea notifica in-app per il barbiere (solo se ha user_id)
    IF v_staff_record.user_id IS NOT NULL THEN
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
            NEW.shop_id,
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
                'created_at', NOW()
            ),
            NOW()
        );
    END IF;
    
    -- NOTA: per inviare email automatiche, aggiungi un webhook Supabase su INSERT di appointments
    -- verso N8N / funzione esterna, oppure usa pg_net se disponibile.
    -- Il payload in notifica contiene tutti i campi utili.
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Errore nella notifica creazione appuntamento %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_barber_on_created ON public.appointments;
CREATE TRIGGER trigger_notify_barber_on_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_barber_on_appointment_created();

COMMENT ON FUNCTION public.notify_barber_on_appointment_created() IS 'Funzione trigger per notificare il barbiere (in-app; email via webhook) quando viene creato un nuovo appuntamento';

