-- ============================================
-- FIX: Notifiche per messaggi di chat
-- Esegui questo script su Supabase SQL Editor
-- ============================================
-- Questo script crea un trigger che genera notifiche quando
-- un barbiere invia un messaggio di chat a un cliente

-- 1. Aggiungi il tipo 'chat_message' alle notifiche
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('new_appointment', 'appointment_cancelled', 'appointment_reminder', 'system', 'waitlist_available', 'new_client', 'chat_message'));

-- 2. Crea la funzione trigger per notificare i clienti quando arrivano messaggi dal barbiere
CREATE OR REPLACE FUNCTION public.notify_client_on_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  v_chat_record RECORD;
  v_client_user_id UUID;
  v_staff_record RECORD;
  v_client_name TEXT;
  v_staff_name TEXT;
  v_shop_id UUID;
BEGIN
  -- Solo se il messaggio è inviato da staff (barbiere)
  IF NEW.sender_type = 'staff' THEN
    -- Ottieni i dettagli della chat
    SELECT 
      c.client_id,
      c.staff_id,
      c.shop_id
    INTO v_chat_record
    FROM public.chats c
    WHERE c.id = NEW.chat_id;
    
    -- Se non troviamo la chat, esci
    IF v_chat_record.client_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Ottieni shop_id dalla chat o dallo staff
    v_shop_id := v_chat_record.shop_id;
    IF v_shop_id IS NULL THEN
      SELECT shop_id INTO v_shop_id
      FROM public.staff
      WHERE id = v_chat_record.staff_id;
    END IF;
    
    -- Ottieni il nome del barbiere
    SELECT full_name INTO v_staff_name
    FROM public.staff
    WHERE id = NEW.sender_id;
    
    -- Ottieni il nome del cliente
    SELECT 
      COALESCE(first_name || ' ' || COALESCE(last_name, ''), email, 'Cliente') INTO v_client_name
    FROM public.clients
    WHERE id = v_chat_record.client_id;
    
    -- Trova il user_id del cliente tramite email
    -- Il collegamento avviene tramite email tra clients e auth.users
    SELECT p.user_id INTO v_client_user_id
    FROM public.clients cl
    JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(cl.email))
    JOIN public.profiles p ON u.id = p.user_id
    WHERE cl.id = v_chat_record.client_id
      AND p.role = 'client'
    LIMIT 1;
    
    -- Se non troviamo il user_id tramite email, prova a cercare tramite client_id
    -- (potrebbe esserci un campo user_id nella tabella clients)
    IF v_client_user_id IS NULL THEN
      -- Prova a cercare se esiste un campo user_id in clients
      -- (questa query fallirà se il campo non esiste, ma non è un problema)
      BEGIN
        SELECT user_id INTO v_client_user_id
        FROM public.clients
        WHERE id = v_chat_record.client_id
          AND user_id IS NOT NULL
        LIMIT 1;
      EXCEPTION
        WHEN OTHERS THEN
          -- Campo user_id non esiste, continua
          NULL;
      END;
    END IF;
    
    -- Se abbiamo trovato il user_id del cliente, crea la notifica
    IF v_client_user_id IS NOT NULL THEN
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
        v_shop_id,
        v_client_user_id,
        'client',
        'chat_message',
        '💬 Nuovo messaggio',
        COALESCE(v_staff_name, 'Il barbiere') || ' ti ha inviato un messaggio',
        jsonb_build_object(
          'chat_id', NEW.chat_id,
          'message_id', NEW.id,
          'sender_id', NEW.sender_id,
          'sender_type', NEW.sender_type,
          'sender_name', COALESCE(v_staff_name, 'Barbiere'),
          'content_preview', LEFT(NEW.content, 100),
          'created_at', NEW.created_at
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log dell'errore ma continua l'esecuzione
    RAISE LOG 'Errore nella creazione notifica per messaggio chat %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crea il trigger che si attiva dopo l'inserimento di un messaggio
DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;
CREATE TRIGGER on_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_client_on_chat_message();

-- 4. Verifica che il trigger sia stato creato
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_chat_message_inserted';

-- 5. Commenti per documentazione
COMMENT ON FUNCTION public.notify_client_on_chat_message() IS 'Funzione trigger per creare notifiche quando un barbiere invia un messaggio di chat a un cliente';
COMMENT ON COLUMN public.notifications.type IS 'Tipo: new_appointment, appointment_cancelled, appointment_reminder, system, waitlist_available, new_client, chat_message';







