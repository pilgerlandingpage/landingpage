'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ClipboardList,
    Clock3,
    Database,
    ExternalLink,
    Filter,
    KeyRound,
    Loader2,
    MessageSquareText,
    Save,
    RefreshCw,
    Route,
    Send,
    ShieldCheck,
    UserPlus,
    UserRound,
    XCircle,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type GlobalCommand = {
    id: string
    session_id: string | null
    phone_masked: string
    identity_type: string
    identity_label: string
    command_type: string
    command_label: string
    target_agent: string
    target_label: string
    required_permission: string | null
    status: string
    command_text: string
    payload: Record<string, any>
    result: Record<string, any>
    pilger_return_pending: boolean
    pilger_return_sent_at: string | null
    pilger_return_message: string | null
    pilger_return_preview: string
    created_at: string
    updated_at: string
    session: GlobalSession | null
}

type GlobalSession = {
    id: string
    phone_masked: string
    identity_type: string
    identity_label: string
    permission_keys: string[]
    message_count: number
    last_user_message: string
    last_assistant_message: string
    last_message_at: string
    messages: Array<{
        role: string
        content: string
        timestamp: string | null
        has_media: boolean
        command_type: string | null
    }>
}

type PilgerGoLivePacket = {
    ready: boolean
    status: 'ready' | 'attention' | 'blocked' | string
    launch_state: string
    score: number
    blockers: number
    warnings: number
    checklist: Array<{
        key: string
        label: string
        status: 'ok' | 'warn' | 'missing' | string
        action: string
    }>
    final_test_runbook: Array<{
        step: number
        label: string
        detail: string
        evidence: string
    }>
    required_evidence: string[]
    rollback_plan: Array<{
        label: string
        action: string
    }>
    handoff?: {
        owner: string
        mode: string
        next_gate: string
    }
}

type PilgerPostLaunchReport = {
    ready: boolean
    status: 'stable' | 'watch' | 'blocked' | string
    score: number
    blockers: number
    watchpoints: number
    signals: Array<{
        key: string
        label: string
        status: 'ok' | 'watch' | 'missing' | string
        detail: string
        next_action: string
        critical?: boolean
    }>
    metrics: {
        total_commands?: number
        open_commands?: number
        completed_commands?: number
        failed_commands?: number
        blocked_commands?: number
        command_resolution_rate?: number
        return_coverage_rate?: number
        governance_coverage_rate?: number
        phase3_escalations?: number
    }
    stabilization_checklist: string[]
    executive_summary: string
    next_operating_window?: {
        label: string
        duration: string
        cadence: string
    }
}

type PilgerFinalPhase = {
    code_complete: boolean
    status: 'complete' | 'attention' | string
    label: string
    detail: string
    score?: number
    remaining_actions: string[]
    core_checks: Record<string, boolean>
    checks?: Array<{
        key: string
        label: string
        status: string
        detail: string
        action: string
    }>
    metrics?: Record<string, number>
    identity_rules?: Array<{
        key: string
        label: string
        behavior: string
    }>
    tracking_fields?: string[]
    automated_results?: {
        total_scenarios?: number
        route_scenarios?: number
        failed_routes?: number
        blocked_permission_scenarios?: number
        covered_agents?: string[]
    }
    practical_messages?: Array<{
        key: string
        label: string
        text: string
        expected: string
    }>
    evidence_required?: string[]
}

type GlobalPayload = {
    success: boolean
    ready: boolean
    error?: string
    global_instance: {
        id: string
        instance_name: string
        status: string
        phone_masked: string
        broker_id?: string | null
        instance_type: string
        connected_at: string | null
    } | null
    diagnostics: Record<string, any>
    identity_sources: Record<string, number>
    metrics: {
        total_commands: number
        received: number
        blocked: number
        queued: number
        processing: number
        completed: number
        failed: number
        cancelled: number
        open: number
        global_sessions: number
        global_overrides: number
        last_24h: number
    }
    agent_desk?: {
        ready: boolean
        error?: string | null
        totals: {
            total_count?: number
            open_count?: number
            return_pending_count?: number
            returned_count?: number
        }
        agents: Array<{
            target_agent: string
            target_label: string
            total_count: number
            open_count: number
            received_count: number
            queued_count: number
            processing_count: number
            completed_count: number
            failed_count: number
            return_pending_count: number
            returned_count: number
            latest_command: GlobalCommand | null
            oldest_open_command: GlobalCommand | null
            next_return_command: GlobalCommand | null
        }>
    }
    phase_3_automation?: {
        enabled: boolean
        cron_path: string
        cron_schedule: string
        has_cron_secret: boolean
        last_checked_at: string | null
        last_reason: string | null
        last_run_at: string | null
        last_escalations: number
        last_error: string | null
        last_error_at: string | null
        last_result: Record<string, any> | null
    }
    phase_4_governance?: {
        ready: boolean
        error?: string | null
        policies: Array<{
            target_agent: string
            target_label: string
            sector: string
            required_permission: string
            sla_minutes: number
            approval_required: boolean
            return_required: boolean
            audit_focus: string
            total_count?: number
            review_count?: number
            closed_count?: number
            return_pending_count?: number
        }>
        totals: {
            policy_count?: number
            command_count?: number
            returned_count?: number
            return_pending_count?: number
            phase3_escalated_count?: number
            phase4_closed_count?: number
            review_queue_count?: number
            failed_count?: number
            blocked_count?: number
        }
        review_queue: Array<{
            id: string
            target_agent: string
            target_label: string
            status: string
            command_type: string
            identity_type: string
            identity_label: string
            command_preview: string
            return_sent: boolean
            return_pending: boolean
            phase3_escalated: boolean
            phase4_closed: boolean
            updated_at: string | null
            created_at: string | null
        }>
    }
    phase_5_go_live?: PilgerGoLivePacket
    phase_6_post_launch?: PilgerPostLaunchReport
    phase_7_identity?: PilgerFinalPhase
    phase_8_tracking?: PilgerFinalPhase
    phase_9_practical_tests?: PilgerFinalPhase
    recent_commands: GlobalCommand[]
    recent_sessions: GlobalSession[]
    options: {
        statuses: string[]
        targets: Array<{ value: string; label: string }>
    }
}

type GlobalIdentityOverride = {
    id: string
    phone: string
    phone_masked: string
    identity_type: string
    identity_id: string | null
    display_name: string
    permission_keys: string[]
    notes: string
    is_active: boolean
    created_at: string | null
    updated_at: string | null
}

type GlobalIdentityDraft = {
    id: string | null
    phone: string
    display_name: string
    identity_type: string
    permission_keys: string[]
    notes: string
    is_active: boolean
}

type PilgerSimulationResult = {
    scenario_key?: string | null
    scenario_label?: string | null
    phone: string
    message: string
    has_media: boolean
    identity: {
        type: string
        label: string
        source: string
        confidence: number
        identity_id: string | null
        permission_keys: string[]
    }
    intent: {
        command_type: string
        target_agent: string
        required_permission: string | null
        label: string
    }
    route: {
        command_type: string
        label: string
        target_agent: string
        target_agent_name: string
        target_agent_sector: string
        required_permission: string | null
        execution_mode: string
        allowed: boolean
    }
    finance_preview?: {
        action: string
        counterparty_type: string | null
        pending_command_id: string | null
        pending_created_at: string | null
        will_create_finance_action: boolean
        requires_whatsapp_response: boolean
        detail: string
    } | null
    acknowledgement: string
}

type PilgerSimulationDraft = {
    phone: string
    sender_name: string
    message: string
    has_media: boolean
}

const statusLabels: Record<string, string> = {
    all: 'Todos',
    received: 'Recebido',
    blocked: 'Bloqueado',
    queued: 'Na fila',
    processing: 'Processando',
    completed: 'Concluido',
    failed: 'Falhou',
    cancelled: 'Cancelado',
}

const identityLabels: Record<string, string> = {
    admin_user: 'Admin',
    broker_user: 'Corretor',
    broker_authorized: 'Autorizado',
    property_owner: 'Proprietario',
    lead: 'Lead',
    blocked: 'Bloqueado',
}

const GLOBAL_IDENTITY_TYPE_OPTIONS = [
    { value: 'admin_user', label: 'Admin interno' },
    { value: 'broker_user', label: 'Corretor' },
    { value: 'broker_authorized', label: 'Autorizado' },
    { value: 'property_owner', label: 'Proprietario' },
    { value: 'lead', label: 'Lead manual' },
    { value: 'blocked', label: 'Bloqueado' },
]

const PILGER_PERMISSION_OPTIONS = [
    { key: 'master_all', label: 'Master' },
    { key: 'ads', label: 'Trafego' },
    { key: 'blog', label: 'Blog' },
    { key: 'news', label: 'Noticias' },
    { key: 'finance', label: 'Financeiro' },
    { key: 'dashboard', label: 'Relatorios' },
    { key: 'properties', label: 'Imoveis' },
    { key: 'leads', label: 'Leads' },
    { key: 'crm', label: 'CRM' },
    { key: 'agenda', label: 'Agenda' },
    { key: 'send_messages', label: 'Mensagens' },
    { key: 'owner_properties', label: 'Proprietario' },
]

const EMPTY_IDENTITY_DRAFT: GlobalIdentityDraft = {
    id: null,
    phone: '',
    display_name: '',
    identity_type: 'broker_authorized',
    permission_keys: ['properties'],
    notes: '',
    is_active: true,
}

const EMPTY_SIMULATION_DRAFT: PilgerSimulationDraft = {
    phone: '',
    sender_name: '',
    message: 'Veja para mim como esta a campanha de trafego hoje',
    has_media: false,
}

const PILGER_SIMULATION_SCENARIOS = [
    {
        key: 'traffic_monitoring',
        label: 'Vitor trafego',
        message: 'Pilger, veja pra mim como esta a campanha de trafego hoje.',
        has_media: false,
    },
    {
        key: 'blog_status',
        label: 'Isadora blog',
        message: 'Pilger, veja pra mim qual o blog de hoje.',
        has_media: false,
    },
    {
        key: 'news_create',
        label: 'Clara noticias',
        message: 'Pilger, crie uma noticia sobre valorizacao imobiliaria no litoral catarinense.',
        has_media: false,
    },
    {
        key: 'finance_receipt',
        label: 'Financeiro',
        message: 'Pilger, recebi um comprovante do posto de gasolina.',
        has_media: true,
    },
    {
        key: 'property_stock',
        label: 'Bianca imoveis',
        message: 'Pilger, veja os imoveis disponiveis frente mar.',
        has_media: false,
    },
    {
        key: 'ceo_report',
        label: 'Arthur relatorio',
        message: 'Pilger, me traga um relatorio geral da operacao hoje.',
        has_media: false,
    },
]

function formatDateTime(value?: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function compact(value: unknown, max = 160) {
    const text = String(value || '').trim()
    return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function statusLabel(value?: string | null) {
    return statusLabels[String(value || '')] || String(value || '-')
}

function statusTone(value?: string | null) {
    const status = String(value || '')
    if (status === 'completed') return 'ok'
    if (status === 'failed' || status === 'blocked' || status === 'cancelled') return 'risk'
    if (status === 'processing' || status === 'queued') return 'warn'
    return 'neutral'
}

function identityLabel(value?: string | null) {
    return identityLabels[String(value || '')] || String(value || '-')
}

function identityTypeOptionLabel(value?: string | null) {
    return GLOBAL_IDENTITY_TYPE_OPTIONS.find(option => option.value === value)?.label || identityLabel(value)
}

function JsonBlock({ value }: { value: unknown }) {
    const text = JSON.stringify(value || {}, null, 2)
    if (!text || text === '{}') return <span className="global-muted">Sem dados.</span>
    return <pre>{text}</pre>
}

function commandResultValue(command: GlobalCommand | null | undefined, keys: string[]) {
    const result = command?.result || {}
    for (const key of keys) {
        const value = result[key]
        if (value !== undefined && value !== null && String(value).trim()) return value
    }
    return null
}

function financeActionIdFromCommand(command: GlobalCommand | null | undefined) {
    const direct = commandResultValue(command, ['finance_action_id', 'financeActionId'])
    if (direct) return String(direct)
    const nested = command?.result?.finance_action
    if (nested && typeof nested === 'object' && nested.id) return String(nested.id)
    return null
}

function financeQueueState(command: GlobalCommand | null | undefined) {
    if (!command || command.target_agent !== 'finance-ops-agent') return null
    const actionId = financeActionIdFromCommand(command)
    if (actionId) return {
        title: 'Acao financeira criada',
        description: 'O comprovante ja entrou na fila do concierge do Global para conferencia e continuidade operacional.',
        meta: `ID da acao: ${actionId}`,
        tone: 'ok',
    }
    const awaitingField = commandResultValue(command, ['awaiting_field'])
    if (awaitingField === 'counterparty_type') return {
        title: 'Aguardando CPF ou CNPJ',
        description: 'O Pilger ja pediu ao usuario se o lancamento deve ser cadastrado como pessoa fisica ou juridica.',
        meta: 'Assim que o usuario responder, o agente financeiro recebe a tarefa.',
        tone: 'warn',
    }
    return null
}

function pilgerProcessDetail(result: Record<string, any>) {
    if (result.score) return ` Score: ${result.score}/100.`
    if (result.selectedCount) return ` Opcoes: ${result.selectedCount}.`
    if (result.snapshotCount) return ` Snapshots: ${result.snapshotCount}.`
    if (result.financeActionId || result.finance_action_id) return ' Acao financeira criada.'
    if (result.awaitingField === 'counterparty_type' || result.awaiting_field === 'counterparty_type') return ' Aguardando CPF/CNPJ.'
    return ''
}

function MetricCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number | string; hint: string }) {
    return (
        <article className="global-metric-card">
            <span>{icon}{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
        </article>
    )
}

export default function WhatsAppGlobalPage() {
    const [data, setData] = useState<GlobalPayload | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [targetFilter, setTargetFilter] = useState('all')
    const [activeId, setActiveId] = useState<string | null>(null)
    const [updating, setUpdating] = useState<string | null>(null)
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [identityOverrides, setIdentityOverrides] = useState<GlobalIdentityOverride[]>([])
    const [identityLoading, setIdentityLoading] = useState(false)
    const [identitySaving, setIdentitySaving] = useState(false)
    const [identityError, setIdentityError] = useState<string | null>(null)
    const [identityDraft, setIdentityDraft] = useState<GlobalIdentityDraft>(EMPTY_IDENTITY_DRAFT)
    const [simulationDraft, setSimulationDraft] = useState<PilgerSimulationDraft>(EMPTY_SIMULATION_DRAFT)
    const [simulationResult, setSimulationResult] = useState<PilgerSimulationResult | null>(null)
    const [simulationSuite, setSimulationSuite] = useState<PilgerSimulationResult[]>([])
    const [simulationLoading, setSimulationLoading] = useState(false)
    const [simulationSuiteLoading, setSimulationSuiteLoading] = useState(false)
    const [simulationError, setSimulationError] = useState<string | null>(null)
    const [automationRunning, setAutomationRunning] = useState(false)
    const [governanceLearning, setGovernanceLearning] = useState('')

    const commands = data?.recent_commands || []
    const activeCommand = useMemo(() => {
        if (!commands.length) return null
        return commands.find(command => command.id === activeId) || commands[0]
    }, [commands, activeId])

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true)
        setRefreshing(silent)
        setError(null)
        try {
            const params = new URLSearchParams()
            params.set('limit', '120')
            params.set('status', statusFilter)
            params.set('target', targetFilter)
            const response = await fetch(`/api/admin/whatsapp/global?${params.toString()}`, { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Nao foi possivel carregar o WhatsApp Global.')
            setData(payload)
            setActiveId(current => {
                const nextCommands = Array.isArray(payload.recent_commands) ? payload.recent_commands : []
                return nextCommands.some((command: GlobalCommand) => command.id === current) ? current : nextCommands[0]?.id || null
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido.')
        } finally {
            if (!silent) setLoading(false)
            setRefreshing(false)
        }
    }

    const loadIdentityOverrides = async () => {
        setIdentityLoading(true)
        setIdentityError(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global/identities', { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Nao foi possivel carregar acessos do Pilger.')
            setIdentityOverrides(Array.isArray(payload.identities) ? payload.identities : [])
        } catch (err) {
            setIdentityError(err instanceof Error ? err.message : 'Erro ao carregar acessos do Pilger.')
        } finally {
            setIdentityLoading(false)
        }
    }

    useEffect(() => {
        loadData(false)
        loadIdentityOverrides()
    }, [statusFilter, targetFilter])

    const toggleDraftPermission = (key: string) => {
        setIdentityDraft(current => {
            const set = new Set(current.permission_keys)
            if (set.has(key)) set.delete(key)
            else set.add(key)
            return { ...current, permission_keys: Array.from(set) }
        })
    }

    const editIdentityOverride = (identity: GlobalIdentityOverride) => {
        setIdentityDraft({
            id: identity.id,
            phone: identity.phone,
            display_name: identity.display_name,
            identity_type: identity.identity_type,
            permission_keys: identity.permission_keys || [],
            notes: identity.notes || '',
            is_active: identity.is_active !== false,
        })
    }

    const resetIdentityDraft = () => {
        setIdentityDraft(EMPTY_IDENTITY_DRAFT)
    }

    const saveIdentityOverride = async () => {
        setIdentitySaving(true)
        setIdentityError(null)
        setToast(null)
        try {
            const method = identityDraft.id ? 'PATCH' : 'POST'
            const response = await fetch('/api/admin/whatsapp/global/identities', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(identityDraft),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Nao foi possivel salvar o acesso.')
            setToast({ type: 'success', text: 'Acesso do Pilger salvo.' })
            resetIdentityDraft()
            await Promise.all([loadIdentityOverrides(), loadData(true)])
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao salvar acesso do Pilger.'
            setIdentityError(message)
            setToast({ type: 'error', text: message })
        } finally {
            setIdentitySaving(false)
        }
    }

    const toggleIdentityActive = async (identity: GlobalIdentityOverride) => {
        setUpdating(`${identity.id}:identity`)
        setIdentityError(null)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global/identities', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: identity.id, is_active: !identity.is_active }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Nao foi possivel atualizar o acesso.')
            setToast({ type: 'success', text: identity.is_active ? 'Acesso pausado.' : 'Acesso ativado.' })
            await Promise.all([loadIdentityOverrides(), loadData(true)])
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao atualizar acesso.'
            setIdentityError(message)
            setToast({ type: 'error', text: message })
        } finally {
            setUpdating(null)
        }
    }

    const runPilgerSimulation = async () => {
        setSimulationLoading(true)
        setSimulationError(null)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(simulationDraft),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Nao foi possivel simular o Pilger.')
            setSimulationResult(payload.simulation || null)
            setSimulationSuite([])
            setToast({ type: 'success', text: 'Simulacao do Pilger concluida.' })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao simular o Pilger.'
            setSimulationError(message)
            setToast({ type: 'error', text: message })
        } finally {
            setSimulationLoading(false)
        }
    }

    const runPilgerSimulationSuite = async () => {
        setSimulationSuiteLoading(true)
        setSimulationError(null)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: simulationDraft.phone,
                    sender_name: simulationDraft.sender_name,
                    scenarios: PILGER_SIMULATION_SCENARIOS,
                }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Nao foi possivel rodar a bateria do Pilger.')
            const rows = Array.isArray(payload.simulations) ? payload.simulations : []
            setSimulationSuite(rows)
            setSimulationResult(rows[0] || null)
            setToast({ type: 'success', text: `${rows.length} cenario(s) simulados.` })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao rodar a bateria do Pilger.'
            setSimulationError(message)
            setToast({ type: 'error', text: message })
        } finally {
            setSimulationSuiteLoading(false)
        }
    }

    const updateStatus = async (commandId: string, status: string) => {
        setUpdating(`${commandId}:${status}`)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command_id: commandId, status }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Falha ao atualizar status.')
            setToast({ type: 'success', text: `Comando marcado como ${statusLabel(status).toLowerCase()}.` })
            await loadData(true)
        } catch (err) {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao atualizar status.' })
        } finally {
            setUpdating(null)
        }
    }

    const processWithPilger = async (commandId: string) => {
        setUpdating(`${commandId}:process_pilger`)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command_id: commandId, action: 'process_pilger' }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Falha ao processar com o Pilger.')
            const result = payload.result || payload.vitor || {}
            const detail = pilgerProcessDetail(result)
            setToast({ type: 'success', text: `Comando processado pelo Pilger.${detail}` })
            await loadData(true)
        } catch (err) {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao processar com o Pilger.' })
        } finally {
            setUpdating(null)
        }
    }

    const sendPilgerReturn = async (command: GlobalCommand) => {
        setUpdating(`${command.id}:send_return`)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command_id: command.id,
                    action: 'send_pilger_return',
                    message: command.pilger_return_preview,
                }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Falha ao enviar retorno do Pilger.')
            setToast({ type: 'success', text: 'Retorno enviado pelo Pilger.' })
            await loadData(true)
        } catch (err) {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao enviar retorno do Pilger.' })
        } finally {
            setUpdating(null)
        }
    }

    const runPilgerAutomation = async () => {
        setAutomationRunning(true)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global/automation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: true }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Falha ao rodar automacao do Pilger.')
            const count = payload.summary?.escalated_count || 0
            setToast({ type: 'success', text: `Automacao Fase 3 concluida: ${count} alerta(s) registrado(s).` })
            await loadData(true)
        } catch (err) {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao rodar automacao do Pilger.' })
        } finally {
            setAutomationRunning(false)
        }
    }

    const closePilgerGovernance = async (command: GlobalCommand) => {
        setUpdating(`${command.id}:close_governance`)
        setToast(null)
        try {
            const response = await fetch('/api/admin/whatsapp/global', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command_id: command.id,
                    action: 'close_pilger_governance',
                    outcome: command.pilger_return_sent_at ? 'resolved_with_return' : 'reviewed_pending_return',
                    learning: governanceLearning,
                }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Falha ao fechar governanca do Pilger.')
            setToast({ type: 'success', text: 'Governanca do Pilger registrada.' })
            setGovernanceLearning('')
            await loadData(true)
        } catch (err) {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao fechar governanca do Pilger.' })
        } finally {
            setUpdating(null)
        }
    }

    const copyCommand = (text: string) => {
        if (!text || typeof navigator === 'undefined') return
        void navigator.clipboard.writeText(text)
        setToast({ type: 'success', text: 'Texto copiado.' })
    }

    const canProcessActiveCommand = Boolean(
        activeCommand
        && (
            (activeCommand.target_agent === 'ads-analyst' && activeCommand.command_type.startsWith('paid_traffic'))
            || (['blog-intelligence', 'news-intelligence'].includes(activeCommand.target_agent) && activeCommand.command_type === 'content_request')
            || (activeCommand.target_agent === 'finance-ops-agent' && activeCommand.command_type === 'finance_request')
            || (activeCommand.target_agent === 'property-register' && activeCommand.command_type === 'property_request')
            || (activeCommand.target_agent === 'ceo-agent' && activeCommand.command_type === 'report_request')
        )
        && !['blocked', 'cancelled', 'processing', 'completed'].includes(activeCommand.status),
    )
    const activeFinanceState = financeQueueState(activeCommand)
    const agentDesk = data?.agent_desk?.agents || []
    const automation = data?.phase_3_automation
    const governance = data?.phase_4_governance
    const goLive = data?.phase_5_go_live
    const postLaunch = data?.phase_6_post_launch
    const phase7Identity = data?.phase_7_identity
    const phase8Tracking = data?.phase_8_tracking
    const phase9Practical = data?.phase_9_practical_tests
    const goLiveTone = goLive?.status === 'ready' ? 'ok' : goLive?.status === 'blocked' ? 'risk' : 'warn'
    const postLaunchTone = postLaunch?.status === 'stable' ? 'ok' : postLaunch?.status === 'blocked' ? 'risk' : 'warn'
    const activePhase4 = activeCommand?.result?.pilger_phase4 || null
    const activePolicy = governance?.policies?.find(policy => policy.target_agent === activeCommand?.target_agent) || null
    const canSendActiveReturn = Boolean(
        activeCommand
        && activeCommand.pilger_return_pending
        && activeCommand.pilger_return_preview
        && !activeCommand.pilger_return_sent_at,
    )

    if (loading) return <AdminLoadingState message="Carregando WhatsApp Global..." />

    return (
        <div className="admin-dashboard whatsapp-global-page">
            {toast && (
                <div className={`global-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                    {toast.text}
                </div>
            )}

            <div className="admin-header global-header">
                <div>
                    <Link href="/admin/whatsapp" className="back-link">
                        <ArrowLeft size={18} /> WhatsApp
                    </Link>
                    <h1>WhatsApp Global</h1>
                    <p>Fila operacional de comandos, conversas internas e roteamento por perfil.</p>
                </div>
                <div className="global-header-actions">
                    <Link href="/admin/pilger-ai/agentes?agent=whatsapp-global-agent&setor=Diretoria" className="btn btn-outline">
                        <ShieldCheck size={16} /> Agente
                    </Link>
                    <Link href="/admin/ads/vitor" className="btn btn-outline">
                        <ExternalLink size={16} /> Vitor
                    </Link>
                    <Link href="/admin/whatsapp/global/pre-test" className="btn btn-outline">
                        <ClipboardList size={16} /> Pre-teste
                    </Link>
                    <button type="button" className="btn btn-outline" onClick={() => void runPilgerAutomation()} disabled={automationRunning}>
                        {automationRunning ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Fase 3
                    </button>
                    <button type="button" className="btn btn-gold" onClick={() => loadData(true)} disabled={refreshing}>
                        {refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Atualizar
                    </button>
                </div>
            </div>

            {error && (
                <section className="chart-card global-alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                </section>
            )}

            {!data?.ready && (
                <section className="chart-card global-alert warn">
                    <Database size={18} />
                    <span>Banco do WhatsApp Global ainda nao respondeu completamente. Confira migrations e permissoes.</span>
                </section>
            )}

            <section className="global-instance-strip">
                <div className="chart-card global-instance-card">
                    <span><ShieldCheck size={16} /> Instancia Global</span>
                    <strong>{data?.global_instance?.instance_name || 'Nao localizada'}</strong>
                    <small>{data?.global_instance?.status || 'sem status'} {data?.global_instance?.phone_masked ? `| ${data.global_instance.phone_masked}` : ''}</small>
                </div>
                <div className="chart-card global-identity-card">
                    <span><UserRound size={16} /> Identidades reconhecidas</span>
                    <div className="global-identity-grid">
                        <strong>{data?.identity_sources.admin_users_with_phone || 0}<small>admins</small></strong>
                        <strong>{data?.identity_sources.virtual_brokers_with_phone || 0}<small>corretores</small></strong>
                        <strong>{data?.identity_sources.broker_authorized_phones || 0}<small>autorizados</small></strong>
                        <strong>{(data?.identity_sources.property_owner_legacy_phones || 0) + (data?.identity_sources.property_owner_private_phones || 0)}<small>proprietarios</small></strong>
                    </div>
                </div>
            </section>

            <section className="global-metrics-grid">
                <MetricCard icon={<ClipboardList size={16} />} label="Comandos" value={data?.metrics.total_commands || 0} hint={`${data?.metrics.last_24h || 0} nas ultimas 24h`} />
                <MetricCard icon={<Clock3 size={16} />} label="Abertos" value={data?.metrics.open || 0} hint={`${data?.metrics.processing || 0} em processamento`} />
                <MetricCard icon={<MessageSquareText size={16} />} label="Sessoes" value={data?.metrics.global_sessions || 0} hint="Conversas registradas" />
                <MetricCard icon={<CheckCircle2 size={16} />} label="Concluidos" value={data?.metrics.completed || 0} hint={`${data?.metrics.failed || 0} falha(s)`} />
            </section>

            <section className="chart-card global-agent-desk-panel">
                <div className="global-section-title">
                    <span><ClipboardList size={16} /> Mesa dos agentes</span>
                    <strong>{data?.agent_desk?.totals?.return_pending_count || 0} retorno(s) pendente(s)</strong>
                </div>
                <div className="global-agent-desk-grid">
                    {agentDesk.map(agent => (
                        <button
                            key={agent.target_agent}
                            type="button"
                            className={`global-agent-desk-card ${targetFilter === agent.target_agent ? 'active' : ''}`}
                            onClick={() => {
                                setTargetFilter(agent.target_agent)
                                if (agent.next_return_command?.id) setActiveId(agent.next_return_command.id)
                                else if (agent.oldest_open_command?.id) setActiveId(agent.oldest_open_command.id)
                                else if (agent.latest_command?.id) setActiveId(agent.latest_command.id)
                            }}
                        >
                            <span>{agent.target_label}</span>
                            <strong>{agent.open_count}</strong>
                            <small>Abertos</small>
                            <div>
                                <em className={agent.return_pending_count ? 'warn' : 'ok'}>{agent.return_pending_count} retorno(s)</em>
                                <em>{agent.completed_count} concluidos</em>
                            </div>
                            <p>{agent.latest_command ? compact(agent.latest_command.command_text || agent.latest_command.command_label, 90) : 'Sem comandos recentes.'}</p>
                        </button>
                    ))}
                </div>
            </section>

            <section className={`chart-card global-automation-panel ${automation?.last_error ? 'risk' : automation?.last_escalations ? 'warn' : 'ok'}`}>
                <div className="global-section-title">
                    <span><RefreshCw size={16} /> Fase 3 automacao</span>
                    <strong>{automation?.enabled === false ? 'Pausada' : automation?.has_cron_secret ? 'Cron protegido' : 'Sem CRON_SECRET'}</strong>
                </div>
                <div className="global-automation-grid">
                    <article>
                        <span>Ultima checagem</span>
                        <strong>{formatDateTime(automation?.last_checked_at)}</strong>
                        <small>{automation?.last_reason || 'sem execucao registrada'}</small>
                    </article>
                    <article>
                        <span>Escalonamentos</span>
                        <strong>{automation?.last_escalations || 0}</strong>
                        <small>{automation?.cron_path || '/api/cron/pilger-global'} | {automation?.cron_schedule || '*/15 * * * *'}</small>
                    </article>
                    <article>
                        <span>Erro recente</span>
                        <strong>{automation?.last_error ? 'Atencao' : 'Sem erro'}</strong>
                        <small>{automation?.last_error || 'Automacao pronta para monitorar SLA e retornos pendentes.'}</small>
                    </article>
                    <button type="button" className="btn btn-gold" onClick={() => void runPilgerAutomation()} disabled={automationRunning}>
                        {automationRunning ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                        Rodar agora
                    </button>
                </div>
            </section>

            <section className={`chart-card global-governance-panel ${governance?.totals?.review_queue_count ? 'warn' : 'ok'}`}>
                <div className="global-section-title">
                    <span><ShieldCheck size={16} /> Fase 4 governanca</span>
                    <strong>{governance?.totals?.review_queue_count || 0} revisao(oes)</strong>
                </div>
                <div className="global-governance-grid">
                    <article>
                        <span>Politicas</span>
                        <strong>{governance?.totals?.policy_count || 0}</strong>
                        <small>Agentes cobertos por permissao, SLA, retorno e auditoria.</small>
                    </article>
                    <article>
                        <span>Fechamentos</span>
                        <strong>{governance?.totals?.phase4_closed_count || 0}</strong>
                        <small>{governance?.totals?.returned_count || 0} comando(s) ja tiveram retorno registrado.</small>
                    </article>
                    <article>
                        <span>Risco aberto</span>
                        <strong>{governance?.totals?.review_queue_count || 0}</strong>
                        <small>{governance?.totals?.phase3_escalated_count || 0} vieram de escalonamento da Fase 3.</small>
                    </article>
                </div>
                <div className="global-policy-strip">
                    {(governance?.policies || []).map(policy => (
                        <button
                            key={policy.target_agent}
                            type="button"
                            className={targetFilter === policy.target_agent ? 'active' : ''}
                            onClick={() => setTargetFilter(policy.target_agent)}
                        >
                            <strong>{policy.target_label}</strong>
                            <span>{policy.required_permission} | SLA {policy.sla_minutes}m</span>
                            <small>{policy.review_count || 0} revisao(oes)</small>
                        </button>
                    ))}
                </div>
            </section>

            {goLive && (
                <section className={`chart-card global-go-live-panel ${goLiveTone}`}>
                    <div className="global-section-title">
                        <span><ClipboardList size={16} /> Fase 5 go-live</span>
                        <strong>{goLive.score}% | {goLive.handoff?.mode || goLive.launch_state}</strong>
                    </div>
                    <div className="global-go-live-grid">
                        <article>
                            <span>Portao final</span>
                            <strong>{goLive.ready ? 'Liberado' : 'Atencao'}</strong>
                            <small>{goLive.handoff?.next_gate || 'Executar bateria final com evidencias.'}</small>
                        </article>
                        <article>
                            <span>Bloqueios</span>
                            <strong>{goLive.blockers}</strong>
                            <small>{goLive.warnings} watchpoint(s) antes da validacao final.</small>
                        </article>
                        <article>
                            <span>Evidencias</span>
                            <strong>{goLive.required_evidence.length}</strong>
                            <small>{goLive.rollback_plan.length} passo(s) de rollback documentados.</small>
                        </article>
                    </div>
                    <div className="global-go-live-checks">
                        {goLive.checklist.slice(0, 9).map(item => (
                            <span key={item.key} className={item.status === 'ok' ? 'ok' : item.status === 'missing' ? 'risk' : 'warn'}>
                                {item.status === 'ok' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                                {item.label}
                            </span>
                        ))}
                    </div>
                    <div className="global-go-live-runbook">
                        {goLive.final_test_runbook.slice(0, 3).map(step => (
                            <article key={step.step}>
                                <span>Passo {step.step}</span>
                                <strong>{step.label}</strong>
                                <p>{step.evidence}</p>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {postLaunch && (
                <section className={`chart-card global-post-launch-panel ${postLaunchTone}`}>
                    <div className="global-section-title">
                        <span><Database size={16} /> Fase 6 pos-go-live</span>
                        <strong>{postLaunch.score}% | {postLaunch.status}</strong>
                    </div>
                    <p className="global-post-launch-summary">{postLaunch.executive_summary}</p>
                    <div className="global-post-launch-grid">
                        <article>
                            <span>Comandos</span>
                            <strong>{postLaunch.metrics.total_commands || 0}</strong>
                            <small>{postLaunch.metrics.command_resolution_rate || 0}% com resolucao registrada.</small>
                        </article>
                        <article>
                            <span>Retornos</span>
                            <strong>{postLaunch.metrics.return_coverage_rate || 0}%</strong>
                            <small>{postLaunch.metrics.open_commands || 0} comando(s) ainda aberto(s).</small>
                        </article>
                        <article>
                            <span>Governanca</span>
                            <strong>{postLaunch.metrics.governance_coverage_rate || 0}%</strong>
                            <small>{postLaunch.watchpoints} watchpoint(s), {postLaunch.blockers} bloqueio(s).</small>
                        </article>
                    </div>
                    <div className="global-post-launch-signals">
                        {postLaunch.signals.slice(0, 9).map(signal => (
                            <span key={signal.key} className={signal.status === 'ok' ? 'ok' : signal.status === 'missing' ? 'risk' : 'warn'}>
                                {signal.status === 'ok' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                                {signal.label}
                            </span>
                        ))}
                    </div>
                    <div className="global-post-launch-window">
                        <strong>{postLaunch.next_operating_window?.label || 'producao assistida'}</strong>
                        <span>{postLaunch.next_operating_window?.duration || 'primeiras 24 horas'} | {postLaunch.next_operating_window?.cadence || 'revisao por ciclo'}</span>
                    </div>
                </section>
            )}

            {phase7Identity && (
                <section className={`chart-card global-post-launch-panel ${phase7Identity.code_complete ? 'ok' : 'warn'}`}>
                    <div className="global-section-title">
                        <span><ShieldCheck size={16} /> Fase 7 identidade</span>
                        <strong>{phase7Identity.score || 0}% | {phase7Identity.status}</strong>
                    </div>
                    <p className="global-post-launch-summary">{phase7Identity.detail}</p>
                    <div className="global-post-launch-grid">
                        <article>
                            <span>Perfis internos</span>
                            <strong>{phase7Identity.metrics?.internal_profiles || 0}</strong>
                            <small>Colegas/corretores/autorizados reconheciveis.</small>
                        </article>
                        <article>
                            <span>Proprietarios</span>
                            <strong>{phase7Identity.metrics?.owner_profiles || 0}</strong>
                            <small>Separados do funil de comprador.</small>
                        </article>
                        <article>
                            <span>Falhas de rota</span>
                            <strong>{phase7Identity.metrics?.route_failures || 0}</strong>
                            <small>Permissao antes de chamar agente.</small>
                        </article>
                    </div>
                    <div className="global-post-launch-signals">
                        {(phase7Identity.identity_rules || []).map(rule => (
                            <span key={rule.key} className="ok">
                                <CheckCircle2 size={13} />
                                {rule.label}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {phase8Tracking && (
                <section className={`chart-card global-post-launch-panel ${phase8Tracking.code_complete ? 'ok' : 'warn'}`}>
                    <div className="global-section-title">
                        <span><ClipboardList size={16} /> Fase 8 painel</span>
                        <strong>{phase8Tracking.score || 0}% | {phase8Tracking.status}</strong>
                    </div>
                    <p className="global-post-launch-summary">{phase8Tracking.detail}</p>
                    <div className="global-post-launch-grid">
                        <article>
                            <span>Comandos</span>
                            <strong>{phase8Tracking.metrics?.total_commands || 0}</strong>
                            <small>Pedidos recebidos pelo Global.</small>
                        </article>
                        <article>
                            <span>Agentes</span>
                            <strong>{phase8Tracking.metrics?.agent_count || 0}</strong>
                            <small>Mesa operacional acompanhada.</small>
                        </article>
                        <article>
                            <span>Retornos</span>
                            <strong>{phase8Tracking.metrics?.returned_count || 0}</strong>
                            <small>{phase8Tracking.metrics?.return_pending_count || 0} pendente(s).</small>
                        </article>
                    </div>
                    <div className="global-post-launch-signals">
                        {(phase8Tracking.tracking_fields || []).map(field => (
                            <span key={field} className="ok">
                                <CheckCircle2 size={13} />
                                {field}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {phase9Practical && (
                <section className={`chart-card global-post-launch-panel ${phase9Practical.code_complete ? 'ok' : 'warn'}`}>
                    <div className="global-section-title">
                        <span><MessageSquareText size={16} /> Fase 9 testes praticos</span>
                        <strong>{phase9Practical.score || 0}% | {phase9Practical.status}</strong>
                    </div>
                    <p className="global-post-launch-summary">{phase9Practical.detail}</p>
                    <div className="global-post-launch-grid">
                        <article>
                            <span>Cenarios</span>
                            <strong>{phase9Practical.automated_results?.total_scenarios || 0}</strong>
                            <small>{phase9Practical.automated_results?.route_scenarios || 0} simulacao(oes) de rota.</small>
                        </article>
                        <article>
                            <span>Falhas</span>
                            <strong>{phase9Practical.automated_results?.failed_routes || 0}</strong>
                            <small>{phase9Practical.automated_results?.blocked_permission_scenarios || 0} bloqueio(s) de permissao coberto(s).</small>
                        </article>
                        <article>
                            <span>Agentes cobertos</span>
                            <strong>{phase9Practical.automated_results?.covered_agents?.length || 0}</strong>
                            <small>Vitor, editorial, financeiro, imoveis e CEO.</small>
                        </article>
                    </div>
                    <div className="global-post-launch-signals">
                        {(phase9Practical.practical_messages || []).slice(0, 9).map(item => (
                            <span key={item.key} className="ok">
                                <CheckCircle2 size={13} />
                                {item.label}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            <section className="chart-card global-access-panel">
                <div className="global-section-title">
                    <span><KeyRound size={16} /> Acessos do Pilger</span>
                    <strong>{identityOverrides.filter(identity => identity.is_active).length} ativo(s)</strong>
                </div>

                {identityError && (
                    <div className="global-access-error">
                        <AlertTriangle size={15} />
                        {identityError}
                    </div>
                )}

                <div className="global-access-grid">
                    <form
                        className="global-access-form"
                        onSubmit={(event) => {
                            event.preventDefault()
                            void saveIdentityOverride()
                        }}
                    >
                        <div className="global-access-form-head">
                            <strong>{identityDraft.id ? 'Editar colega' : 'Cadastrar colega'}</strong>
                            {identityDraft.id && (
                                <button type="button" onClick={resetIdentityDraft}>
                                    <UserPlus size={14} /> Novo
                                </button>
                            )}
                        </div>
                        <div className="global-access-fields">
                            <label>
                                <span>Telefone</span>
                                <input
                                    value={identityDraft.phone}
                                    onChange={event => setIdentityDraft(current => ({ ...current, phone: event.target.value }))}
                                    placeholder="5547999999999"
                                />
                            </label>
                            <label>
                                <span>Nome</span>
                                <input
                                    value={identityDraft.display_name}
                                    onChange={event => setIdentityDraft(current => ({ ...current, display_name: event.target.value }))}
                                    placeholder="Nome do colega"
                                />
                            </label>
                            <label>
                                <span>Perfil</span>
                                <select
                                    value={identityDraft.identity_type}
                                    onChange={event => {
                                        const nextType = event.target.value
                                        setIdentityDraft(current => ({
                                            ...current,
                                            identity_type: nextType,
                                            permission_keys: nextType === 'blocked' ? [] : current.permission_keys,
                                        }))
                                    }}
                                >
                                    {GLOBAL_IDENTITY_TYPE_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>Status</span>
                                <select
                                    value={identityDraft.is_active ? 'active' : 'inactive'}
                                    onChange={event => setIdentityDraft(current => ({ ...current, is_active: event.target.value === 'active' }))}
                                >
                                    <option value="active">Ativo</option>
                                    <option value="inactive">Pausado</option>
                                </select>
                            </label>
                        </div>

                        <div className="global-permission-grid">
                            {PILGER_PERMISSION_OPTIONS.map(option => {
                                const active = identityDraft.permission_keys.includes(option.key)
                                const disabled = identityDraft.identity_type === 'blocked'
                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        className={active ? 'active' : ''}
                                        disabled={disabled}
                                        onClick={() => toggleDraftPermission(option.key)}
                                    >
                                        <span>{option.label}</span>
                                    </button>
                                )
                            })}
                        </div>

                        <label className="global-access-note">
                            <span>Observacao</span>
                            <textarea
                                value={identityDraft.notes}
                                onChange={event => setIdentityDraft(current => ({ ...current, notes: event.target.value }))}
                                placeholder="Ex.: Guilherme pode acionar financeiro e relatorios. Vitor pode receber campanhas de trafego."
                                rows={3}
                            />
                        </label>

                        <button type="submit" className="btn btn-gold" disabled={identitySaving}>
                            {identitySaving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                            Salvar acesso
                        </button>
                    </form>

                    <div className="global-access-list">
                        <div className="global-access-list-head">
                            <span>Overrides cadastrados</span>
                            <button type="button" onClick={() => void loadIdentityOverrides()} disabled={identityLoading}>
                                {identityLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                                Atualizar
                            </button>
                        </div>
                        {identityLoading ? (
                            <div className="global-access-empty">
                                <Loader2 size={16} className="spin" />
                                Carregando acessos...
                            </div>
                        ) : identityOverrides.length === 0 ? (
                            <div className="global-access-empty">Nenhum acesso manual cadastrado ainda.</div>
                        ) : (
                            identityOverrides.map(identity => (
                                <article key={identity.id} className={`global-access-item ${identity.is_active ? '' : 'inactive'}`}>
                                    <div>
                                        <strong>{identity.display_name || identity.phone_masked}</strong>
                                        <p>{identity.phone_masked} | {identityTypeOptionLabel(identity.identity_type)}</p>
                                        <small>{identity.permission_keys.length ? identity.permission_keys.join(', ') : 'sem permissoes operacionais'}</small>
                                    </div>
                                    <div className="global-access-actions">
                                        <button type="button" onClick={() => editIdentityOverride(identity)}>
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSimulationDraft(current => ({
                                                ...current,
                                                phone: identity.phone,
                                                sender_name: identity.display_name || current.sender_name,
                                            }))}
                                        >
                                            Testar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void toggleIdentityActive(identity)}
                                            disabled={updating === `${identity.id}:identity`}
                                        >
                                            {updating === `${identity.id}:identity` ? <Loader2 size={13} className="spin" /> : null}
                                            {identity.is_active ? 'Pausar' : 'Ativar'}
                                        </button>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </div>
            </section>

            <section className="chart-card global-simulator-panel">
                <div className="global-section-title">
                    <span><Route size={16} /> Simular Pilger</span>
                    <strong>{simulationResult ? (simulationResult.route.allowed ? 'Liberado' : 'Bloqueado') : 'Dry-run'}</strong>
                </div>

                {simulationError && (
                    <div className="global-access-error">
                        <AlertTriangle size={15} />
                        {simulationError}
                    </div>
                )}

                <div className="global-simulator-grid">
                    <form
                        className="global-simulator-form"
                        onSubmit={(event) => {
                            event.preventDefault()
                            void runPilgerSimulation()
                        }}
                    >
                        <div className="global-access-fields">
                            <label>
                                <span>Telefone</span>
                                <input
                                    value={simulationDraft.phone}
                                    onChange={event => setSimulationDraft(current => ({ ...current, phone: event.target.value }))}
                                    placeholder="5547999999999"
                                />
                            </label>
                            <label>
                                <span>Nome opcional</span>
                                <input
                                    value={simulationDraft.sender_name}
                                    onChange={event => setSimulationDraft(current => ({ ...current, sender_name: event.target.value }))}
                                    placeholder="Nome visto no WhatsApp"
                                />
                            </label>
                        </div>
                        <label className="global-access-note">
                            <span>Mensagem</span>
                            <textarea
                                value={simulationDraft.message}
                                onChange={event => setSimulationDraft(current => ({ ...current, message: event.target.value }))}
                                rows={3}
                                placeholder="Ex.: Suba uma campanha de trafego com esse criativo"
                            />
                        </label>
                        <label className="global-simulator-media-toggle">
                            <input
                                type="checkbox"
                                checked={simulationDraft.has_media}
                                onChange={event => setSimulationDraft(current => ({ ...current, has_media: event.target.checked }))}
                            />
                            <span>Simular mensagem com midia/comprovante</span>
                        </label>
                        <button type="submit" className="btn btn-gold" disabled={simulationLoading}>
                            {simulationLoading ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                            Simular rota
                        </button>
                        <button type="button" className="btn btn-outline" disabled={simulationSuiteLoading} onClick={() => void runPilgerSimulationSuite()}>
                            {simulationSuiteLoading ? <Loader2 size={15} className="spin" /> : <ClipboardList size={15} />}
                            Bateria Pilger
                        </button>
                    </form>

                    <div className="global-simulator-result">
                        {!simulationResult ? (
                            <div className="global-access-empty">Informe telefone e mensagem para ver como o Pilger decide.</div>
                        ) : (
                            <>
                                <div className={`global-simulator-verdict ${simulationResult.route.allowed ? 'ok' : 'risk'}`}>
                                    <strong>{simulationResult.route.allowed ? 'Permissao liberada' : 'Permissao bloqueada'}</strong>
                                    <span>{simulationResult.route.target_agent_name} | {simulationResult.route.execution_mode}</span>
                                </div>
                                <div className="global-simulator-cards">
                                    <span><strong>Identidade</strong>{identityTypeOptionLabel(simulationResult.identity.type)} | {simulationResult.identity.label}</span>
                                    <span><strong>Fonte</strong>{simulationResult.identity.source} | {simulationResult.identity.confidence}%</span>
                                    <span><strong>Intencao</strong>{simulationResult.intent.label} | {simulationResult.intent.command_type}</span>
                                    <span><strong>Permissao</strong>{simulationResult.route.required_permission || 'sem exigencia'}</span>
                                </div>
                                {simulationResult.finance_preview && (
                                    <div className={`global-simulator-finance ${simulationResult.finance_preview.will_create_finance_action ? 'ok' : simulationResult.finance_preview.requires_whatsapp_response ? 'warn' : 'risk'}`}>
                                        <strong>Fluxo financeiro</strong>
                                        <p>{simulationResult.finance_preview.detail}</p>
                                        <span>
                                            {simulationResult.finance_preview.counterparty_type
                                                ? `Classificacao: ${simulationResult.finance_preview.counterparty_type === 'pessoa_fisica' ? 'CPF / pessoa fisica' : 'CNPJ / pessoa juridica'}`
                                                : 'Aguardando classificacao CPF/CNPJ'}
                                            {simulationResult.finance_preview.pending_command_id ? ` | Pendencia: ${simulationResult.finance_preview.pending_command_id}` : ''}
                                        </span>
                                    </div>
                                )}
                                <div className="global-simulator-response">
                                    <strong>Resposta que o Pilger daria</strong>
                                    <p>{simulationResult.acknowledgement}</p>
                                </div>
                                {simulationSuite.length > 0 && (
                                    <div className="global-simulator-suite">
                                        {simulationSuite.map(row => (
                                            <button
                                                key={row.scenario_key || `${row.intent.command_type}:${row.message}`}
                                                type="button"
                                                className={simulationResult?.scenario_key === row.scenario_key ? 'active' : ''}
                                                onClick={() => setSimulationResult(row)}
                                            >
                                                <span>{row.scenario_label || row.intent.label}</span>
                                                <strong>{row.route.target_agent_name}</strong>
                                                <small>{row.route.allowed ? 'Liberado' : 'Bloqueado'} | {row.intent.command_type}</small>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </section>

            <section className="chart-card global-toolbar">
                <div>
                    <Filter size={16} />
                    <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                        <option value="all">Todos os status</option>
                        {(data?.options.statuses || []).map(status => (
                            <option key={status} value={status}>{statusLabel(status)}</option>
                        ))}
                    </select>
                    <select value={targetFilter} onChange={event => setTargetFilter(event.target.value)}>
                        <option value="all">Todos os destinos</option>
                        {(data?.options.targets || []).map(target => (
                            <option key={target.value} value={target.value}>{target.label}</option>
                        ))}
                    </select>
                </div>
                <span>{commands.length} item(ns) na visao atual</span>
            </section>

            <div className="global-layout">
                <section className="chart-card global-command-list">
                    <div className="global-section-title">
                        <span>Fila de comandos</span>
                        <strong>{commands.length}</strong>
                    </div>
                    <div className="global-list-scroll">
                        {commands.map(command => (
                            <button
                                key={command.id}
                                type="button"
                                className={`global-command-item ${activeCommand?.id === command.id ? 'active' : ''}`}
                                onClick={() => setActiveId(command.id)}
                            >
                                <div className={`global-status-dot ${statusTone(command.status)}`} />
                                <div>
                                    <strong>{command.identity_label || command.phone_masked}</strong>
                                    <p>{compact(command.command_text || command.session?.last_user_message || command.command_label, 140)}</p>
                                    <span>{command.command_label} | {command.target_label} | {formatDateTime(command.created_at)}</span>
                                </div>
                                <em className={statusTone(command.status)}>{statusLabel(command.status)}</em>
                            </button>
                        ))}
                        {commands.length === 0 && (
                            <div className="global-empty">
                                <MessageSquareText size={28} />
                                <span>Nenhum comando neste filtro.</span>
                            </div>
                        )}
                    </div>
                </section>

                <main className="global-detail">
                    {!activeCommand ? (
                        <section className="chart-card global-empty-detail">
                            <Route size={32} />
                            <h2>Aguardando comandos</h2>
                            <p>Quando o WhatsApp Global receber mensagens internas ou ordens operacionais, elas aparecem aqui.</p>
                        </section>
                    ) : (
                        <>
                            <section className="chart-card global-detail-hero">
                                <div className={`global-hero-status ${statusTone(activeCommand.status)}`}>
                                    <span>Status</span>
                                    <strong>{statusLabel(activeCommand.status)}</strong>
                                </div>
                                <div className="global-detail-main">
                                    <div className="global-chips">
                                        <span>{identityLabel(activeCommand.identity_type)}</span>
                                        <span>{activeCommand.command_label}</span>
                                        <span>{activeCommand.target_label}</span>
                                    </div>
                                    <h2>{activeCommand.identity_label || activeCommand.phone_masked}</h2>
                                    <p>{activeCommand.command_text || activeCommand.session?.last_user_message || 'Sem texto registrado.'}</p>
                                    <div className="global-action-row">
                                        {canProcessActiveCommand && (
                                            <button
                                                type="button"
                                                className="btn btn-gold"
                                                onClick={() => processWithPilger(activeCommand.id)}
                                                disabled={Boolean(updating)}
                                            >
                                                {updating === `${activeCommand.id}:process_pilger` ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                                                Processar {activeCommand.target_label}
                                            </button>
                                        )}
                                        {canSendActiveReturn && (
                                            <button
                                                type="button"
                                                className="btn btn-gold"
                                                onClick={() => void sendPilgerReturn(activeCommand)}
                                                disabled={Boolean(updating)}
                                            >
                                                {updating === `${activeCommand.id}:send_return` ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                                                Retornar usuario
                                            </button>
                                        )}
                                        {['queued', 'processing', 'completed', 'failed', 'cancelled'].map(status => (
                                            <button
                                                key={status}
                                                type="button"
                                                className={`btn ${status === 'completed' ? 'btn-gold' : 'btn-outline'} ${status === 'failed' || status === 'cancelled' ? 'danger' : ''}`}
                                                onClick={() => updateStatus(activeCommand.id, status)}
                                                disabled={Boolean(updating)}
                                            >
                                                {updating === `${activeCommand.id}:${status}` ? <Loader2 size={15} className="spin" /> : status === 'completed' ? <CheckCircle2 size={15} /> : status === 'failed' || status === 'cancelled' ? <XCircle size={15} /> : <Clock3 size={15} />}
                                                {statusLabel(status)}
                                            </button>
                                        ))}
                                        <button type="button" className="btn btn-outline" onClick={() => copyCommand(activeCommand.command_text)}>
                                            <ClipboardList size={15} /> Copiar
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section className="global-info-grid">
                                <article className="chart-card global-info-card">
                                    <span>Origem</span>
                                    <strong>{activeCommand.phone_masked}</strong>
                                    <p>{identityLabel(activeCommand.identity_type)} | Permissao: {activeCommand.required_permission || 'sem exigencia'}</p>
                                </article>
                                <article className="chart-card global-info-card">
                                    <span>Destino</span>
                                    <strong>{activeCommand.target_label}</strong>
                                    <p>{activeCommand.command_type} | {formatDateTime(activeCommand.created_at)}</p>
                                </article>
                                <article className="chart-card global-info-card">
                                    <span>Sessao</span>
                                    <strong>{activeCommand.session?.message_count || 0} mensagens</strong>
                                    <p>{activeCommand.session_id || 'sem sessao vinculada'}</p>
                                </article>
                            </section>

                            {activeFinanceState && (
                                <section className="chart-card global-finance-state-card">
                                    <div className={`global-finance-state-icon ${activeFinanceState.tone}`}>
                                        <Database size={18} />
                                    </div>
                                    <div>
                                        <span>Financeiro</span>
                                        <strong>{activeFinanceState.title}</strong>
                                        <p>{activeFinanceState.description}</p>
                                        <small>{activeFinanceState.meta}</small>
                                    </div>
                                    <Link href="/admin/pilger-ai/agentes?agent=whatsapp-global-agent&setor=Diretoria" className="btn btn-outline">
                                        <ExternalLink size={15} /> Abrir fila
                                    </Link>
                                </section>
                            )}

                            {activeCommand.pilger_return_preview && (
                                <section className={`chart-card global-return-card ${activeCommand.pilger_return_sent_at ? 'ok' : activeCommand.pilger_return_pending ? 'warn' : 'neutral'}`}>
                                    <div>
                                        <span>Retorno do Pilger</span>
                                        <strong>
                                            {activeCommand.pilger_return_sent_at
                                                ? `Enviado em ${formatDateTime(activeCommand.pilger_return_sent_at)}`
                                                : activeCommand.pilger_return_pending
                                                    ? 'Aguardando envio ao usuario'
                                                    : 'Preview operacional'}
                                        </strong>
                                        <p>{activeCommand.pilger_return_preview}</p>
                                    </div>
                                    <div className="global-return-actions">
                                        {canSendActiveReturn && (
                                            <button
                                                type="button"
                                                className="btn btn-gold"
                                                onClick={() => void sendPilgerReturn(activeCommand)}
                                                disabled={Boolean(updating)}
                                            >
                                                {updating === `${activeCommand.id}:send_return` ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                                                Enviar
                                            </button>
                                        )}
                                        <button type="button" className="btn btn-outline" onClick={() => copyCommand(activeCommand.pilger_return_preview)}>
                                            <ClipboardList size={15} /> Copiar
                                        </button>
                                    </div>
                                </section>
                            )}

                            {activePolicy && (
                                <section className={`chart-card global-governance-detail-card ${activePhase4?.closed_at ? 'ok' : 'warn'}`}>
                                    <div className="global-governance-detail-copy">
                                        <span>Governanca Fase 4</span>
                                        <strong>
                                            {activePhase4?.closed_at
                                                ? `Fechado em ${formatDateTime(activePhase4.closed_at)}`
                                                : `Politica: ${activePolicy.target_label}`}
                                        </strong>
                                        <p>{activePhase4?.learning || activePolicy.audit_focus}</p>
                                        <div className="global-governance-detail-tags">
                                            <em>Permissao: {activePolicy.required_permission}</em>
                                            <em>SLA: {activePolicy.sla_minutes}m</em>
                                            <em>{activePolicy.approval_required ? 'Aprovacao humana' : 'Sem aprovacao obrigatoria'}</em>
                                            <em>{activeCommand.pilger_return_sent_at ? 'Retorno enviado' : 'Retorno pendente'}</em>
                                        </div>
                                    </div>
                                    <div className="global-governance-close-box">
                                        <textarea
                                            value={governanceLearning}
                                            onChange={event => setGovernanceLearning(event.target.value)}
                                            rows={3}
                                            placeholder="Aprendizado operacional opcional para este comando"
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-gold"
                                            onClick={() => void closePilgerGovernance(activeCommand)}
                                            disabled={Boolean(updating)}
                                        >
                                            {updating === `${activeCommand.id}:close_governance` ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
                                            Registrar governanca
                                        </button>
                                    </div>
                                </section>
                            )}

                            <section className="global-bottom-grid">
                                <article className="chart-card global-history-card">
                                    <div className="global-section-title">
                                        <span>Historico da sessao</span>
                                        <strong>{activeCommand.session?.message_count || 0}</strong>
                                    </div>
                                    <div className="global-message-list">
                                        {(activeCommand.session?.messages || []).map((message, index) => (
                                            <div key={`${message.timestamp || index}-${index}`} className={`global-message ${message.role === 'assistant' ? 'assistant' : 'user'}`}>
                                                <span>{message.role === 'assistant' ? 'Global' : 'Contato'} {message.has_media ? '| midia' : ''}</span>
                                                <p>{message.content}</p>
                                                <small>{formatDateTime(message.timestamp)}</small>
                                            </div>
                                        ))}
                                        {!activeCommand.session?.messages?.length && (
                                            <span className="global-muted">Sem historico carregado para esta sessao.</span>
                                        )}
                                    </div>
                                </article>

                                <article className="chart-card global-json-card">
                                    <div className="global-section-title">
                                        <span>Dados operacionais</span>
                                        <strong>JSON</strong>
                                    </div>
                                    <h3>Payload</h3>
                                    <JsonBlock value={activeCommand.payload} />
                                    <h3>Resultado</h3>
                                    <JsonBlock value={activeCommand.result} />
                                </article>
                            </section>
                        </>
                    )}
                </main>
            </div>

            <style jsx global>{`
                .global-header,
                .global-header-actions,
                .global-action-row,
                .global-toolbar,
                .global-toolbar > div,
                .global-chips {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .global-header {
                    justify-content: space-between;
                }

                .global-instance-strip,
                .global-metrics-grid,
                .global-info-grid,
                .global-bottom-grid {
                    display: grid;
                    gap: 14px;
                }

                .global-instance-strip {
                    grid-template-columns: minmax(280px, .8fr) minmax(0, 1.2fr);
                    margin-bottom: 16px;
                }

                .global-metrics-grid {
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    margin-bottom: 16px;
                }

                .global-info-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                .global-bottom-grid {
                    grid-template-columns: minmax(0, 1.05fr) minmax(320px, .95fr);
                }

                .global-instance-card,
                .global-identity-card,
                .global-metric-card,
                .global-info-card {
                    padding: 16px;
                }

                .global-instance-card > span,
                .global-identity-card > span,
                .global-metric-card > span,
                .global-info-card > span {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    color: var(--text-muted);
                    font-size: .7rem;
                    font-weight: 900;
                    letter-spacing: .08em;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                }

                .global-instance-card svg,
                .global-identity-card svg,
                .global-metric-card svg {
                    color: var(--gold);
                }

                .global-instance-card strong,
                .global-info-card strong {
                    display: block;
                    color: var(--text-primary);
                    font-size: 1.08rem;
                    margin-bottom: 5px;
                }

                .global-instance-card small,
                .global-info-card p,
                .global-metric-card small,
                .global-toolbar > span,
                .global-muted {
                    color: var(--text-muted);
                    font-size: .78rem;
                    line-height: 1.4;
                }

                .global-identity-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 8px;
                }

                .global-identity-grid strong {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    background: rgba(255,255,255,.72);
                    color: var(--text-primary);
                    display: grid;
                    gap: 3px;
                    padding: 10px;
                }

                .global-identity-grid small {
                    color: var(--text-muted);
                    font-size: .66rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .global-access-panel {
                    margin-bottom: 16px;
                    padding: 16px;
                }

                .global-agent-desk-panel {
                    margin-bottom: 16px;
                    padding: 16px;
                }

                .global-automation-panel {
                    margin-bottom: 16px;
                    padding: 16px;
                    border-left: 4px solid #047857;
                }

                .global-automation-panel.warn {
                    border-left-color: #b45309;
                }

                .global-automation-panel.risk {
                    border-left-color: #b91c1c;
                }

                .global-automation-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
                    gap: 10px;
                    align-items: stretch;
                }

                .global-automation-grid article {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 8px;
                    background: rgba(255,255,255,.78);
                    display: grid;
                    align-content: start;
                    gap: 5px;
                    min-height: 92px;
                    padding: 12px;
                }

                .global-automation-grid article span {
                    color: var(--text-muted);
                    font-size: .66rem;
                    font-weight: 900;
                    letter-spacing: .06em;
                    text-transform: uppercase;
                }

                .global-automation-grid article strong {
                    color: var(--text-primary);
                    font-size: 1rem;
                    line-height: 1.2;
                }

                .global-automation-grid article small {
                    color: var(--text-muted);
                    font-size: .74rem;
                    line-height: 1.35;
                    overflow-wrap: anywhere;
                }

                .global-automation-grid > .btn {
                    align-self: center;
                    justify-content: center;
                    min-width: 132px;
                    min-height: 42px;
                }

                .global-governance-panel {
                    margin-bottom: 16px;
                    padding: 16px;
                    border-left: 4px solid #047857;
                }

                .global-governance-panel.warn {
                    border-left-color: #b45309;
                }

                .global-governance-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                    margin-bottom: 12px;
                }

                .global-governance-grid article {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 8px;
                    background: rgba(255,255,255,.78);
                    display: grid;
                    gap: 5px;
                    min-height: 92px;
                    padding: 12px;
                }

                .global-governance-grid article span,
                .global-governance-detail-copy > span {
                    color: var(--text-muted);
                    font-size: .66rem;
                    font-weight: 900;
                    letter-spacing: .06em;
                    text-transform: uppercase;
                }

                .global-governance-grid article strong {
                    color: var(--text-primary);
                    font-size: 1.35rem;
                    line-height: 1;
                }

                .global-governance-grid article small,
                .global-policy-strip span,
                .global-policy-strip small {
                    color: var(--text-muted);
                    font-size: .74rem;
                    line-height: 1.35;
                }

                .global-policy-strip {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                }

                .global-policy-strip button {
                    appearance: none;
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 8px;
                    background: rgba(255,255,255,.78);
                    cursor: pointer;
                    display: grid;
                    gap: 4px;
                    min-height: 78px;
                    padding: 10px;
                    text-align: left;
                }

                .global-policy-strip button.active,
                .global-policy-strip button:hover {
                    border-color: rgba(201, 169, 110, .55);
                    background: rgba(201, 169, 110, .1);
                }

                .global-policy-strip strong {
                    color: var(--text-primary);
                    font-size: .8rem;
                    line-height: 1.25;
                }

                .global-go-live-panel {
                    margin-bottom: 16px;
                    padding: 16px;
                    border-left: 4px solid #047857;
                }

                .global-go-live-panel.warn {
                    border-left-color: #b45309;
                }

                .global-go-live-panel.risk {
                    border-left-color: #b91c1c;
                }

                .global-go-live-grid,
                .global-go-live-runbook {
                    display: grid;
                    gap: 10px;
                }

                .global-go-live-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    margin-bottom: 12px;
                }

                .global-go-live-grid article,
                .global-go-live-runbook article {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 8px;
                    background: rgba(255,255,255,.78);
                    display: grid;
                    align-content: start;
                    gap: 5px;
                    padding: 12px;
                }

                .global-go-live-grid article {
                    min-height: 92px;
                }

                .global-go-live-grid article span,
                .global-go-live-runbook article span {
                    color: var(--text-muted);
                    font-size: .66rem;
                    font-weight: 900;
                    letter-spacing: .06em;
                    text-transform: uppercase;
                }

                .global-go-live-grid article strong {
                    color: var(--text-primary);
                    font-size: 1.18rem;
                    line-height: 1.1;
                }

                .global-go-live-grid article small,
                .global-go-live-runbook article p {
                    color: var(--text-muted);
                    font-size: .74rem;
                    line-height: 1.35;
                    margin: 0;
                    overflow-wrap: anywhere;
                }

                .global-go-live-checks {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 7px;
                    margin-bottom: 12px;
                }

                .global-go-live-checks span {
                    border-radius: 999px;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    font-size: .68rem;
                    font-weight: 900;
                    padding: 6px 9px;
                    text-transform: uppercase;
                }

                .global-go-live-checks span.ok {
                    background: rgba(4, 120, 87, .1);
                    color: #047857;
                }

                .global-go-live-checks span.warn {
                    background: rgba(180, 83, 9, .12);
                    color: #92400e;
                }

                .global-go-live-checks span.risk {
                    background: rgba(185, 28, 28, .1);
                    color: #b91c1c;
                }

                .global-go-live-runbook {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                .global-go-live-runbook article strong {
                    color: var(--text-primary);
                    font-size: .86rem;
                    line-height: 1.25;
                }

                .global-post-launch-panel {
                    margin-bottom: 16px;
                    padding: 16px;
                    border-left: 4px solid #047857;
                }

                .global-post-launch-panel.warn {
                    border-left-color: #b45309;
                }

                .global-post-launch-panel.risk {
                    border-left-color: #b91c1c;
                }

                .global-post-launch-summary {
                    color: var(--text-muted);
                    font-size: .84rem;
                    line-height: 1.45;
                    margin: 0 0 12px;
                }

                .global-post-launch-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                    margin-bottom: 12px;
                }

                .global-post-launch-grid article {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 8px;
                    background: rgba(255,255,255,.78);
                    display: grid;
                    gap: 5px;
                    min-height: 92px;
                    padding: 12px;
                }

                .global-post-launch-grid article span {
                    color: var(--text-muted);
                    font-size: .66rem;
                    font-weight: 900;
                    letter-spacing: .06em;
                    text-transform: uppercase;
                }

                .global-post-launch-grid article strong {
                    color: var(--text-primary);
                    font-size: 1.18rem;
                    line-height: 1.1;
                }

                .global-post-launch-grid article small,
                .global-post-launch-window span {
                    color: var(--text-muted);
                    font-size: .74rem;
                    line-height: 1.35;
                    overflow-wrap: anywhere;
                }

                .global-post-launch-signals {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 7px;
                    margin-bottom: 12px;
                }

                .global-post-launch-signals span {
                    border-radius: 999px;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    font-size: .68rem;
                    font-weight: 900;
                    padding: 6px 9px;
                    text-transform: uppercase;
                }

                .global-post-launch-signals span.ok {
                    background: rgba(4, 120, 87, .1);
                    color: #047857;
                }

                .global-post-launch-signals span.warn {
                    background: rgba(180, 83, 9, .12);
                    color: #92400e;
                }

                .global-post-launch-signals span.risk {
                    background: rgba(185, 28, 28, .1);
                    color: #b91c1c;
                }

                .global-post-launch-window {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 8px;
                    background: rgba(17, 24, 39, .035);
                    display: grid;
                    gap: 4px;
                    padding: 11px 12px;
                }

                .global-post-launch-window strong {
                    color: var(--text-primary);
                    font-size: .86rem;
                    text-transform: uppercase;
                }

                .global-agent-desk-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                }

                .global-agent-desk-card {
                    appearance: none;
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 8px;
                    background: rgba(255,255,255,.78);
                    cursor: pointer;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 4px 10px;
                    min-height: 138px;
                    padding: 12px;
                    text-align: left;
                    transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
                }

                .global-agent-desk-card:hover,
                .global-agent-desk-card.active {
                    border-color: rgba(201, 169, 110, .55);
                    box-shadow: 0 0 0 3px rgba(201, 169, 110, .1);
                    transform: translateY(-1px);
                }

                .global-agent-desk-card > span {
                    color: var(--text-primary);
                    font-size: .82rem;
                    font-weight: 900;
                    line-height: 1.25;
                }

                .global-agent-desk-card > strong {
                    color: var(--gold);
                    font-size: 1.55rem;
                    line-height: 1;
                    text-align: right;
                }

                .global-agent-desk-card > small {
                    color: var(--text-muted);
                    font-size: .66rem;
                    font-weight: 900;
                    letter-spacing: .06em;
                    text-transform: uppercase;
                }

                .global-agent-desk-card > div {
                    display: flex;
                    justify-content: flex-end;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .global-agent-desk-card em {
                    border-radius: 999px;
                    background: rgba(17, 24, 39, .06);
                    color: var(--text-muted);
                    font-size: .64rem;
                    font-style: normal;
                    font-weight: 900;
                    padding: 4px 7px;
                    white-space: nowrap;
                }

                .global-agent-desk-card em.warn {
                    background: rgba(180, 83, 9, .12);
                    color: #92400e;
                }

                .global-agent-desk-card em.ok {
                    background: rgba(4, 120, 87, .1);
                    color: #047857;
                }

                .global-agent-desk-card p {
                    grid-column: 1 / -1;
                    color: var(--text-muted);
                    font-size: .74rem;
                    line-height: 1.35;
                    margin: 8px 0 0;
                    overflow-wrap: anywhere;
                }

                .global-simulator-panel {
                    margin-bottom: 16px;
                    padding: 16px;
                }

                .global-access-grid {
                    display: grid;
                    grid-template-columns: minmax(320px, .95fr) minmax(0, 1.05fr);
                    gap: 14px;
                    align-items: start;
                }

                .global-simulator-grid {
                    display: grid;
                    grid-template-columns: minmax(320px, .85fr) minmax(0, 1.15fr);
                    gap: 14px;
                    align-items: start;
                }

                .global-access-form,
                .global-access-list,
                .global-simulator-form,
                .global-simulator-result {
                    display: grid;
                    gap: 12px;
                    min-width: 0;
                }

                .global-access-form-head,
                .global-access-list-head,
                .global-access-actions,
                .global-access-error {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    flex-wrap: wrap;
                }

                .global-access-form-head,
                .global-access-list-head {
                    justify-content: space-between;
                }

                .global-access-form-head strong,
                .global-access-list-head span {
                    color: var(--text-primary);
                    font-size: .88rem;
                    font-weight: 900;
                }

                .global-access-form-head button,
                .global-access-list-head button,
                .global-access-actions button {
                    border: 1px solid rgba(17, 24, 39, .1);
                    border-radius: 9px;
                    background: #fff;
                    color: var(--text-primary);
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: .72rem;
                    font-weight: 900;
                    padding: 7px 9px;
                    cursor: pointer;
                }

                .global-access-fields {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                }

                .global-access-fields label,
                .global-access-note {
                    display: grid;
                    gap: 5px;
                }

                .global-access-fields span,
                .global-access-note span {
                    color: var(--text-muted);
                    font-size: .66rem;
                    font-weight: 900;
                    letter-spacing: .06em;
                    text-transform: uppercase;
                }

                .global-access-fields input,
                .global-access-fields select,
                .global-access-note textarea {
                    border: 1px solid rgba(17, 24, 39, .1);
                    border-radius: 10px;
                    background: #fff;
                    color: var(--text-primary);
                    font: inherit;
                    font-size: .82rem;
                    outline: none;
                    padding: 10px 11px;
                    width: 100%;
                }

                .global-access-note textarea {
                    resize: vertical;
                }

                .global-permission-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 7px;
                }

                .global-permission-grid button {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 9px;
                    background: rgba(255,255,255,.74);
                    color: var(--text-muted);
                    font-size: .7rem;
                    font-weight: 900;
                    min-height: 34px;
                    padding: 7px;
                    cursor: pointer;
                }

                .global-permission-grid button.active {
                    border-color: rgba(201, 169, 110, .55);
                    background: rgba(201, 169, 110, .13);
                    color: #92400e;
                }

                .global-permission-grid button:disabled {
                    cursor: not-allowed;
                    opacity: .45;
                }

                .global-access-error {
                    border: 1px solid rgba(185, 28, 28, .2);
                    border-radius: 10px;
                    background: rgba(185, 28, 28, .06);
                    color: #b91c1c;
                    font-size: .78rem;
                    font-weight: 800;
                    margin-bottom: 12px;
                    padding: 10px 12px;
                }

                .global-access-item {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    background: rgba(255,255,255,.72);
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 10px;
                    align-items: center;
                    padding: 11px;
                }

                .global-access-item.inactive {
                    opacity: .62;
                }

                .global-access-item strong {
                    color: var(--text-primary);
                    display: block;
                    font-size: .86rem;
                    margin-bottom: 3px;
                }

                .global-access-item p,
                .global-access-item small,
                .global-access-empty {
                    color: var(--text-muted);
                    font-size: .76rem;
                    line-height: 1.38;
                    margin: 0;
                }

                .global-access-empty {
                    border: 1px dashed rgba(17, 24, 39, .14);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 82px;
                    padding: 12px;
                    text-align: center;
                }

                .global-simulator-media-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--text-muted);
                    font-size: .78rem;
                    font-weight: 800;
                }

                .global-simulator-media-toggle input {
                    width: 16px;
                    height: 16px;
                }

                .global-simulator-verdict {
                    border-radius: 10px;
                    display: grid;
                    gap: 3px;
                    padding: 12px;
                }

                .global-simulator-verdict.ok {
                    background: rgba(4, 120, 87, .1);
                    color: #047857;
                }

                .global-simulator-verdict.risk {
                    background: rgba(185, 28, 28, .08);
                    color: #b91c1c;
                }

                .global-simulator-verdict strong,
                .global-simulator-finance strong,
                .global-simulator-response strong,
                .global-simulator-cards strong {
                    font-size: .8rem;
                    font-weight: 900;
                }

                .global-simulator-verdict span {
                    font-size: .74rem;
                    font-weight: 800;
                }

                .global-simulator-cards {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                }

                .global-simulator-cards span {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    background: rgba(255,255,255,.72);
                    color: var(--text-muted);
                    display: grid;
                    gap: 3px;
                    font-size: .75rem;
                    line-height: 1.35;
                    padding: 10px;
                }

                .global-simulator-cards strong {
                    color: var(--text-primary);
                    display: block;
                }

                .global-simulator-suite {
                    display: grid;
                    gap: 8px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .global-simulator-suite button {
                    appearance: none;
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    background: rgba(255,255,255,.72);
                    color: var(--text-muted);
                    cursor: pointer;
                    display: grid;
                    gap: 3px;
                    padding: 10px;
                    text-align: left;
                    transition: border-color .15s ease, background .15s ease, transform .15s ease;
                }

                .global-simulator-suite button:hover,
                .global-simulator-suite button.active {
                    border-color: rgba(201, 169, 110, .45);
                    background: rgba(201, 169, 110, .1);
                    transform: translateY(-1px);
                }

                .global-simulator-suite span {
                    color: var(--text-primary);
                    font-size: .78rem;
                    font-weight: 900;
                }

                .global-simulator-suite strong {
                    color: var(--text-primary);
                    font-size: .78rem;
                    font-weight: 800;
                    line-height: 1.25;
                }

                .global-simulator-suite small {
                    color: var(--text-muted);
                    font-size: .7rem;
                    font-weight: 800;
                    line-height: 1.3;
                }

                .global-simulator-response {
                    border: 1px solid rgba(201, 169, 110, .22);
                    border-radius: 10px;
                    background: rgba(201, 169, 110, .08);
                    display: grid;
                    gap: 5px;
                    padding: 12px;
                }

                .global-simulator-finance {
                    border: 1px solid rgba(201, 169, 110, .24);
                    border-radius: 10px;
                    background: rgba(201, 169, 110, .08);
                    display: grid;
                    gap: 5px;
                    padding: 12px;
                }

                .global-simulator-finance.ok {
                    border-color: rgba(34, 197, 94, .22);
                    background: rgba(34, 197, 94, .08);
                }

                .global-simulator-finance.warn {
                    border-color: rgba(245, 158, 11, .24);
                    background: rgba(245, 158, 11, .08);
                }

                .global-simulator-finance.risk {
                    border-color: rgba(239, 68, 68, .22);
                    background: rgba(239, 68, 68, .08);
                }

                .global-simulator-finance strong,
                .global-simulator-response strong {
                    color: var(--text-primary);
                }

                .global-simulator-finance p,
                .global-simulator-response p {
                    color: var(--text-muted);
                    font-size: .82rem;
                    line-height: 1.45;
                    margin: 0;
                    white-space: pre-line;
                }

                .global-simulator-finance span {
                    color: var(--text-muted);
                    font-size: .74rem;
                    font-weight: 800;
                    line-height: 1.4;
                    word-break: break-word;
                }

                .global-metric-card {
                    border: 1px solid var(--border-color);
                    border-radius: 10px;
                    background: #fff;
                    min-height: 126px;
                    display: grid;
                    gap: 6px;
                }

                .global-metric-card strong {
                    color: var(--text-primary);
                    font-size: 2rem;
                    line-height: 1;
                }

                .global-alert {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border-color: rgba(185, 28, 28, .24);
                    color: #b91c1c;
                    font-weight: 800;
                    margin-bottom: 16px;
                    padding: 13px 16px;
                }

                .global-alert.warn {
                    border-color: rgba(180, 83, 9, .24);
                    color: #92400e;
                }

                .global-toolbar {
                    justify-content: space-between;
                    margin-bottom: 16px;
                    padding: 12px 14px;
                }

                .global-toolbar select {
                    border: 1px solid var(--border-color);
                    border-radius: 10px;
                    background: #fff;
                    color: var(--text-primary);
                    font: inherit;
                    font-size: .82rem;
                    padding: 9px 10px;
                    outline: none;
                }

                .global-layout {
                    display: grid;
                    grid-template-columns: minmax(320px, .88fr) minmax(0, 1.55fr);
                    gap: 16px;
                    align-items: start;
                }

                .global-command-list {
                    padding: 14px;
                    position: sticky;
                    top: 86px;
                }

                .global-section-title {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-bottom: 12px;
                }

                .global-section-title span {
                    color: var(--text-primary);
                    font-size: .9rem;
                    font-weight: 900;
                }

                .global-section-title strong {
                    color: var(--gold);
                    font-size: .8rem;
                }

                .global-list-scroll {
                    display: grid;
                    gap: 9px;
                    max-height: 760px;
                    overflow: auto;
                    padding-right: 4px;
                }

                .global-command-item {
                    width: 100%;
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    background: #fff;
                    display: grid;
                    grid-template-columns: 10px minmax(0, 1fr) auto;
                    gap: 10px;
                    align-items: start;
                    padding: 11px;
                    text-align: left;
                    cursor: pointer;
                }

                .global-command-item.active {
                    border-color: rgba(201, 169, 110, .62);
                    box-shadow: 0 0 0 3px rgba(201, 169, 110, .12);
                }

                .global-command-item strong {
                    display: block;
                    color: var(--text-primary);
                    font-size: .86rem;
                    margin-bottom: 4px;
                }

                .global-command-item p {
                    color: var(--text-muted);
                    font-size: .78rem;
                    line-height: 1.35;
                    margin: 0 0 5px;
                }

                .global-command-item span {
                    color: var(--text-muted);
                    font-size: .68rem;
                    font-weight: 800;
                }

                .global-command-item em {
                    border-radius: 999px;
                    font-size: .64rem;
                    font-style: normal;
                    font-weight: 900;
                    padding: 5px 7px;
                    text-transform: uppercase;
                }

                .global-status-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-top: 5px;
                }

                .global-status-dot.ok,
                .global-command-item em.ok,
                .global-hero-status.ok {
                    background: #047857;
                    color: #fff;
                }

                .global-status-dot.warn,
                .global-command-item em.warn,
                .global-hero-status.warn {
                    background: #b45309;
                    color: #fff;
                }

                .global-status-dot.risk,
                .global-command-item em.risk,
                .global-hero-status.risk {
                    background: #b91c1c;
                    color: #fff;
                }

                .global-status-dot.neutral,
                .global-command-item em.neutral,
                .global-hero-status.neutral {
                    background: rgba(201, 169, 110, .16);
                    color: #92400e;
                }

                .global-detail {
                    display: grid;
                    gap: 16px;
                    min-width: 0;
                }

                .global-detail-hero {
                    display: grid;
                    grid-template-columns: 132px minmax(0, 1fr);
                    gap: 16px;
                    padding: 16px;
                }

                .global-hero-status {
                    border-radius: 12px;
                    display: grid;
                    place-items: center;
                    align-content: center;
                    min-height: 132px;
                    padding: 12px;
                    text-align: center;
                }

                .global-hero-status span {
                    font-size: .68rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .global-hero-status strong {
                    font-size: 1rem;
                }

                .global-detail-main h2 {
                    color: var(--text-primary);
                    font-size: 1.4rem;
                    line-height: 1.16;
                    margin: 0 0 8px;
                }

                .global-detail-main p {
                    color: var(--text-muted);
                    font-size: .88rem;
                    line-height: 1.48;
                    margin: 0 0 14px;
                    overflow-wrap: anywhere;
                }

                .global-chips span {
                    border: 1px solid rgba(201, 169, 110, .28);
                    border-radius: 999px;
                    background: rgba(201, 169, 110, .1);
                    color: #92400e;
                    padding: 4px 8px;
                    font-size: .66rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .global-action-row .btn.danger {
                    border-color: rgba(185, 28, 28, .28);
                    color: #b91c1c;
                }

                .global-finance-state-card {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    gap: 13px;
                    align-items: center;
                    padding: 14px 16px;
                }

                .global-finance-state-icon {
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    display: grid;
                    place-items: center;
                }

                .global-finance-state-icon.ok {
                    background: rgba(4, 120, 87, .1);
                    color: #047857;
                }

                .global-finance-state-icon.warn {
                    background: rgba(180, 83, 9, .12);
                    color: #92400e;
                }

                .global-finance-state-card span {
                    color: var(--text-muted);
                    display: block;
                    font-size: .68rem;
                    font-weight: 900;
                    letter-spacing: .08em;
                    margin-bottom: 4px;
                    text-transform: uppercase;
                }

                .global-finance-state-card strong {
                    color: var(--text-primary);
                    display: block;
                    font-size: .96rem;
                    margin-bottom: 3px;
                }

                .global-finance-state-card p,
                .global-finance-state-card small {
                    color: var(--text-muted);
                    display: block;
                    font-size: .78rem;
                    line-height: 1.4;
                    margin: 0;
                }

                .global-return-card {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 14px;
                    align-items: start;
                    padding: 14px 16px;
                    border-left: 4px solid rgba(201, 169, 110, .5);
                }

                .global-return-card.ok {
                    border-left-color: #047857;
                }

                .global-return-card.warn {
                    border-left-color: #b45309;
                }

                .global-return-card > div:first-child {
                    min-width: 0;
                }

                .global-return-card span {
                    color: var(--text-muted);
                    display: block;
                    font-size: .68rem;
                    font-weight: 900;
                    letter-spacing: .08em;
                    margin-bottom: 4px;
                    text-transform: uppercase;
                }

                .global-return-card strong {
                    color: var(--text-primary);
                    display: block;
                    font-size: .94rem;
                    margin-bottom: 7px;
                }

                .global-return-card p {
                    color: var(--text-muted);
                    font-size: .82rem;
                    line-height: 1.45;
                    margin: 0;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                }

                .global-return-actions {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .global-governance-detail-card {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(280px, .55fr);
                    gap: 14px;
                    padding: 14px 16px;
                    border-left: 4px solid #b45309;
                }

                .global-governance-detail-card.ok {
                    border-left-color: #047857;
                }

                .global-governance-detail-copy {
                    display: grid;
                    align-content: start;
                    gap: 7px;
                    min-width: 0;
                }

                .global-governance-detail-copy strong {
                    color: var(--text-primary);
                    font-size: .98rem;
                }

                .global-governance-detail-copy p {
                    color: var(--text-muted);
                    font-size: .82rem;
                    line-height: 1.45;
                    margin: 0;
                    overflow-wrap: anywhere;
                }

                .global-governance-detail-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 7px;
                }

                .global-governance-detail-tags em {
                    border-radius: 999px;
                    background: rgba(17, 24, 39, .06);
                    color: var(--text-muted);
                    font-size: .64rem;
                    font-style: normal;
                    font-weight: 900;
                    padding: 5px 8px;
                }

                .global-governance-close-box {
                    display: grid;
                    gap: 9px;
                }

                .global-governance-close-box textarea {
                    border: 1px solid rgba(17, 24, 39, .1);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font: inherit;
                    font-size: .8rem;
                    min-height: 82px;
                    padding: 10px;
                    resize: vertical;
                    width: 100%;
                }

                .global-history-card,
                .global-json-card {
                    padding: 16px;
                }

                .global-message-list {
                    display: grid;
                    gap: 9px;
                }

                .global-message {
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    padding: 10px;
                    background: rgba(255,255,255,.72);
                }

                .global-message.assistant {
                    border-color: rgba(201, 169, 110, .28);
                    background: rgba(201, 169, 110, .08);
                }

                .global-message span,
                .global-message small {
                    color: var(--text-muted);
                    font-size: .68rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .global-message p {
                    color: var(--text-primary);
                    font-size: .82rem;
                    line-height: 1.42;
                    margin: 5px 0;
                    overflow-wrap: anywhere;
                }

                .global-json-card h3 {
                    color: var(--text-primary);
                    font-size: .82rem;
                    margin: 14px 0 8px;
                }

                .global-json-card pre {
                    max-height: 280px;
                    overflow: auto;
                    border: 1px solid rgba(17, 24, 39, .08);
                    border-radius: 10px;
                    background: #111827;
                    color: #e5e7eb;
                    font-size: .72rem;
                    line-height: 1.45;
                    margin: 0;
                    padding: 12px;
                }

                .global-empty,
                .global-empty-detail {
                    border: 1px dashed var(--border-color);
                    border-radius: 12px;
                    color: var(--text-muted);
                    display: grid;
                    gap: 10px;
                    justify-items: center;
                    padding: 28px;
                    text-align: center;
                }

                .global-empty svg,
                .global-empty-detail svg {
                    color: var(--gold);
                }

                .global-empty-detail h2 {
                    color: var(--text-primary);
                    margin: 0;
                }

                .global-empty-detail p {
                    margin: 0;
                    max-width: 520px;
                }

                .global-toast {
                    position: fixed;
                    right: 24px;
                    top: 24px;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border-radius: 12px;
                    padding: 13px 18px;
                    font-weight: 800;
                    box-shadow: 0 8px 30px rgba(0,0,0,.18);
                }

                .global-toast.success {
                    border: 1px solid rgba(34, 197, 94, .28);
                    background: rgba(34, 197, 94, .12);
                    color: #047857;
                }

                .global-toast.error {
                    border: 1px solid rgba(239, 68, 68, .28);
                    background: rgba(239, 68, 68, .1);
                    color: #b91c1c;
                }

                .spin {
                    animation: global-spin 1s linear infinite;
                }

                @keyframes global-spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 1180px) {
                    .global-metrics-grid,
                    .global-info-grid,
                    .global-bottom-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .global-layout,
                    .global-instance-strip,
                    .global-access-grid,
                    .global-simulator-grid,
                    .global-automation-grid,
                    .global-governance-grid,
                    .global-policy-strip,
                    .global-go-live-grid,
                    .global-go-live-runbook,
                    .global-post-launch-grid,
                    .global-agent-desk-grid {
                        grid-template-columns: 1fr;
                    }

                    .global-command-list {
                        position: static;
                    }
                }

                @media (max-width: 760px) {
                    .global-metrics-grid,
                    .global-info-grid,
                    .global-bottom-grid,
                    .global-finance-state-card,
                    .global-access-fields,
                    .global-permission-grid,
                    .global-access-item,
                    .global-simulator-cards,
                    .global-simulator-suite,
                    .global-detail-hero,
                    .global-return-card,
                    .global-governance-detail-card,
                    .global-identity-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
