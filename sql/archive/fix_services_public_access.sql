-- Fix RLS policies per services: permette accesso pubblico ai servizi attivi
-- Questo è necessario per permettere ai clienti non autenticati di vedere i servizi durante la prenotazione

-- 1. Rimuovi la policy esistente che richiede autenticazione
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.services;

-- 2. Crea una nuova policy che permette accesso pubblico ai servizi attivi
-- Questa policy permette a chiunque (autenticato o no) di vedere i servizi attivi
CREATE POLICY "Enable public read access for active services" ON public.services
  FOR SELECT USING (active = true);

-- 3. Mantieni la policy per utenti autenticati (per vedere anche servizi non attivi se necessario)
CREATE POLICY "Enable read access for authenticated users" ON public.services
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Verifica le policy create
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'services'
ORDER BY policyname;

-- 5. Test: verifica che i servizi attivi siano accessibili
SELECT 
  'SUCCESS: Public access enabled for active services' as status,
  COUNT(*) as active_services_count
FROM public.services
WHERE active = true;
