-- FIX CRITICO: Isolamento notifiche tra negozi
-- Il trigger handle_new_user() creava notifiche per TUTTI i negozi quando un cliente si registrava
-- Questo script corregge il problema assicurando che le notifiche vengano create SOLO per il negozio del cliente

-- ============================================
-- 1. MODIFICA handle_new_user() per NON creare notifiche se shop_id è NULL
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_full_name TEXT;
  v_client_email TEXT;
BEGIN
  -- Estrai il nome completo e l'email del nuovo utente
  v_profile_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_client_email := NEW.email;
  
  -- Inserisce automaticamente un nuovo record nella tabella profiles
  -- IMPORTANTE: shop_id inizialmente NULL (verrà assegnato durante la registrazione cliente)
  -- IMPORTANTE: Tutti i nuovi utenti hanno SEMPRE il ruolo 'client' inizialmente
  INSERT INTO public.profiles (user_id, shop_id, role, full_name, created_at)
  VALUES (
    NEW.id,
    NULL,                      -- shop_id inizialmente NULL
    'client',                  -- ruolo SEMPRE 'client' per tutti i nuovi utenti
    v_profile_full_name,
    NOW()
  );
  
  -- IMPORTANTE: NON creare notifiche qui perché shop_id è NULL
  -- Le notifiche verranno create dal trigger handle_profile_shop_assigned()
  -- quando shop_id viene assegnato al profilo durante la registrazione cliente
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Errore nella creazione profilo per nuovo utente %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. NUOVO TRIGGER: Crea notifiche quando shop_id viene assegnato a un profilo cliente
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_profile_shop_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_barber_record RECORD;
  v_profile_full_name TEXT;
  v_client_email TEXT;
BEGIN
  -- Solo se:
  -- 1. shop_id è stato appena assegnato (era NULL, ora non è NULL)
  -- 2. Il ruolo è 'client'
  -- 3. shop_id è cambiato da NULL a un valore
  IF NEW.role = 'client' 
     AND NEW.shop_id IS NOT NULL 
     AND (OLD.shop_id IS NULL OR OLD.shop_id != NEW.shop_id) THEN
    
    v_profile_full_name := COALESCE(NEW.full_name, 'Cliente');
    
    -- Recupera l'email dal profilo utente auth
    SELECT email INTO v_client_email
    FROM auth.users
    WHERE id = NEW.user_id;
    
    -- Verifica che non esista già una notifica per questo cliente nello stesso negozio
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE type = 'new_client' 
        AND shop_id = NEW.shop_id
        AND (
          data->>'client_user_id' = NEW.user_id::text
          OR data->>'client_email' = v_client_email
        )
        AND created_at > NOW() - INTERVAL '1 minute'
    ) THEN
      -- Trova UN SOLO barbiere del NEGOZIO SPECIFICO del cliente
      SELECT 
        s.id as staff_id,
        s.user_id,
        s.shop_id,
        s.full_name as barber_name
      INTO v_barber_record
      FROM public.staff s
      WHERE s.active = true
        AND s.shop_id = NEW.shop_id  -- IMPORTANTE: Solo barbieri dello stesso negozio
        AND s.user_id IS NOT NULL
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
        s.created_at ASC
      LIMIT 1;
      
      -- Crea la notifica solo se è stato trovato un barbiere dello stesso negozio
      IF FOUND AND v_barber_record.user_id IS NOT NULL AND v_barber_record.shop_id = NEW.shop_id THEN
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
          NEW.shop_id,  -- IMPORTANTE: shop_id del cliente (garantisce isolamento)
          v_barber_record.user_id,
          'staff',
          'new_client',
          '👤 Nuovo Cliente Registrato',
          v_profile_full_name || ' si è appena registrato' || 
          CASE WHEN v_client_email IS NOT NULL THEN ' (' || v_client_email || ')' ELSE '' END,
          jsonb_build_object(
            'client_user_id', NEW.user_id,
            'client_name', v_profile_full_name,
            'client_email', v_client_email,
            'registered_at', NOW()
          ),
          NOW()
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Errore nella creazione notifica per cliente % nel negozio %: %', NEW.user_id, NEW.shop_id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crea il trigger sull'aggiornamento di profiles
DROP TRIGGER IF EXISTS trigger_notify_on_shop_assigned ON public.profiles;
CREATE TRIGGER trigger_notify_on_shop_assigned
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.shop_id IS NOT NULL AND (OLD.shop_id IS NULL OR OLD.shop_id != NEW.shop_id))
  EXECUTE FUNCTION public.handle_profile_shop_assigned();

-- Commenti per documentazione
COMMENT ON FUNCTION public.handle_new_user() IS 'Funzione trigger per creare automaticamente un profilo quando viene creato un nuovo utente. NON crea notifiche (shop_id è NULL).';
COMMENT ON FUNCTION public.handle_profile_shop_assigned() IS 'Funzione trigger per creare notifiche quando shop_id viene assegnato a un profilo cliente. Garantisce isolamento tra negozi.';






