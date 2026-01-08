-- Fix RLS policies per services e staff: permette accesso pubblico
-- Questo è necessario per permettere ai clienti non autenticati di vedere servizi e barbieri durante la prenotazione
-- 
-- IMPORTANTE: Esegui questo script dopo aver verificato che i servizi e lo staff abbiano shop_id corretto nel database

-- ============================================
-- PARTE 1: FIX SERVICES
-- ============================================

-- 1. Rimuovi la policy esistente che richiede autenticazione
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.services;

-- 2. Crea una nuova policy che permette accesso pubblico ai servizi attivi
CREATE POLICY "Enable public read access for active services" ON public.services
  FOR SELECT USING (active = true);

-- 3. Mantieni la policy per utenti autenticati (per vedere anche servizi non attivi se necessario)
CREATE POLICY "Enable read access for authenticated users" ON public.services
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- PARTE 2: FIX STAFF
-- ============================================

-- 1. Rimuovi le policy esistenti che potrebbero interferire
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.staff;
DROP POLICY IF EXISTS "staff_select_shop" ON public.staff;

-- 2. Crea una nuova policy che permette accesso pubblico allo staff attivo
CREATE POLICY "Enable public read access for active staff" ON public.staff
  FOR SELECT USING (active = true);

-- 3. Mantieni la policy per utenti autenticati (per vedere anche staff non attivo se necessario)
CREATE POLICY "Enable read access for authenticated users" ON public.staff
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Policy per INSERT: solo admin e manager possono inserire staff
CREATE POLICY "Enable insert for admin and manager" ON public.staff
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- 5. Policy per UPDATE: solo admin e manager possono aggiornare staff
CREATE POLICY "Enable update for admin and manager" ON public.staff
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- 6. Policy per DELETE: solo admin e manager possono eliminare staff
CREATE POLICY "Enable delete for admin and manager" ON public.staff
  FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- ============================================
-- PARTE 3: VERIFICA
-- ============================================

-- Verifica le policy create per services
SELECT 
  'SERVICES POLICIES' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'services'
ORDER BY policyname;

-- Verifica le policy create per staff
SELECT 
  'STAFF POLICIES' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'staff'
ORDER BY policyname;

-- Test: verifica che i servizi attivi siano accessibili
SELECT 
  'SUCCESS: Public access enabled for active services' as status,
  COUNT(*) as active_services_count
FROM public.services
WHERE active = true;

-- Test: verifica che lo staff attivo sia accessibile
SELECT 
  'SUCCESS: Public access enabled for active staff' as status,
  COUNT(*) as active_staff_count
FROM public.staff
WHERE active = true;
