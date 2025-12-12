-- =====================================================
-- TEST SEMPLICE INSERIMENTO CLIENTE
-- =====================================================
-- Esegui questo script come utente autenticato
-- per testare se l'inserimento funziona
-- =====================================================

-- 1) Verifica utente corrente
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role,
  public.is_platform_admin() as is_platform_admin;

-- 2) Verifica profilo
SELECT 
  user_id,
  shop_id,
  role,
  is_platform_admin
FROM public.profiles
WHERE user_id = auth.uid();

-- 3) Verifica funzione helper
SELECT 
  public.can_insert_client('4139fac4-127f-42f6-ba10-74ee03ffb160'::UUID) as can_insert;

-- 4) Test inserimento (sostituisci con il tuo shop_id)
DO $$
DECLARE
  v_shop_id UUID := '4139fac4-127f-42f6-ba10-74ee03ffb160'; -- MODIFICA QUI
  v_client_id UUID;
  v_can_insert BOOLEAN;
BEGIN
  -- Verifica se può inserire
  v_can_insert := public.can_insert_client(v_shop_id);
  
  RAISE NOTICE '=== TEST INSERIMENTO ===';
  RAISE NOTICE 'Shop ID: %', v_shop_id;
  RAISE NOTICE 'can_insert_client(): %', v_can_insert;
  
  IF NOT v_can_insert THEN
    RAISE WARNING '❌ La funzione can_insert_client() restituisce FALSE!';
    RAISE NOTICE 'Verifica:';
    RAISE NOTICE '  - auth.uid(): %', auth.uid();
    RAISE NOTICE '  - auth.role(): %', auth.role();
    RAISE NOTICE '  - is_platform_admin(): %', public.is_platform_admin();
    RAISE NOTICE '  - shop_id nel profilo: %', (SELECT shop_id FROM public.profiles WHERE user_id = auth.uid());
    RETURN;
  END IF;
  
  -- Prova inserimento
  BEGIN
    INSERT INTO public.clients (
      shop_id,
      first_name,
      last_name,
      phone_e164,
      email
    ) VALUES (
      v_shop_id,
      'Test',
      'Cliente',
      '+39123456789',
      'test-' || extract(epoch from now())::text || '@test.it'
    ) RETURNING id INTO v_client_id;
    
    RAISE NOTICE '✅✅✅ INSERIMENTO RIUSCITO! ✅✅✅';
    RAISE NOTICE 'Client ID: %', v_client_id;
    
    -- Rimuovi cliente di test
    DELETE FROM public.clients WHERE id = v_client_id;
    RAISE NOTICE '✅ Cliente di test rimosso';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌❌❌ INSERIMENTO FALLITO! ❌❌❌';
    RAISE NOTICE 'Errore: %', SQLERRM;
    RAISE NOTICE 'Codice: %', SQLSTATE;
  END;
END $$;
