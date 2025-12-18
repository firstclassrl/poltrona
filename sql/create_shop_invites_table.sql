-- Crea tabella per token di invito al setup negozio (idempotente)
CREATE TABLE IF NOT EXISTS public.shop_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  used_by_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Abilita RLS
ALTER TABLE public.shop_invites ENABLE ROW LEVEL SECURITY;

-- Policy: lettura pubblica (necessaria per validare token in fase di setup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'shop_invites' AND policyname = 'shop_invites_select_public'
  ) THEN
    CREATE POLICY shop_invites_select_public ON public.shop_invites
      FOR SELECT USING (true);
  END IF;

  -- Inserimento/aggiornamento riservato ad admin (auth.role = 'service_role' oppure profilo admin)
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
END $$;

-- Policy aggiuntiva: uso token da parte di anon/authenticated per marcare come usato
DO $$
BEGIN
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

-- Indice per ricerche veloci sul token
CREATE INDEX IF NOT EXISTS idx_shop_invites_token ON public.shop_invites(token);








