-- Script completo per creare tutte le tabelle mancanti
-- Questo script crea tutte le tabelle necessarie per l'applicazione

-- 1. Creiamo la tabella clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone_e164 TEXT NOT NULL,
  email TEXT,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Creiamo la tabella staff
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Creiamo la tabella appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'rescheduled', 'cancelled', 'no_show', 'completed')),
  notes TEXT,
  gcal_event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Creiamo la tabella chats
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Creiamo la tabella chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'staff')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- 6. Abilitiamo RLS su tutte le tabelle
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 7. Creiamo le policy per clients
CREATE POLICY "Enable all operations for authenticated users" ON public.clients
  FOR ALL USING (auth.role() = 'authenticated');

-- 8. Creiamo le policy per staff
CREATE POLICY "Enable all operations for authenticated users" ON public.staff
  FOR ALL USING (auth.role() = 'authenticated');

-- 9. Creiamo le policy per appointments
CREATE POLICY "Enable all operations for authenticated users" ON public.appointments
  FOR ALL USING (auth.role() = 'authenticated');

-- 10. Creiamo le policy per chats
CREATE POLICY "Enable all operations for authenticated users" ON public.chats
  FOR ALL USING (auth.role() = 'authenticated');

-- 11. Creiamo le policy per chat_messages
CREATE POLICY "Enable all operations for authenticated users" ON public.chat_messages
  FOR ALL USING (auth.role() = 'authenticated');

-- 12. Creiamo gli indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_clients_shop_id ON public.clients(shop_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone_e164);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);

CREATE INDEX IF NOT EXISTS idx_staff_shop_id ON public.staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON public.staff(active);

CREATE INDEX IF NOT EXISTS idx_appointments_shop_id ON public.appointments(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON public.appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_at ON public.appointments(start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

CREATE INDEX IF NOT EXISTS idx_chats_client_id ON public.chats(client_id);
CREATE INDEX IF NOT EXISTS idx_chats_staff_id ON public.chats(staff_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON public.chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- 13. Creiamo i trigger per aggiornare automaticamente updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Inseriamo alcuni dati di esempio
INSERT INTO public.staff (full_name, role, active, email) VALUES
('Mario Rossi', 'barber', true, 'mario@retrobarbershop.it'),
('Luigi Bianchi', 'barber', true, 'luigi@retrobarbershop.it'),
('Giuseppe Verdi', 'receptionist', true, 'giuseppe@retrobarbershop.it')
ON CONFLICT DO NOTHING;

-- 15. Verifichiamo che tutto sia stato creato correttamente
SELECT 
  'SUCCESS: All tables created' as status,
  (SELECT COUNT(*) FROM public.clients) as clients_count,
  (SELECT COUNT(*) FROM public.staff) as staff_count,
  (SELECT COUNT(*) FROM public.appointments) as appointments_count,
  (SELECT COUNT(*) FROM public.chats) as chats_count,
  (SELECT COUNT(*) FROM public.chat_messages) as chat_messages_count;


