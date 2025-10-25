-- Script per creare la tabella services
-- Questo script crea la tabella services con la struttura corretta per l'applicazione

-- 1. Creiamo la tabella services
CREATE TABLE IF NOT EXISTS public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  price_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Abilitiamo RLS (Row Level Security)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 3. Creiamo le policy per la tabella services
-- Policy per permettere a tutti gli utenti autenticati di leggere i servizi attivi
CREATE POLICY "Enable read access for authenticated users" ON public.services
  FOR SELECT USING (auth.role() = 'authenticated' AND active = true);

-- Policy per permettere agli admin e manager di inserire servizi
CREATE POLICY "Enable insert for admin and manager" ON public.services
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Policy per permettere agli admin e manager di aggiornare servizi
CREATE POLICY "Enable update for admin and manager" ON public.services
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Policy per permettere agli admin e manager di eliminare servizi
CREATE POLICY "Enable delete for admin and manager" ON public.services
  FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- 4. Creiamo gli indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_services_shop_id ON public.services(shop_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(active);
CREATE INDEX IF NOT EXISTS idx_services_name ON public.services(name);

-- 5. Creiamo un trigger per aggiornare automaticamente updated_at
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Inseriamo alcuni servizi di esempio
INSERT INTO public.services (name, duration_min, price_cents, active) VALUES
('Taglio Classico', 30, 2500, true),
('Taglio + Barba', 45, 3500, true),
('Solo Barba', 20, 1500, true),
('Shampoo + Taglio', 40, 3000, true),
('Taglio + Styling', 35, 2800, true)
ON CONFLICT DO NOTHING;

-- 7. Verifichiamo che tutto sia stato creato correttamente
SELECT 
  'SUCCESS: Services table created' as status,
  (SELECT COUNT(*) FROM public.services) as services_count;

-- 8. Mostriamo i servizi creati
SELECT 
  id,
  name,
  duration_min,
  price_cents,
  active,
  created_at
FROM public.services
ORDER BY created_at DESC;


