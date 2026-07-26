import {
  centsToMoney,
  findOrCreateCommerceCustomer,
  loadCheckoutOffer,
  loadCommerceConfig,
  normalizeBrazilPhone,
  type CheckoutBumpRow,
} from './checkout'
import {
  assertMercadoPagoCredentialEnvironment,
  classifyMercadoPagoCredential,
  createMercadoPagoPixPayment,
  extractMercadoPagoPixData,
  getMercadoPagoCurrentUser,
  getMercadoPagoPayment,
  getMercadoPagoPaymentMethod,
  mercadoPagoAmountToCents,
  normalizeMercadoPagoPaymentStatus,
} from './mercado-pago'
import { fulfillApprovedOrder, mapPaymentStatusToOrderStatus } from './fulfillment'

type SupabaseAdminLike = {
  from: (table: string) => any
}

type DiagnosticStatus = 'ok' | 'warn' | 'error'

type DiagnosticItem = {
  key: string
  label: string
  status: DiagnosticStatus
  detail: string
}

const REQUIRED_TEMPLATE_KEYS = [
  'checkout_pix_generated',
  'checkout_payment_pending',
  'checkout_abandoned',
  'checkout_payment_pending_email',
  'checkout_abandoned_email',
  'checkout_pix_expiring',
  'checkout_pix_expiring_email',
  'checkout_pix_expired',
  'checkout_pix_expired_email',
  'member_first_access_whatsapp',
  'member_first_access_email',
]

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function hostFromUrl(value: string) {
  try {
    return new URL(value).host
  } catch {
    return ''
  }
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function credentialKindLabel(kind: ReturnType<typeof classifyMercadoPagoCredential>) {
  if (kind === 'test') return 'teste'
  if (kind === 'production') return 'produção'
  if (kind === 'unknown') return 'formato não identificado'
  return 'ausente'
}

function mercadoPagoCredentialEnvironmentStatus(params: {
  environment: 'sandbox' | 'production'
  accessToken: string
}) {
  const kind = classifyMercadoPagoCredential(params.accessToken)
  const mismatch = (params.environment === 'sandbox' && kind === 'production')
    || (params.environment === 'production' && kind === 'test')

  return {
    kind,
    mismatch,
    status: !params.accessToken ? 'error' as DiagnosticStatus : mismatch ? 'error' as DiagnosticStatus : kind === 'unknown' ? 'warn' as DiagnosticStatus : 'ok' as DiagnosticStatus,
  }
}

function buildActivationState(params: {
  config: Awaited<ReturnType<typeof loadCommerceConfig>>
  activeOffer: any
}) {
  const { config, activeOffer } = params
  const tokenStatus = mercadoPagoCredentialEnvironmentStatus({
    environment: config.mercadoPagoEnvironment,
    accessToken: config.mercadoPagoAccessToken,
  })
  const publicKeyKind = classifyMercadoPagoCredential(config.mercadoPagoPublicKey)
  const webhookOk = isHttpsUrl(config.mercadoPagoWebhookUrl) && config.mercadoPagoWebhookUrl.includes('/api/webhooks/mercadopago')
  const missing: string[] = []
  const nextSteps: string[] = []

  if (!config.mercadoPagoEnabled) {
    missing.push('Ativar integração Mercado Pago')
    nextSteps.push('Na Sala de Manutenção, marque Mercado Pago como Ativo.')
  }
  if (!config.mercadoPagoAccessToken) {
    missing.push('Access Token')
    nextSteps.push('Cole o Access Token de teste do vendedor para o sandbox.')
  }
  if (tokenStatus.mismatch) {
    missing.push('Credencial compatível com o ambiente')
    nextSteps.push('Use credencial TEST no sandbox e credencial de produção somente em produção.')
  }
  if (!webhookOk) {
    missing.push('Webhook HTTPS do Mercado Pago')
    nextSteps.push('Configure a Webhook URL como https://guilhermepilger.ai/api/webhooks/mercadopago.')
  }
  if (!activeOffer) {
    missing.push('Oferta ativa com checkout')
    nextSteps.push('Mantenha ao menos uma oferta ativa com checkout_path.')
  }
  if (!config.mercadoPagoWebhookSecret) {
    nextSteps.push('Cole o Webhook Secret para validar a assinatura x-signature nas notificações.')
  }
  if (!config.mercadoPagoPublicKey) {
    nextSteps.push('Cole também a Public Key da mesma aplicação para manter o painel completo.')
  }

  return {
    ready_for_sandbox_pix: config.mercadoPagoEnvironment === 'sandbox'
      && config.mercadoPagoEnabled
      && Boolean(config.mercadoPagoAccessToken)
      && !tokenStatus.mismatch
      && webhookOk
      && Boolean(activeOffer),
    ready_for_production: config.mercadoPagoEnvironment === 'production'
      && config.mercadoPagoEnabled
      && Boolean(config.mercadoPagoAccessToken)
      && !tokenStatus.mismatch
      && Boolean(config.mercadoPagoWebhookSecret)
      && webhookOk
      && Boolean(activeOffer),
    missing,
    next_steps: Array.from(new Set(nextSteps)),
    credential_summary: {
      public_key_configured: Boolean(config.mercadoPagoPublicKey),
      public_key_kind: publicKeyKind,
      access_token_configured: Boolean(config.mercadoPagoAccessToken),
      access_token_kind: tokenStatus.kind,
      webhook_secret_configured: Boolean(config.mercadoPagoWebhookSecret),
    },
  }
}

function selectedBumps(allBumps: CheckoutBumpRow[], selectedIds: unknown) {
  const ids = new Set(Array.isArray(selectedIds) ? selectedIds.map(String) : [])
  return allBumps.filter((bump) => ids.has(bump.id))
}

function sumCents(items: Array<{ price_cents: number }>) {
  return items.reduce((total, item) => total + Math.max(0, Number(item.price_cents) || 0), 0)
}

function health(items: DiagnosticItem[]) {
  if (items.some((item) => item.status === 'error')) return 'error'
  if (items.some((item) => item.status === 'warn')) return 'warn'
  return 'ok'
}

async function loadTemplateStatus(supabase: SupabaseAdminLike) {
  const { data, error } = await supabase
    .from('message_templates')
    .select('template_key, channel, is_active')
    .eq('business_unit', 'education')
    .in('template_key', REQUIRED_TEMPLATE_KEYS)

  if (error) throw error

  const activeKeys = new Set((data || []).filter((row: any) => row.is_active !== false).map((row: any) => text(row.template_key)))
  const missing = REQUIRED_TEMPLATE_KEYS.filter((key) => !activeKeys.has(key))
  return {
    found: activeKeys.size,
    required: REQUIRED_TEMPLATE_KEYS.length,
    missing,
  }
}

async function loadActiveOffer(supabase: SupabaseAdminLike) {
  const { data, error } = await supabase
    .from('commerce_offers')
    .select('id, slug, name, price_cents, checkout_path, status')
    .eq('status', 'active')
    .not('checkout_path', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function resolveDiagnosticCheckout(
  supabase: SupabaseAdminLike,
  input: { checkoutSlug?: string } = {}
) {
  const selectedOffer = input.checkoutSlug
    ? await loadCheckoutOffer(input.checkoutSlug.replace(/^\/?checkout\//, ''))
    : null
  const activeOffer = selectedOffer
    ? null
    : await loadActiveOffer(supabase)
  const checkoutSlug = selectedOffer
    ? input.checkoutSlug!.replace(/^\/?checkout\//, '')
    : text(activeOffer?.checkout_path).replace(/^\/?checkout\//, '')

  if (!checkoutSlug) throw new Error('Nenhuma oferta ativa com checkout foi encontrada.')

  const checkout = selectedOffer || await loadCheckoutOffer(checkoutSlug)
  if (!checkout) throw new Error('Oferta de checkout indisponível.')

  return { checkout, checkoutSlug }
}

async function loadLatestDiagnosticOrder(supabase: SupabaseAdminLike) {
  const { data, error } = await supabase
    .from('commerce_orders')
    .select('id, order_number, status, payment_provider, total_cents, paid_at, created_at, updated_at, metadata')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throw error

  const order = (data || []).find((row: any) => objectRecord(row.metadata).diagnostic_test === true)
  if (!order) return null

  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    payment_provider: order.payment_provider,
    total_cents: Number(order.total_cents || 0),
    total_display: centsToMoney(Number(order.total_cents || 0)),
    paid_at: order.paid_at || null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  }
}

async function loadCronState(supabase: SupabaseAdminLike) {
  const keys = [
    'commerce_automation_cron_last_checked_at',
    'commerce_automation_cron_last_run_at',
    'commerce_automation_cron_last_reason',
    'commerce_automation_cron_last_error',
    'commerce_automation_cron_last_error_at',
  ]
  const { data, error } = await supabase.from('app_config').select('key, value').in('key', keys)
  if (error) throw error

  return Object.fromEntries((data || []).map((row: any) => [row.key, row.value || '']))
}

async function loadRecentPaymentSignals(supabase: SupabaseAdminLike) {
  const [paymentsRes, eventsRes] = await Promise.all([
    supabase
      .from('commerce_payments')
      .select('id, status, provider_payment_id, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('commerce_payment_events')
      .select('id, event_type, resource_id, signature_valid, processing_status, received_at, error_message')
      .order('received_at', { ascending: false })
      .limit(5),
  ])

  const error = paymentsRes.error || eventsRes.error
  if (error) throw error

  return {
    payments: paymentsRes.data || [],
    events: eventsRes.data || [],
  }
}

export async function runCommerceDiagnostics(
  supabase: SupabaseAdminLike,
  options: { checkMercadoPagoConnection?: boolean } = {}
) {
  const config = await loadCommerceConfig()
  const [templates, activeOffer, cronState, recentSignals, latestDiagnosticOrder] = await Promise.all([
    loadTemplateStatus(supabase),
    loadActiveOffer(supabase),
    loadCronState(supabase),
    loadRecentPaymentSignals(supabase),
    loadLatestDiagnosticOrder(supabase),
  ])

  const webhookHost = hostFromUrl(config.mercadoPagoWebhookUrl)
  const expectedHost = hostFromUrl(process.env.NEXT_PUBLIC_SITE_URL || 'https://guilhermepilger.ai')
  const credentialStatus = mercadoPagoCredentialEnvironmentStatus({
    environment: config.mercadoPagoEnvironment,
    accessToken: config.mercadoPagoAccessToken,
  })
  const publicKeyKind = classifyMercadoPagoCredential(config.mercadoPagoPublicKey)
  const activation = buildActivationState({ config, activeOffer })
  let remoteMercadoPago: Record<string, any> | null = null
  let remoteMercadoPagoError = ''

  if (options.checkMercadoPagoConnection && config.mercadoPagoAccessToken) {
    try {
      const user = await getMercadoPagoCurrentUser(config.mercadoPagoAccessToken)
      remoteMercadoPago = {
        id: user.id || null,
        nickname: user.nickname || '',
        site_id: user.site_id || '',
        country_id: user.country_id || '',
      }
    } catch (error) {
      remoteMercadoPagoError = error instanceof Error ? error.message : String(error)
    }
  }

  const items: DiagnosticItem[] = [
    {
      key: 'mercado_pago_enabled',
      label: 'Mercado Pago ativo',
      status: config.mercadoPagoEnabled ? 'ok' : 'error',
      detail: config.mercadoPagoEnabled ? 'Checkout liberado na configuração.' : 'Ative o Mercado Pago na Sala de Manutenção.',
    },
    {
      key: 'mercado_pago_environment',
      label: 'Ambiente de pagamento',
      status: config.mercadoPagoEnvironment === 'sandbox' ? 'ok' : 'warn',
      detail: config.mercadoPagoEnvironment === 'sandbox'
        ? 'Ambiente sandbox pronto para testes controlados.'
        : 'Ambiente em produção. Teste real de sandbox fica bloqueado.',
    },
    {
      key: 'mercado_pago_access_token',
      label: 'Access Token',
      status: config.mercadoPagoAccessToken ? (remoteMercadoPagoError ? 'error' : 'ok') : 'error',
      detail: config.mercadoPagoAccessToken
        ? (remoteMercadoPagoError || (remoteMercadoPago ? `Conectado ao usuário ${remoteMercadoPago.nickname || remoteMercadoPago.id}.` : 'Token configurado. Rode o teste de conexão para validar.'))
        : 'Access Token ausente.',
    },
    {
      key: 'mercado_pago_public_key',
      label: 'Public Key',
      status: config.mercadoPagoPublicKey ? 'ok' : 'warn',
      detail: config.mercadoPagoPublicKey
        ? `Public Key configurada (${credentialKindLabel(publicKeyKind)}).`
        : 'Public Key ausente. O Pix server-side usa o Access Token, mas a ativação fica incompleta.',
    },
    {
      key: 'mercado_pago_credential_environment',
      label: 'Credencial x ambiente',
      status: credentialStatus.status,
      detail: credentialStatus.mismatch
        ? `Ambiente ${config.mercadoPagoEnvironment} com credencial de ${credentialKindLabel(credentialStatus.kind)}.`
        : config.mercadoPagoAccessToken
          ? `Access Token identificado como ${credentialKindLabel(credentialStatus.kind)}.`
          : 'Configure o Access Token antes de gerar Pix real.',
    },
    {
      key: 'mercado_pago_webhook_url',
      label: 'Webhook HTTPS',
      status: isHttpsUrl(config.mercadoPagoWebhookUrl) && config.mercadoPagoWebhookUrl.includes('/api/webhooks/mercadopago')
        ? (expectedHost && webhookHost !== expectedHost ? 'warn' : 'ok')
        : 'error',
      detail: config.mercadoPagoWebhookUrl || 'Webhook URL ausente.',
    },
    {
      key: 'mercado_pago_webhook_secret',
      label: 'Webhook Secret',
      status: config.mercadoPagoWebhookSecret ? 'ok' : 'warn',
      detail: config.mercadoPagoWebhookSecret ? 'Assinatura HMAC será exigida nos webhooks.' : 'Sem segredo, o webhook aceita eventos sem validação HMAC.',
    },
    {
      key: 'commerce_templates',
      label: 'Templates transacionais',
      status: templates.missing.length ? 'error' : 'ok',
      detail: templates.missing.length
        ? `Faltando: ${templates.missing.join(', ')}`
        : `${templates.found}/${templates.required} templates ativos.`,
    },
    {
      key: 'active_offer',
      label: 'Oferta ativa com checkout',
      status: activeOffer ? 'ok' : 'error',
      detail: activeOffer
        ? `${activeOffer.name || activeOffer.slug} (${centsToMoney(Number(activeOffer.price_cents || 0))})`
        : 'Nenhuma oferta ativa com checkout_path.',
    },
    {
      key: 'commerce_automation',
      label: 'Automação comercial',
      status: config.automationEnabled ? 'ok' : 'warn',
      detail: config.automationEnabled
        ? `Carrinho ${config.checkoutAbandonedAfterMinutes} min, Pix pendente ${config.pixPendingAfterMinutes} min.`
        : 'Automação comercial desligada.',
    },
    {
      key: 'commerce_cron',
      label: 'Cron de recuperação',
      status: cronState.commerce_automation_cron_last_error ? 'error' : cronState.commerce_automation_cron_last_checked_at ? 'ok' : 'warn',
      detail: cronState.commerce_automation_cron_last_error
        ? cronState.commerce_automation_cron_last_error
        : cronState.commerce_automation_cron_last_checked_at || 'Cron ainda não registrou execução.',
    },
  ]

  return {
    success: true,
    health: health(items),
    checked_at: new Date().toISOString(),
    items,
    config: {
      mercado_pago_environment: config.mercadoPagoEnvironment,
      webhook_url: config.mercadoPagoWebhookUrl,
      mercado_pago_public_key_configured: Boolean(config.mercadoPagoPublicKey),
      mercado_pago_public_key_kind: publicKeyKind,
      mercado_pago_access_token_kind: credentialStatus.kind,
      whatsapp_enabled: config.whatsappNotificationsEnabled,
      email_enabled: config.emailNotificationsEnabled,
      automation_enabled: config.automationEnabled,
    },
    activation,
    templates,
    active_offer: activeOffer,
    latest_diagnostic_order: latestDiagnosticOrder,
    cron_state: cronState,
    recent_signals: recentSignals,
    remote_mercado_pago: remoteMercadoPago,
  }
}

export async function createSandboxDiagnosticPix(
  supabase: SupabaseAdminLike,
  input: { checkoutSlug?: string; selectedBumpIds?: string[] } = {}
) {
  const config = await loadCommerceConfig()
  if (!config.mercadoPagoEnabled || !config.mercadoPagoAccessToken) {
    throw new Error('Mercado Pago não está ativo ou não tem Access Token.')
  }
  if (config.mercadoPagoEnvironment !== 'sandbox') {
    throw new Error('Pix de diagnóstico só pode ser criado no ambiente sandbox.')
  }

  const selectedOffer = input.checkoutSlug
    ? await loadCheckoutOffer(input.checkoutSlug.replace(/^\/?checkout\//, ''))
    : null
  const activeOffer = selectedOffer
    ? null
    : await loadActiveOffer(supabase)
  const checkoutSlug = selectedOffer
    ? input.checkoutSlug!.replace(/^\/?checkout\//, '')
    : text(activeOffer?.checkout_path).replace(/^\/?checkout\//, '')

  if (!checkoutSlug) throw new Error('Nenhuma oferta ativa com checkout foi encontrada.')

  const checkout = selectedOffer || await loadCheckoutOffer(checkoutSlug)
  if (!checkout) throw new Error('Oferta de checkout indisponível.')

  assertMercadoPagoCredentialEnvironment({
    environment: config.mercadoPagoEnvironment,
    accessToken: config.mercadoPagoAccessToken,
  })

  const now = new Date()
  const suffix = now.getTime()
  const customer = await findOrCreateCommerceCustomer({
    name: 'Cliente Diagnóstico Sandbox',
    email: `diagnostico+${suffix}@guilhermepilger.ai`,
    phone: '47999999999',
    document: '12345678909',
    whatsappOptIn: false,
    emailOptIn: false,
  }, 'admin_sandbox_diagnostic')

  const selected = selectedBumps(checkout.bumps, input.selectedBumpIds)
  const bumpTotalCents = sumCents(selected)
  const subtotalCents = checkout.offer.price_cents
  const totalCents = subtotalCents + bumpTotalCents
  const checkoutSessionId = crypto.randomUUID()
  const pixExpiresAt = new Date(now.getTime() + config.mercadoPagoPixExpirationMinutes * 60 * 1000).toISOString()
  const checkoutUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://guilhermepilger.ai').replace(/\/$/, '')}${checkout.offer.checkout_path || `/checkout/${checkoutSlug}`}`

  const { data: lead, error: leadError } = await supabase
    .from('education_leads')
    .insert([{
      customer_id: customer.id,
      landing_page_id: checkout.offer.landing_page_id,
      product_id: checkout.product.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      phone_e164: normalizeBrazilPhone(customer.phone),
      document: customer.document || null,
      lead_stage: 'pix_generated',
      source: 'admin_sandbox_diagnostic',
      acquired_via: 'diagnostic_pix',
      consent: { whatsapp: false, email: false },
      metadata: {
        diagnostic_test: true,
        checkout_session_id: checkoutSessionId,
        checkout_url: checkoutUrl,
      },
      last_activity_at: now.toISOString(),
    }])
    .select()
    .single()

  if (leadError) throw leadError

  const { data: order, error: orderError } = await supabase
    .from('commerce_orders')
    .insert([{
      customer_id: customer.id,
      education_lead_id: lead.id,
      offer_id: checkout.offer.id,
      landing_page_id: checkout.offer.landing_page_id,
      status: 'checkout_started',
      currency: checkout.offer.currency,
      subtotal_cents: subtotalCents,
      bump_total_cents: bumpTotalCents,
      total_cents: totalCents,
      payment_provider: 'mercado_pago',
      checkout_session_id: checkoutSessionId,
      pix_expires_at: pixExpiresAt,
      recovery_status: 'cancelled',
      metadata: {
        diagnostic_test: true,
        checkout_url: checkoutUrl,
        product_slug: checkout.product.slug,
        offer_slug: checkout.offer.slug,
        payment_environment: 'sandbox',
        notification_preferences: { whatsapp: false, email: false },
      },
    }])
    .select()
    .single()

  if (orderError) throw orderError

  const items = [
    {
      order_id: order.id,
      product_id: checkout.product.id,
      offer_id: checkout.offer.id,
      item_type: 'primary',
      title_snapshot: checkout.product.title,
      quantity: 1,
      unit_amount_cents: checkout.offer.price_cents,
      total_amount_cents: checkout.offer.price_cents,
      metadata: { diagnostic_test: true, offer_slug: checkout.offer.slug },
    },
    ...selected.map((bump) => ({
      order_id: order.id,
      product_id: bump.bump_product_id,
      offer_id: bump.bump_offer_id,
      item_type: 'order_bump',
      title_snapshot: bump.title,
      quantity: 1,
      unit_amount_cents: bump.price_cents,
      total_amount_cents: bump.price_cents,
      metadata: { diagnostic_test: true, order_bump_id: bump.id },
    })),
  ]

  const { error: itemsError } = await supabase.from('commerce_order_items').insert(items)
  if (itemsError) throw itemsError

  const remotePayment = await createMercadoPagoPixPayment({
    accessToken: config.mercadoPagoAccessToken,
    idempotencyKey: `diagnostic-${order.id}`,
    amountCents: totalCents,
    description: `Diagnostico sandbox - ${checkout.product.title}`.slice(0, 255),
    payer: {
      name: customer.name,
      email: customer.email,
      document: customer.document,
    },
    externalReference: order.id,
    notificationUrl: config.mercadoPagoWebhookUrl,
    metadata: {
      diagnostic_test: true,
      order_id: order.id,
      product_slug: checkout.product.slug,
      checkout_session_id: checkoutSessionId,
    },
  })

  const pix = extractMercadoPagoPixData(remotePayment)
  const paymentStatus = normalizeMercadoPagoPaymentStatus(remotePayment.status)
  const providerPaymentId = text(remotePayment.id)

  const { data: payment, error: paymentError } = await supabase
    .from('commerce_payments')
    .insert([{
      order_id: order.id,
      customer_id: customer.id,
      provider: 'mercado_pago',
      provider_payment_id: providerPaymentId || null,
      provider_order_id: remotePayment.order?.id ? String(remotePayment.order.id) : null,
      status: paymentStatus,
      status_detail: text(remotePayment.status_detail),
      payment_method: getMercadoPagoPaymentMethod(remotePayment.payment_method_id),
      installments: Number.isFinite(Number(remotePayment.installments)) ? Number(remotePayment.installments) : null,
      amount_cents: mercadoPagoAmountToCents(remotePayment.transaction_amount) || totalCents,
      currency: checkout.offer.currency,
      pix_qr_code: pix.qrCode || null,
      pix_qr_code_base64: pix.qrCodeBase64 || null,
      pix_ticket_url: pix.ticketUrl || null,
      paid_at: remotePayment.date_approved || null,
      expires_at: pixExpiresAt,
      raw_payload: remotePayment,
    }])
    .select()
    .single()

  if (paymentError) throw paymentError

  await supabase
    .from('commerce_orders')
    .update({
      status: paymentStatus === 'approved' ? 'paid' : 'pending_payment',
      provider_order_id: providerPaymentId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  return {
    success: true,
    diagnostic_test: true,
    order: {
      id: order.id,
      order_number: order.order_number,
      status: paymentStatus === 'approved' ? 'paid' : 'pending_payment',
      total_cents: totalCents,
      total_display: centsToMoney(totalCents),
      checkout_url: checkoutUrl,
      pix_expires_at: pixExpiresAt,
    },
    payment: {
      id: payment.id,
      provider_payment_id: providerPaymentId,
      status: paymentStatus,
      pix_qr_code: pix.qrCode,
      pix_qr_code_base64: pix.qrCodeBase64,
      pix_ticket_url: pix.ticketUrl,
      expires_at: pixExpiresAt,
    },
  }
}

export async function syncSandboxDiagnosticPayment(
  supabase: SupabaseAdminLike,
  input: { orderId?: string; paymentId?: string } = {}
) {
  const config = await loadCommerceConfig()
  if (!config.mercadoPagoEnabled || !config.mercadoPagoAccessToken) {
    throw new Error('Mercado Pago não está ativo ou não tem Access Token.')
  }
  if (config.mercadoPagoEnvironment !== 'sandbox') {
    throw new Error('A consulta de Pix sandbox só roda quando o ambiente está em sandbox.')
  }
  assertMercadoPagoCredentialEnvironment({
    environment: config.mercadoPagoEnvironment,
    accessToken: config.mercadoPagoAccessToken,
  })

  const latestDiagnosticOrder = input.orderId ? null : await loadLatestDiagnosticOrder(supabase)
  const orderId = text(input.orderId || latestDiagnosticOrder?.id)
  if (!orderId) throw new Error('Nenhum pedido sandbox de diagnóstico foi encontrado.')

  const { data: order, error: orderError } = await supabase
    .from('commerce_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) throw orderError
  if (!order) throw new Error('Pedido sandbox não encontrado.')
  if (objectRecord(order.metadata).diagnostic_test !== true || order.payment_provider !== 'mercado_pago') {
    throw new Error('A sincronização sandbox só aceita pedidos diagnósticos criados pelo Mercado Pago.')
  }

  const paymentQuery = supabase
    .from('commerce_payments')
    .select('*')
    .eq('provider', 'mercado_pago')

  const { data: payment, error: paymentError } = input.paymentId
    ? await paymentQuery.eq('id', input.paymentId).maybeSingle()
    : await paymentQuery.eq('order_id', order.id).order('updated_at', { ascending: false }).limit(1).maybeSingle()

  if (paymentError) throw paymentError
  if (!payment?.provider_payment_id) throw new Error('Pagamento Mercado Pago não encontrado para este pedido.')

  const remotePayment = await getMercadoPagoPayment(config.mercadoPagoAccessToken, payment.provider_payment_id)
  const pix = extractMercadoPagoPixData(remotePayment)
  const paymentStatus = normalizeMercadoPagoPaymentStatus(remotePayment.status)
  const orderStatus = mapPaymentStatusToOrderStatus(paymentStatus, text(remotePayment.status_detail))
  const paidAt = paymentStatus === 'approved'
    ? (remotePayment.date_approved || payment.paid_at || new Date().toISOString())
    : order.paid_at
  const now = new Date().toISOString()

  const { data: updatedPayment, error: updatePaymentError } = await supabase
    .from('commerce_payments')
    .update({
      status: paymentStatus,
      status_detail: text(remotePayment.status_detail),
      payment_method: getMercadoPagoPaymentMethod(remotePayment.payment_method_id),
      installments: Number.isFinite(Number(remotePayment.installments)) ? Number(remotePayment.installments) : null,
      amount_cents: mercadoPagoAmountToCents(remotePayment.transaction_amount) || payment.amount_cents || order.total_cents,
      pix_qr_code: pix.qrCode || payment.pix_qr_code || null,
      pix_qr_code_base64: pix.qrCodeBase64 || payment.pix_qr_code_base64 || null,
      pix_ticket_url: pix.ticketUrl || payment.pix_ticket_url || null,
      paid_at: paymentStatus === 'approved' ? paidAt : payment.paid_at,
      raw_payload: remotePayment,
      updated_at: now,
    })
    .eq('id', payment.id)
    .select()
    .single()

  if (updatePaymentError) throw updatePaymentError

  const { error: updateOrderError } = await supabase
    .from('commerce_orders')
    .update({
      status: orderStatus,
      paid_at: orderStatus === 'paid' ? paidAt : order.paid_at,
      cancelled_at: orderStatus === 'cancelled' ? now : order.cancelled_at,
      recovery_status: orderStatus === 'paid' ? 'cancelled' : order.recovery_status,
      updated_at: now,
      metadata: {
        ...objectRecord(order.metadata),
        sandbox_status_checked_at: now,
        last_mercado_pago_status: paymentStatus,
        last_mercado_pago_status_detail: text(remotePayment.status_detail),
      },
    })
    .eq('id', order.id)

  if (updateOrderError) throw updateOrderError

  let fulfillment = null
  if (paymentStatus === 'approved') {
    fulfillment = await fulfillApprovedOrder({
      supabase,
      orderId: order.id,
      paymentId: updatedPayment.id,
      source: 'admin_sandbox_diagnostic_sync',
      remotePayment,
      suppressNotifications: true,
      suppressAuthAccess: true,
    })
  }

  return {
    success: true,
    diagnostic_test: true,
    order: {
      id: order.id,
      order_number: order.order_number,
      status: orderStatus,
      total_cents: Number(order.total_cents || 0),
      total_display: centsToMoney(Number(order.total_cents || 0)),
      paid_at: orderStatus === 'paid' ? paidAt : null,
      created_at: order.created_at,
    },
    payment: {
      id: updatedPayment.id,
      provider_payment_id: updatedPayment.provider_payment_id,
      status: paymentStatus,
      status_detail: text(remotePayment.status_detail),
      pix_qr_code: pix.qrCode || updatedPayment.pix_qr_code || '',
      pix_qr_code_base64: pix.qrCodeBase64 || updatedPayment.pix_qr_code_base64 || '',
      pix_ticket_url: pix.ticketUrl || updatedPayment.pix_ticket_url || null,
      paid_at: paymentStatus === 'approved' ? paidAt : null,
      expires_at: updatedPayment.expires_at || order.pix_expires_at || null,
    },
    fulfillment,
    entitlements_count: fulfillment?.entitlements_count || 0,
    notifications_suppressed: Boolean(fulfillment),
    auth_access_suppressed: Boolean(fulfillment),
  }
}

export async function createInternalDiagnosticOrder(
  supabase: SupabaseAdminLike,
  input: { checkoutSlug?: string; selectedBumpIds?: string[] } = {}
) {
  const config = await loadCommerceConfig()
  const { checkout, checkoutSlug } = await resolveDiagnosticCheckout(supabase, input)

  const now = new Date()
  const suffix = now.getTime()
  const customer = await findOrCreateCommerceCustomer({
    name: 'Cliente Diagnóstico Interno',
    email: `diagnostico-interno+${suffix}@guilhermepilger.ai`,
    phone: '47999999999',
    document: '12345678909',
    whatsappOptIn: false,
    emailOptIn: false,
  }, 'admin_internal_diagnostic')

  const selected = selectedBumps(checkout.bumps, input.selectedBumpIds)
  const bumpTotalCents = sumCents(selected)
  const subtotalCents = checkout.offer.price_cents
  const totalCents = subtotalCents + bumpTotalCents
  const checkoutSessionId = crypto.randomUUID()
  const pixExpiresAt = new Date(now.getTime() + config.mercadoPagoPixExpirationMinutes * 60 * 1000).toISOString()
  const checkoutUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://guilhermepilger.ai').replace(/\/$/, '')}${checkout.offer.checkout_path || `/checkout/${checkoutSlug}`}`

  const { data: lead, error: leadError } = await supabase
    .from('education_leads')
    .insert([{
      customer_id: customer.id,
      landing_page_id: checkout.offer.landing_page_id,
      product_id: checkout.product.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      phone_e164: normalizeBrazilPhone(customer.phone),
      document: customer.document || null,
      lead_stage: 'payment_pending',
      source: 'admin_internal_diagnostic',
      acquired_via: 'internal_diagnostic_order',
      consent: { whatsapp: false, email: false },
      metadata: {
        diagnostic_test: true,
        checkout_session_id: checkoutSessionId,
        checkout_url: checkoutUrl,
        notification_preferences: { whatsapp: false, email: false },
      },
      last_activity_at: now.toISOString(),
    }])
    .select()
    .single()

  if (leadError) throw leadError

  const { data: order, error: orderError } = await supabase
    .from('commerce_orders')
    .insert([{
      customer_id: customer.id,
      education_lead_id: lead.id,
      offer_id: checkout.offer.id,
      landing_page_id: checkout.offer.landing_page_id,
      status: 'pending_payment',
      currency: checkout.offer.currency,
      subtotal_cents: subtotalCents,
      bump_total_cents: bumpTotalCents,
      total_cents: totalCents,
      payment_provider: 'diagnostic',
      checkout_session_id: checkoutSessionId,
      pix_expires_at: pixExpiresAt,
      recovery_status: 'cancelled',
      metadata: {
        diagnostic_test: true,
        checkout_url: checkoutUrl,
        product_slug: checkout.product.slug,
        offer_slug: checkout.offer.slug,
        payment_environment: 'internal',
        notification_preferences: { whatsapp: false, email: false },
      },
    }])
    .select()
    .single()

  if (orderError) throw orderError

  const items = [
    {
      order_id: order.id,
      product_id: checkout.product.id,
      offer_id: checkout.offer.id,
      item_type: 'primary',
      title_snapshot: checkout.product.title,
      quantity: 1,
      unit_amount_cents: checkout.offer.price_cents,
      total_amount_cents: checkout.offer.price_cents,
      metadata: { diagnostic_test: true, offer_slug: checkout.offer.slug },
    },
    ...selected.map((bump) => ({
      order_id: order.id,
      product_id: bump.bump_product_id,
      offer_id: bump.bump_offer_id,
      item_type: 'order_bump',
      title_snapshot: bump.title,
      quantity: 1,
      unit_amount_cents: bump.price_cents,
      total_amount_cents: bump.price_cents,
      metadata: { diagnostic_test: true, order_bump_id: bump.id },
    })),
  ]

  const { error: itemsError } = await supabase.from('commerce_order_items').insert(items)
  if (itemsError) throw itemsError

  const providerPaymentId = `diagnostic-${order.id}`
  const { data: payment, error: paymentError } = await supabase
    .from('commerce_payments')
    .insert([{
      order_id: order.id,
      customer_id: customer.id,
      provider: 'diagnostic',
      provider_payment_id: providerPaymentId,
      status: 'pending',
      status_detail: 'internal_diagnostic_pending',
      payment_method: 'pix',
      amount_cents: totalCents,
      currency: checkout.offer.currency,
      expires_at: pixExpiresAt,
      raw_payload: {
        diagnostic_test: true,
        source: 'admin_internal_diagnostic',
        checkout_session_id: checkoutSessionId,
      },
    }])
    .select()
    .single()

  if (paymentError) throw paymentError

  await supabase
    .from('commerce_orders')
    .update({
      provider_order_id: providerPaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  return {
    success: true,
    diagnostic_test: true,
    order: {
      id: order.id,
      order_number: order.order_number,
      status: 'pending_payment',
      total_cents: totalCents,
      total_display: centsToMoney(totalCents),
      checkout_url: checkoutUrl,
      pix_expires_at: pixExpiresAt,
      created_at: order.created_at,
    },
    payment: {
      id: payment.id,
      provider_payment_id: providerPaymentId,
      status: 'pending',
      expires_at: pixExpiresAt,
    },
  }
}

export async function approveInternalDiagnosticOrder(
  supabase: SupabaseAdminLike,
  input: { orderId?: string } = {}
) {
  const latestDiagnosticOrder = input.orderId ? null : await loadLatestDiagnosticOrder(supabase)
  const orderId = text(input.orderId || latestDiagnosticOrder?.id)
  if (!orderId) throw new Error('Crie um pedido diagnóstico interno antes de simular o pagamento.')

  const { data: order, error: orderError } = await supabase
    .from('commerce_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) throw orderError
  if (!order) throw new Error('Pedido diagnóstico não encontrado.')
  if (objectRecord(order.metadata).diagnostic_test !== true) {
    throw new Error('A simulação só pode aprovar pedidos marcados como diagnóstico.')
  }

  const now = new Date().toISOString()
  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from('commerce_payments')
    .select('*')
    .eq('order_id', order.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingPaymentError) throw existingPaymentError

  const paymentPayload = {
    status: 'approved',
    status_detail: 'internal_diagnostic_approved',
    paid_at: existingPayment?.paid_at || now,
    raw_payload: {
      ...objectRecord(existingPayment?.raw_payload),
      diagnostic_test: true,
      source: 'admin_internal_diagnostic',
      approved_at: now,
    },
    updated_at: now,
  }

  const payment = existingPayment
    ? await supabase
        .from('commerce_payments')
        .update(paymentPayload)
        .eq('id', existingPayment.id)
        .select()
        .single()
        .then((result: any) => {
          if (result.error) throw result.error
          return result.data
        })
    : await supabase
        .from('commerce_payments')
        .insert([{
          order_id: order.id,
          customer_id: order.customer_id,
          provider: 'diagnostic',
          provider_payment_id: `diagnostic-${order.id}`,
          payment_method: 'pix',
          amount_cents: Number(order.total_cents || 0),
          currency: order.currency || 'BRL',
          ...paymentPayload,
        }])
        .select()
        .single()
        .then((result: any) => {
          if (result.error) throw result.error
          return result.data
        })

  const paidAt = order.paid_at || payment.paid_at || now
  const { error: paidOrderError } = await supabase
    .from('commerce_orders')
    .update({
      status: 'paid',
      paid_at: paidAt,
      recovery_status: 'cancelled',
      updated_at: now,
      metadata: {
        ...objectRecord(order.metadata),
        diagnostic_approved_at: now,
        payment_simulation: 'approved',
      },
    })
    .eq('id', order.id)

  if (paidOrderError) throw paidOrderError

  const fulfillment = await fulfillApprovedOrder({
    supabase,
    orderId: order.id,
    paymentId: payment.id,
    source: 'admin_internal_diagnostic',
    remotePayment: {
      id: payment.provider_payment_id,
      status: 'approved',
      external_reference: order.id,
      diagnostic_test: true,
    },
    suppressNotifications: true,
    suppressAuthAccess: true,
  })

  const { count: entitlementsCount, error: entitlementsError } = await supabase
    .from('member_entitlements')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id)

  if (entitlementsError) throw entitlementsError

  return {
    success: true,
    diagnostic_test: true,
    order: {
      id: order.id,
      order_number: order.order_number,
      status: 'paid',
      total_cents: Number(order.total_cents || 0),
      total_display: centsToMoney(Number(order.total_cents || 0)),
      paid_at: paidAt,
      created_at: order.created_at,
    },
    payment: {
      id: payment.id,
      provider_payment_id: payment.provider_payment_id,
      status: 'approved',
      paid_at: payment.paid_at || paidAt,
    },
    fulfillment,
    entitlements_count: entitlementsCount ?? fulfillment.entitlements_count,
    notifications_suppressed: true,
    auth_access_suppressed: true,
  }
}
