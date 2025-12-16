-- Aggiorna le RLS policy per multi-tenant con filtro su shop_id
-- Include helper function current_shop_id() per evitare duplicazioni

-- Helper: restituisce lo shop_id del profilo corrente (o NULL)
CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT shop_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Shops: lettura pubblica, scrittura solo admin/owner/manager o service_role
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_select_public';
  IF NOT FOUND THEN
    CREATE POLICY shops_select_public ON public.shops
      FOR SELECT
      USING (true);
  END IF;

  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='shops_write_admin';
  IF NOT FOUND THEN
    CREATE POLICY shops_write_admin ON public.shops
      FOR ALL
      USING (
        auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.role IN ('admin','owner','manager')
        )
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND p.role IN ('admin','owner','manager')
        )
      );
  END IF;
END $$;

-- Utility per applicare policy standard con shop_id
-- Nota: usare EXECUTE per riutilizzare il codice
DO $apply$
DECLARE
  r text;
  tables text[] := ARRAY[
    'clients',
    'staff',
    'appointments',
    'services',
    'products',
    'waitlist',
    'shop_daily_hours',
    'shop_daily_time_slots'
  ];
BEGIN
  FOREACH r IN ARRAY tables LOOP
    -- Salta le tabelle che non hanno shop_id (es. prodotti legacy senza colonna)
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = r
        AND column_name = 'shop_id'
    ) THEN
      RAISE NOTICE 'Skip RLS policy for table %: missing shop_id column', r;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r);

    -- SELECT
    PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename=r AND policyname=(r||'_select_shop');
    IF NOT FOUND THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (auth.role() = %L OR shop_id = public.current_shop_id());',
        r||'_select_shop', r, 'service_role'
      );
    END IF;

    -- INSERT
    PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename=r AND policyname=(r||'_insert_shop');
    IF NOT FOUND THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (auth.role() = %L OR shop_id = public.current_shop_id());',
        r||'_insert_shop', r, 'service_role'
      );
    END IF;

    -- UPDATE
    PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename=r AND policyname=(r||'_update_shop');
    IF NOT FOUND THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE USING (auth.role() = %L OR shop_id = public.current_shop_id()) WITH CHECK (auth.role() = %L OR shop_id = public.current_shop_id());',
        r||'_update_shop', r, 'service_role', 'service_role'
      );
    END IF;

    -- DELETE
    PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename=r AND policyname=(r||'_delete_shop');
    IF NOT FOUND THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE USING (auth.role() = %L OR shop_id = public.current_shop_id());',
        r||'_delete_shop', r, 'service_role'
      );
    END IF;
  END LOOP;
END
$apply$;

-- Profili: lettura/aggiornamento solo self
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_self'
  ) THEN
    CREATE POLICY profiles_select_self ON public.profiles
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_self'
  ) THEN
    CREATE POLICY profiles_update_self ON public.profiles
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;





