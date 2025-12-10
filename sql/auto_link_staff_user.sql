-- ============================================
-- SOLUZIONE PERMANENTE: Auto-collegamento Staff <-> User
-- Esegui questo script su Supabase SQL Editor
-- ============================================

-- 1. Assicurati che la colonna user_id esista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Funzione che crea automaticamente un record staff quando un barbiere si registra
CREATE OR REPLACE FUNCTION public.auto_create_staff_for_barber()
RETURNS TRIGGER AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Solo per ruoli barber/admin/staff
  IF NEW.role IN ('barber', 'admin', 'staff', 'owner') THEN
    -- Trova il primo shop disponibile
    SELECT id INTO v_shop_id FROM public.shops LIMIT 1;
    
    -- Controlla se esiste già uno staff con questo user_id
    IF NOT EXISTS (SELECT 1 FROM public.staff WHERE user_id = NEW.user_id) THEN
      -- Controlla se esiste uno staff con lo stesso nome (da collegare)
      IF EXISTS (SELECT 1 FROM public.staff WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(NEW.full_name)) AND user_id IS NULL) THEN
        -- Collega lo staff esistente
        UPDATE public.staff 
        SET user_id = NEW.user_id
        WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(NEW.full_name)) 
        AND user_id IS NULL;
        
        RAISE LOG 'Staff collegato a user: % -> %', NEW.full_name, NEW.user_id;
      ELSE
        -- Crea un nuovo record staff
        INSERT INTO public.staff (shop_id, full_name, role, active, user_id, created_at)
        VALUES (v_shop_id, NEW.full_name, NEW.role, true, NEW.user_id, NOW());
        
        RAISE LOG 'Nuovo staff creato per: % con user_id: %', NEW.full_name, NEW.user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger che si attiva quando viene creato/aggiornato un profilo
DROP TRIGGER IF EXISTS on_profile_staff_sync ON public.profiles;
CREATE TRIGGER on_profile_staff_sync
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW 
  EXECUTE FUNCTION public.auto_create_staff_for_barber();

-- 4. Funzione che collega automaticamente staff a user quando viene creato uno staff
CREATE OR REPLACE FUNCTION public.auto_link_staff_to_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Se user_id è NULL, prova a trovare un profilo corrispondente
  IF NEW.user_id IS NULL THEN
    UPDATE public.staff
    SET user_id = (
      SELECT p.user_id 
      FROM public.profiles p 
      WHERE LOWER(TRIM(p.full_name)) = LOWER(TRIM(NEW.full_name))
      AND p.role IN ('barber', 'admin', 'staff', 'owner')
      LIMIT 1
    )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger che si attiva quando viene creato uno staff
DROP TRIGGER IF EXISTS on_staff_auto_link ON public.staff;
CREATE TRIGGER on_staff_auto_link
  AFTER INSERT ON public.staff
  FOR EACH ROW 
  EXECUTE FUNCTION public.auto_link_staff_to_user();

-- 6. Collega tutti gli staff esistenti ai loro user
UPDATE public.staff s
SET user_id = p.user_id
FROM public.profiles p
WHERE LOWER(TRIM(s.full_name)) = LOWER(TRIM(p.full_name))
AND s.user_id IS NULL
AND p.role IN ('barber', 'admin', 'staff', 'owner');

-- 7. Verifica finale
SELECT 
    s.id as staff_id,
    s.full_name,
    s.user_id as linked_user_id,
    p.role as profile_role,
    CASE WHEN s.user_id IS NOT NULL THEN '✅ Collegato' ELSE '❌ Non collegato' END as status
FROM public.staff s
LEFT JOIN public.profiles p ON s.user_id = p.user_id
ORDER BY s.full_name;










