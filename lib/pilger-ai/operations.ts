import { createAdminClient } from '@/lib/supabase/server'

export type PilgerAiStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted'

export type PilgerAiMetric = {
    label: string
    value: string
    note: string
}

export type PilgerAiWorkItem = {
    id: string
    title: string
    description: string
    sector: string
    owner: string
    status: string
    priority: 'Alta' | 'Media' | 'Baixa'
    tone: PilgerAiStatusTone
    source: string
    href?: string
    createdAt?: string
}

export type PilgerAiEventItem = {
    id: string
    eventType: string
    title: string
    description: string
    sector: string
    status: string
    tone: PilgerAiStatusTone
    createdAt?: string
}

export type PilgerAiAgentItem = {
    id: string
    name: string
    role: string
    status: string
    tone: PilgerAiStatusTone
    detail: string
}

export type PilgerAiOperationsSnapshot = {
    metrics: PilgerAiMetric[]
    tasks: PilgerAiWorkItem[]
    approvals: PilgerAiWorkItem[]
    events: PilgerAiEventItem[]
    audit: PilgerAiEventItem[]
    agents: PilgerAiAgentItem[]
    memory: PilgerAiEventItem[]
}

type SupabaseResult<T> = { data: T; error?: string }

async function safeQuery<T>(fallback: T, query: () => Promise<{ data: T | null; error: any }>): Promise<SupabaseResult<T>> {
    try {
        const { data, error } = await query()
        if (error) return { data: fallback, error: error.message || String(error) }
        return { data: data ?? fallback }
    } catch (error: any) {
        return { data: fallback, error: error?.message || String(error) }
    }
}

function formatDate(value?: string | null) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function money(value: unknown) {
    const amount = Number(value || 0)
    if (!Number.isFinite(amount) || amount <= 0) return 'valor nao informado'
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function statusTone(status?: string | null): PilgerAiStatusTone {
    const normalized = String(status || '').toLowerCase()
    if (['completed', 'sent', 'active', 'approved', 'success'].includes(normalized)) return 'success'
    if (['queued', 'waiting', 'under_review', 'pending', 'running'].includes(normalized)) return 'warning'
    if (['failed', 'blocked', 'rejected', 'stopped'].includes(normalized)) return 'danger'
    if (normalized) return 'info'
    return 'muted'
}

function priorityFromStatus(status?: string | null): 'Alta' | 'Media' | 'Baixa' {
    const normalized = String(status || '').toLowerCase()
    if (['failed', 'blocked', 'under_review', 'waiting'].includes(normalized)) return 'Alta'
    if (['running', 'queued', 'pending'].includes(normalized)) return 'Media'
    return 'Baixa'
}

function titleFromEventType(eventType?: string | null) {
    return String(eventType || 'evento')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
}

function normalizeProperty(property: any): PilgerAiWorkItem {
    const city = [property?.city, property?.state].filter(Boolean).join(', ') || 'local nao informado'
    return {
        id: String(property?.id || crypto.randomUUID()),
        title: property?.title || 'Imovel aguardando revisao',
        description: `${city} - ${money(property?.price)}`,
        sector: 'Operacoes / Marketing',
        owner: 'Responsavel do setor',
        status: property?.status === 'under_review' ? 'Em analise' : property?.status || 'Pendente',
        priority: 'Alta',
        tone: statusTone(property?.status || 'under_review'),
        source: 'Cadastro de imovel',
        href: `/admin/properties?review=${encodeURIComponent(String(property?.id || ''))}`,
        createdAt: formatDate(property?.created_at),
    }
}

function normalizeRun(run: any): PilgerAiWorkItem {
    return {
        id: String(run?.id || crypto.randomUUID()),
        title: run?.lead_name ? `Workflow para ${run.lead_name}` : 'Execucao de workflow',
        description: [
            run?.trigger_type ? `gatilho ${run.trigger_type}` : null,
            run?.lead_phone ? `lead ${run.lead_phone}` : null,
            run?.error_message || null,
        ].filter(Boolean).join(' - ') || 'Aguardando processamento do agente.',
        sector: 'Automacao / Comercial',
        owner: 'Agente de workflow',
        status: run?.status || 'queued',
        priority: priorityFromStatus(run?.status),
        tone: statusTone(run?.status),
        source: 'Workflow IA',
        href: '/admin/automation',
        createdAt: formatDate(run?.created_at),
    }
}

function normalizeEvent(event: any): PilgerAiEventItem {
    return {
        id: String(event?.id || crypto.randomUUID()),
        eventType: event?.event_type || 'evento',
        title: titleFromEventType(event?.event_type),
        description: event?.message || event?.status || 'Evento registrado no motor de automacao.',
        sector: event?.workflow_id ? 'Automacao' : 'Sistema',
        status: event?.status || 'registrado',
        tone: statusTone(event?.status),
        createdAt: formatDate(event?.created_at),
    }
}

function normalizeBroker(broker: any): PilgerAiAgentItem {
    const active = broker?.is_active !== false
    return {
        id: String(broker?.id || crypto.randomUUID()),
        name: broker?.name || 'Agente sem nome',
        role: broker?.creci ? `Corretor IA - CRECI ${broker.creci}` : 'Corretor IA',
        status: active ? 'Ativo' : 'Inativo',
        tone: active ? 'success' : 'muted',
        detail: broker?.assignment_type ? `Atendimento: ${broker.assignment_type}` : 'Atendimento e qualificacao de leads.',
    }
}

function buildMemoryFromLeads(leads: any[]): PilgerAiEventItem[] {
    const sourceMap = new Map<string, number>()
    const cityMap = new Map<string, number>()
    const stageMap = new Map<string, number>()

    for (const lead of leads) {
        const source = String(lead?.source || lead?.detected_source || 'Direto').trim() || 'Direto'
        const city = String(lead?.city || lead?.region || 'Local nao informado').trim() || 'Local nao informado'
        const stage = String(lead?.funnel_stage || 'sem etapa').trim() || 'sem etapa'
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1)
        cityMap.set(city, (cityMap.get(city) || 0) + 1)
        stageMap.set(stage, (stageMap.get(stage) || 0) + 1)
    }

    const rows: PilgerAiEventItem[] = []
    const topSource = Array.from(sourceMap.entries()).sort((a, b) => b[1] - a[1])[0]
    const topCity = Array.from(cityMap.entries()).sort((a, b) => b[1] - a[1])[0]
    const topStage = Array.from(stageMap.entries()).sort((a, b) => b[1] - a[1])[0]

    if (topSource) {
        rows.push({
            id: 'memory-source',
            eventType: 'lead_source',
            title: 'Canal com maior volume',
            description: `${topSource[0]} concentrou ${topSource[1]} lead(s) recentes.`,
            sector: 'Marketing',
            status: 'aprendizado',
            tone: 'info',
        })
    }
    if (topCity) {
        rows.push({
            id: 'memory-city',
            eventType: 'lead_region',
            title: 'Regiao com maior demanda',
            description: `${topCity[0]} apareceu em ${topCity[1]} lead(s) recentes.`,
            sector: 'Inteligencia',
            status: 'aprendizado',
            tone: 'success',
        })
    }
    if (topStage) {
        rows.push({
            id: 'memory-stage',
            eventType: 'lead_stage',
            title: 'Etapa mais recorrente',
            description: `${topStage[0]} aparece em ${topStage[1]} registro(s) do funil.`,
            sector: 'Comercial',
            status: 'aprendizado',
            tone: 'warning',
        })
    }

    return rows
}

export async function getPilgerAiOperationsSnapshot(): Promise<PilgerAiOperationsSnapshot> {
    const supabase = createAdminClient()

    const [workflows, runs, events, properties, brokers, leads] = await Promise.all([
        safeQuery<any[]>([], () => supabase
            .from('agent_workflows')
            .select('id,name,description,trigger_type,is_active,created_at,updated_at')
            .order('updated_at', { ascending: false })
            .limit(30)),
        safeQuery<any[]>([], () => supabase
            .from('agent_workflow_runs')
            .select('id,lead_name,lead_phone,status,trigger_type,error_message,created_at,updated_at')
            .order('created_at', { ascending: false })
            .limit(30)),
        safeQuery<any[]>([], () => supabase
            .from('agent_workflow_events')
            .select('id,event_type,status,message,workflow_id,created_at')
            .order('created_at', { ascending: false })
            .limit(50)),
        safeQuery<any[]>([], () => supabase
            .from('properties')
            .select('id,title,city,state,status,price,created_at,updated_at,featured_image,images')
            .order('created_at', { ascending: false })
            .limit(60)),
        safeQuery<any[]>([], () => supabase
            .from('virtual_brokers')
            .select('id,name,creci,is_active,assignment_type,created_at,updated_at')
            .order('created_at', { ascending: false })
            .limit(30)),
        safeQuery<any[]>([], () => supabase
            .from('leads')
            .select('id,name,phone,city,region,source,detected_source,funnel_stage,created_at')
            .order('created_at', { ascending: false })
            .limit(100)),
    ])

    const workflowRows = workflows.data || []
    const runRows = runs.data || []
    const eventRows = events.data || []
    const propertyRows = properties.data || []
    const brokerRows = brokers.data || []
    const leadRows = leads.data || []

    const reviewProperties = propertyRows.filter(property => String(property?.status || '').toLowerCase() === 'under_review')
    const activeWorkflows = workflowRows.filter(workflow => workflow?.is_active !== false)
    const openRuns = runRows.filter(run => ['queued', 'running', 'waiting', 'failed', 'stopped'].includes(String(run?.status || '').toLowerCase()))

    const approvals = reviewProperties.map(normalizeProperty)
    const tasks = [
        ...openRuns.map(normalizeRun),
        ...approvals.slice(0, 8),
    ].slice(0, 14)

    const normalizedEvents = eventRows.map(normalizeEvent)
    const agents = brokerRows.map(normalizeBroker)
    const memory = buildMemoryFromLeads(leadRows)

    return {
        metrics: [
            { label: 'Workflows ativos', value: String(activeWorkflows.length), note: `${workflowRows.length} workflows cadastrados` },
            { label: 'Tarefas abertas', value: String(tasks.length), note: `${openRuns.length} execucoes e ${approvals.length} aprovacoes` },
            { label: 'Eventos recentes', value: String(normalizedEvents.length), note: 'Base de auditoria operacional' },
            { label: 'Agentes conectados', value: String(agents.filter(agent => agent.tone === 'success').length), note: `${agents.length} corretores/agentes no cadastro` },
        ],
        tasks,
        approvals,
        events: normalizedEvents,
        audit: normalizedEvents,
        agents,
        memory,
    }
}
