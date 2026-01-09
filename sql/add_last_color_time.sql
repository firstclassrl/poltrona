-- Add last_color_time column to client_hair_profiles table
-- This tracks how long ago the last color treatment was done

ALTER TABLE public.client_hair_profiles 
ADD COLUMN IF NOT EXISTS last_color_time TEXT 
CHECK (last_color_time IN ('never', 'less_than_month', '1_3_months', '3_6_months', '6_12_months', 'more_than_year'));

COMMENT ON COLUMN public.client_hair_profiles.last_color_time IS 'Tempo trascorso dall ultimo trattamento colore';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
