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
  INSERT INTO public.profiles (user_id, shop_id, role, full_name, created_at)
  VALUES (
    NEW.id,                    -- ID dell'utente appena creato
    NULL,                      -- shop_id inizialmente NULL (da assegnare successivamente)
    'user',                    -- ruolo di default
    v_profile_full_name,       -- nome completo o email come fallback
    NOW()                      -- timestamp di creazione
  );
  
  -- Invia notifica a tutti i barbieri attivi che hanno un user_id collegato
  -- Trova tutti i barbieri dalla tabella staff con ruolo 'barber' o simile
  FOR v_barber_record IN
    SELECT 
      s.id as staff_id,
      s.user_id,
      s.shop_id,
      s.full_name as barber_name
    FROM public.staff s
    WHERE s.active = true
      AND s.user_id IS NOT NULL  -- Solo barbieri con user_id collegato
      AND (
        LOWER(s.role) LIKE '%barber%' 
        OR s.role IN ('barber', 'Barbiere', 'Barbiere Senior', 'Barbiere Junior', 'Master Barber', 'Junior Barber')
      )
  LOOP
    -- Crea una notifica per ogni barbiere
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
  END LOOP;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log dell'errore ma continua l'esecuzione
    RAISE LOG 'Errore nella creazione notifica per nuovo utente %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Creiamo il trigger che si attiva dopo l'inserimento in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Opzionale: Trigger per aggiornare il profilo quando cambiano i metadati utente
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Aggiorna il profilo se cambiano i metadati utente
  UPDATE public.profiles
  SET 
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', OLD.raw_user_meta_data->>'full_name', NEW.email),
    updated_at = NOW()
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

