-- =====================================================
-- URGENT FIX: STRICT MULTI-TENANCY ISOLATION
-- =====================================================
-- This script removes ANY permissive policies that might
-- cause data leaks between shops and enforces strict
-- shop_id isolation.
-- =====================================================

DO $$
DECLARE
  v_policy_name TEXT;
  v_table_name TEXT;
BEGIN
  RAISE NOTICE 'Starting urgent isolation fix...';

  -- 1. DROP SPECIFIC KNOWN PERMISSIVE POLICIES
  -- ----------------------------------------------------------------
  
  -- The specific culprit identified
  DROP POLICY IF EXISTS "clients_all_operations_authenticated" ON public.clients;
  RAISE NOTICE 'Dropped permissive policy: clients_all_operations_authenticated';

  -- 2. RESET RLS ON SENSITIVE TABLES
  -- ----------------------------------------------------------------
  -- We will drop ALL policies on these tables and re-create strict ones
  -- to ensure no other "accidental" permissive policies exist.
  
  FOREACH v_table_name IN ARRAY ARRAY['clients', 'appointments', 'waitlist', 'notifications', 'products', 'services', 'staff']
  LOOP
    -- Enable RLS just in case
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);
    
    -- Drop all existing policies for this table
    FOR v_policy_name IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = v_table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy_name, v_table_name);
      RAISE NOTICE 'Dropped policy: % on %', v_policy_name, v_table_name;
    END LOOP;
  END LOOP;

  -- 3. RE-CREATE STRICT POLICIES
  -- ----------------------------------------------------------------
  
  -- --- CLIENTS ---
  CREATE POLICY "clients_isolation_select" ON public.clients
    FOR SELECT USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "clients_isolation_insert" ON public.clients
    FOR INSERT WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "clients_isolation_update" ON public.clients
    FOR UPDATE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    ) WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "clients_isolation_delete" ON public.clients
    FOR DELETE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );

  RAISE NOTICE 'Re-created strict policies for: clients';

  -- --- APPOINTMENTS ---
  CREATE POLICY "appointments_isolation_select" ON public.appointments
    FOR SELECT USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "appointments_isolation_insert" ON public.appointments
    FOR INSERT WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "appointments_isolation_update" ON public.appointments
    FOR UPDATE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    ) WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "appointments_isolation_delete" ON public.appointments
    FOR DELETE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );

  RAISE NOTICE 'Re-created strict policies for: appointments';

  -- --- WAITLIST ---
  CREATE POLICY "waitlist_isolation_select" ON public.waitlist
    FOR SELECT USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "waitlist_isolation_insert" ON public.waitlist
    FOR INSERT WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "waitlist_isolation_update" ON public.waitlist
    FOR UPDATE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    ) WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "waitlist_isolation_delete" ON public.waitlist
    FOR DELETE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );

  RAISE NOTICE 'Re-created strict policies for: waitlist';
  
  -- --- NOTIFICATIONS ---
  CREATE POLICY "notifications_isolation_select" ON public.notifications
    FOR SELECT USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "notifications_isolation_insert" ON public.notifications
    FOR INSERT WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "notifications_isolation_update" ON public.notifications
    FOR UPDATE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    ) WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "notifications_isolation_delete" ON public.notifications
    FOR DELETE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  RAISE NOTICE 'Re-created strict policies for: notifications';

  -- --- PRODUCTS ---
   CREATE POLICY "products_isolation_select" ON public.products
    FOR SELECT USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "products_isolation_insert" ON public.products
    FOR INSERT WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "products_isolation_update" ON public.products
    FOR UPDATE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    ) WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "products_isolation_delete" ON public.products
    FOR DELETE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  RAISE NOTICE 'Re-created strict policies for: products';

  -- --- SERVICES ---
   CREATE POLICY "services_isolation_select" ON public.services
    FOR SELECT USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "services_isolation_insert" ON public.services
    FOR INSERT WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "services_isolation_update" ON public.services
    FOR UPDATE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    ) WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "services_isolation_delete" ON public.services
    FOR DELETE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );

  RAISE NOTICE 'Re-created strict policies for: services';
  
  -- --- STAFF ---
   CREATE POLICY "staff_isolation_select" ON public.staff
    FOR SELECT USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "staff_isolation_insert" ON public.staff
    FOR INSERT WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "staff_isolation_update" ON public.staff
    FOR UPDATE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    ) WITH CHECK (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );
    
  CREATE POLICY "staff_isolation_delete" ON public.staff
    FOR DELETE USING (
      shop_id = public.current_shop_id() OR auth.role() = 'service_role' OR public.is_platform_admin()
    );

  RAISE NOTICE 'Re-created strict policies for: staff';

  RAISE NOTICE '=== ISOLATION FIX COMPLETED ===';
END $$;
