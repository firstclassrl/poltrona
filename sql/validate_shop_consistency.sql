-- =====================================================
-- FIX: Validazione Cross-Reference per appointments
-- =====================================================
-- Questo script crea una funzione per validare che client_id,
-- staff_id, e service_id appartengano allo stesso shop
-- =====================================================

-- 1) FUNZIONE PER VALIDARE COERENZA shop_id IN appointments
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_appointment_shop_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_shop_id UUID;
  v_staff_shop_id UUID;
  v_service_shop_id UUID;
  v_final_shop_id UUID;
BEGIN
  -- Se shop_id è già presente, verifica coerenza
  IF NEW.shop_id IS NOT NULL THEN
    v_final_shop_id := NEW.shop_id;
  END IF;
  
  -- Recupera shop_id da client, staff, service
  IF NEW.client_id IS NOT NULL THEN
    SELECT shop_id INTO v_client_shop_id
    FROM public.clients
    WHERE id = NEW.client_id
    LIMIT 1;
  END IF;
  
  IF NEW.staff_id IS NOT NULL THEN
    SELECT shop_id INTO v_staff_shop_id
    FROM public.staff
    WHERE id = NEW.staff_id
    LIMIT 1;
  END IF;
  
  IF NEW.service_id IS NOT NULL THEN
    SELECT shop_id INTO v_service_shop_id
    FROM public.services
    WHERE id = NEW.service_id
    LIMIT 1;
  END IF;
  
  -- Determina shop_id finale con priorità
  IF v_final_shop_id IS NULL THEN
    IF v_client_shop_id IS NOT NULL THEN
      v_final_shop_id := v_client_shop_id;
    ELSIF v_staff_shop_id IS NOT NULL THEN
      v_final_shop_id := v_staff_shop_id;
    ELSIF v_service_shop_id IS NOT NULL THEN
      v_final_shop_id := v_service_shop_id;
    END IF;
  END IF;
  
  -- Verifica coerenza: tutti i riferimenti devono appartenere allo stesso shop
  IF v_final_shop_id IS NOT NULL THEN
    -- Verifica client
    IF v_client_shop_id IS NOT NULL AND v_client_shop_id != v_final_shop_id THEN
      RAISE EXCEPTION 'Appointment: client_id appartiene a shop diverso (client: %, appointment: %)', 
        v_client_shop_id, v_final_shop_id;
    END IF;
    
    -- Verifica staff
    IF v_staff_shop_id IS NOT NULL AND v_staff_shop_id != v_final_shop_id THEN
      RAISE EXCEPTION 'Appointment: staff_id appartiene a shop diverso (staff: %, appointment: %)', 
        v_staff_shop_id, v_final_shop_id;
    END IF;
    
    -- Verifica service
    IF v_service_shop_id IS NOT NULL AND v_service_shop_id != v_final_shop_id THEN
      RAISE EXCEPTION 'Appointment: service_id appartiene a shop diverso (service: %, appointment: %)', 
        v_service_shop_id, v_final_shop_id;
    END IF;
    
    -- Assegna shop_id se mancante
    IF NEW.shop_id IS NULL THEN
      NEW.shop_id := v_final_shop_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_appointment_shop_consistency() IS 
    'Valida che client_id, staff_id, e service_id appartengano allo stesso shop prima di creare/aggiornare un appointment.';

-- 2) CREA TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_validate_appointment_shop_consistency ON public.appointments;
CREATE TRIGGER trigger_validate_appointment_shop_consistency
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment_shop_consistency();

-- 3) VERIFICA APPOINTMENTS ESISTENTI CON INCONSISTENZE
-- =====================================================
DO $$
DECLARE
  v_inconsistent_count INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA INCONSISTENZE APPOINTMENTS ===';
  
  SELECT COUNT(*) INTO v_inconsistent_count
  FROM public.appointments a
  WHERE a.shop_id IS NOT NULL
    AND (
      -- Client appartiene a shop diverso
      (a.client_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = a.client_id
          AND c.shop_id IS NOT NULL
          AND c.shop_id != a.shop_id
      ))
      OR
      -- Staff appartiene a shop diverso
      (a.staff_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = a.staff_id
          AND s.shop_id IS NOT NULL
          AND s.shop_id != a.shop_id
      ))
      OR
      -- Service appartiene a shop diverso
      (a.service_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.services sv
        WHERE sv.id = a.service_id
          AND sv.shop_id IS NOT NULL
          AND sv.shop_id != a.shop_id
      ))
    );
  
  IF v_inconsistent_count > 0 THEN
    RAISE WARNING '⚠️ Trovati % appointments con inconsistenze shop_id!', v_inconsistent_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Appointments con inconsistenze:';
    RAISE NOTICE '(Eseguire query manuale per vedere i dettagli)';
  ELSE
    RAISE NOTICE '✅ Nessuna inconsistenza trovata';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 4) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Funzione creata: validate_appointment_shop_consistency()';
  RAISE NOTICE '✅ Trigger creato: trigger_validate_appointment_shop_consistency';
  RAISE NOTICE '';
  RAISE NOTICE 'Il trigger valida automaticamente che:';
  RAISE NOTICE '- client_id, staff_id, service_id appartengano allo stesso shop';
  RAISE NOTICE '- Assegna shop_id se mancante';
  RAISE NOTICE '- Solleva eccezione se ci sono inconsistenze';
  RAISE NOTICE '';
END $$;

