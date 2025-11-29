-- ============================================
-- TRIGGER PER INVIO EMAIL AUTOMATICO SU CANCELLAZIONE
-- ============================================
-- Questo script modifica il trigger esistente per inviare automaticamente
-- email al barbiere e al cliente quando un appuntamento viene cancellato.
-- 
-- IMPORTANTE: Prima di eseguire questo script:
-- 1. Vai su Supabase Dashboard > Database > Custom Config
-- 2. Aggiungi una variabile custom: app.settings.service_role_key
-- 3. Inserisci la tua SERVICE_ROLE_KEY (non anon key!) da Settings > API
-- 4. Sostituisci 'tlwxsluoqzdluzneugbe' con il tuo project_id Supabase
--
-- ============================================

-- Abilita pg_net extension (se non già abilitata)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_net extension: %', SQLERRM;
END $$;

-- Funzione helper per generare HTML email annullamento (barbiere)
CREATE OR REPLACE FUNCTION public.generate_cancellation_email_html(
    p_client_name TEXT,
    p_client_email TEXT,
    p_client_phone TEXT,
    p_service_name TEXT,
    p_appointment_date TEXT,
    p_appointment_time TEXT,
    p_barber_name TEXT,
    p_shop_name TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Appuntamento Annullato</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #ef4444; padding-bottom: 20px; margin-bottom: 30px; }
        .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 15px 20px; margin: 20px 0; }
        .details { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Appuntamento Annullato</h1>
        </div>
        <div class="alert-box">
            <strong>⚠️ Un cliente ha annullato il suo appuntamento</strong>
        </div>
        <div class="details">
            <div class="detail-row"><span><strong>Cliente:</strong></span><span>' || p_client_name || '</span></div>' ||
    CASE WHEN p_client_email IS NOT NULL AND p_client_email != '' THEN '<div class="detail-row"><span><strong>Email:</strong></span><span>' || p_client_email || '</span></div>' ELSE '' END ||
    CASE WHEN p_client_phone IS NOT NULL AND p_client_phone != '' THEN '<div class="detail-row"><span><strong>Telefono:</strong></span><span>' || p_client_phone || '</span></div>' ELSE '' END ||
    '<div class="detail-row"><span><strong>Servizio:</strong></span><span>' || p_service_name || '</span></div>
            <div class="detail-row"><span><strong>Data:</strong></span><span>' || p_appointment_date || '</span></div>
            <div class="detail-row"><span><strong>Orario:</strong></span><span>' || p_appointment_time || '</span></div>
            <div class="detail-row"><span><strong>Barbiere:</strong></span><span>' || p_barber_name || '</span></div>
        </div>
        <div class="footer">
            <p>' || p_shop_name || ' - Sistema di Gestione Appuntamenti</p>
        </div>
    </div>
</body>
</html>';
END;
$$ LANGUAGE plpgsql;

-- Funzione helper per generare HTML email annullamento (cliente)
CREATE OR REPLACE FUNCTION public.generate_client_cancellation_email_html(
    p_client_name TEXT,
    p_service_name TEXT,
    p_appointment_date TEXT,
    p_appointment_time TEXT,
    p_barber_name TEXT,
    p_shop_name TEXT
) RETURNS TEXT AS $$
BEGIN
    RETURN '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Appuntamento Annullato</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #ef4444; padding-bottom: 20px; margin-bottom: 30px; }
        .info-box { background: #fef3c7; border: 1px solid #fbbf24; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 15px 20px; margin: 20px 0; text-align: center; }
        .details { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Appuntamento Annullato</h1>
        </div>
        <div class="info-box">
            <strong>ℹ️ Il tuo appuntamento è stato annullato</strong>
        </div>
        <p>Ciao ' || SPLIT_PART(p_client_name, ' ', 1) || ',</p>
        <p>Ti confermiamo che il tuo appuntamento è stato annullato come richiesto.</p>
        <div class="details">
            <div class="detail-row"><span><strong>Servizio:</strong></span><span>' || p_service_name || '</span></div>
            <div class="detail-row"><span><strong>Data:</strong></span><span>' || p_appointment_date || '</span></div>
            <div class="detail-row"><span><strong>Orario:</strong></span><span>' || p_appointment_time || '</span></div>
            <div class="detail-row"><span><strong>Barbiere:</strong></span><span>' || p_barber_name || '</span></div>
        </div>
        <p style="text-align: center; color: #6b7280;">Se desideri prenotare un nuovo appuntamento, puoi farlo accedendo al tuo profilo.</p>
        <div class="footer">
            <p>' || p_shop_name || ' - Sistema di Gestione Appuntamenti</p>
        </div>
    </div>
</body>
</html>';
END;
$$ LANGUAGE plpgsql;

-- Modifica la funzione trigger esistente per inviare email
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
    v_shop_email TEXT;
    v_shop_name TEXT;
    v_edge_function_url TEXT;
    v_supabase_url TEXT;
    v_supabase_key TEXT;
    v_email_html TEXT;
    v_email_text TEXT;
    v_response_id BIGINT;
BEGIN
    -- Solo se lo status cambia a 'cancelled'
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
        
        -- Recupera i dati del barbiere (staff) - NON esce se non trovato
        SELECT 
            s.id,
            s.user_id,
            s.full_name,
            s.email,
            s.shop_id
        INTO v_staff_record
        FROM public.staff s
        WHERE s.id = NEW.staff_id;
        
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
        
        -- Prepara i dati
        v_client_name := COALESCE(v_client_record.full_name, 'Cliente');
        v_client_email := v_client_record.email;
        v_client_phone := v_client_record.phone_e164;
        v_service_name := COALESCE(v_service_record.name, 'Servizio');
        v_barber_name := COALESCE(v_staff_record.full_name, 'Barbiere');
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
        
        -- Configurazione Supabase
        -- Estrai l'URL dal database connection o usa valore di default
        -- NOTA: Sostituisci 'tlwxsluoqzdluzneugbe' con il tuo project_id Supabase se necessario
        BEGIN
            -- Prova a leggere da variabile custom
            v_supabase_url := current_setting('app.settings.supabase_url', true);
        EXCEPTION
            WHEN OTHERS THEN
                v_supabase_url := NULL;
        END;
        
        -- Se non configurato, usa valore di default (SOSTITUISCI CON IL TUO!)
        IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
            v_supabase_url := 'https://tlwxsluoqzdluzneugbe.supabase.co';
        END IF;
        
        -- Prova a leggere la service_role_key dalle variabili custom
        -- Se non configurata, usa anon key come fallback
        BEGIN
            v_supabase_key := current_setting('app.settings.service_role_key', true);
        EXCEPTION
            WHEN OTHERS THEN
                v_supabase_key := NULL;
        END;
        
        -- Se non disponibile, prova anon key
        IF v_supabase_key IS NULL OR v_supabase_key = '' THEN
            BEGIN
                v_supabase_key := current_setting('app.settings.anon_key', true);
            EXCEPTION
                WHEN OTHERS THEN
                    v_supabase_key := NULL;
            END;
        END IF;
        
        -- Se ancora non disponibile, logga errore ma continua
        IF v_supabase_key IS NULL OR v_supabase_key = '' THEN
            RAISE LOG '⚠️ Chiave Supabase non configurata. Configura app.settings.service_role_key o app.settings.anon_key in Supabase Database > Custom Config';
        ELSE
            -- Costruisci URL Edge Function
            v_edge_function_url := v_supabase_url || '/functions/v1/send-email';
            
            -- 1. Invia email al negozio/barbiere (se notification_email configurata)
            IF v_shop_email IS NOT NULL AND v_shop_email != '' THEN
                -- Genera HTML email
                v_email_html := public.generate_cancellation_email_html(
                    v_client_name,
                    v_client_email,
                    v_client_phone,
                    v_service_name,
                    v_appointment_date,
                    v_appointment_time,
                    v_barber_name,
                    v_shop_name
                );
                
                v_email_text := 'APPUNTAMENTO ANNULLATO - ' || UPPER(v_shop_name) || E'\n\n' ||
                               '⚠️ Un cliente ha annullato il suo appuntamento!\n\n' ||
                               'Cliente: ' || v_client_name || E'\n' ||
                               COALESCE('Email: ' || v_client_email || E'\n', '') ||
                               COALESCE('Telefono: ' || v_client_phone || E'\n', '') ||
                               'Servizio: ' || v_service_name || E'\n' ||
                               'Data: ' || v_appointment_date || E'\n' ||
                               'Orario: ' || v_appointment_time || E'\n' ||
                               'Barbiere: ' || v_barber_name;
                
                -- Chiama Edge Function per inviare email al negozio
                BEGIN
                    SELECT * INTO v_response_id
                    FROM net.http_post(
                        url := v_edge_function_url,
                        headers := jsonb_build_object(
                            'Content-Type', 'application/json',
                            'Authorization', 'Bearer ' || v_supabase_key,
                            'apikey', v_supabase_key
                        ),
                        body := jsonb_build_object(
                            'to', v_shop_email,
                            'subject', '⚠️ Appuntamento Annullato - ' || v_client_name || ' - ' || v_appointment_date,
                            'html', v_email_html,
                            'text', v_email_text
                        )::text
                    );
                    
                    RAISE LOG '✅ Email annullamento inviata al negozio: % (request_id: %)', v_shop_email, v_response_id;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE LOG '❌ Errore invio email al negozio %: %', v_shop_email, SQLERRM;
                END;
            END IF;
            
            -- 2. Invia email al cliente (se email disponibile)
            IF v_client_email IS NOT NULL AND v_client_email != '' THEN
                -- Genera HTML email cliente
                v_email_html := public.generate_client_cancellation_email_html(
                    v_client_name,
                    v_service_name,
                    v_appointment_date,
                    v_appointment_time,
                    v_barber_name,
                    v_shop_name
                );
                
                v_email_text := 'APPUNTAMENTO ANNULLATO - ' || UPPER(v_shop_name) || E'\n\n' ||
                               'ℹ️ Il tuo appuntamento è stato annullato\n\n' ||
                               'Ciao ' || SPLIT_PART(v_client_name, ' ', 1) || ',\n\n' ||
                               'Ti confermiamo che il tuo appuntamento è stato annullato come richiesto.\n\n' ||
                               'Servizio: ' || v_service_name || E'\n' ||
                               'Data: ' || v_appointment_date || E'\n' ||
                               'Orario: ' || v_appointment_time || E'\n' ||
                               'Barbiere: ' || v_barber_name || E'\n\n' ||
                               'Se desideri prenotare un nuovo appuntamento, puoi farlo accedendo al tuo profilo.';
                
                -- Chiama Edge Function per inviare email al cliente
                BEGIN
                    SELECT * INTO v_response_id
                    FROM net.http_post(
                        url := v_edge_function_url,
                        headers := jsonb_build_object(
                            'Content-Type', 'application/json',
                            'Authorization', 'Bearer ' || v_supabase_key,
                            'apikey', v_supabase_key
                        ),
                        body := jsonb_build_object(
                            'to', v_client_email,
                            'subject', '❌ Appuntamento Annullato - ' || v_shop_name || ' - ' || v_appointment_date,
                            'html', v_email_html,
                            'text', v_email_text
                        )::text
                    );
                    
                    RAISE LOG '✅ Email annullamento inviata al cliente: % (request_id: %)', v_client_email, v_response_id;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE LOG '❌ Errore invio email al cliente %: %', v_client_email, SQLERRM;
                END;
            END IF;
        END IF;
        
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log dell'errore ma continua l'esecuzione
        RAISE LOG '❌ Errore nella notifica cancellazione appuntamento %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Il trigger esiste già, quindi non serve ricrearlo
-- La funzione è stata aggiornata e il trigger userà la nuova versione

COMMENT ON FUNCTION public.notify_barber_on_appointment_cancellation() IS 'Funzione trigger per notificare il barbiere (in-app e email) quando un appuntamento viene cancellato. Invia email automaticamente via Supabase Edge Function usando pg_net.';

-- ============================================
-- ISTRUZIONI PER CONFIGURAZIONE
-- ============================================
-- 
-- 1. Sostituisci 'tlwxsluoqzdluzneugbe' con il tuo project_id Supabase
--    (lo trovi in Supabase Dashboard > Settings > API > Project URL)
--
-- 2. Configura la service_role_key in Supabase:
--    - Vai su Supabase Dashboard > Database > Custom Config
--    - Aggiungi una nuova variabile:
--      Nome: app.settings.service_role_key
--      Valore: (incolla la tua SERVICE_ROLE_KEY da Settings > API)
--
-- 3. Verifica che l'extension pg_net sia abilitata:
--    - Vai su Supabase Dashboard > Database > Extensions
--    - Cerca "pg_net" e assicurati che sia abilitata
--
-- 4. Testa il trigger:
--    - Annulla un appuntamento cambiando status a 'cancelled'
--    - Controlla i log in Supabase Dashboard > Logs > Postgres Logs
--    - Dovresti vedere messaggi come "✅ Email annullamento inviata..."
--
-- ============================================

