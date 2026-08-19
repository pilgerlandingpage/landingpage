export interface MetaWhatsAppSenderLike {
  display_name?: unknown
  phone_number?: unknown
  local_status?: unknown
  meta_status?: unknown
  quality_rating?: unknown
  daily_limit?: unknown
  daily_sent_count?: unknown
  daily_limit_resets_at?: unknown
  metadata?: unknown
  last_error?: unknown
}

export interface MetaWhatsAppSenderUsage {
  limit: number
  sent: number
  remaining: number
  usageLabel: string
}

export interface MetaWhatsAppSenderHealth {
  available: boolean
  policyEligible: boolean
  severity: 'ok' | 'warn' | 'blocked'
  reason: string
  warning?: string
  usage: MetaWhatsAppSenderUsage
}

const BLOCKED_QUALITY = new Set([
  'RED',
  'LOW',
  'BAIXA',
  'RUIM',
  'CRITICAL',
  'CRITICA',
  'CRITICO',
])

const WARNING_QUALITY = new Set([
  'YELLOW',
  'MEDIUM',
  'MEDIA',
  'AMARELA',
])

const RESTRICTED_STATUS_VALUES = new Set([
  'restricted',
  'disabled',
  'blocked',
  'banned',
  'banido',
  'suspended',
  'suspenso',
  'timelocked',
  'limited',
  'limitado',
])

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asNumber(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function truthyFlag(value: unknown) {
  if (value === true) return true
  const selected = cleanText(value, 40).toLowerCase()
  return ['true', '1', 'yes', 'sim', 'active', 'ativo'].includes(selected)
}

function falseyFlag(value: unknown) {
  if (value === false) return true
  const selected = cleanText(value, 40).toLowerCase()
  return ['false', '0', 'no', 'nao', 'não', 'inactive', 'inativo'].includes(selected)
}

function normalizedQuality(value: unknown) {
  return cleanText(value, 60)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function isUsageExpired(sender: MetaWhatsAppSenderLike, now = new Date()) {
  const value = cleanText(sender.daily_limit_resets_at, 80)
  if (!value) return false
  const resetAt = new Date(value)
  return Number.isFinite(resetAt.getTime()) && resetAt.getTime() <= now.getTime()
}

function nestedRestrictionActive(metadata: Record<string, unknown>) {
  const restriction = asRecord(metadata.restriction)
  const restrictions = asRecord(metadata.restrictions)
  const reachoutTimelock = asRecord(metadata.reachout_timelock)
  const policy = asRecord(metadata.policy)

  return truthyFlag(restriction.active)
    || truthyFlag(restrictions.active)
    || truthyFlag(reachoutTimelock.active)
    || truthyFlag(policy.restricted)
}

function restrictedStatusFromMetadata(metadata: Record<string, unknown>) {
  const candidates = [
    metadata.policy_status,
    metadata.account_status,
    metadata.restriction_status,
    metadata.ban_status,
    metadata.integrity_status,
  ]

  return candidates
    .map(value => cleanText(value, 80).toLowerCase())
    .some(value => RESTRICTED_STATUS_VALUES.has(value))
}

export function metaWhatsAppSenderUsage(sender: MetaWhatsAppSenderLike): MetaWhatsAppSenderUsage {
  const limit = asNumber(sender.daily_limit)
  const sent = isUsageExpired(sender) ? 0 : asNumber(sender.daily_sent_count)
  return {
    limit,
    sent,
    remaining: Math.max(limit - sent, 0),
    usageLabel: `${sent}/${limit || 'sem limite'}`,
  }
}

export function hasMetaWhatsAppRestrictionSignal(sender: MetaWhatsAppSenderLike) {
  const metadata = asRecord(sender.metadata)
  const lastError = cleanText(sender.last_error, 800).toLowerCase()

  return truthyFlag(metadata.restricted)
    || truthyFlag(metadata.account_restricted)
    || truthyFlag(metadata.banned)
    || truthyFlag(metadata.disabled)
    || falseyFlag(metadata.can_send_new_messages)
    || falseyFlag(metadata.can_initiate_conversations)
    || nestedRestrictionActive(metadata)
    || restrictedStatusFromMetadata(metadata)
    || (lastError.includes('restricted') && lastError.includes('whatsapp'))
    || (lastError.includes('ban') && lastError.includes('whatsapp'))
}

export function getMetaWhatsAppSenderHealth(sender: MetaWhatsAppSenderLike | null | undefined): MetaWhatsAppSenderHealth {
  const usage = metaWhatsAppSenderUsage(sender || {})
  if (!sender) {
    return {
      available: false,
      policyEligible: false,
      severity: 'blocked',
      reason: 'numero selecionado nao encontrado.',
      usage,
    }
  }

  const localStatus = cleanText(sender.local_status, 40)
  const metaStatus = cleanText(sender.meta_status, 40).toUpperCase()
  const quality = normalizedQuality(sender.quality_rating)

  if (localStatus !== 'active') {
    return {
      available: false,
      policyEligible: false,
      severity: 'blocked',
      reason: `status local ${localStatus || 'sem status local'}.`,
      usage,
    }
  }

  if (metaStatus !== 'CONNECTED') {
    return {
      available: false,
      policyEligible: false,
      severity: 'blocked',
      reason: `status Meta ${metaStatus || 'sem status'}.`,
      usage,
    }
  }

  if (hasMetaWhatsAppRestrictionSignal(sender)) {
    return {
      available: false,
      policyEligible: false,
      severity: 'blocked',
      reason: 'numero com sinal de restricao/politica; pause e revise antes de enviar.',
      usage,
    }
  }

  if (BLOCKED_QUALITY.has(quality)) {
    return {
      available: false,
      policyEligible: false,
      severity: 'blocked',
      reason: `qualidade ${cleanText(sender.quality_rating, 80) || 'critica'}; envio bloqueado para proteger a conta.`,
      usage,
    }
  }

  if (usage.limit <= 0) {
    return {
      available: false,
      policyEligible: true,
      severity: 'blocked',
      reason: 'limite diario nao configurado.',
      usage,
    }
  }

  if (usage.sent >= usage.limit) {
    return {
      available: false,
      policyEligible: true,
      severity: 'blocked',
      reason: `limite diario esgotado (${usage.usageLabel}).`,
      usage,
    }
  }

  const warning = WARNING_QUALITY.has(quality)
    ? `qualidade ${cleanText(sender.quality_rating, 80)}; reduza volume e monitore respostas.`
    : undefined

  return {
    available: true,
    policyEligible: true,
    severity: warning ? 'warn' : 'ok',
    reason: `disponivel (${usage.usageLabel}).`,
    warning,
    usage,
  }
}

export function isMetaWhatsAppSenderAvailable(sender: MetaWhatsAppSenderLike | null | undefined) {
  return getMetaWhatsAppSenderHealth(sender).available
}

export function isMetaWhatsAppSenderPolicyEligible(sender: MetaWhatsAppSenderLike | null | undefined) {
  return getMetaWhatsAppSenderHealth(sender).policyEligible
}
