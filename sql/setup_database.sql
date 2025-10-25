-- Script per ricreare tutto da zero senza conflitti
-- Questo script elimina tutto e ricrea da zero

-- 1. Eliminiamo TUTTE le policy esistenti
DROP POLICY IF EXISTS "Enable all operations for shops" ON public.shops;
DROP POLICY IF EXISTS shops_upd ON public.shops;
DROP POLICY IF EXISTS shops_sel ON public.shops;
DROP POLICY IF EXISTS shops_ins ON public.shops;
DROP POLICY IF EXISTS shops_del ON public.shops;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;

-- 2. Eliminiamo TUTTI i constraint esistenti
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check1;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check2;

-- 3. Eliminiamo TUTTI i trigger esistenti
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- 4. Eliminiamo TUTTE le funzioni esistenti
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_update();
DROP FUNCTION IF EXISTS public.handle_user_delete();

-- 5. Verifichiamo che le tabelle esistano
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'client',
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Aggiungiamo il constraint sulla colonna role
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'manager', 'staff', 'user', 'client', 'barber', 'receptionist', 'owner'));

-- 7. Abilitiamo RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- 8. Ricreiamo le policy
CREATE POLICY "Enable all operations for shops" ON public.shops
  FOR ALL USING (true);

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- 9. Creiamo la funzione trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserisce automaticamente un nuovo record nella tabella profiles
  INSERT INTO public.profiles (user_id, shop_id, role, full_name, created_at)
  VALUES (
    NEW.id,
    NULL,
    'client',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW()
  );
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log dell'errore e continua
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Creiamo il trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. Creiamo i profili per gli utenti esistenti
INSERT INTO public.profiles (user_id, shop_id, role, full_name, created_at)
SELECT 
  u.id,
  NULL,
  'client',
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 12. Verifichiamo il risultato
SELECT 
  'SUCCESS: Everything recreated' as status,
  (SELECT COUNT(*) FROM auth.users) as users_count,
  (SELECT COUNT(*) FROM public.profiles) as profiles_count;

-- 13. Mostriamo i profili creati
SELECT 
  user_id,
  role,
  full_name,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- 14. Verifichiamo che tutto sia a posto
SELECT 
  'Trigger active' as check_type,
  trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
UNION ALL
SELECT 
  'Function exists' as check_type,
  routine_name
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
UNION ALL
SELECT 
  'Policy count' as check_type,
  COUNT(*)::text
FROM pg_policies 
WHERE schemaname = 'public';
