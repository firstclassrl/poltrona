-- ============================================
-- FIX TRIGGER: Rimozione assegnazione automatica shop pericolosa
-- Questo script rimuove la logica di fallback che assegnava 'retro-barbershop'
-- o il primo negozio disponibile quando mancava lo shop_slug.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_full_name TEXT;
  v_client_email TEXT;
  v_barber_record RECORD;
  v_new_user_shop_id UUID;
  v_shop_slug TEXT;
  v_resolved_shop_id UUID;
BEGIN
  -- Estrai il nome completo e l'email del nuovo utente
  v_profile_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_client_email := NEW.email;
  
  -- Recupera lo shop_slug dai metadati dell'utente
  v_shop_slug := NEW.raw_user_meta_data->>'shop_slug';
  
  -- Se shop_slug è presente, cerca lo shop corrispondente
  IF v_shop_slug IS NOT NULL AND v_shop_slug != '' THEN
    SELECT id INTO v_resolved_shop_id
    FROM public.shops
    WHERE slug = v_shop_slug
    LIMIT 1;
  END IF;
  
  -- RIMOSSO: Fallback su 'retro-barbershop' e su primo shop disponibile
  -- Se v_resolved_shop_id è NULL, l'utente sarà creato senza shop associato (corretto)
  
  -- Inserisce automaticamente un nuovo record nella tabella profiles
  INSERT INTO public.profiles (user_id, shop_id, role, full_name, created_at)
  VALUES (
    NEW.id,
    v_resolved_shop_id,        -- Sarà NULL se lo slug non è valido o mancante
    'client',                  -- ruolo SEMPRE 'client'
    v_profile_full_name,
    NOW()
  );
  
  -- Se shop_id non è stato risolto, usciamo senza inviare notifiche
  IF v_resolved_shop_id IS NULL THEN
    RAISE LOG 'Nuovo utente % creato senza shop_id (slug mancante o non valido: %)', NEW.id, v_shop_slug;
    RETURN NEW;
  END IF;

  -- Invia notifica SOLO se abbiamo un valido shop_id
  v_new_user_shop_id := v_resolved_shop_id;

  IF NOT EXISTS (
       SELECT 1 FROM public.notifications 
       WHERE type = 'new_client' 
         AND (
           data->>'client_user_id' = NEW.id::text
           OR data->>'client_email' = NEW.email
         )
         AND created_at > NOW() - INTERVAL '1 minute'
     ) THEN
     
    -- Trova UN SOLO barbiere del negozio SPECIFICO
    SELECT 
      s.id as staff_id,
      s.user_id,
      s.shop_id,
      s.full_name as barber_name
    INTO v_barber_record
    FROM public.staff s
    WHERE s.active = true
      AND s.user_id IS NOT NULL 
      AND s.shop_id = v_new_user_shop_id  -- CRITICO: Solo barbieri di QUESTO shop
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
    
    -- Crea notifica se trovato barbiere
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
        v_new_user_shop_id,
        v_barber_record.user_id,
        'staff',
        'new_client',
        '👤 Nuovo Cliente Registrato',
        v_profile_full_name || ' si è appena registrato' || 
        CASE WHEN v_client_email IS NOT NULL THEN ' (' || v_client_email || ')' ELSE '' END,
        jsonb_build_object(
          'client_user_id', NEW.id,
          'client_name', v_profile_full_name,
          'client_email', v_client_email,
          'shop_id', v_new_user_shop_id,
          'registered_at', NOW()
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Errore trigger handle_new_user per %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
