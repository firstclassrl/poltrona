-- Genera un token di invito valido per qualsiasi utente
-- Esegui questo script in Supabase SQL Editor

INSERT INTO public.shop_invites (token, expires_at)
VALUES (
  encode(gen_random_bytes(16), 'hex'), -- Genera un token casuale di 32 caratteri
  NOW() + INTERVAL '7 days'            -- Valido per 7 giorni
)
RETURNING 
  token, 
  expires_at, 
  'https://poltrona-beta-1.vercel.app/setup?token=' || token as setup_url;
