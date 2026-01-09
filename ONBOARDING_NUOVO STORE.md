# 🚀 Procedura Automatica Creazione Negozio

### ⚠️ Prerequisito
L'utente con l'email specificata **DEVE GIÀ ESISTERE** in Supabase Auth (es. registrato tramite app o dashboard).
Se lo script non restituisce nulla, l'utente non esiste.
Password per utenti demo: demo123
demo salone: salone@abruzzo.ai
demo barbiere: demo@abruzzo.ai
demo estetista: estetista@abruzzo.ai

### 📜 Script SQL (Copia e Incolla in Supabase)
Modifica solo la prima riga (`email`) e l'`url` se necessario.


WITH params AS (
  SELECT
    'salone@abruzzo.ai'::text     AS target_email,  -- <--- 📧 METTI QUI L'EMAIL DELL'UTENTE
    'https://poltrona.abruzzo.ai'::text AS base_url       -- <--- URL (locale o prod)
),
target_user AS (
  SELECT id AS user_id, email
  FROM auth.users
  WHERE email = (SELECT target_email FROM params)
  LIMIT 1
),
-- 1. Promuovi utente a 'owner'
promote_user AS (
  INSERT INTO public.profiles (user_id, email, role, is_platform_admin, full_name, created_at)
  SELECT 
    u.user_id, 
    u.email, 
    'owner', -- Ruolo corretto per gestire negozi
    false, 
    split_part(u.email, '@', 1), -- Nome fallback
    now()
  FROM target_user u
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'owner', -- Forza upgrade
        updated_at = now()
  RETURNING user_id
),
-- 2. Crea token invito
create_invite AS (
  INSERT INTO public.shop_invites (token, created_by, expires_at)
  SELECT
    encode(gen_random_bytes(16), 'hex'), -- Genera token
    (SELECT email FROM target_user),    -- Traccia chi ha creato (l'utente stesso in questo caso auto-gen)
    now() + INTERVAL '7 days'
  FROM target_user -- Esegue solo se utente esiste
  RETURNING token
)
-- 3. Output finale
SELECT 
  u.email as admin_email,
  i.token,
  p.base_url || '/setup?token=' || i.token AS CLICCA_QUI_PER_SETUP
FROM target_user u
CROSS JOIN params p
JOIN create_invite i ON true;


### RENDI amministratore

UPDATE public.profiles
SET role = 'owner', is_platform_admin = true
WHERE email = 'salone@abruzzo.ai';

### 🎁 SCRIPT: REGALA 1 MESE GRATIS
Questo script estende (o attiva) l'abbonamento del negozio associato a quella mail per 30 giorni.

WITH target_shop AS (
  SELECT p.shop_id
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE u.email = 'salone@abruzzo.ai' -- <--- 📧 CAMBIA EMAIL QUI
  LIMIT 1
)
INSERT INTO public.shop_subscriptions (
    shop_id,
    stripe_customer_id,
    stripe_subscription_id,
    status,
    plan,
    current_period_start,
    current_period_end,
    cancel_at_period_end
)
SELECT 
    shop_id,
    'manual_gift',
    'gift_' || gen_random_uuid(),
    'active',
    'monthly',
    now(),
    now() + INTERVAL '30 days', -- Scade tra 30 giorni
    false
FROM target_shop
WHERE shop_id IS NOT NULL
ON CONFLICT (shop_id) DO UPDATE SET
    status = 'active',
    -- Estende di 30 giorni dalla data attuale o dalla scadenza corrente se futura
    current_period_end = GREATEST(shop_subscriptions.current_period_end, now()) + INTERVAL '30 days',
    updated_at = now();