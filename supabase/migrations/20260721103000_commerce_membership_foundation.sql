-- Foundation for Pilger digital commerce, education CRM, member area and
-- centralized transactional messaging.

CREATE TABLE IF NOT EXISTS public.commerce_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  phone_e164 TEXT,
  document TEXT,
  document_type TEXT CHECK (document_type IN ('cpf', 'cnpj', 'other')),
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
  email_opt_in BOOLEAN NOT NULL DEFAULT true,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_customers_auth_user
  ON public.commerce_customers(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_customers_email
  ON public.commerce_customers(lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_customers_phone_e164
  ON public.commerce_customers(phone_e164)
  WHERE phone_e164 IS NOT NULL AND btrim(phone_e164) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_customers_document
  ON public.commerce_customers(document)
  WHERE document IS NOT NULL AND btrim(document) <> '';

CREATE TABLE IF NOT EXISTS public.commerce_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  product_type TEXT NOT NULL DEFAULT 'course'
    CHECK (product_type IN ('ebook', 'course', 'mentorship', 'bundle', 'digital_download')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'hidden', 'archived')),
  access_model TEXT NOT NULL DEFAULT 'lifetime'
    CHECK (access_model IN ('lifetime', 'limited_time', 'subscription')),
  cover_image_url TEXT,
  thumbnail_url TEXT,
  sales_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commerce_products_status
  ON public.commerce_products(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.commerce_product_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.commerce_product_contents(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'lesson'
    CHECK (content_type IN ('module', 'lesson', 'video', 'pdf', 'ebook', 'bonus', 'external_link')),
  title TEXT NOT NULL,
  description TEXT,
  body TEXT,
  asset_url TEXT,
  asset_storage_path TEXT,
  duration_seconds INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commerce_product_contents_product
  ON public.commerce_product_contents(product_id, position, created_at);

CREATE INDEX IF NOT EXISTS idx_commerce_product_contents_parent
  ON public.commerce_product_contents(parent_id, position)
  WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  landing_page_id UUID REFERENCES public.landing_pages(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  checkout_path TEXT,
  payment_methods TEXT[] NOT NULL DEFAULT ARRAY['pix']::TEXT[],
  max_installments INTEGER NOT NULL DEFAULT 1 CHECK (max_installments >= 1),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commerce_offers_product
  ON public.commerce_offers(product_id, status);

CREATE TABLE IF NOT EXISTS public.commerce_order_bumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.commerce_offers(id) ON DELETE CASCADE,
  bump_product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  bump_offer_id UUID REFERENCES public.commerce_offers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_bumps_offer
  ON public.commerce_order_bumps(offer_id, is_active, position);

CREATE TABLE IF NOT EXISTS public.commerce_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'expired', 'archived')),
  discount_type TEXT NOT NULL
    CHECK (discount_type IN ('fixed_amount', 'percentage')),
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  percentage NUMERIC(5,2) CHECK (percentage IS NULL OR (percentage > 0 AND percentage <= 100)),
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions >= 0),
  redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  product_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_coupons_code
  ON public.commerce_coupons(lower(code));

CREATE TABLE IF NOT EXISTS public.education_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  landing_page_id UUID REFERENCES public.landing_pages(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.commerce_products(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  phone_e164 TEXT,
  document TEXT,
  lead_stage TEXT NOT NULL DEFAULT 'new'
    CHECK (lead_stage IN (
      'new',
      'checkout_started',
      'pix_generated',
      'payment_pending',
      'abandoned',
      'purchased',
      'access_granted',
      'student_active',
      'upsell',
      'lost'
    )),
  lead_score INTEGER NOT NULL DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  source TEXT,
  acquired_via TEXT,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_education_leads_stage
  ON public.education_leads(lead_stage, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_education_leads_customer
  ON public.education_leads(customer_id, updated_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_education_leads_phone
  ON public.education_leads(phone_e164, updated_at DESC)
  WHERE phone_e164 IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL DEFAULT ('PED-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))) UNIQUE,
  customer_id UUID REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  education_lead_id UUID REFERENCES public.education_leads(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES public.commerce_offers(id) ON DELETE SET NULL,
  landing_page_id UUID REFERENCES public.landing_pages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'checkout_started'
    CHECK (status IN (
      'checkout_started',
      'pending_payment',
      'paid',
      'abandoned',
      'cancelled',
      'expired',
      'refunded',
      'chargeback'
    )),
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  bump_total_cents INTEGER NOT NULL DEFAULT 0 CHECK (bump_total_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  coupon_id UUID REFERENCES public.commerce_coupons(id) ON DELETE SET NULL,
  payment_provider TEXT NOT NULL DEFAULT 'mercado_pago',
  provider_order_id TEXT,
  provider_preference_id TEXT,
  checkout_session_id TEXT,
  pix_expires_at TIMESTAMPTZ,
  recovery_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (recovery_status IN ('not_started', 'scheduled', 'active', 'recovered', 'lost', 'cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_customer
  ON public.commerce_orders(customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_education_lead
  ON public.commerce_orders(education_lead_id, created_at DESC)
  WHERE education_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_status
  ON public.commerce_orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_provider_order
  ON public.commerce_orders(payment_provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.commerce_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.commerce_products(id) ON DELETE SET NULL,
  offer_id UUID REFERENCES public.commerce_offers(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'primary'
    CHECK (item_type IN ('primary', 'order_bump', 'upsell', 'manual')),
  title_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_amount_cents >= 0),
  total_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_items_order
  ON public.commerce_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_commerce_order_items_product
  ON public.commerce_order_items(product_id, created_at DESC)
  WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'mercado_pago',
  provider_payment_id TEXT,
  provider_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'approved',
      'authorized',
      'in_process',
      'in_mediation',
      'rejected',
      'cancelled',
      'refunded',
      'charged_back'
    )),
  status_detail TEXT,
  payment_method TEXT NOT NULL DEFAULT 'pix'
    CHECK (payment_method IN ('pix', 'credit_card', 'boleto', 'unknown')),
  installments INTEGER,
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  pix_qr_code TEXT,
  pix_qr_code_base64 TEXT,
  pix_ticket_url TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_payments_provider_payment
  ON public.commerce_payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_payments_order
  ON public.commerce_payments(order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_payments_status
  ON public.commerce_payments(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.commerce_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'mercado_pago',
  event_id TEXT,
  event_type TEXT,
  action TEXT,
  resource_id TEXT,
  payment_id UUID REFERENCES public.commerce_payments(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  signature_valid BOOLEAN,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerce_payment_events_provider_event
  ON public.commerce_payment_events(provider, event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_payment_events_resource
  ON public.commerce_payment_events(provider, resource_id, received_at DESC)
  WHERE resource_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_payment_events_status
  ON public.commerce_payment_events(processing_status, received_at DESC);

CREATE TABLE IF NOT EXISTS public.member_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  email TEXT,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending_setup', 'blocked', 'archived')),
  last_login_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_member_accounts_auth_user
  ON public.member_accounts(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_member_accounts_customer
  ON public.member_accounts(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_member_accounts_email
  ON public.member_accounts(lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE TABLE IF NOT EXISTS public.member_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_account_id UUID REFERENCES public.member_accounts(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES public.commerce_order_items(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  access_starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_expires_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_entitlements_member
  ON public.member_entitlements(member_account_id, status)
  WHERE member_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_entitlements_customer
  ON public.member_entitlements(customer_id, status)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_entitlements_product
  ON public.member_entitlements(product_id, status);

CREATE TABLE IF NOT EXISTS public.member_content_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_account_id UUID NOT NULL REFERENCES public.member_accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.commerce_products(id) ON DELETE CASCADE,
  product_content_id UUID NOT NULL REFERENCES public.commerce_product_contents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_position_seconds INTEGER,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_account_id, product_content_id)
);

CREATE INDEX IF NOT EXISTS idx_member_content_progress_product
  ON public.member_content_progress(product_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  business_unit TEXT NOT NULL DEFAULT 'education'
    CHECK (business_unit IN ('real_estate', 'education', 'global')),
  channel TEXT NOT NULL
    CHECK (channel IN ('whatsapp', 'email')),
  event_type TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_opt_in BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_message_templates_unit_channel_key
  ON public.message_templates(business_unit, channel, template_key);

CREATE INDEX IF NOT EXISTS idx_message_templates_event
  ON public.message_templates(business_unit, event_type, is_active);

CREATE TABLE IF NOT EXISTS public.message_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  business_unit TEXT NOT NULL DEFAULT 'education'
    CHECK (business_unit IN ('real_estate', 'education', 'global')),
  channel TEXT NOT NULL
    CHECK (channel IN ('whatsapp', 'email')),
  sender_agent TEXT NOT NULL DEFAULT 'whatsapp-global-agent',
  whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.commerce_customers(id) ON DELETE SET NULL,
  education_lead_id UUID REFERENCES public.education_leads(id) ON DELETE SET NULL,
  real_estate_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.commerce_payments(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'skipped')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_dispatches_status
  ON public.message_dispatches(status, scheduled_for, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_dispatches_order
  ON public.message_dispatches(order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_dispatches_education_lead
  ON public.message_dispatches(education_lead_id, created_at DESC)
  WHERE education_lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.commerce_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('system', 'admin', 'customer', 'webhook')),
  actor_id TEXT,
  message TEXT,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commerce_audit_logs_entity
  ON public.commerce_audit_logs(entity_type, entity_id, created_at DESC)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commerce_audit_logs_action
  ON public.commerce_audit_logs(action, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_commerce_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commerce_customers_updated_at ON public.commerce_customers;
CREATE TRIGGER commerce_customers_updated_at
BEFORE UPDATE ON public.commerce_customers
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS commerce_products_updated_at ON public.commerce_products;
CREATE TRIGGER commerce_products_updated_at
BEFORE UPDATE ON public.commerce_products
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS commerce_product_contents_updated_at ON public.commerce_product_contents;
CREATE TRIGGER commerce_product_contents_updated_at
BEFORE UPDATE ON public.commerce_product_contents
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS commerce_offers_updated_at ON public.commerce_offers;
CREATE TRIGGER commerce_offers_updated_at
BEFORE UPDATE ON public.commerce_offers
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS commerce_order_bumps_updated_at ON public.commerce_order_bumps;
CREATE TRIGGER commerce_order_bumps_updated_at
BEFORE UPDATE ON public.commerce_order_bumps
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS commerce_coupons_updated_at ON public.commerce_coupons;
CREATE TRIGGER commerce_coupons_updated_at
BEFORE UPDATE ON public.commerce_coupons
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS education_leads_updated_at ON public.education_leads;
CREATE TRIGGER education_leads_updated_at
BEFORE UPDATE ON public.education_leads
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS commerce_orders_updated_at ON public.commerce_orders;
CREATE TRIGGER commerce_orders_updated_at
BEFORE UPDATE ON public.commerce_orders
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS commerce_payments_updated_at ON public.commerce_payments;
CREATE TRIGGER commerce_payments_updated_at
BEFORE UPDATE ON public.commerce_payments
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS member_accounts_updated_at ON public.member_accounts;
CREATE TRIGGER member_accounts_updated_at
BEFORE UPDATE ON public.member_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS member_entitlements_updated_at ON public.member_entitlements;
CREATE TRIGGER member_entitlements_updated_at
BEFORE UPDATE ON public.member_entitlements
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS member_content_progress_updated_at ON public.member_content_progress;
CREATE TRIGGER member_content_progress_updated_at
BEFORE UPDATE ON public.member_content_progress
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS message_templates_updated_at ON public.message_templates;
CREATE TRIGGER message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DROP TRIGGER IF EXISTS message_dispatches_updated_at ON public.message_dispatches;
CREATE TRIGGER message_dispatches_updated_at
BEFORE UPDATE ON public.message_dispatches
FOR EACH ROW EXECUTE FUNCTION public.update_commerce_updated_at();

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'commerce_customers',
    'commerce_products',
    'commerce_product_contents',
    'commerce_offers',
    'commerce_order_bumps',
    'commerce_coupons',
    'education_leads',
    'commerce_orders',
    'commerce_order_items',
    'commerce_payments',
    'commerce_payment_events',
    'member_accounts',
    'member_entitlements',
    'member_content_progress',
    'message_templates',
    'message_dispatches',
    'commerce_audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = 'service_role_full_access_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
        'service_role_full_access_' || tbl,
        tbl
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO public.commerce_products (
  slug,
  title,
  subtitle,
  description,
  product_type,
  status,
  access_model,
  cover_image_url,
  thumbnail_url,
  sales_content,
  metadata
) VALUES (
  'corretor-nota-8',
  'Corretor Nota 8',
  'Posicionamento, método e disciplina para vender imóveis de alto padrão',
  'Livro digital de Guilherme Pilger para corretores que querem organizar postura, método comercial e disciplina.',
  'ebook',
  'active',
  'lifetime',
  '/images/products/corretor-nota-8-cover.webp',
  '/images/products/corretor-nota-8-cover.webp',
  jsonb_build_object('landing_slug', 'corretor-nota-8', 'author', 'Guilherme Pilger'),
  jsonb_build_object('seeded_by', '20260721103000_commerce_membership_foundation')
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  product_type = EXCLUDED.product_type,
  status = EXCLUDED.status,
  access_model = EXCLUDED.access_model,
  cover_image_url = EXCLUDED.cover_image_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  sales_content = public.commerce_products.sales_content || EXCLUDED.sales_content,
  metadata = public.commerce_products.metadata || EXCLUDED.metadata,
  updated_at = now();

INSERT INTO public.commerce_offers (
  product_id,
  landing_page_id,
  slug,
  name,
  description,
  status,
  price_cents,
  currency,
  checkout_path,
  payment_methods,
  metadata
)
SELECT
  p.id,
  lp.id,
  'corretor-nota-8-principal',
  'Oferta principal Corretor Nota 8',
  'Oferta de lançamento do livro digital Corretor Nota 8.',
  'active',
  9700,
  'BRL',
  '/checkout/corretor-nota-8',
  ARRAY['pix']::TEXT[],
  jsonb_build_object('seeded_by', '20260721103000_commerce_membership_foundation')
FROM public.commerce_products p
LEFT JOIN public.landing_pages lp ON lp.slug = 'corretor-nota-8'
WHERE p.slug = 'corretor-nota-8'
ON CONFLICT (slug) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  landing_page_id = EXCLUDED.landing_page_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  checkout_path = EXCLUDED.checkout_path,
  payment_methods = EXCLUDED.payment_methods,
  metadata = public.commerce_offers.metadata || EXCLUDED.metadata,
  updated_at = now();

INSERT INTO public.message_templates (
  template_key,
  business_unit,
  channel,
  event_type,
  name,
  subject,
  body,
  variables,
  requires_opt_in,
  metadata
) VALUES
  (
    'checkout_pix_generated',
    'education',
    'whatsapp',
    'payment.pix_generated',
    'Pix gerado',
    NULL,
    'Oi {nome}, seu Pix para acessar {produto} foi gerado. Valor: {valor}. Copie e cole: {pix_copia_cola}. Assim que o pagamento for aprovado, liberamos seu acesso.',
    '["nome","produto","valor","pix_copia_cola"]'::jsonb,
    true,
    '{"sender_agent":"whatsapp-global-agent"}'::jsonb
  ),
  (
    'checkout_payment_pending',
    'education',
    'whatsapp',
    'payment.pending',
    'Pagamento pendente',
    NULL,
    'Oi {nome}, seu pagamento de {produto} ainda está pendente. Se quiser concluir agora, use este link: {checkout_url}.',
    '["nome","produto","checkout_url"]'::jsonb,
    true,
    '{"sender_agent":"whatsapp-global-agent"}'::jsonb
  ),
  (
    'checkout_abandoned',
    'education',
    'whatsapp',
    'checkout.abandoned',
    'Checkout abandonado',
    NULL,
    'Oi {nome}, vi que você começou a compra de {produto}, mas não finalizou. Posso te mandar o link para continuar? {checkout_url}',
    '["nome","produto","checkout_url"]'::jsonb,
    true,
    '{"sender_agent":"whatsapp-global-agent"}'::jsonb
  ),
  (
    'purchase_approved_access_released',
    'education',
    'whatsapp',
    'payment.approved',
    'Compra aprovada e acesso liberado',
    NULL,
    'Pagamento aprovado, {nome}. Seu acesso ao {produto} foi liberado. Entre pela área de membros: {member_area_url}',
    '["nome","produto","member_area_url"]'::jsonb,
    true,
    '{"sender_agent":"whatsapp-global-agent"}'::jsonb
  ),
  (
    'purchase_approved_email',
    'education',
    'email',
    'payment.approved',
    'E-mail de compra aprovada',
    'Seu acesso ao {produto} foi liberado',
    'Olá, {nome}. Seu pagamento foi aprovado e seu acesso ao {produto} já está disponível. Acesse: {member_area_url}',
    '["nome","produto","member_area_url"]'::jsonb,
    false,
    '{"provider":"brevo"}'::jsonb
  ),
  (
    'password_recovery_email',
    'education',
    'email',
    'member.password_recovery',
    'Recuperação de senha',
    'Recupere seu acesso à área de membros',
    'Olá, {nome}. Para recuperar seu acesso à área de membros, use este link: {recovery_url}',
    '["nome","recovery_url"]'::jsonb,
    false,
    '{"provider":"brevo"}'::jsonb
  )
ON CONFLICT (business_unit, channel, template_key) DO UPDATE SET
  event_type = EXCLUDED.event_type,
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  requires_opt_in = EXCLUDED.requires_opt_in,
  metadata = public.message_templates.metadata || EXCLUDED.metadata,
  updated_at = now();

COMMENT ON TABLE public.education_leads IS
  'CRM separado para corretores, alunos e compradores de produtos digitais. Nao substitui o CRM imobiliario.';

COMMENT ON TABLE public.message_dispatches IS
  'Fila central de envios transacionais. WhatsApp deve sair pelo WhatsApp Global; e-mail deve usar provedor transacional.';
