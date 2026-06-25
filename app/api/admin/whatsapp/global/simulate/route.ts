import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyPilgerGlobalManagerAccess } from '@/lib/whatsapp/pilger-admin-access'
import {
  buildPilgerAgentRouterAcknowledgement,
  resolvePilgerAgentRoute,
} from '@/lib/whatsapp/pilger-agent-router'
import {
  detectWhatsAppGlobalCommandIntent,
  normalizeGlobalPhone,
  resolveWhatsAppGlobalIdentity,
} from '@/lib/whatsapp/global-identity'

export const dynamic = 'force-dynamic'

function cleanText(value: unknown, max = 1600) {
  const text = String(value || '').trim()
  return text.length > max ? text.slice(0, max) : text
}

function cleanScenarioKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .slice(0, 80)
}

function normalizeText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferFinanceCounterpartyType(text: unknown) {
  const normalized = normalizeText(text)
  if (/\b(cnpj|pj|juridica|pessoa juridica|empresa|finance_party_pj)\b/.test(normalized)) return 'pessoa_juridica'
  if (/\b(cpf|pf|fisica|pessoa fisica|finance_party_pf)\b/.test(normalized)) return 'pessoa_fisica'
  return null
}

async function readFinancePreview(params: {
  supabase: ReturnType<typeof createAdminClient>
  phone: string
  message: string
  route: ReturnType<typeof resolvePilgerAgentRoute>
}) {
  if (params.route.targetAgentId !== 'finance-ops-agent') return null

  const counterpartyType = inferFinanceCounterpartyType(params.message)
  let pendingCommand: any = null

  if (counterpartyType) {
    const { data, error } = await params.supabase
      .from('whatsapp_global_commands')
      .select('id, status, command_text, created_at')
      .eq('phone', params.phone)
      .eq('command_type', 'finance_request')
      .eq('target_agent', 'finance-ops-agent')
      .eq('status', 'queued')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error) pendingCommand = data || null
  }

  const action = !params.route.allowed
    ? 'blocked'
    : !counterpartyType
      ? 'ask_counterparty_type'
      : pendingCommand?.id
        ? 'handoff_pending_command'
        : 'handoff_current_message'

  return {
    action,
    counterparty_type: counterpartyType,
    pending_command_id: pendingCommand?.id || null,
    pending_created_at: pendingCommand?.created_at || null,
    will_create_finance_action: params.route.allowed && Boolean(counterpartyType),
    requires_whatsapp_response: params.route.allowed && !counterpartyType,
    detail: !params.route.allowed
      ? 'Pilger bloqueia antes de acionar o Agente Financeiro.'
      : !counterpartyType
        ? 'Pilger perguntaria se o lancamento e CPF ou CNPJ.'
        : pendingCommand?.id
          ? 'Pilger aplicaria esta resposta na pendencia financeira anterior.'
          : 'Pilger encaminharia esta mensagem atual ao Agente Financeiro.',
  }
}

async function buildPilgerSimulation(params: {
  supabase: ReturnType<typeof createAdminClient>
  phone: string
  senderName?: string | null
  message: string
  hasMedia: boolean
  scenarioKey?: string | null
  scenarioLabel?: string | null
}) {
  const identity = await resolveWhatsAppGlobalIdentity({
    supabase: params.supabase,
    phone: params.phone,
    senderName: params.senderName || null,
  })
  const intent = detectWhatsAppGlobalCommandIntent(params.message, params.hasMedia)
  const route = resolvePilgerAgentRoute({ identity, intent })
  const acknowledgement = buildPilgerAgentRouterAcknowledgement({ identity, route })
  const financePreview = await readFinancePreview({
    supabase: params.supabase,
    phone: params.phone,
    message: params.message,
    route,
  })

  return {
    scenario_key: params.scenarioKey || null,
    scenario_label: params.scenarioLabel || null,
    phone: params.phone,
    message: params.message,
    has_media: params.hasMedia,
    identity: {
      type: identity.type,
      label: identity.label,
      source: identity.source,
      confidence: identity.confidence,
      identity_id: identity.identityId || null,
      permission_keys: identity.permissions,
    },
    intent: {
      command_type: intent.commandType,
      target_agent: intent.targetAgent,
      required_permission: intent.requiredPermission || null,
      label: intent.label,
    },
    route: {
      command_type: route.commandType,
      label: route.label,
      target_agent: route.targetAgentId,
      target_agent_name: route.targetAgent.name,
      target_agent_sector: route.targetAgent.sector,
      required_permission: route.requiredPermission || null,
      execution_mode: route.executionMode,
      allowed: route.allowed,
    },
    finance_preview: financePreview,
    acknowledgement,
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await verifyPilgerGlobalManagerAccess()
    if (!access) return NextResponse.json({ success: false, error: 'Acesso negado.' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const phone = normalizeGlobalPhone(body?.phone)
    const senderName = cleanText(body?.sender_name, 120)
    const message = cleanText(body?.message, 1600)
    const hasMedia = Boolean(body?.has_media)
    const scenarios = Array.isArray(body?.scenarios) ? body.scenarios.slice(0, 12) : []

    if (!phone || phone.length < 8) {
      return NextResponse.json({ success: false, error: 'Informe um telefone valido para simular.' }, { status: 400 })
    }
    if (!scenarios.length && !message && !hasMedia) {
      return NextResponse.json({ success: false, error: 'Informe uma mensagem ou marque que ha midia.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (scenarios.length) {
      const simulations = await Promise.all(scenarios.map((scenario: any, index: number) => {
        const scenarioMessage = cleanText(scenario?.message, 1600)
        const scenarioHasMedia = Boolean(scenario?.has_media)
        if (!scenarioMessage && !scenarioHasMedia) {
          return null
        }

        return buildPilgerSimulation({
          supabase,
          phone,
          senderName,
          message: scenarioMessage,
          hasMedia: scenarioHasMedia,
          scenarioKey: cleanScenarioKey(scenario?.key) || `scenario_${index + 1}`,
          scenarioLabel: cleanText(scenario?.label, 120) || `Cenario ${index + 1}`,
        })
      }))

      return NextResponse.json({
        success: true,
        simulations: simulations.filter(Boolean),
      })
    }

    const simulation = await buildPilgerSimulation({
      supabase,
      phone,
      senderName,
      message,
      hasMedia,
    })

    return NextResponse.json({
      success: true,
      simulation,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
  }
}
