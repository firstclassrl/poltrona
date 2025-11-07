-- Add extraordinary opening fields to shops table (idempotent)

-- 1) Ensure shops table exists (no-op if already present)
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) Add columns for single-day extraordinary opening (with safe checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'extra_opening_date'
  ) THEN
    ALTER TABLE public.shops
      ADD COLUMN extra_opening_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'extra_morning_start'
  ) THEN
    ALTER TABLE public.shops
      ADD COLUMN extra_morning_start TIME WITHOUT TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'extra_morning_end'
  ) THEN
    ALTER TABLE public.shops
      ADD COLUMN extra_morning_end TIME WITHOUT TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'extra_afternoon_start'
  ) THEN
    ALTER TABLE public.shops
      ADD COLUMN extra_afternoon_start TIME WITHOUT TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'extra_afternoon_end'
  ) THEN
    ALTER TABLE public.shops
      ADD COLUMN extra_afternoon_end TIME WITHOUT TIME ZONE;
  END IF;
END $$;

-- 3) Optional helper index for quick lookups by date
CREATE INDEX IF NOT EXISTS idx_shops_extra_opening_date
  ON public.shops (extra_opening_date);


