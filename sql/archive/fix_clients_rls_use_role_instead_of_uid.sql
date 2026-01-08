-- ============================================
-- FIX RLS - USA auth.role() invece di auth.uid()
-- ============================================
-- Se auth.uid() non funziona, proviamo con auth.role() = 'authenticated'
-- ============================================

-- Rimuovi TUTTE le policy esistenti
DO $$
DECLARE
  v_policy_name TEXT;
BEGIN
  FOR v_policy_name IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'clients'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clients', v_policy_name);
  END LOOP;
END $$;

-- Riabilita RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: usa auth.role() invece di auth.uid()
CREATE POLICY "clients_select_authenticated" ON public.clients
  FOR SELECT 
  USING (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

-- Policy INSERT: usa auth.role() invece di auth.uid()
-- IMPORTANTE: usa WITH CHECK per INSERT
CREATE POLICY "clients_insert_authenticated" ON public.clients
  FOR INSERT 
  WITH CHECK (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

-- Policy UPDATE: usa auth.role() invece di auth.uid()
CREATE POLICY "clients_update_authenticated" ON public.clients
  FOR UPDATE 
  USING (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

-- Policy DELETE: usa auth.role() invece di auth.uid()
CREATE POLICY "clients_delete_authenticated" ON public.clients
  FOR DELETE 
  USING (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

-- Verifica
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Policy create usando auth.role() invece di auth.uid()';
  RAISE NOTICE '   Se questo non funziona, il problema potrebbe essere nel token stesso';
  RAISE NOTICE '';
END $$;

SELECT 
  'SUCCESS' as status,
  policyname,
  cmd,
  CASE 
    WHEN qual IS NULL THEN 'NULL (OK per INSERT)'
    ELSE qual::text
  END as "USING clause",
  CASE 
    WHEN with_check IS NULL THEN 'NULL'
    ELSE with_check::text
  END as "WITH CHECK clause"
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients'
ORDER BY policyname;
