-- =====================================================
-- FIX: Trigger Auto-Assign shop_id per chat_messages
-- =====================================================
-- Questo script crea trigger per auto-assegnare shop_id
-- alla tabella chat_messages quando viene creato un nuovo record
-- =====================================================

-- 1) FUNZIONE TRIGGER PER AUTO-ASSIGN shop_id A chat_messages
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_assign_shop_id_to_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Se shop_id è NULL, prova a ottenerlo dal chat_id
  -- (il chat dovrebbe avere già shop_id assegnato)
  
  IF NEW.shop_id IS NULL AND NEW.chat_id IS NOT NULL THEN
    -- Recupera shop_id dalla tabella chats
    SELECT shop_id INTO v_shop_id
    FROM public.chats
    WHERE id = NEW.chat_id
    LIMIT 1;
    
    IF v_shop_id IS NOT NULL THEN
      NEW.shop_id := v_shop_id;
      RAISE LOG 'Chat message: shop_id assegnato automaticamente da chat: %', v_shop_id;
    ELSE
      -- Se il chat non ha shop_id, prova a determinarlo dal sender
      -- (fallback per chat esistenti senza shop_id)
      IF NEW.sender_type = 'client' THEN
        SELECT c.shop_id INTO v_shop_id
        FROM public.chats ch
        JOIN public.clients c ON c.id = ch.client_id
        WHERE ch.id = NEW.chat_id
        LIMIT 1;
      ELSIF NEW.sender_type = 'staff' THEN
        SELECT s.shop_id INTO v_shop_id
        FROM public.chats ch
        JOIN public.staff s ON s.id = ch.staff_id
        WHERE ch.id = NEW.chat_id
        LIMIT 1;
      END IF;
      
      IF v_shop_id IS NOT NULL THEN
        NEW.shop_id := v_shop_id;
        RAISE LOG 'Chat message: shop_id assegnato automaticamente da sender: %', v_shop_id;
      ELSE
        RAISE WARNING 'Chat message: Impossibile assegnare shop_id - chat % non ha shop_id e non è possibile determinarlo', NEW.chat_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_assign_shop_id_to_chat_message() IS 
    'Assegna automaticamente shop_id ai messaggi chat se mancante, recuperandolo dalla tabella chats.';

-- 2) CREA TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trigger_auto_assign_shop_id_to_chat_message ON public.chat_messages;
CREATE TRIGGER trigger_auto_assign_shop_id_to_chat_message
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.shop_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_shop_id_to_chat_message();

-- 3) AGGIORNA RECORD ESISTENTI SENZA shop_id
-- =====================================================
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  RAISE NOTICE '=== AGGIORNAMENTO CHAT_MESSAGES ESISTENTI ===';
  
  -- Aggiorna chat_messages senza shop_id (dal chat)
  UPDATE public.chat_messages cm
  SET shop_id = c.shop_id
  FROM public.chats c
  WHERE cm.chat_id = c.id
    AND cm.shop_id IS NULL
    AND c.shop_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Chat messages aggiornati da chat: %', v_updated_count;
  
  RAISE NOTICE '';
END $$;

-- 4) VERIFICA
-- =====================================================
DO $$
DECLARE
  v_messages_without_shop_id INTEGER;
BEGIN
  RAISE NOTICE '=== VERIFICA ===';
  
  SELECT COUNT(*) INTO v_messages_without_shop_id
  FROM public.chat_messages
  WHERE shop_id IS NULL;
  
  RAISE NOTICE 'Chat messages senza shop_id: %', v_messages_without_shop_id;
  
  IF v_messages_without_shop_id > 0 THEN
    RAISE WARNING '⚠️ Ci sono ancora chat messages senza shop_id';
  ELSE
    RAISE NOTICE '✅ Tutti i chat messages hanno shop_id assegnato';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- 5) RIEPILOGO
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== RIEPILOGO ===';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Funzione creata: auto_assign_shop_id_to_chat_message()';
  RAISE NOTICE '✅ Trigger creato: trigger_auto_assign_shop_id_to_chat_message';
  RAISE NOTICE '';
  RAISE NOTICE 'PROSSIMI PASSI:';
  RAISE NOTICE '1. Prova a creare un nuovo messaggio chat dall''app';
  RAISE NOTICE '2. Verifica che abbia shop_id assegnato automaticamente';
  RAISE NOTICE '3. Se funziona, il problema è risolto!';
  RAISE NOTICE '';
END $$;

