-- ============================================
-- FIX RLS - TENTATIVO FINALE
-- ============================================
-- Questo script prova diverse combinazioni per far funzionare RLS
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

-- Policy INSERT: Prova TUTTE le condizioni possibili
CREATE POLICY "clients_insert_authenticated" ON public.clients
  FOR INSERT 
  WITH CHECK (
    -- Condizione 1: auth.uid() IS NOT NULL
    auth.uid() IS NOT NULL
    -- Condizione 2: auth.role() = 'authenticated'
    OR auth.role() = 'authenticated'
    -- Condizione 3: service_role
    OR auth.role() = 'service_role'
    -- Condizione 4: Verifica JWT direttamente
    OR (auth.jwt() IS NOT NULL AND auth.jwt() ->> 'sub' IS NOT NULL)
  );

-- Policy SELECT
CREATE POLICY "clients_select_authenticated" ON public.clients
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL
    OR auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
    OR (auth.jwt() IS NOT NULL AND auth.jwt() ->> 'sub' IS NOT NULL)
  );

-- Policy UPDATE
CREATE POLICY "clients_update_authenticated" ON public.clients
  FOR UPDATE 
  USING (
    auth.uid() IS NOT NULL
    OR auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

-- Policy DELETE
CREATE POLICY "clients_delete_authenticated" ON public.clients
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL
    OR auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

-- Verifica
SELECT 
  'SUCCESS' as status,
  policyname,
  cmd,
  with_check as "WITH CHECK clause"
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients'
  AND cmd = 'INSERT';

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Policy create con TUTTE le condizioni possibili';
  RAISE NOTICE '   Se questo non funziona, il problema è nel token o nella configurazione Supabase';
  RAISE NOTICE '';
END $$;
