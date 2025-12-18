-- Aggiunge il campo admin_user_id alla tabella shop_invites
-- Questo campo associa un token di invito a un admin specifico

-- Aggiungi la colonna admin_user_id se non esiste
ALTER TABLE public.shop_invites 
ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Crea un indice per ricerche veloci
CREATE INDEX IF NOT EXISTS idx_shop_invites_admin_user_id ON public.shop_invites(admin_user_id);

-- Commento per documentazione
COMMENT ON COLUMN public.shop_invites.admin_user_id IS 'ID dell''utente admin associato a questo token di invito. Solo questo admin può usare il token per creare il negozio.';






