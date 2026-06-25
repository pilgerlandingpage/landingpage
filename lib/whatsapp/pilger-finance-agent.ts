import { recordAgentCentralSignal } from '@/lib/intelligence/agent-runtime'
import { sendMenuMessage, sendWhatsAppMessage } from '@/lib/uazapi'

type SupabaseLike = {
  from: (table: string) => any
}

type FinanceCounterpartyType = 'pessoa_fisica' | 'pessoa_juridica'

type ProcessPilgerFinanceCommandParams = {
  supabase: SupabaseLike
  command: any
  instance?: any
  instanceToken?: string | null
  sendResponse?: boolean
}

export type ProcessPilgerFinanceCommandResult = {
  handled: boolean
  whatsappSent: boolean
  action?: 'ask_counterparty_type' | 'handoff_ready'
  awaitingField?: 'counterparty_type'
  counterpartyType?: FinanceCounterpartyType
  pendingCommandId?: string | null
  financeActionId?: string | null
  error?: string
}

function cleanString(value: unknown, max = 1200) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text.length > max ? text.slice(0, max) : text
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

function inferCounterpartyType(text: unknown): FinanceCounterpartyType | null {
  const normalized = normalizeText(text)
  if (/\b(cnpj|pj|juridica|pessoa juridica|empresa|finance_party_pj)\b/.test(normalized)) {
    return 'pessoa_juridica'
  }
  if (/\b(cpf|pf|fisica|pessoa fisica|finance_party_pf)\b/.test(normalized)) {
    return 'pessoa_fisica'
  }
  return null
}

function counterpartyLabel(type: FinanceCounterpartyType) {
  return type === 'pessoa_juridica' ? 'CNPJ / pessoa juridica' : 'CPF / pessoa fisica'
}

function mediaSummary(command: any) {
  const media = Array.isArray(command?.payload?.media) ? command.payload.media : []
  return {
    has_media: media.length > 0,
    media_count: media.length,
    media_types: media
      .map((item: any) => cleanString(item?.mime || item?.mimetype || item?.kind || item?.type, 80))
      .filter(Boolean)
      .slice(0, 8),
  }
}

function firstMedia(command: any) {
  const media = Array.isArray(command?.payload?.media) ? command.payload.media : []
  return media.find((item: any) => item?.url || item?.r2_url || item?.media_url) || null
}

function looksLikeFuel(text: unknown) {
  return /\b(abastec|combustivel|gasolina|etanol|diesel|posto)\b/.test(normalizeText(text))
}

function buildFinanceActionPayload(params: {
  command: any
  targetCommand: any
  counterpartyType: FinanceCounterpartyType
}) {
  const { command, targetCommand, counterpartyType } = params
  const sourceText = cleanString(targetCommand?.command_text || command?.command_text, 2400)
  const media = firstMedia(targetCommand) || firstMedia(command)
  const isFuel = looksLikeFuel(sourceText)

  return {
    assistant_action: 'create_finance_entry',
    entry_type: 'expense',
    amount: null,
    counterparty_type: counterpartyType,
    payment_status: 'paid',
    entry_date: new Date().toISOString().slice(0, 10),
    due_date: new Date().toISOString().slice(0, 10),
    competence_date: new Date().toISOString().slice(0, 10),
    category: 'Consumo despesas',
    subcategory: isFuel ? 'Combustivel' : 'Comprovante recebido',
    description: isFuel ? 'Abastecimento do carro' : 'Despesa enviada pelo WhatsApp Global',
    counterparty_name: isFuel ? 'Posto de combustivel' : null,
    reference_company: counterpartyType === 'pessoa_fisica' ? 'Pessoa fisica' : 'Pessoa juridica',
    attachment_url: media?.r2_url || media?.url || media?.media_url || null,
    media_filename: media?.filename || media?.fileName || null,
    source_text: sourceText || null,
    receipt_analysis: {
      raw_summary: sourceText || 'Comprovante recebido pelo Pilger WhatsApp Global.',
      confidence: null,
      document_number: null,
    },
    source_module: 'whatsapp_global_pilger',
    pilger_command_id: targetCommand?.id || null,
    source_command_id: command?.id || null,
    requested_by_phone: command?.phone || targetCommand?.phone || null,
    requested_by_label: command?.identity_label || targetCommand?.identity_label || null,
  }
}

async function upsertPilgerFinanceAction(params: {
  supabase: SupabaseLike
  command: any
  targetCommand: any
  counterpartyType: FinanceCounterpartyType
  instance?: any
}) {
  const brokerId = params.instance?.broker_id || params.targetCommand?.payload?.broker_id || null
  const targetCommandId = params.targetCommand?.id || null
  if (!brokerId || !targetCommandId) return null

  const payload = buildFinanceActionPayload({
    command: params.command,
    targetCommand: params.targetCommand,
    counterpartyType: params.counterpartyType,
  })

  const { data: existing, error: existingError } = await params.supabase
    .from('broker_assistant_actions')
    .select('id, status')
    .eq('broker_id', brokerId)
    .eq('action_type', 'create_finance_entry')
    .eq('payload->>pilger_command_id', targetCommandId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing?.id) {
    const { error: updateError } = await params.supabase
      .from('broker_assistant_actions')
      .update({
        payload,
        status: existing.status === 'cancelled' ? existing.status : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) throw updateError
    return existing.id
  }

  const { data, error } = await params.supabase
    .from('broker_assistant_actions')
    .insert({
      broker_id: brokerId,
      action_type: 'create_finance_entry',
      status: 'pending',
      payload,
      result: {
        source: 'pilger_finance_agent',
        command_id: targetCommandId,
        created_from: params.command?.id || null,
      },
    })
    .select('id')
    .single()

  if (error) throw error
  return data?.id || null
}

async function updateCommandStatus(
  supabase: SupabaseLike,
  commandId: string | null,
  status: string,
  result: Record<string, unknown>,
) {
  if (!commandId) return
  await supabase
    .from('whatsapp_global_commands')
    .update({
      status,
      result,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commandId)
}

async function findPendingFinanceCommand(supabase: SupabaseLike, command: any) {
  if (!command?.phone) return null
  const { data, error } = await supabase
    .from('whatsapp_global_commands')
    .select('*')
    .eq('phone', command.phone)
    .eq('command_type', 'finance_request')
    .eq('target_agent', 'finance-ops-agent')
    .eq('status', 'queued')
    .neq('id', command.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function askCounterpartyType(params: {
  command: any
  instanceToken?: string | null
}) {
  const phone = cleanString(params.command?.phone, 40)
  if (!phone || !params.instanceToken) return false
  const message = [
    `${cleanString(params.command?.identity_label, 80) || 'Recebi'}, isso e financeiro.`,
    'Esse comprovante/lancamento deve ser cadastrado como CPF ou CNPJ?',
  ].join('\n')

  try {
    await sendMenuMessage({
      phone,
      text: message,
      type: 'button',
      choices: [
        'CPF|finance_party_pf',
        'CNPJ|finance_party_pj',
      ],
      footerText: 'Pilger Financeiro',
      instanceToken: params.instanceToken,
    })
    return true
  } catch (error) {
    console.warn('[Pilger Finance] button send failed, falling back to text:', error)
    try {
      await sendWhatsAppMessage({
        phone,
        message: `${message}\n\nResponda CPF ou CNPJ.`,
        instanceToken: params.instanceToken,
      })
      return true
    } catch (fallbackError: any) {
      console.warn('[Pilger Finance] WhatsApp response failed:', fallbackError?.message || fallbackError)
      return false
    }
  }
}

async function sendHandoffReady(params: {
  command: any
  counterpartyType: FinanceCounterpartyType
  instanceToken?: string | null
}) {
  const phone = cleanString(params.command?.phone, 40)
  if (!phone || !params.instanceToken) return false
  try {
    await sendWhatsAppMessage({
      phone,
      message: [
        `${cleanString(params.command?.identity_label, 80) || 'Perfeito'}, vou encaminhar ao Agente Financeiro.`,
        `Classificacao: ${counterpartyLabel(params.counterpartyType)}.`,
        'O lancamento ficou registrado no Pilger para o financeiro cadastrar/conferir.',
      ].join('\n'),
      instanceToken: params.instanceToken,
    })
    return true
  } catch (error: any) {
    console.warn('[Pilger Finance] WhatsApp handoff response failed:', error?.message || error)
    return false
  }
}

async function recordFinanceSignal(params: {
  supabase: SupabaseLike
  command: any
  action: 'ask_counterparty_type' | 'handoff_ready'
  counterpartyType?: FinanceCounterpartyType | null
  pendingCommandId?: string | null
  financeActionId?: string | null
}) {
  await recordAgentCentralSignal({
    supabase: params.supabase as any,
    agentId: 'finance-ops-agent',
    eventType: params.action === 'handoff_ready'
      ? 'pilger_finance_handoff_ready'
      : 'pilger_finance_needs_counterparty_type',
    entityType: 'whatsapp_global_command',
    entityId: params.pendingCommandId || params.command?.id || null,
    source: 'pilger-finance-agent',
    label: params.action === 'handoff_ready'
      ? 'Agente Financeiro recebeu classificacao do Pilger'
      : 'Agente Financeiro pediu CPF/CNPJ pelo Pilger',
    importanceScore: params.action === 'handoff_ready' ? 72 : 66,
    metadata: {
      command_id: params.command?.id || null,
      pending_command_id: params.pendingCommandId || null,
      finance_action_id: params.financeActionId || null,
      requested_by_phone: params.command?.phone || null,
      requested_by_label: params.command?.identity_label || null,
      counterparty_type: params.counterpartyType || null,
      text_preview: cleanString(params.command?.command_text, 360) || null,
      ...mediaSummary(params.command),
    },
    handoffTargets: ['whatsapp-global-agent', 'internal-notifier', 'ceo-agent'],
  }).catch((error: any) => {
    console.warn('[Pilger Finance] central signal failed:', error?.message || error)
  })
}

export async function processPilgerFinanceCommand(
  params: ProcessPilgerFinanceCommandParams,
): Promise<ProcessPilgerFinanceCommandResult> {
  const { supabase, command } = params
  if (!command?.id) return { handled: false, whatsappSent: false, error: 'missing_command' }
  if (command.status === 'blocked') return { handled: false, whatsappSent: false, error: 'blocked_command' }
  if (command.command_type !== 'finance_request') return { handled: false, whatsappSent: false }

  const instanceToken = params.instanceToken || params.instance?.instance_token || null
  const shouldSendResponse = params.sendResponse !== false

  try {
    await updateCommandStatus(supabase, command.id, 'processing', {
      stage: 'pilger_finance_processing_started',
      started_at: new Date().toISOString(),
    })

    const counterpartyType = inferCounterpartyType(command.command_text)
    if (!counterpartyType) {
      const result = {
        stage: 'pilger_finance_awaiting_counterparty_type',
        awaiting_field: 'counterparty_type',
        accepted_answers: ['cpf', 'cnpj'],
        ...mediaSummary(command),
        queued_at: new Date().toISOString(),
      }
      await updateCommandStatus(supabase, command.id, 'queued', result)
      await recordFinanceSignal({ supabase, command, action: 'ask_counterparty_type' })
      const whatsappSent = shouldSendResponse
        ? await askCounterpartyType({ command, instanceToken })
        : false

      return {
        handled: true,
        whatsappSent,
        action: 'ask_counterparty_type',
        awaitingField: 'counterparty_type',
        pendingCommandId: command.id,
      }
    }

    const pendingCommand = await findPendingFinanceCommand(supabase, command)
    const targetCommand = pendingCommand || command
    const financeActionId = await upsertPilgerFinanceAction({
      supabase,
      command,
      targetCommand,
      counterpartyType,
      instance: params.instance,
    })
    const result = {
      stage: 'pilger_finance_handoff_ready',
      counterparty_type: counterpartyType,
      finance_action_id: financeActionId,
      source_command_id: command.id,
      pending_command_id: pendingCommand?.id || null,
      ...mediaSummary(targetCommand),
      completed_at: new Date().toISOString(),
    }

    if (pendingCommand?.id) {
      await updateCommandStatus(supabase, pendingCommand.id, 'completed', result)
      await updateCommandStatus(supabase, command.id, 'completed', {
        ...result,
        stage: 'pilger_finance_context_applied',
      })
    } else {
      await updateCommandStatus(supabase, command.id, 'completed', result)
    }

    await recordFinanceSignal({
      supabase,
      command,
      action: 'handoff_ready',
      counterpartyType,
      pendingCommandId: targetCommand?.id || null,
      financeActionId,
    })

    const whatsappSent = shouldSendResponse
      ? await sendHandoffReady({ command, counterpartyType, instanceToken })
      : false

    return {
      handled: true,
      whatsappSent,
      action: 'handoff_ready',
      counterpartyType,
      pendingCommandId: targetCommand?.id || null,
      financeActionId,
    }
  } catch (error: any) {
    const message = error?.message || String(error)
    console.error('[Pilger Finance] command failed:', message)
    await updateCommandStatus(supabase, command.id, 'failed', {
      stage: 'pilger_finance_failed',
      error: message,
      failed_at: new Date().toISOString(),
    }).catch(() => null)

    const whatsappSent = shouldSendResponse
      ? await sendWhatsAppMessage({
        phone: command.phone,
        message: [
          'Recebi o pedido financeiro, mas nao consegui concluir a triagem agora.',
          'O comando ficou registrado no Pilger para revisao interna.',
        ].join('\n'),
        instanceToken: instanceToken || undefined,
      }).then(() => true).catch(() => false)
      : false

    return {
      handled: true,
      whatsappSent,
      error: message,
    }
  }
}
