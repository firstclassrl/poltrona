-- =====================================================
-- FIX: Trigger Auto-Assign shop_id per chats
-- =====================================================
-- Questo script crea trigger per auto-assegnare shop_id
-- alla tabella chats quando viene creato un nuovo record
-- =====================================================

-- 1) FUNZIONE TRIGGER PER AUTO-ASSIGN shop_id A chats
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_assign_shop_id_to_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_client_shop_id UUID;
  v_staff_shop_id UUID;
BEGIN
  -- Se shop_id è NULL, prova a ottenerlo con priorità:
  -- 1. Dal client_id (se client ha shop_id)
  -- 2. Dallo staff_id (se staff ha shop_id)
  -- 3. Dal profilo dell'utente autenticato
  
  IF NEW.shop_id IS NULL THEN
    -- Priorità 1: Prova dal client
    IF NEW.client_id IS NOT NULL THEN
      SELECT shop_id INTO v_shop_id
      FROM public.clients
      WHERE id = NEW.client_id
      LIMIT 1;
    END IF;
    
    -- Priorità 2: Se non trovato, prova dallo staff
    IF v_shop_id IS NULL AND NEW.staff_id IS NOT NULL THEN
      SELECT shop_id INTO v_shop_id
      FROM public.staff
      WHERE id = NEW.staff_id
      LIMIT 1;
    END IF;
    
    -- Priorità 3: Se non trovato, prova dal profilo dell'utente autenticato
    IF v_shop_id IS NULL THEN
      SELECT shop_id INTO v_shop_id
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1;
    END IF;
    
    -- Verifica coerenza: client e staff devono appartenere allo stesso shop
    IF NEW.client_id IS NOT NULL AND NEW.staff_id IS NOT NULL THEN
      -- Recupera shop_id di client e staff per verifica coerenza
      SELECT shop_id INTO v_client_shop_id
      FROM public.clients
      WHERE id = NEW.client_id
      LIMIT 1;
      
      SELECT shop_id INTO v_staff_shop_id
      FROM public.staff
      WHERE id = NEW.staff_id
      LIMIT 1;
      
      -- Se entrambi hanno shop_id e sono diversi, usa quello del client (priorità)
      IF v_client_shop_id IS NOT NULL AND v_staff_shop_id IS NOT NULL 
         AND v_client_shop_id != v_staff_shop_id THEN
        RAISE WARNING '⚠️ Chat: client e staff appartengono a shop diversi (% vs %), uso shop_id del client', 
          v_client_shop_id, v_staff_shop_id;
        v_shop_id := v_client_shop_id;
      ELSIF v_client_shop_id IS NOT NULL AND v_shop_id IS NULL THEN
        v_shop_id := v_client_shop_id;
      ELSIF v_staff_shop_id IS NOT NULL AND v_shop_id IS NULL THEN
        v_shop_id := v_staff_shop_id;
      END IF;
    END IF;
    
    IF v_shop_id IS NOT NULL THEN
      NEW.shop_id := v_shop_id;
      RAISE LOG 'Chat: shop_id assegnato automaticamente: %', v_shop_id;
    ELSE
      RAISE WARNING 'Chat: Impossibile assegnare shop_id - nessuna fonte disponibile';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_assign_shop_id_to_chat() IS 
    'Assegna automaticamente shop_id ai chat se mancante, con priorità: client > staff > user profile. Verifica coerenza tra client e staff.';

-- 2) CREA TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_auto_assign_shop_id_to_chat ON public.chats;
CREATE TRIGGER trigger_auto_assign_shop_id_to_chat
  BEFORE INSERT OR UPDATE ON public.chats
  FOR EACH ROW
  WHEN (NEW.shop_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_shop_id_to_chat();

-- 3) AGGIORNA RECORD ESISTENTI SENZA shop_id
-- =====================================================
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  RAISE NOTICE '=== AGGIORNAMENTO CHATS ESISTENTI ===';
  
  -- Aggiorna chats senza shop_id (dal client)
  UPDATE public.chats c
  SET shop_id = cl.shop_id
  FROM public.clients cl
  WHERE c.client_id = cl.id
    AND c.shop_id IS NULL
    AND cl.shop_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Chats aggiornati da client: %', v_updated_count;
  
  -- Aggiorna chats senza shop_id (dallo staff)
  UPDATE public.chats c
  SET shop_id = s.shop_id
  FROM public.staff s
  WHERE c.staff_id = s.id
    AND c.shop_id IS NULL
    AND s.shop_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Chats aggiornati da staff: %', v_updated_count;
  
  RAISE NOTICE '';
END $$;

-- 4) VERIFICA
-- =====================================================
DO $$
DECLARE
  v_chats_without_shop_id INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA ===';
  
  SELECT COUNT(*) INTO v_chats_without_shop_id
  FROM public.chats
  WHERE shop_id IS NULL;
  
  RAISE NOTICE 'Chats senza shop_id: %', v_chats_without_shop_id;
  
  IF v_chats_without_shop_id > 0 THEN
    RAISE WARNING '⚠️ Ci sono ancora chats senza shop_id';
  ELSE
    RAISE NOTICE '✅ Tutti i chats hanno shop_id assegnato';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 5) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Funzione creata: auto_assign_shop_id_to_chat()';
  RAISE NOTICE '✅ Trigger creato: trigger_auto_assign_shop_id_to_chat';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Prova a creare un nuovo chat dall''app';
  RAISE NOTICE '2. Verifica che abbia shop_id assegnato automaticamente';
  RAISE NOTICE '3. Se funziona, il problema è risolto!';
  RAISE NOTICE '';
END $$;

