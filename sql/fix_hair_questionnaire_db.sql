-- 1. Aggiunta colonne alla tabella services
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS is_duration_variable BOOLEAN DEFAULT false;

ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS duration_config JSONB DEFAULT '{
  "base_minutes": 30,
  "hair_type_multipliers": {
    "straight_fine": 1.0,
    "wavy_medium": 1.15,
    "curly_thick": 1.25,
    "very_curly_afro": 1.4
  },
  "hair_length_multipliers": {
    "short": 1.0,
    "medium": 1.2,
    "long": 1.35,
    "very_long": 1.5
  },
  "color_situation_extra_minutes": {
    "virgin": 0,
    "roots_touch_up": 0,
    "full_color_change": 30,
    "color_correction": 60
  },
  "buffer_percentage": 10
}';

COMMENT ON COLUMN public.services.is_duration_variable IS 'Se true, la durata viene calcolata in base al profilo capelli del cliente';
COMMENT ON COLUMN public.services.duration_config IS 'Configurazione JSON per calcolo durata dinamica';

-- 2. Creazione tabella client_hair_profiles se non esiste
CREATE TABLE IF NOT EXISTS public.client_hair_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  hair_type TEXT CHECK (hair_type IN ('straight_fine', 'wavy_medium', 'curly_thick', 'very_curly_afro')),
  hair_length TEXT CHECK (hair_length IN ('short', 'medium', 'long', 'very_long')),
  has_color_history BOOLEAN DEFAULT false,
  color_situation TEXT CHECK (color_situation IN ('virgin', 'roots_touch_up', 'full_color_change', 'color_correction')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(client_id, shop_id)
);

COMMENT ON TABLE public.client_hair_profiles IS 'Profilo capelli cliente per shop - usato per calcolo durata appuntamenti';

-- 3. RLS per client_hair_profiles
ALTER TABLE public.client_hair_profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_hair_profiles' AND policyname = 'Staff can manage hair profiles') THEN
        CREATE POLICY "Staff can manage hair profiles" ON public.client_hair_profiles
          FOR ALL USING (
            shop_id IN (
              SELECT shop_id FROM public.shop_staff WHERE user_id = auth.uid()
            )
          );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_hair_profiles' AND policyname = 'Clients can manage own hair profile') THEN
        CREATE POLICY "Clients can manage own hair profile" ON public.client_hair_profiles
          FOR ALL USING (
            client_id IN (
              SELECT id FROM public.clients WHERE user_id = auth.uid()
            )
          );
    END IF;
END $$;

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
