-- Quick seed for local/testing
-- Products
INSERT INTO public.products (name, description, brand, price, imageurl, instock, stockquantity, active)
VALUES
  ('Shampoo Uomo', 'Shampoo delicato per uso quotidiano', 'Retro', 9.90, NULL, true, 20, true),
  ('Cera Capelli', 'Tenuta media, finitura naturale', 'Retro', 12.50, NULL, true, 15, true)
ON CONFLICT DO NOTHING;

-- Services
INSERT INTO public.services (name, duration_min, price_cents, active)
VALUES
  ('Taglio Uomo', 30, 1500, true),
  ('Barba', 20, 1000, true)
ON CONFLICT DO NOTHING;

-- Staff (minimal row if missing). Requires shops row or allows NULL shop_id
INSERT INTO public.staff (id, shop_id, full_name, role, active, chair_id, email, phone, specialties, bio)
VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'Mario Rossi', 'barber', true, NULL, 'mario@example.com', '+39 123 456 7890', 'Taglio classico, Barba', 'Barbiere appassionato')
ON CONFLICT (id) DO NOTHING;


