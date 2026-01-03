-- ============================================
-- FIX RLS - PERMETTE INSERIMENTI PUBBLICI
-- ============================================
-- Questo script permette inserimenti nella tabella clients ANCHE senza autenticazione
-- Usalo se vuoi permettere prenotazioni senza login
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

-- Policy SELECT: permette a tutti di vedere i clienti (o solo autenticati, scegli tu)
CREATE POLICY "clients_select_public" ON public.clients
  FOR SELECT 
  USING (true);  -- Permette a tutti di vedere (cambia in auth.uid() IS NOT NULL se vuoi solo autenticati)

-- Policy INSERT: PERMETTE A TUTTI di inserire (necessario per prenotazioni senza login)
CREATE POLICY "clients_insert_public" ON public.clients
  FOR INSERT 
  WITH CHECK (true);  -- Permette inserimenti da chiunque

-- Policy UPDATE: solo utenti autenticati possono aggiornare
CREATE POLICY "clients_update_authenticated" ON public.clients
  FOR UPDATE 
  USING (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  );

-- Policy DELETE: solo utenti autenticati possono eliminare
CREATE POLICY "clients_delete_authenticated" ON public.clients
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  );

-- Verifica
SELECT 
  'SUCCESS' as status,
  policyname,
  cmd,
  qual as "USING",
  with_check as "WITH CHECK"
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients'
ORDER BY policyname;

RAISE NOTICE '';
RAISE NOTICE '✅ Policy create!';
RAISE NOTICE '   INSERT ora permette inserimenti da chiunque (anche senza autenticazione)';
RAISE NOTICE '   SELECT permette a tutti di vedere i clienti';
RAISE NOTICE '   UPDATE/DELETE richiedono autenticazione';
RAISE NOTICE '';
