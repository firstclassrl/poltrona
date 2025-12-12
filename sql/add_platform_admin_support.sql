-- Aggiunge supporto per Platform Admin (Super Admin)
-- Il Platform Admin può gestire tutto il database, creare negozi, utenti e fare assistenza

-- ============================================
-- 1. Aggiungi campo is_platform_admin alla tabella profiles
-- ============================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false NOT NULL;

-- Indice per ricerche veloci sui soli platform admin
CREATE INDEX IF NOT EXISTS idx_profiles_is_platform_admin 
  ON public.profiles(is_platform_admin) 
  WHERE is_platform_admin = true;

-- Commento per documentazione
COMMENT ON COLUMN public.profiles.is_platform_admin IS 'Se true, l''utente è un Platform Admin (Super Admin) con accesso completo a tutti i negozi e funzionalità di sistema.';

-- ============================================
-- 2. Funzione helper per verificare se un utente è platform admin
-- ============================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(user_id_param UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = user_id_param
      AND profiles.is_platform_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_platform_admin IS 'Verifica se un utente è Platform Admin. Se user_id_param non è specificato, usa auth.uid().';

-- ============================================
-- 3. Policy minime per permettere al platform admin di vedere/gestire tutto
--    (adatta queste policy alle tue regole esistenti se già presenti)
-- ============================================

DO $$
BEGIN
  -- Policy per SELECT sui profili: l'utente vede il proprio profilo, il platform admin vede tutto
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'profiles_select_platform_admin'
  ) THEN
    CREATE POLICY profiles_select_platform_admin ON public.profiles
      FOR SELECT USING (
        auth.uid() = user_id 
        OR public.is_platform_admin()
      );
  END IF;

  -- Policy per UPDATE sui profili: l'utente aggiorna il proprio profilo, il platform admin aggiorna tutto
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'profiles_update_platform_admin'
  ) THEN
    CREATE POLICY profiles_update_platform_admin ON public.profiles
      FOR UPDATE USING (
        auth.uid() = user_id 
        OR public.is_platform_admin()
      )
      WITH CHECK (
        auth.uid() = user_id 
        OR public.is_platform_admin()
      );
  END IF;
END $$;

DO $$
BEGIN
  -- Policy per SELECT sui negozi: vedi il tuo negozio o, se platform admin, tutti
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'shops' 
      AND policyname = 'shops_select_platform_admin'
  ) THEN
    CREATE POLICY shops_select_platform_admin ON public.shops
      FOR SELECT USING (
        id = public.current_shop_id() 
        OR public.is_platform_admin()
      );
  END IF;

  -- Policy per tutte le operazioni sui negozi per il platform admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'shops' 
      AND policyname = 'shops_all_platform_admin'
  ) THEN
    CREATE POLICY shops_all_platform_admin ON public.shops
      FOR ALL USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- ============================================
-- 4. Istruzioni per promuovere un account a Platform Admin
-- ============================================
-- Dopo aver creato l'account utente in Supabase Auth, esegui in SQL:
--
-- UPDATE public.profiles 
-- SET is_platform_admin = true 
-- WHERE user_id = 'TUO_USER_ID_QUI';
--
-- Oppure, se vuoi creare direttamente:
--
-- INSERT INTO public.profiles (user_id, role, is_platform_admin, full_name)
-- VALUES ('TUO_USER_ID_QUI', 'admin', true, 'Tuo Nome')
-- ON CONFLICT (user_id) 
-- DO UPDATE SET is_platform_admin = true;
--
-- Ricorda: il Platform Admin ha accesso completo, usa con cautela.
