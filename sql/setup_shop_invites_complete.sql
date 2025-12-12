-- Script COMPLETO per setup shop_invites con admin_user_id
-- Esegui questo script PRIMA di creare token di invito
--
-- Questo script:
-- 1. Verifica/crea la tabella shop_invites
-- 2. Aggiunge la colonna admin_user_id se non esiste
-- 3. Crea gli indici necessari

-- ============================================
-- 1. Crea tabella shop_invites se non esiste
-- ============================================

CREATE TABLE IF NOT EXISTS public.shop_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  used_by_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- 2. Aggiungi colonna admin_user_id se non esiste
-- ============================================

ALTER TABLE public.shop_invites 
ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================
-- 3. Crea indici
-- ============================================

CREATE INDEX IF NOT EXISTS idx_shop_invites_token ON public.shop_invites(token);
CREATE INDEX IF NOT EXISTS idx_shop_invites_admin_user_id ON public.shop_invites(admin_user_id);

-- ============================================
-- 4. Abilita RLS se non già abilitato
-- ============================================

ALTER TABLE public.shop_invites ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Crea/aggiorna policy RLS
-- ============================================

DO $$
BEGIN
  -- Policy: lettura pubblica (necessaria per validare token in fase di setup)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'shop_invites' AND policyname = 'shop_invites_select_public'
  ) THEN
    CREATE POLICY shop_invites_select_public ON public.shop_invites
      FOR SELECT USING (true);
  END IF;

  -- Policy: inserimento/aggiornamento riservato ad admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'shop_invites' AND policyname = 'shop_invites_write_admin'
  ) THEN
    CREATE POLICY shop_invites_write_admin ON public.shop_invites
      FOR ALL
      USING (
        auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'owner', 'manager')
        )
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'owner', 'manager')
        )
      );
  END IF;

  -- Policy: uso token da parte di anon/authenticated per marcare come usato
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'shop_invites' AND policyname = 'shop_invites_use_token'
  ) THEN
    CREATE POLICY shop_invites_use_token ON public.shop_invites
      FOR UPDATE
      USING (
        (auth.role() IN ('anon','authenticated','service_role')) AND used_at IS NULL
      )
      WITH CHECK (
        (auth.role() IN ('anon','authenticated','service_role')) AND used_at IS NOT NULL AND used_by_shop_id IS NOT NULL
      );
  END IF;
END $$;

-- ============================================
-- 6. Verifica che tutto sia stato creato correttamente
-- ============================================

SELECT 
  '✅ Tabella shop_invites' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_invites')
    THEN '✅ Esiste'
    ELSE '❌ Non esiste'
  END as status
UNION ALL
SELECT 
  '✅ Colonna admin_user_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'shop_invites' 
      AND column_name = 'admin_user_id'
  )
    THEN '✅ Esiste'
    ELSE '❌ Non esiste'
  END
UNION ALL
SELECT 
  '✅ Indice token',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'shop_invites' 
      AND indexname = 'idx_shop_invites_token'
  )
    THEN '✅ Esiste'
    ELSE '❌ Non esiste'
  END
UNION ALL
SELECT 
  '✅ Indice admin_user_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'shop_invites' 
      AND indexname = 'idx_shop_invites_admin_user_id'
  )
    THEN '✅ Esiste'
    ELSE '❌ Non esiste'
  END;

-- ============================================
-- 7. Commenti per documentazione
-- ============================================

COMMENT ON COLUMN public.shop_invites.admin_user_id IS 'ID dell''utente admin associato a questo token di invito. Solo questo admin può usare il token per creare il negozio.';
