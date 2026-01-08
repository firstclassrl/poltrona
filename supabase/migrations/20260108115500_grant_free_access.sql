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
) VALUES
(
    '2475d034-be73-4aef-8f31-db8f6ca79691',
    'manual_free_tier',
    'manual_sub_' || gen_random_uuid()::text,
    'active',
    'yearly',
    now(),
    '2099-12-31 23:59:59+00',
    false,
    NULL
),
(
    'b94a4e6c-ec3a-43b0-b841-01b433ea106a',
    'manual_free_tier',
    'manual_sub_' || gen_random_uuid()::text,
    'active',
    'yearly',
    now(),
    '2099-12-31 23:59:59+00',
    false,
    NULL
)
ON CONFLICT (shop_id) DO UPDATE SET
    status = 'active',
    plan = 'yearly',
    current_period_end = '2099-12-31 23:59:59+00',
    stripe_customer_id = 'manual_free_tier',
    updated_at = now();
