type SupabaseAdminLike = {
  from: (table: string) => any
}

export type CommerceOfficialWhatsAppTemplate = {
  templateKey: string
  name: string
  eventType: string
  internalBody: string
  variables: string[]
  requiresOptIn: boolean
  meta: {
    templateName: string
    language: string
    category: 'UTILITY'
    bodyText: string
    bodyVariables: string[]
    bodyExamples: string[]
    footerText: string
  }
}

const DRAFT_CONFIG_KEY = 'meta_whatsapp_template_drafts'
const LANGUAGE = 'pt_BR'
const FOOTER = 'Guilherme Pilger'

function nowIso() {
  return new Date().toISOString()
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function metaBody(text: string, variables: string[], examples: string[]) {
  return {
    type: 'BODY',
    text,
    example: {
      body_text: [variables.map((_, index) => examples[index] || `exemplo_${index + 1}`)],
    },
  }
}

function metaComponents(template: CommerceOfficialWhatsAppTemplate) {
  return [
    metaBody(template.meta.bodyText, template.meta.bodyVariables, template.meta.bodyExamples),
    { type: 'FOOTER', text: template.meta.footerText },
  ]
}

function metaForm(template: CommerceOfficialWhatsAppTemplate) {
  return {
    name: template.meta.templateName,
    language: template.meta.language,
    category: template.meta.category,
    headerFormat: 'NONE',
    headerText: '',
    headerExample: '',
    headerMediaHandle: '',
    bodyText: template.meta.bodyText,
    bodyExamples: template.meta.bodyExamples.join('; '),
    footerText: template.meta.footerText,
    buttons: [],
    messageSendTtlSeconds: '',
  }
}

export const OFFICIAL_COMMERCE_WHATSAPP_TEMPLATES: CommerceOfficialWhatsAppTemplate[] = [
  {
    templateKey: 'checkout_started_whatsapp',
    name: 'Checkout iniciado',
    eventType: 'payment.checkout_started',
    internalBody: 'Oi {nome}, recebemos seus dados para a compra do {produto}. Seu pedido {numero_pedido} foi iniciado. Para continuar o pagamento com seguranca, acesse: {checkout_url}',
    variables: ['nome', 'produto', 'numero_pedido', 'checkout_url'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_checkout_started',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, recebemos seus dados para a compra do {{2}}. Seu pedido {{3}} foi iniciado. Para continuar o pagamento com seguranca, acesse: {{4}}',
      bodyVariables: ['nome', 'produto', 'numero_pedido', 'checkout_url'],
      bodyExamples: ['Maria', 'Corretor Nota 8', 'PED-123ABC', 'https://guilhermepilger.ai/checkout/corretor-nota-8'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'checkout_pix_generated',
    name: 'Pix gerado',
    eventType: 'payment.pix_generated',
    internalBody: 'Oi {nome}, seu Pix para o {produto} foi gerado. Valor: {valor}. Ele vence em {pix_expira_em}. Para ver o QR Code ou copiar o Pix, acesse: {checkout_url}',
    variables: ['nome', 'produto', 'valor', 'pix_expira_em', 'checkout_url'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_pix_generated',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, seu Pix para o {{2}} foi gerado. Valor: {{3}}. Ele vence em {{4}}. Para ver o QR Code ou copiar o Pix, acesse: {{5}}',
      bodyVariables: ['nome', 'produto', 'valor', 'pix_expira_em', 'checkout_url'],
      bodyExamples: ['Maria', 'Corretor Nota 8', 'R$ 97,00', '30/07/2026 15:45', 'https://guilhermepilger.ai/checkout/corretor-nota-8'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'checkout_payment_pending',
    name: 'Pagamento pendente',
    eventType: 'payment.pending',
    internalBody: 'Oi {nome}, seu pagamento do {produto} ainda esta pendente. Assim que o Mercado Pago confirmar, seu acesso sera liberado automaticamente. Pedido: {numero_pedido}',
    variables: ['nome', 'produto', 'numero_pedido'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_payment_pending',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, seu pagamento do {{2}} ainda esta pendente. Assim que o Mercado Pago confirmar, seu acesso sera liberado automaticamente. Pedido: {{3}}',
      bodyVariables: ['nome', 'produto', 'numero_pedido'],
      bodyExamples: ['Maria', 'Corretor Nota 8', 'PED-123ABC'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'checkout_payment_processing',
    name: 'Pagamento em processamento',
    eventType: 'payment.processing',
    internalBody: 'Oi {nome}, recebemos sua tentativa de pagamento do {produto} e ela esta em analise pelo Mercado Pago. Avisaremos assim que houver uma atualizacao.',
    variables: ['nome', 'produto'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_payment_processing',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, recebemos sua tentativa de pagamento do {{2}} e ela esta em analise pelo Mercado Pago. Avisaremos assim que houver uma atualizacao.',
      bodyVariables: ['nome', 'produto'],
      bodyExamples: ['Maria', 'Corretor Nota 8'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'member_first_access_whatsapp',
    name: 'Primeiro acesso liberado',
    eventType: 'member.first_access',
    internalBody: 'Pagamento aprovado, {nome}. Parabens pela compra do {produto}. Seu acesso ja foi liberado. Entre na area de membros por aqui: {access_link}',
    variables: ['nome', 'produto', 'access_link'],
    requiresOptIn: false,
    meta: {
      templateName: 'pilger_first_access_released',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Pagamento aprovado, {{1}}. Parabens pela compra do {{2}}. Seu acesso ja foi liberado. Entre na area de membros por aqui: {{3}}',
      bodyVariables: ['nome', 'produto', 'access_link'],
      bodyExamples: ['Maria', 'Corretor Nota 8', 'https://guilhermepilger.ai/auth/continue?flow=first_access'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'purchase_approved_access_released',
    name: 'Compra aprovada e acesso liberado',
    eventType: 'payment.approved',
    internalBody: 'Pagamento aprovado, {nome}. Seu acesso ao {produto} foi liberado. Entre pela area de membros: {member_area_url}',
    variables: ['nome', 'produto', 'member_area_url'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_payment_approved_access',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Pagamento aprovado, {{1}}. Seu acesso ao {{2}} foi liberado. Entre pela area de membros: {{3}}',
      bodyVariables: ['nome', 'produto', 'member_area_url'],
      bodyExamples: ['Maria', 'Corretor Nota 8', 'https://guilhermepilger.ai/membros'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'checkout_payment_rejected',
    name: 'Pagamento recusado',
    eventType: 'payment.rejected',
    internalBody: 'Oi {nome}, o pagamento do {produto} foi recusado pelo Mercado Pago. Voce pode tentar novamente com outro meio de pagamento por aqui: {checkout_url}',
    variables: ['nome', 'produto', 'checkout_url'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_payment_rejected',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, o pagamento do {{2}} foi recusado pelo Mercado Pago. Voce pode tentar novamente com outro meio de pagamento por aqui: {{3}}',
      bodyVariables: ['nome', 'produto', 'checkout_url'],
      bodyExamples: ['Maria', 'Corretor Nota 8', 'https://guilhermepilger.ai/checkout/corretor-nota-8'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'checkout_payment_cancelled',
    name: 'Pagamento cancelado',
    eventType: 'payment.cancelled',
    internalBody: 'Oi {nome}, o pagamento do pedido {numero_pedido} foi cancelado. Se quiser continuar, gere um novo pagamento com seguranca por aqui: {checkout_url}',
    variables: ['nome', 'numero_pedido', 'checkout_url'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_payment_cancelled',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, o pagamento do pedido {{2}} foi cancelado. Se quiser continuar, gere um novo pagamento com seguranca por aqui: {{3}}',
      bodyVariables: ['nome', 'numero_pedido', 'checkout_url'],
      bodyExamples: ['Maria', 'PED-123ABC', 'https://guilhermepilger.ai/checkout/corretor-nota-8'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'checkout_pix_expiring',
    name: 'Pix perto de vencer',
    eventType: 'payment.pix_expiring',
    internalBody: 'Oi {nome}, seu Pix do pedido {numero_pedido} vence em breve. Para concluir a compra do {produto}, acesse: {checkout_url}',
    variables: ['nome', 'numero_pedido', 'produto', 'checkout_url'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_pix_expiring',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, seu Pix do pedido {{2}} vence em breve. Para concluir a compra do {{3}}, acesse: {{4}}',
      bodyVariables: ['nome', 'numero_pedido', 'produto', 'checkout_url'],
      bodyExamples: ['Maria', 'PED-123ABC', 'Corretor Nota 8', 'https://guilhermepilger.ai/checkout/corretor-nota-8'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'checkout_pix_expired',
    name: 'Pix vencido',
    eventType: 'payment.pix_expired',
    internalBody: 'Oi {nome}, o Pix do pedido {numero_pedido} venceu. Para concluir a compra do {produto}, gere um novo pagamento por aqui: {checkout_url}',
    variables: ['nome', 'numero_pedido', 'produto', 'checkout_url'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_pix_expired',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, o Pix do pedido {{2}} venceu. Para concluir a compra do {{3}}, gere um novo pagamento por aqui: {{4}}',
      bodyVariables: ['nome', 'numero_pedido', 'produto', 'checkout_url'],
      bodyExamples: ['Maria', 'PED-123ABC', 'Corretor Nota 8', 'https://guilhermepilger.ai/checkout/corretor-nota-8'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'checkout_payment_refunded',
    name: 'Pagamento reembolsado',
    eventType: 'payment.refunded',
    internalBody: 'Oi {nome}, o pagamento do pedido {numero_pedido} foi marcado como reembolsado. Se precisar de suporte, responda esta mensagem.',
    variables: ['nome', 'numero_pedido'],
    requiresOptIn: true,
    meta: {
      templateName: 'pilger_payment_refunded',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, o pagamento do pedido {{2}} foi marcado como reembolsado. Se precisar de suporte, responda esta mensagem.',
      bodyVariables: ['nome', 'numero_pedido'],
      bodyExamples: ['Maria', 'PED-123ABC'],
      footerText: FOOTER,
    },
  },
  {
    templateKey: 'checkout_payment_chargeback',
    name: 'Pagamento contestado',
    eventType: 'payment.chargeback',
    internalBody: 'Oi {nome}, o pagamento do pedido {numero_pedido} foi contestado no Mercado Pago. Nossa equipe vai revisar o acesso. Se foi engano, responda esta mensagem.',
    variables: ['nome', 'numero_pedido'],
    requiresOptIn: false,
    meta: {
      templateName: 'pilger_payment_chargeback',
      language: LANGUAGE,
      category: 'UTILITY',
      bodyText: 'Oi {{1}}, o pagamento do pedido {{2}} foi contestado no Mercado Pago. Nossa equipe vai revisar o acesso. Se foi engano, responda esta mensagem.',
      bodyVariables: ['nome', 'numero_pedido'],
      bodyExamples: ['Maria', 'PED-123ABC'],
      footerText: FOOTER,
    },
  },
]

export const OFFICIAL_COMMERCE_WHATSAPP_TEMPLATE_KEYS = OFFICIAL_COMMERCE_WHATSAPP_TEMPLATES.map(template => template.templateKey)

export function commerceOfficialWhatsAppDraft(template: CommerceOfficialWhatsAppTemplate, createdAt = nowIso()) {
  return {
    id: `commerce_${template.templateKey}`,
    name: template.meta.templateName,
    language: template.meta.language,
    category: template.meta.category,
    components: metaComponents(template),
    form: metaForm(template),
    created_at: createdAt,
    updated_at: nowIso(),
  }
}

async function readMetaDrafts(supabase: SupabaseAdminLike) {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', DRAFT_CONFIG_KEY)
    .maybeSingle()

  if (error) throw error
  try {
    const parsed = JSON.parse(String(data?.value || '[]'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function upsertCommerceOfficialWhatsAppTemplates(supabase: SupabaseAdminLike) {
  const now = nowIso()
  const rows = OFFICIAL_COMMERCE_WHATSAPP_TEMPLATES.map(template => ({
    template_key: template.templateKey,
    business_unit: 'education',
    channel: 'whatsapp',
    event_type: template.eventType,
    name: template.name,
    subject: null,
    body: template.internalBody,
    variables: template.variables,
    requires_opt_in: template.requiresOptIn,
    is_active: true,
    metadata: {
      sender_agent: 'whatsapp-global-agent',
      provider: 'meta_whatsapp',
      source: 'commerce_official_whatsapp_templates',
      meta_whatsapp: {
        template_name: template.meta.templateName,
        template_language: template.meta.language,
        category: template.meta.category,
        body_variables: template.meta.bodyVariables,
        draft_components: metaComponents(template),
        example_values: template.meta.bodyExamples,
      },
    },
  }))

  const { error: templateError } = await supabase
    .from('message_templates')
    .upsert(rows, { onConflict: 'business_unit,channel,template_key' })
  if (templateError) throw templateError

  const existingDrafts = await readMetaDrafts(supabase)
  const existingById = new Map(existingDrafts.map((draft: any) => [String(draft.id || ''), draft]))
  const commerceDrafts = OFFICIAL_COMMERCE_WHATSAPP_TEMPLATES.map(template => {
    const id = `commerce_${template.templateKey}`
    const existing = objectRecord(existingById.get(id))
    return commerceOfficialWhatsAppDraft(template, existing.created_at || now)
  })
  const commerceDraftIds = new Set(commerceDrafts.map(draft => draft.id))
  const nextDrafts = [
    ...commerceDrafts,
    ...existingDrafts.filter((draft: any) => !commerceDraftIds.has(String(draft.id || ''))),
  ].slice(0, 100)

  const { error: draftError } = await supabase
    .from('app_config')
    .upsert({
      key: DRAFT_CONFIG_KEY,
      value: JSON.stringify(nextDrafts),
      description: 'Rascunhos internos de templates Meta WhatsApp criados no painel.',
      updated_at: nowIso(),
    }, { onConflict: 'key' })
  if (draftError) throw draftError

  return {
    success: true,
    templates_count: rows.length,
    drafts_count: commerceDrafts.length,
    template_keys: rows.map(row => row.template_key),
  }
}

export function commerceOfficialWhatsAppMetaComponents(template: CommerceOfficialWhatsAppTemplate) {
  return metaComponents(template)
}
