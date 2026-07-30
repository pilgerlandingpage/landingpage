ALTER TABLE public.commerce_payments
  DROP CONSTRAINT IF EXISTS commerce_payments_payment_method_check;

ALTER TABLE public.commerce_payments
  ADD CONSTRAINT commerce_payments_payment_method_check
  CHECK (payment_method IN (
    'pix',
    'credit_card',
    'debit_card',
    'boleto',
    'account_money',
    'subscription',
    'unknown'
  ));

CREATE TABLE IF NOT EXISTS public.commerce_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.commerce_products(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES public.commerce_offers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'mercado_pago',
  provider_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'authorized',
      'active',
      'paused',
      'cancelled',
      'expired',
      'rejected'
    )),
  payment_method TEXT NOT NULL DEFAULT 'unknown'
    CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'account_money', 'unknown')),
  billing_frequency INTEGER NOT NULL DEFAULT 1 CHECK (billing_frequency > 0),
  billing_frequency_type TEXT NOT NULL DEFAULT 'months'
    CHECK (billing_frequency_type IN ('days', 'weeks', 'months', 'years')),
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  starts_at TIMESTAMPTZ,
  next_payment_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  init_point TEXT,
  sandbox_init_point TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_subscriptions_provider_subscription
  ON public.commerce_subscriptions(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_subscriptions_customer
  ON public.commerce_subscriptions(customer_id, status, updated_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_subscriptions_order
  ON public.commerce_subscriptions(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_subscriptions_status
  ON public.commerce_subscriptions(status, next_payment_at DESC);

ALTER TABLE public.commerce_orders
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.commerce_subscriptions(id) ON DELETE SET NULL;

ALTER TABLE public.commerce_payments
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.commerce_subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_subscription
  ON public.commerce_orders(subscription_id)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_payments_subscription
  ON public.commerce_payments(subscription_id, created_at DESC)
  WHERE subscription_id IS NOT NULL;

DROP TRIGGER IF EXISTS commerce_subscriptions_updated_at ON public.commerce_subscriptions;
CREATE TRIGGER commerce_subscriptions_updated_at
BEFORE UPDATE ON public.commerce_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

ALTER TABLE public.commerce_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'commerce_subscriptions'
      AND policyname = 'service_role_full_access_commerce_subscriptions'
  ) THEN
    CREATE POLICY service_role_full_access_commerce_subscriptions
      ON public.commerce_subscriptions
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

INSERT INTO public.app_config (key, value, updated_at)
VALUES
  ('commerce_card_payments_enabled', 'true', now()),
  ('commerce_subscription_payments_enabled', 'true', now()),
  ('commerce_subscription_default_frequency', '1', now()),
  ('commerce_subscription_default_frequency_type', 'months', now())
ON CONFLICT (key) DO NOTHING;
