-- =====================================================
-- FIX: AUTO-ASSEGNAZIONE shop_id PER TUTTE LE TABELLE
-- =====================================================
-- Questo script garantisce che services, products, staff
-- e appointments abbiano shop_id assegnato automaticamente
-- dal profilo dell'utente autenticato
-- =====================================================

-- 1) FUNZIONE HELPER PER OTTENERE shop_id DALL'UTENTE AUTENTICATO
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Ottieni shop_id dal profilo dell'utente autenticato
  SELECT shop_id INTO v_shop_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN v_shop_id;
END;
$$;

COMMENT ON FUNCTION public.get_user_shop_id() IS 'Restituisce shop_id dal profilo dell''utente autenticato';

-- 2) TRIGGER PER SERVICES
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_assign_shop_id_to_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Se shop_id è NULL o mancante, assegnalo dal profilo
  IF NEW.shop_id IS NULL THEN
    v_shop_id := public.get_user_shop_id();
    
    IF v_shop_id IS NOT NULL THEN
      NEW.shop_id := v_shop_id;
      RAISE LOG 'Service: shop_id assegnato automaticamente: %', v_shop_id;
    ELSE
      RAISE WARNING 'Service: Impossibile assegnare shop_id - profilo senza shop_id';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_shop_id_to_service ON public.services;
CREATE TRIGGER trigger_auto_assign_shop_id_to_service
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW
  WHEN (NEW.shop_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_shop_id_to_service();

COMMENT ON FUNCTION public.auto_assign_shop_id_to_service() IS 'Assegna automaticamente shop_id ai servizi se mancante';

-- 3) TRIGGER PER PRODUCTS
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_assign_shop_id_to_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Se shop_id è NULL o mancante, assegnalo dal profilo
  IF NEW.shop_id IS NULL THEN
    v_shop_id := public.get_user_shop_id();
    
    IF v_shop_id IS NOT NULL THEN
      NEW.shop_id := v_shop_id;
      RAISE LOG 'Product: shop_id assegnato automaticamente: %', v_shop_id;
    ELSE
      RAISE WARNING 'Product: Impossibile assegnare shop_id - profilo senza shop_id';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_shop_id_to_product ON public.products;
CREATE TRIGGER trigger_auto_assign_shop_id_to_product
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  WHEN (NEW.shop_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_shop_id_to_product();

COMMENT ON FUNCTION public.auto_assign_shop_id_to_product() IS 'Assegna automaticamente shop_id ai prodotti se mancante';

-- 4) TRIGGER PER STAFF
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_assign_shop_id_to_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Se shop_id è NULL o mancante, assegnalo dal profilo
  IF NEW.shop_id IS NULL THEN
    v_shop_id := public.get_user_shop_id();
    
    IF v_shop_id IS NOT NULL THEN
      NEW.shop_id := v_shop_id;
      RAISE LOG 'Staff: shop_id assegnato automaticamente: %', v_shop_id;
    ELSE
      RAISE WARNING 'Staff: Impossibile assegnare shop_id - profilo senza shop_id';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_shop_id_to_staff ON public.staff;
CREATE TRIGGER trigger_auto_assign_shop_id_to_staff
  BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW
  WHEN (NEW.shop_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_shop_id_to_staff();

COMMENT ON FUNCTION public.auto_assign_shop_id_to_staff() IS 'Assegna automaticamente shop_id allo staff se mancante';

-- 5) TRIGGER PER APPOINTMENTS (se non già presente)
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_assign_shop_id_to_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Se shop_id è NULL, prova a ottenerlo dal client o dal profilo
  IF NEW.shop_id IS NULL THEN
    -- Prova dal client
    IF NEW.client_id IS NOT NULL THEN
      SELECT shop_id INTO v_shop_id
      FROM public.clients
      WHERE id = NEW.client_id
      LIMIT 1;
    END IF;
    
    -- Se non trovato dal client, prova dal profilo
    IF v_shop_id IS NULL THEN
      v_shop_id := public.get_user_shop_id();
    END IF;
    
    IF v_shop_id IS NOT NULL THEN
      NEW.shop_id := v_shop_id;
      RAISE LOG 'Appointment: shop_id assegnato automaticamente: %', v_shop_id;
    ELSE
      RAISE WARNING 'Appointment: Impossibile assegnare shop_id';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_shop_id_to_appointment ON public.appointments;
CREATE TRIGGER trigger_auto_assign_shop_id_to_appointment
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  WHEN (NEW.shop_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_shop_id_to_appointment();

COMMENT ON FUNCTION public.auto_assign_shop_id_to_appointment() IS 'Assegna automaticamente shop_id agli appuntamenti se mancante';

-- 6) AGGIORNA RECORD ESISTENTI SENZA shop_id
-- =====================================================
DO $$
DECLARE
  v_updated_services INTEGER := 0;
  v_updated_products INTEGER := 0;
  v_updated_staff INTEGER := 0;
  v_updated_appointments INTEGER := 0;
  v_shop_id UUID;
BEGIN
  RAISE NOTICE '=== AGGIORNAMENTO RECORD ESISTENTI ===';
  
  -- Per ogni shop, aggiorna i record senza shop_id
  -- basandoci sul fatto che probabilmente appartengono al primo shop creato
  -- o al shop dell'admin che li ha creati
  
  -- Aggiorna services senza shop_id
  -- Assegna al primo shop disponibile (o al shop dell'admin se possibile)
  UPDATE public.services s
  SET shop_id = (
    SELECT p.shop_id
    FROM public.profiles p
    WHERE p.role IN ('admin', 'manager', 'owner')
      AND p.shop_id IS NOT NULL
    ORDER BY p.created_at
    LIMIT 1
  )
  WHERE s.shop_id IS NULL;
  
  GET DIAGNOSTICS v_updated_services = ROW_COUNT;
  
  -- Aggiorna products senza shop_id
  UPDATE public.products pr
  SET shop_id = (
    SELECT p.shop_id
    FROM public.profiles p
    WHERE p.role IN ('admin', 'manager', 'owner')
      AND p.shop_id IS NOT NULL
    ORDER BY p.created_at
    LIMIT 1
  )
  WHERE pr.shop_id IS NULL;
  
  GET DIAGNOSTICS v_updated_products = ROW_COUNT;
  
  -- Aggiorna staff senza shop_id
  UPDATE public.staff st
  SET shop_id = (
    SELECT p.shop_id
    FROM public.profiles p
    WHERE p.role IN ('admin', 'manager', 'owner')
      AND p.shop_id IS NOT NULL
    ORDER BY p.created_at
    LIMIT 1
  )
  WHERE st.shop_id IS NULL;
  
  GET DIAGNOSTICS v_updated_staff = ROW_COUNT;
  
  -- Aggiorna appointments senza shop_id (dal client)
  UPDATE public.appointments a
  SET shop_id = c.shop_id
  FROM public.clients c
  WHERE a.client_id = c.id
    AND a.shop_id IS NULL
    AND c.shop_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_appointments = ROW_COUNT;
  
  RAISE NOTICE 'Services aggiornati: %', v_updated_services;
  RAISE NOTICE 'Products aggiornati: %', v_updated_products;
  RAISE NOTICE 'Staff aggiornati: %', v_updated_staff;
  RAISE NOTICE 'Appointments aggiornati: %', v_updated_appointments;
  RAISE NOTICE '';
END $$;

-- 7) VERIFICA
-- =====================================================
DO $$
DECLARE
  v_services_without_shop_id INTEGER;
  v_products_without_shop_id INTEGER;
  v_staff_without_shop_id INTEGER;
  v_appointments_without_shop_id INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA ===';
  
  SELECT COUNT(*) INTO v_services_without_shop_id
  FROM public.services
  WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_products_without_shop_id
  FROM public.products
  WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_staff_without_shop_id
  FROM public.staff
  WHERE shop_id IS NULL;
  
  SELECT COUNT(*) INTO v_appointments_without_shop_id
  FROM public.appointments
  WHERE shop_id IS NULL;
  
  RAISE NOTICE 'Services senza shop_id: %', v_services_without_shop_id;
  RAISE NOTICE 'Products senza shop_id: %', v_products_without_shop_id;
  RAISE NOTICE 'Staff senza shop_id: %', v_staff_without_shop_id;
  RAISE NOTICE 'Appointments senza shop_id: %', v_appointments_without_shop_id;
  
  IF v_services_without_shop_id > 0 OR 
     v_products_without_shop_id > 0 OR 
     v_staff_without_shop_id > 0 OR 
     v_appointments_without_shop_id > 0 THEN
    RAISE WARNING '⚠️ Ci sono ancora record senza shop_id';
  ELSE
    RAISE NOTICE '✅ Tutti i record hanno shop_id assegnato';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 8) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Funzione creata: get_user_shop_id()';
  RAISE NOTICE '✅ Trigger creati:';
  RAISE NOTICE '   - trigger_auto_assign_shop_id_to_service';
  RAISE NOTICE '   - trigger_auto_assign_shop_id_to_product';
  RAISE NOTICE '   - trigger_auto_assign_shop_id_to_staff';
  RAISE NOTICE '   - trigger_auto_assign_shop_id_to_appointment';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Prova a creare un servizio, prodotto, staff dall''app';
  RAISE NOTICE '2. Verifica che abbiano shop_id assegnato automaticamente';
  RAISE NOTICE '3. Se funziona, il problema è risolto!';
  RAISE NOTICE '';
END $$;
