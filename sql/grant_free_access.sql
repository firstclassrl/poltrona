-- ================================================================
-- Grant Free Lifetime Access to a Shop
-- ================================================================

-- 1. Find the Shop ID for your store
-- Run this first to see your shops:
-- SELECT id, name, created_at FROM shops;

-- 2. Insert or Update the subscription to be "Active" forever
-- Replace 'YOUR_SHOP_ID_HERE' with the actual UUID of the shop you want to give free access to.

INSERT INTO shop_subscriptions (
    shop_id,
    stripe_customer_id,
    stripe_subscription_id,
    status,
    plan,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    trial_end
) VALUES (
    'YOUR_SHOP_ID_HERE',       -- <--- REPLACE THIS ID
    'manual_free_tier',        -- Placeholder for Stripe Customer ID
    'manual_sub_' || gen_random_uuid()::text,
    'active',
    'yearly',                  -- 'monthly' or 'yearly'
    now(),
    '2099-12-31 23:59:59+00', -- Expires in year 2099
    false,
    NULL
)
ON CONFLICT (shop_id) DO UPDATE SET
    status = 'active',
    plan = 'yearly',
    current_period_end = '2099-12-31 23:59:59+00',
    stripe_customer_id = 'manual_free_tier',
    updated_at = now();
