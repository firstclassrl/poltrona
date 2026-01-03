-- ============================================
-- DISABILITA RLS TEMPORANEAMENTE PER TEST
-- ============================================
-- ATTENZIONE: Questo script DISABILITA completamente RLS sulla tabella clients
-- Usalo SOLO per test. Dopo aver verificato che funziona, riabilita RLS con policy corrette.
-- ============================================

-- Disabilita RLS sulla tabella clients
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;

-- Verifica che RLS sia disabilitato
SELECT 
  'RLS STATUS' as check_type,
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'clients';

-- Mostra tutte le policy (dovrebbero essere ignorate se RLS è disabilitato)
SELECT 
  'EXISTING POLICIES (ignored when RLS disabled)' as note,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'clients';

RAISE NOTICE '';
RAISE NOTICE '⚠️ RLS DISABILITATO sulla tabella clients';
RAISE NOTICE '   Ora prova a creare un appuntamento.';
RAISE NOTICE '   Se funziona, il problema è nelle policy RLS.';
RAISE NOTICE '   Se NON funziona, il problema è altrove (token, codice, ecc.)';
RAISE NOTICE '';
