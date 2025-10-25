-- Script per creare i bucket per le foto dei prodotti e profili
-- Questo script deve essere eseguito nel Supabase Dashboard > Storage

-- 1. Creare bucket per foto prodotti
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-photos',
  'product-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- 2. Creare bucket per foto profili
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  3145728, -- 3MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- 3. Policy per bucket foto prodotti
-- Permettere a tutti gli utenti autenticati di caricare foto prodotti
CREATE POLICY "Allow authenticated users to upload product photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-photos');

-- Permettere a tutti di visualizzare le foto prodotti
CREATE POLICY "Allow public to view product photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-photos');

-- Permettere agli utenti autenticati di aggiornare le proprie foto prodotti
CREATE POLICY "Allow authenticated users to update product photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-photos');

-- Permettere agli utenti autenticati di eliminare le proprie foto prodotti
CREATE POLICY "Allow authenticated users to delete product photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-photos');

-- 4. Policy per bucket foto profili
-- Permettere a tutti gli utenti autenticati di caricare foto profilo
CREATE POLICY "Allow authenticated users to upload profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-photos');

-- Permettere a tutti di visualizzare le foto profilo
CREATE POLICY "Allow public to view profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-photos');

-- Permettere agli utenti autenticati di aggiornare le proprie foto profilo
CREATE POLICY "Allow authenticated users to update profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-photos');

-- Permettere agli utenti autenticati di eliminare le proprie foto profilo
CREATE POLICY "Allow authenticated users to delete profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-photos');

-- 5. Aggiungere colonna chair_id alla tabella staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS chair_id VARCHAR(50);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- 6. Aggiungere colonna image_url alla tabella services (per i prodotti)
ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 7. Creare tabella per gestire le poltrone
CREATE TABLE IF NOT EXISTS chairs (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Inserire le poltrone standard
INSERT INTO chairs (id, name, description, active) VALUES
('chair_1', 'Poltrona 1', 'Poltrona principale del barbershop', true),
('chair_2', 'Poltrona 2', 'Poltrona secondaria del barbershop', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Abilitare RLS sulla tabella chairs
ALTER TABLE chairs ENABLE ROW LEVEL SECURITY;

-- 10. Policy per la tabella chairs
CREATE POLICY "Allow all operations for chairs"
ON chairs FOR ALL
TO authenticated
USING (true);

-- 11. Creare funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 12. Creare trigger per aggiornare updated_at su chairs
CREATE TRIGGER update_chairs_updated_at
    BEFORE UPDATE ON chairs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 13. Aggiungere constraint per chair_id
ALTER TABLE staff ADD CONSTRAINT fk_staff_chair 
FOREIGN KEY (chair_id) REFERENCES chairs(id);

-- 14. Creare indice per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_staff_chair_id ON staff(chair_id);
CREATE INDEX IF NOT EXISTS idx_appointments_chair ON appointments(staff_id) WHERE staff_id IS NOT NULL;

