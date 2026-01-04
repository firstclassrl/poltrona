-- =====================================================
-- TRIGGER: Aggiorna automaticamente profiles.role quando si crea/aggiorna staff
-- =====================================================
-- Questo trigger assicura che quando uno staff viene creato o aggiornato
-- con un user_id, il profilo corrispondente abbia role='barber'
-- =====================================================

-- 1) Funzione trigger per aggiornare profiles.role
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_update_profile_role_for_staff()
RETURNS TRIGGER AS $$
BEGIN
  -- Se lo staff ha un user_id collegato, aggiorna il profilo
  IF NEW.user_id IS NOT NULL THEN
    -- Aggiorna il profilo solo se non è già 'admin' (mantieni gli admin)
    -- Se vuoi che anche gli admin vengano aggiornati a 'barber', rimuovi la condizione AND p.role != 'admin'
    UPDATE public.profiles
    SET role = 'barber',
        updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND role != 'barber'
      AND role != 'admin'; -- Mantieni gli admin come admin
    
    -- Log per debug (opzionale, rimuovi in produzione se non necessario)
    RAISE LOG 'Trigger: Aggiornato profile.role a barber per user_id: %', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Trigger su INSERT
-- =====================================================
DROP TRIGGER IF EXISTS trigger_auto_update_profile_role_on_staff_insert ON public.staff;
CREATE TRIGGER trigger_auto_update_profile_role_on_staff_insert
  AFTER INSERT ON public.staff
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.auto_update_profile_role_for_staff();

-- 3) Trigger su UPDATE (solo quando user_id viene aggiunto o modificato)
-- =====================================================
DROP TRIGGER IF EXISTS trigger_auto_update_profile_role_on_staff_update ON public.staff;
CREATE TRIGGER trigger_auto_update_profile_role_on_staff_update
  AFTER UPDATE ON public.staff
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL AND (OLD.user_id IS NULL OR OLD.user_id != NEW.user_id))
  EXECUTE FUNCTION public.auto_update_profile_role_for_staff();

-- 4) Commenti
-- =====================================================
COMMENT ON FUNCTION public.auto_update_profile_role_for_staff() IS 
'Funzione trigger che aggiorna automaticamente profiles.role a ''barber'' quando uno staff viene creato o aggiornato con un user_id. Mantiene gli admin come admin.';

COMMENT ON TRIGGER trigger_auto_update_profile_role_on_staff_insert ON public.staff IS 
'Trigger che aggiorna profiles.role quando viene creato uno staff con user_id';

COMMENT ON TRIGGER trigger_auto_update_profile_role_on_staff_update ON public.staff IS 
'Trigger che aggiorna profiles.role quando viene aggiunto o modificato user_id in uno staff';

-- 5) Verifica che i trigger siano attivi
-- =====================================================
SELECT 
    '=== VERIFICA TRIGGER ===' as section;

SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    '✅ Attivo' as status
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
  AND event_object_table = 'staff'
  AND trigger_name LIKE '%profile_role%'
ORDER BY trigger_name;
