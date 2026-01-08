-- ============================================
-- Stripe Subscription System for Poltrona
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing objects if they exist (for clean re-run)
DROP TABLE IF EXISTS subscription_invoices CASCADE;
DROP TABLE IF EXISTS shop_subscriptions CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS subscription_plan CASCADE;
DROP TYPE IF EXISTS invoice_status CASCADE;

-- Create enum types
CREATE TYPE subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired'
);

CREATE TYPE subscription_plan AS ENUM ('monthly', 'yearly');

CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- ============================================
-- shop_subscriptions table
-- ============================================
CREATE TABLE shop_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  status subscription_status NOT NULL DEFAULT 'trialing',
  plan subscription_plan,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one active subscription per shop
  CONSTRAINT unique_shop_subscription UNIQUE (shop_id)
);

-- Create index for faster lookups
CREATE INDEX idx_shop_subscriptions_shop_id ON shop_subscriptions(shop_id);
CREATE INDEX idx_shop_subscriptions_stripe_customer_id ON shop_subscriptions(stripe_customer_id);
CREATE INDEX idx_shop_subscriptions_status ON shop_subscriptions(status);

-- ============================================
-- subscription_invoices table
-- ============================================
CREATE TABLE subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES shop_subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status invoice_status NOT NULL DEFAULT 'open',
  invoice_pdf TEXT,
  hosted_invoice_url TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_subscription_invoices_shop_id ON subscription_invoices(shop_id);
CREATE INDEX idx_subscription_invoices_subscription_id ON subscription_invoices(subscription_id);

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE shop_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

-- shop_subscriptions policies
-- Users can view their own shop's subscription
CREATE POLICY "Users can view own shop subscription"
  ON shop_subscriptions FOR SELECT
  USING (
    shop_id IN (
      SELECT shops.id FROM shops
      JOIN profiles ON profiles.shop_id = shops.id
      WHERE profiles.user_id = auth.uid()
    )
  );

-- Only service role can insert/update (via Edge Functions)
CREATE POLICY "Service role can manage subscriptions"
  ON shop_subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- subscription_invoices policies
-- Users can view their own shop's invoices
CREATE POLICY "Users can view own shop invoices"
  ON subscription_invoices FOR SELECT
  USING (
    shop_id IN (
      SELECT shops.id FROM shops
      JOIN profiles ON profiles.shop_id = shops.id
      WHERE profiles.user_id = auth.uid()
    )
  );

-- Only service role can insert/update (via Edge Functions)
CREATE POLICY "Service role can manage invoices"
  ON subscription_invoices FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- Function to check if shop has active subscription
-- ============================================
CREATE OR REPLACE FUNCTION has_active_subscription(p_shop_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_sub RECORD;
BEGIN
  SELECT status, current_period_end, trial_end
  INTO v_sub
  FROM shop_subscriptions
  WHERE shop_id = p_shop_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Active or trialing are valid
  IF v_sub.status IN ('active', 'trialing') THEN
    -- Check if period hasn't ended
    IF v_sub.status = 'trialing' AND v_sub.trial_end IS NOT NULL THEN
      RETURN v_sub.trial_end > now();
    END IF;
    IF v_sub.current_period_end IS NOT NULL THEN
      RETURN v_sub.current_period_end > now();
    END IF;
    RETURN true;
  END IF;
  
  -- Past due gives a grace period (still accessible)
  IF v_sub.status = 'past_due' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Trigger to update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_timestamp
  BEFORE UPDATE ON shop_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT ON shop_subscriptions TO authenticated;
GRANT SELECT ON subscription_invoices TO authenticated;
GRANT ALL ON shop_subscriptions TO service_role;
GRANT ALL ON subscription_invoices TO service_role;
