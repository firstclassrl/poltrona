-- ============================================
-- FIX FINALE RLS - POLICY MOLTO PERMISSIVA
-- ============================================
-- Questo script crea una policy che permette TUTTO a chiunque abbia un token valido
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

-- Crea UNA SOLA policy che permette TUTTO
-- Usa auth.uid() IS NOT NULL che è più affidabile di auth.role()
CREATE POLICY "clients_allow_all_authenticated" ON public.clients
  FOR ALL
  USING (
    -- Se c'è un UID, l'utente è autenticato (più affidabile)
    auth.uid() IS NOT NULL
    -- OPPURE service_role (per backend)
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    -- Stessa condizione per WITH CHECK
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  );

-- Verifica
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
  AND tablename = 'clients';
