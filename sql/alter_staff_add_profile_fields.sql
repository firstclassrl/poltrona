-- Safely add missing profile fields to the staff table
-- This script is idempotent: it checks column existence before altering

-- 1) Ensure table exists (no-op if already created by setup scripts)
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  role TEXT,
  calendar_id TEXT,
  active BOOLEAN DEFAULT true,
  chair_id TEXT,
  profile_photo_url TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) Add missing columns used by the UI
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN phone TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'specialties'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN specialties TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN bio TEXT;
  END IF;
END $$;

-- 3) Helpful index for name search
CREATE INDEX IF NOT EXISTS idx_staff_full_name ON public.staff (full_name);

-- 4) RLS note: rely on existing policies; add as needed if not present

