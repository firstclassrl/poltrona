-- =====================================================
-- CHECK SECURITY CONFIGURATION
-- =====================================================
-- Run this script to verify if RLS is correctly enabled
-- and to identify any potential security leaks.
-- =====================================================

DO $$
DECLARE
  v_count INTEGER;
  v_rec RECORD;
BEGIN
  RAISE NOTICE '=== SECURITY CHECK STARTED ===';
  RAISE NOTICE '';

  -- 1. CHECK PLATFORM ADMINS
  -- ---------------------------------------------------
  RAISE NOTICE '--- Checking Platform Admins ---';
  FOR v_rec IN 
    SELECT id, email, is_platform_admin 
    FROM public.profiles 
    WHERE is_platform_admin = true
  LOOP
    RAISE NOTICE '⚠️ WARNING: User % (%) is a PLATFORM ADMIN (sees all data!)', v_rec.email, v_rec.id;
  END LOOP;
  
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE is_platform_admin = true;
  IF v_count = 0 THEN
    RAISE NOTICE '✅ No Platform Admins found.';
  END IF;
  RAISE NOTICE '';

  -- 2. CHECK RLS STATE
  -- ---------------------------------------------------
  RAISE NOTICE '--- Checking RLS State ---';
  FOR v_rec IN 
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('clients', 'appointments', 'shops', 'staff')
  LOOP
    IF v_rec.rowsecurity = true THEN
      RAISE NOTICE '✅ Table %: RLS Enabled', v_rec.tablename;
    ELSE
      RAISE NOTICE '❌ Table %: RLS DISABLED (CRITICAL!)', v_rec.tablename;
    END IF;
  END LOOP;
  RAISE NOTICE '';

  -- 3. CHECK ACTIVE POLICIES
  -- ---------------------------------------------------
  RAISE NOTICE '--- Checking Active Policies ---';
  FOR v_rec IN 
    SELECT tablename, policyname, cmd, qual
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('clients', 'appointments')
  LOOP
    RAISE NOTICE 'Policy on %: % (%)', v_rec.tablename, v_rec.policyname, v_rec.cmd;
    RAISE NOTICE '   Condition: %', v_rec.qual;
    
    IF v_rec.policyname LIKE '%all_operations_authenticated%' THEN
      RAISE NOTICE '   ❌ DANGER: Permissive policy detected!';
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== SECURITY CHECK COMPLETED ===';
END $$;
