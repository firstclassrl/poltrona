-- ============================================
-- RIABILITA RLS CON POLICY APERTA
-- ============================================
-- Esegui questo DOPO aver verificato che con RLS disabilitato funziona
-- Questo crea una policy molto permissiva che permette tutto agli utenti autenticati
-- ============================================

-- Rimuovi tutte le policy esistenti
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

-- Crea una policy molto permissiva che permette TUTTO agli utenti autenticati
-- Usa auth.uid() IS NOT NULL invece di auth.role() perché è più affidabile
CREATE POLICY "clients_all_operations_authenticated" ON public.clients
  FOR ALL
  USING (
    -- Permetti se c'è un UID (utente autenticato)
    auth.uid() IS NOT NULL
    -- OPPURE se è service_role
    OR auth.role() = 'service_role'
    -- OPPURE se è authenticated (fallback)
    OR auth.role() = 'authenticated'
  )
  WITH CHECK (
    -- Stessa condizione per WITH CHECK
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
  );

-- Verifica
SELECT 
  'RLS RE-ENABLED' as status,
  policyname,
  cmd,
  qual as "USING",
  with_check as "WITH CHECK"
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients';

RAISE NOTICE '';
RAISE NOTICE '✅ RLS riabilitato con policy permissiva';
RAISE NOTICE '   La policy permette tutte le operazioni a chiunque abbia auth.uid() IS NOT NULL';
RAISE NOTICE '';
