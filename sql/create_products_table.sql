-- Script per creare la tabella products
-- Questo script crea la tabella products con la struttura corretta per l'applicazione

-- 1. Creiamo la tabella products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Abilitiamo RLS (Row Level Security)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 3. Creiamo le policy per la tabella products
-- Policy per permettere a tutti gli utenti autenticati di leggere i prodotti attivi
CREATE POLICY "Enable read access for authenticated users" ON public.products
  FOR SELECT USING (auth.role() = 'authenticated' AND active = true);

-- Policy per permettere agli admin e manager di inserire prodotti
CREATE POLICY "Enable insert for admin and manager" ON public.products
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Policy per permettere agli admin e manager di aggiornare prodotti
CREATE POLICY "Enable update for admin and manager" ON public.products
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Policy per permettere agli admin e manager di eliminare prodotti
CREATE POLICY "Enable delete for admin and manager" ON public.products
  FOR DELETE USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- 4. Creiamo gli indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON public.products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- 5. Creiamo un trigger per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Inseriamo alcuni prodotti di esempio
INSERT INTO public.products (name, description, price_cents, image_url, active) VALUES
('Pomata Classica', 'Pomata per capelli di alta qualità, ideale per styling e modellatura', 1200, 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400', true),
('Shampoo Professionale', 'Shampoo delicato per tutti i tipi di capelli', 1500, 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400', true),
('Balsamo Nutriente', 'Balsamo idratante per capelli secchi e danneggiati', 1800, 'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400', true)
ON CONFLICT DO NOTHING;

-- 7. Verifichiamo che tutto sia stato creato correttamente
SELECT 
  'SUCCESS: Products table created' as status,
  (SELECT COUNT(*) FROM public.products) as products_count;

-- 8. Mostriamo i prodotti creati
SELECT 
  id,
  name,
  description,
  price_cents,
  active,
  created_at
FROM public.products
ORDER BY created_at DESC;


