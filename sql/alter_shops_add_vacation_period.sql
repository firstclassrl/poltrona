-- Add vacation_period field to shops table (idempotent)
-- This field stores the vacation period as a JSONB object

-- 1) Ensure shops table exists (no-op if already present)
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2) Add vacation_period column (JSONB to store VacationPeriod object)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'vacation_period'
  ) THEN
    ALTER TABLE public.shops
      ADD COLUMN vacation_period JSONB;
    
    COMMENT ON COLUMN public.shops.vacation_period IS 'Periodo di ferie del negozio. Formato: {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "created_at": "ISO timestamp"}';
  END IF;
END $$;

-- 3) Optional helper index for quick lookups (though JSONB has built-in indexing)
CREATE INDEX IF NOT EXISTS idx_shops_vacation_period
  ON public.shops USING GIN (vacation_period);








