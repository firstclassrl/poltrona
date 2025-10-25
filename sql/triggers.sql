-- Trigger per inserimento automatico in profiles quando si crea un utente in auth.users
-- Questo trigger si attiva automaticamente quando viene inserito un nuovo record in auth.users

-- Prima creiamo la funzione che verrà chiamata dal trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserisce automaticamente un nuovo record nella tabella profiles
  -- collegato al nuovo utente creato in auth.users
  INSERT INTO public.profiles (user_id, shop_id, role, full_name, created_at)
  VALUES (
    NEW.id,                    -- ID dell'utente appena creato
    NULL,                      -- shop_id inizialmente NULL (da assegnare successivamente)
    'user',                    -- ruolo di default
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), -- nome completo o email come fallback
    NOW()                      -- timestamp di creazione
  );
  
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
COMMENT ON FUNCTION public.handle_new_user() IS 'Funzione trigger per creare automaticamente un profilo quando viene creato un nuovo utente';
COMMENT ON FUNCTION public.handle_user_update() IS 'Funzione trigger per aggiornare il profilo quando cambiano i metadati utente';
COMMENT ON FUNCTION public.handle_user_delete() IS 'Funzione trigger per eliminare il profilo quando viene eliminato un utente';

