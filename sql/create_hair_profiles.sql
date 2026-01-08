-- =============================================
-- Hair Profile System Migration
-- Sistema profilo capelli per parrucchieri
-- =============================================

-- =============================================
-- 1. NUOVA TABELLA client_hair_profiles
-- =============================================

CREATE TABLE IF NOT EXISTS client_hair_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relazioni
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  
  -- Caratteristiche capello
  hair_type TEXT CHECK (hair_type IN (
    'straight_fine',    -- Liscio/Fine
    'wavy_medium',      -- Mosso/Medio  
    'curly_thick',      -- Riccio/Spesso
    'very_curly_afro'   -- Molto riccio/Afro
  )),
  
  hair_length TEXT CHECK (hair_length IN (
    'short',       -- Corti (sopra orecchie)
    'medium',      -- Medi (spalle)
    'long',        -- Lunghi (sotto spalle)
    'very_long'    -- Molto lunghi (metà schiena+)
  )),
  
  -- Storia colore
  has_color_history BOOLEAN DEFAULT false,
  color_situation TEXT CHECK (color_situation IN (
    'virgin',           -- Mai colorati
    'roots_touch_up',   -- Ritocco ricrescita
    'full_color_change', -- Cambio colore completo
    'color_correction'  -- Correzione colore
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Un solo profilo per cliente per shop
  UNIQUE(client_id, shop_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_hair_profiles_client ON client_hair_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_hair_profiles_shop ON client_hair_profiles(shop_id);

-- Trigger per updated_at automatico
CREATE OR REPLACE FUNCTION update_hair_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_client_hair_profiles_updated_at ON client_hair_profiles;
CREATE TRIGGER update_client_hair_profiles_updated_at
  BEFORE UPDATE ON client_hair_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_hair_profile_updated_at();

-- Commenti documentazione
COMMENT ON TABLE client_hair_profiles IS 'Profilo capelli cliente per shop - usato per calcolo durata appuntamenti';
COMMENT ON COLUMN client_hair_profiles.hair_type IS 'Tipo di capello: straight_fine, wavy_medium, curly_thick, very_curly_afro';
COMMENT ON COLUMN client_hair_profiles.hair_length IS 'Lunghezza capelli: short, medium, long, very_long';
COMMENT ON COLUMN client_hair_profiles.color_situation IS 'Situazione colore attuale per servizi colorazione';

-- =============================================
-- 2. MODIFICA TABELLA shops
-- =============================================

-- Flag per abilitare questionario capelli (solo per hairdresser)
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS hair_questionnaire_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN shops.hair_questionnaire_enabled IS 'Se true, mostra questionario capelli durante booking. Rilevante solo per shop_type=hairdresser';

-- =============================================
-- 3. MODIFICA TABELLA services
-- =============================================

-- Flag per servizi a durata variabile (dipende dal tipo capello)
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS is_duration_variable BOOLEAN DEFAULT false;

-- Configurazione moltiplicatori per calcolo durata
ALTER TABLE services 
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
}'::jsonb;

COMMENT ON COLUMN services.is_duration_variable IS 'Se true, la durata viene calcolata in base al profilo capelli del cliente';
COMMENT ON COLUMN services.duration_config IS 'Configurazione JSON per calcolo durata dinamica';

-- =============================================
-- 4. RLS POLICIES
-- =============================================

-- Abilitare RLS
ALTER TABLE client_hair_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff can manage hair profiles" ON client_hair_profiles;
DROP POLICY IF EXISTS "Clients can manage own hair profile" ON client_hair_profiles;

-- Staff può vedere/modificare profili del proprio shop
CREATE POLICY "Staff can manage hair profiles" ON client_hair_profiles
  FOR ALL USING (
    shop_id IN (
      SELECT shop_id FROM shop_staff WHERE user_id = auth.uid()
    )
  );

-- Cliente può vedere/modificare solo il proprio profilo
CREATE POLICY "Clients can manage own hair profile" ON client_hair_profiles
  FOR ALL USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

-- =============================================
-- 5. VERIFICA
-- =============================================

-- Query di verifica struttura
SELECT 
  'client_hair_profiles' as table_name,
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'client_hair_profiles'
ORDER BY ordinal_position;

-- Verifica colonne shops
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shops' AND column_name = 'hair_questionnaire_enabled';

-- Verifica colonne services
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'services' AND column_name IN ('is_duration_variable', 'duration_config');
