'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, Eye, EyeOff, Wifi, WifiOff, MessageSquare, Brain, Bell, RefreshCw, Microscope, Type, Bot, Zap, Megaphone, BarChart3, Search, TrendingUp, Database, Mic, Volume2, CalendarDays, Clock3, Activity, AlertTriangle, Bug } from 'lucide-react'
import Link from 'next/link'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

interface IntegrationCard {
    id: string
    title: string
    description: string
    icon: 'whatsapp' | 'gemini' | 'vapid' | 'openai' | 'meta_ads' | 'google_ads' | 'serpapi' | 'dataforseo' | 'r2' | 'inngest' | 'elevenlabs'
    fields: {
        key: string
        label: string
        placeholder: string
        isSecret: boolean
        type?: 'text' | 'password' | 'select'
    }[]
}

const INTEGRATIONS: IntegrationCard[] = [
    {
        id: 'uazapi',
        title: 'ConnectyHub - WhatsApp API',
        description: 'API premium para WhatsApp via ConnectyHub: instâncias, mensagens, botões, menus e automações. Cada usuário terá sua própria instância gerenciada no painel.',
        icon: 'whatsapp',
        fields: [
            { key: 'uazapi_base_url', label: 'URL do Servidor', placeholder: 'https://connectyhub.uazapi.com', isSecret: false },
            { key: 'uazapi_admin_token', label: 'Admin Token', placeholder: 'Seu admin token', isSecret: true },
        ],
    },

    {
        id: 'vapid',
        title: 'VAPID - Push Notifications',
        description: 'Chaves VAPID para envio de notificações push para visitantes do site.',
        icon: 'vapid',
        fields: [
            { key: 'vapid_subject', label: 'Subject (mailto:)', placeholder: 'mailto:email@exemplo.com', isSecret: false },
            { key: 'vapid_public_key', label: 'Public Key', placeholder: 'BJDt...', isSecret: false },
            { key: 'vapid_private_key', label: 'Private Key', placeholder: 'am19...', isSecret: true },
        ],
    },

    {
        id: 'cloudflare',
        title: 'Cloudflare R2 - Storage',
        description: 'Armazenamento de objetos S3 compatível para imagens da plataforma.',
        icon: 'r2',
        fields: [
            { key: 'r2_account_id', label: 'Account ID', placeholder: 'ID da conta Cloudflare', isSecret: false },
            { key: 'r2_access_key_id', label: 'Access Key ID', placeholder: 'Sua chave de acesso', isSecret: false },
            { key: 'r2_secret_access_key', label: 'Secret Access Key', placeholder: 'Seu secret', isSecret: true },
            { key: 'r2_bucket_name', label: 'Bucket Name', placeholder: 'Nome do bucket', isSecret: false },
            { key: 'r2_public_url', label: 'Public URL', placeholder: 'https://pub-....r2.dev', isSecret: false },
        ],
    },

    {
        id: 'serpapi',
        title: 'SerpApi - Search Engine Results',
        description: 'API para extrair resultados de busca do Google.',
        icon: 'serpapi',
        fields: [
            { key: 'serpapi_api_key', label: 'API Key', placeholder: 'Sua API Key', isSecret: true },
        ],
    },
    {
        id: 'dataforseo',
        title: 'DataForSEO - Market Trends',
        description: 'API de backup para tendências de mercado e palavras-chave.',
        icon: 'dataforseo',
        fields: [
            { key: 'dataforseo_login', label: 'Login (Email)', placeholder: 'seu@email.com', isSecret: false },
            { key: 'dataforseo_password', label: 'API Password (Secret)', placeholder: 'Sua senha API', isSecret: true },
        ],
    },

    {
        id: 'inngest',
        title: 'Inngest - Automação & Cron Jobs',
        description: 'Motor de automação: crons do Radar, relatórios Pilger AI, follow-ups e alertas. Estas chaves também precisam estar nas variáveis de ambiente da Vercel.',
        icon: 'inngest',
        fields: [
            { key: 'inngest_event_key', label: 'Event Key', placeholder: 'nSmu_X6u4f...', isSecret: true },
            { key: 'inngest_signing_key', label: 'Signing Key', placeholder: 'signkey-prod-...', isSecret: true },
        ],
    },

    {
        id: 'elevenlabs',
        title: 'ElevenLabs - Voice AI & Clonagem',
        description: 'Vozes ultra-realistas e clonagem de voz para os agentes WhatsApp. Clone a voz do corretor para atendimento natural.',
        icon: 'elevenlabs',
        fields: [
            { key: 'elevenlabs_api_key', label: 'API Key', placeholder: 'Sua API Key ElevenLabs', isSecret: true },
        ],
    },
]

const WEEK_DAYS = [
    { value: '0', label: 'Dom' },
    { value: '1', label: 'Seg' },
    { value: '2', label: 'Ter' },
    { value: '3', label: 'Qua' },
    { value: '4', label: 'Qui' },
    { value: '5', label: 'Sex' },
    { value: '6', label: 'Sáb' },
]

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))

function parseCsvSet(raw: string | undefined, fallback: string): Set<string> {
    const source = String(raw || fallback)
    return new Set(
        source
            .split(',')
            .map(v => v.trim())
            .filter(Boolean)
    )
}

function toSortedCsv(values: Set<string>, mode: 'hour' | 'day'): string {
    const arr = Array.from(values)
    if (mode === 'hour') arr.sort((a, b) => Number(a) - Number(b))
    if (mode === 'day') arr.sort((a, b) => Number(a) - Number(b))
    return arr.join(',')
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface TestResult {
    status: TestStatus
    message: string
}

type LLMProviderStatus = 'ok' | 'no_credits' | 'invalid_key' | 'missing_key' | 'error'

interface LLMCreditCheck {
    success: boolean
    checked_at?: string
    active_provider?: string
    whatsapp_provider?: string | null
    openai?: { configured: boolean; status: LLMProviderStatus; message: string }
    gemini?: { configured: boolean; status: LLMProviderStatus; message: string }
}

type AgentLogSeverity = 'info' | 'success' | 'warning' | 'error'

interface AgentLogEntry {
    id: string
    created_at: string
    instance_name?: string | null
    event_type?: string | null
    message_type?: string | null
    action: string
    status_code?: number | null
    from_phone?: string | null
    sender_name?: string | null
    payload?: Record<string, unknown> | null
    error?: string | null
    severity: AgentLogSeverity
    summary?: string
}

type AgentLogSummary = Record<AgentLogSeverity | 'total', number>

interface GeminiUsageTotals {
    calls: number
    prompt_tokens: number
    output_tokens: number
    total_tokens: number
    estimated_usd: number
    estimated_brl: number
}

interface GeminiOfficialBillingRow {
    service: string
    sku: string
    project_id: string
    project_name: string
    currency: string
    month_cost: number
    today_cost: number
    last_24h_cost: number
    month_cost_brl: number
    today_cost_brl: number
    last_24h_cost_brl: number
    latest_usage_end_time?: string | null
}

interface GeminiOfficialBillingSummary {
    configured: boolean
    status: 'ok' | 'not_configured' | 'error'
    source: 'cloud_billing_bigquery' | 'not_configured'
    message: string
    month: string
    generated_at: string
    cache_updated_at?: string | null
    billing_project_id?: string | null
    gemini_project_id?: string | null
    table?: string | null
    currency?: string
    month_cost: number
    today_cost: number
    last_24h_cost: number
    month_cost_brl: number
    today_cost_brl: number
    last_24h_cost_brl: number
    latest_usage_end_time?: string | null
    rows: GeminiOfficialBillingRow[]
}

interface GeminiCostSummary {
    month: string
    generated_at: string
    usd_to_brl: number
    month_total: GeminiUsageTotals
    today_total: GeminiUsageTotals
    last_24h_total: GeminiUsageTotals
    by_model: Array<GeminiUsageTotals & { model: string }>
    by_feature: Array<GeminiUsageTotals & { feature: string }>
    official_billing?: GeminiOfficialBillingSummary
}

const WHATSAPP_SYSTEM_PROMPT_PREVIEW = `CAMADA GLOBAL DOS AGENTES WHATSAPP

Este bloco e aplicado automaticamente a todos os corretores IA no WhatsApp.
Ele nao substitui o prompt individual do corretor; ele entra junto com o prompt configurado em Corretores IA.

ORDEM DO PROMPT FINAL
1. Prompt individual do agente/corretor.
2. Tags processadas: {nome_lead}, {nome_corretor}, {agendamento}, {regioes}, {transferir}, {documentos}, {horario}, {empresa}, {imoveis}, botoes e redes sociais.
3. Contexto interno do lead, gerado dinamicamente pelo banco.
4. Diretrizes globais de qualificacao e comportamento.
5. Catalogo de imoveis, somente quando o prompt usa {imoveis} ou quando o agente nao tem prompt customizado.

CONTEXTO INTERNO DO LEAD
- Nome, telefone e dados ja cadastrados.
- Origem principal: Instagram, Google, YouTube, TikTok, Facebook, acesso direto ou formulario.
- UTM/campanha quando existir.
- Landing page por onde o lead entrou.
- Dispositivo, navegador e localizacao aproximada.
- Status atual no funil, score, classificacao e resumo anterior.
- Finalidade, orcamento e prazo ja conhecidos.

REGRAS DE USO DO CONTEXTO
- Nunca revelar esses dados internos ao cliente.
- Nao perguntar de novo uma informacao que ja esta conhecida.
- Confirmar com naturalidade quando precisar validar algo.
- Fazer uma pergunta por vez.
- Nunca transformar a conversa em formulario.
- Detectar o idioma do cliente e responder no mesmo idioma.
- Se a origem do lead nao estiver clara, perguntar uma unica vez no decorrer da conversa como ele conheceu a Pilger, sem parecer pesquisa.

DIRETRIZES DE QUALIFICACAO
- O objetivo e filtrar e amadurecer o lead, nao apenas responder perguntas.
- Descobrir aos poucos se busca investimento, moradia ou os dois.
- Descobrir valor disponivel, prazo de compra, regiao, tipo de imovel, objecoes e urgencia.
- Antes de falar de valor, reforcar beneficio, posicionamento, seguranca e adequacao ao objetivo.
- Quando houver intencao real, aproximar de corretor humano, visita ou imovel especifico.
- Usar botao de agendamento somente quando o cliente pedir, aceitar ou demonstrar claramente que quer marcar visita/reuniao agora.
- Nao enviar botoes Manha/Tarde/Noite junto com explicacao de imovel, investimento ou curadoria se o cliente ainda nao pediu agendamento.

NATURALIDADE NO USO DO NOME
- Usar o nome do lead somente de vez em quando: abertura importante, retomada depois de pausa, fechamento ou momento de proximidade.
- Nao comecar toda resposta chamando pelo nome.
- Nao repetir o nome mais de uma vez na mesma resposta.
- Se o nome cadastrado parecer nome de plataforma, empresa, sistema ou bot, nao usar como nome da pessoa.
- Se o nome estiver nao informado ou nao confiavel, perguntar uma unica vez e de forma leve como pode chamar a pessoa.
- Se ja perguntou o nome antes ou o cliente ignorou, nao insistir; continuar ajudando normalmente.

REDES SOCIAIS POR ORIGEM
- Instagram: se o lead veio do Instagram, nao chamar para seguir Instagram como primeira opcao.
- Google: construir autoridade, clareza e seguranca antes de oferecer rede social.
- YouTube: priorizar prova em video quando configurado.
- TikTok: respostas curtas e dinamicas; oferecer TikTok/Instagram apenas se fizer sentido.
- Facebook: linguagem proxima e prova social quando fizer sentido.
- Origem desconhecida: usar Instagram como primeira prova social, sempre um link por vez.
- Se o cliente mencionar Facebook, Instagram, Google, YouTube ou trafego como origem/desconfianca, tratar a objecao primeiro; nao enviar link automaticamente se ele nao pediu.

RAPPORT ADAPTATIVO (quando habilitado na instancia)
- Espelhar primeiro o jeito real que o lead escreve/fala: idioma, formalidade, energia, tamanho das mensagens e vocabulario.
- Usar DDD, localizacao e historico apenas como pistas secundarias.
- Nao fingir ser da mesma regiao do lead.
- Modo suave: regionalismo raro, leve, natural e nunca caricatural.
- Modo forte: regionalismo com mais presenca quando a regiao e o jeito do lead combinarem.
- Se o lead fala formal, responder formal mesmo que a localizacao sugira uma regiao especifica.
- Se o lead usar expressoes regionais, acompanhar com moderacao para gerar proximidade.

CATALOGO DE IMOVEIS
- Quando usar {imoveis}, o sistema injeta imoveis ativos e paginas publicadas.
- Se o cliente informar orcamento, o sistema ordena por proximidade de valor.
- O agente deve recomendar no maximo 1 imovel por resposta, ou 2 se o cliente pedir comparacao.
- Ao recomendar um imovel, deve enviar o botao "Ver imovel" daquele imovel.
- Links de imoveis enviados pelo WhatsApp recebem UTM e referencia do lead para rastrear clique, IP, dispositivo, origem e associar a visita a ficha do CRM.

REGRAS PARA AUDIO E VALORES
- Quando mencionar valores, metragem ou numeros importantes, escrever de forma falada e natural.
- Exemplo: "vinte e dois milhoes de reais" em vez de "R$ 22.000.000" quando a resposta puder virar audio.
- Exemplo: "duzentos metros quadrados" em vez de "200m2".
- O pipeline de audio tambem normaliza dinheiro, percentuais e metragens antes do TTS.

LIMITACOES DE MIDIA
- Gemini: texto, audio transcrito, imagens, documentos e videos.
- OpenAI no fluxo atual: texto, audio transcrito, imagens e documentos. Videos recebem resposta pedindo foto, print ou descricao.`

export default function MaintenancePage() {
    const [configs, setConfigs] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
    const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

    const [geminiModels, setGeminiModels] = useState<{ id: string; name: string }[]>([])
    const [openaiModels, setOpenaiModels] = useState<{ id: string; name: string }[]>([])
    const [loadingGeminiModels, setLoadingGeminiModels] = useState(false)
    const [loadingOpenAIModels, setLoadingOpenAIModels] = useState(false)
    const [elevenLabsVoices, setElevenLabsVoices] = useState<{ voice_id: string; name: string; category: string }[]>([])
    const [loadingVoices, setLoadingVoices] = useState(false)
    const [llmCreditLoading, setLlmCreditLoading] = useState(false)
    const [llmCreditCheck, setLlmCreditCheck] = useState<LLMCreditCheck | null>(null)
    const [syncingAdsSpend, setSyncingAdsSpend] = useState(false)
    const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([])
    const [agentLogSummary, setAgentLogSummary] = useState<AgentLogSummary>({ total: 0, info: 0, success: 0, warning: 0, error: 0 })
    const [agentLogsLoading, setAgentLogsLoading] = useState(false)
    const [agentLogsError, setAgentLogsError] = useState<string | null>(null)
    const [agentLogHours, setAgentLogHours] = useState(24)
    const [geminiCostSummary, setGeminiCostSummary] = useState<GeminiCostSummary | null>(null)
    const [geminiCostsLoading, setGeminiCostsLoading] = useState(false)
    const [geminiCostsError, setGeminiCostsError] = useState<string | null>(null)
    const [syncingGeminiFinance, setSyncingGeminiFinance] = useState(false)

    const dailyDays = parseCsvSet(configs['pilger_daily_days'], '0,1,2,3,4,5,6')
    const dailyHours = parseCsvSet(configs['pilger_daily_time'], '23')
    const weeklyDays = parseCsvSet(configs['pilger_weekly_days'] || configs['pilger_weekly_day'], '1')
    const weeklyHours = parseCsvSet(configs['pilger_weekly_times'] || configs['pilger_weekly_time'], '23')
    const radarDays = parseCsvSet(configs['radar_collection_days'], '0,1,2,3,4,5,6')
    const radarHours = parseCsvSet(configs['radar_collection_times'], '06,12,18')
    const isWhatsAppOpenAI = configs['whatsapp_provider'] === 'openai'
        || (!configs['whatsapp_provider'] && configs['ai_provider'] === 'openai')

    const toggleDay = (key: string, value: string, fallback: string) => {
        const current = parseCsvSet(configs[key], fallback)
        if (current.has(value)) {
            if (current.size === 1) return
            current.delete(value)
        } else {
            current.add(value)
        }
        setConfigs(prev => ({ ...prev, [key]: toSortedCsv(current, 'day') }))
    }

    const toggleHour = (key: string, value: string, fallback: string) => {
        const current = parseCsvSet(configs[key], fallback)
        if (current.has(value)) {
            if (current.size === 1) return
            current.delete(value)
        } else {
            current.add(value)
        }
        setConfigs(prev => ({ ...prev, [key]: toSortedCsv(current, 'hour') }))
    }

    const dayLabel = (day: string) => WEEK_DAYS.find(d => d.value === day)?.label || day
    const formatHourLabel = (h: string) => `${h.padStart(2, '0')}:00`
    const formatConfigDateTime = (value?: string) => {
        if (!value) return 'Ainda nao executou'
        const date = new Date(value)
        if (!Number.isFinite(date.getTime())) return 'Data invalida'

        return new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date)
    }
    const formatCurrency = (value: number, currency = 'BRL') => {
        return Number(value || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency,
            minimumFractionDigits: currency === 'BRL' ? 2 : 4,
            maximumFractionDigits: currency === 'BRL' ? 2 : 6,
        })
    }
    const formatCompactNumber = (value: number) => {
        return Number(value || 0).toLocaleString('pt-BR')
    }

    const formatTokenBreakdown = (total?: GeminiUsageTotals) => {
        const prompt = formatCompactNumber(total?.prompt_tokens || 0)
        const output = formatCompactNumber(total?.output_tokens || 0)
        const all = formatCompactNumber(total?.total_tokens || 0)
        return `Entrada ${prompt} | Saida ${output} | Total ${all}`
    }

    const getOfficialBillingColor = (status?: GeminiOfficialBillingSummary['status']) => {
        if (status === 'ok') return '#22c55e'
        if (status === 'error') return '#ef4444'
        return '#f59e0b'
    }

    // Fetch Gemini Models
    useEffect(() => {
        const apiKey = configs['gemini_api_key']
        if (!apiKey) return

        const fetchGemini = async () => {
            setLoadingGeminiModels(true)
            try {
                const res = await fetch('/api/admin/gemini-models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey }),
                })
                const data = await res.json()
                if (data.success) {
                    setGeminiModels(data.models)
                    // Set defaults if empty
                    setConfigs(prev => {
                        const next = { ...prev }
                        if (!next['gemini_concierge_model'] && data.models.length > 0) next['gemini_concierge_model'] = 'gemini-1.5-flash'
                        if (!next['gemini_pilger_model'] && data.models.length > 0) next['gemini_pilger_model'] = 'gemini-1.5-flash'
                        if (!next['gemini_ceo_model'] && data.models.length > 0) next['gemini_ceo_model'] = 'gemini-1.5-flash'
                        return next
                    })
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoadingGeminiModels(false)
            }
        }
        const timer = setTimeout(fetchGemini, 1000)
        return () => clearTimeout(timer)
    }, [configs['gemini_api_key']])

    // Fetch OpenAI Models
    useEffect(() => {
        const apiKey = configs['openai_api_key']
        if (!apiKey) return

        const fetchOpenAI = async () => {
            setLoadingOpenAIModels(true)
            try {
                const res = await fetch('/api/admin/openai-models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey }),
                })
                const data = await res.json()
                if (data.success) {
                    setOpenaiModels(data.models)
                    // Set defaults if empty
                    setConfigs(prev => {
                        const next = { ...prev }
                        if (!next['openai_concierge_model'] && data.models.length > 0) next['openai_concierge_model'] = 'gpt-3.5-turbo'
                        if (!next['openai_pilger_model'] && data.models.length > 0) next['openai_pilger_model'] = 'gpt-3.5-turbo'
                        if (!next['openai_ceo_model'] && data.models.length > 0) next['openai_ceo_model'] = 'gpt-4o-mini'
                        return next
                    })
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoadingOpenAIModels(false)
            }
        }
        const timer = setTimeout(fetchOpenAI, 1000)
        return () => clearTimeout(timer)
    }, [configs['openai_api_key']])

    // Auto-fetch ElevenLabs voices when API key is available
    useEffect(() => {
        const apiKey = configs['elevenlabs_api_key']
        if (!apiKey || elevenLabsVoices.length > 0) return

        const fetchVoices = async () => {
            setLoadingVoices(true)
            try {
                const res = await fetch('/api/admin/elevenlabs-voices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey })
                })
                const data = await res.json()
                if (data.success) setElevenLabsVoices(data.voices)
            } catch (e) { console.error(e) }
            setLoadingVoices(false)
        }
        const timer = setTimeout(fetchVoices, 1500)
        return () => clearTimeout(timer)
    }, [configs['elevenlabs_api_key']])


    const fetchConfigs = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/configs')
            const json = await res.json()
            if (json.success) {
                setConfigs(json.configs)
            }
        } catch (err) {
            console.error('Error loading configs:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchConfigs()
        const timer = setInterval(fetchConfigs, 60000)
        return () => clearInterval(timer)
    }, [fetchConfigs])

    const fetchAgentLogs = useCallback(async () => {
        setAgentLogsLoading(true)
        setAgentLogsError(null)
        try {
            const res = await fetch(`/api/admin/whatsapp/agent-logs?hours=${agentLogHours}&limit=120`)
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Erro ao carregar logs')
            }
            setAgentLogs(data.logs || [])
            setAgentLogSummary(data.summary || { total: 0, info: 0, success: 0, warning: 0, error: 0 })
        } catch (err) {
            console.error('Error loading agent logs:', err)
            setAgentLogsError('Nao foi possivel carregar os logs dos agentes.')
        } finally {
            setAgentLogsLoading(false)
        }
    }, [agentLogHours])

    useEffect(() => {
        fetchAgentLogs()
        const timer = setInterval(fetchAgentLogs, 30000)
        return () => clearInterval(timer)
    }, [fetchAgentLogs])

    const fetchGeminiCosts = useCallback(async (refreshOfficial = false) => {
        setGeminiCostsLoading(true)
        setGeminiCostsError(null)
        try {
            const res = await fetch(`/api/admin/ai-costs/gemini${refreshOfficial ? '?refresh_official=1' : ''}`)
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao carregar custos Gemini')
            }
            setGeminiCostSummary(data.summary || null)
        } catch (err) {
            console.error('Error loading Gemini costs:', err)
            setGeminiCostsError('Nao foi possivel carregar o consumo Gemini.')
        } finally {
            setGeminiCostsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchGeminiCosts()
        const timer = setInterval(fetchGeminiCosts, 30000)
        return () => clearInterval(timer)
    }, [fetchGeminiCosts])

    const syncGeminiCostsToFinance = useCallback(async () => {
        setSyncingGeminiFinance(true)
        setGeminiCostsError(null)
        try {
            const res = await fetch('/api/admin/ai-costs/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month: geminiCostSummary?.month }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao lancar Gemini no financeiro')
            }
            await fetchGeminiCosts()
        } catch (err) {
            console.error('Error syncing Gemini costs:', err)
            setGeminiCostsError('Nao foi possivel lancar o custo Gemini no financeiro.')
        } finally {
            setSyncingGeminiFinance(false)
        }
    }, [fetchGeminiCosts, geminiCostSummary?.month])

    const syncAdsSpendNow = async () => {
        setSyncingAdsSpend(true)
        try {
            const res = await fetch('/api/admin/finance/sync-ads-spend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao sincronizar trafego pago')
            }
            await fetchConfigs()
        } catch (err) {
            console.error('Error syncing ads spend:', err)
        } finally {
            setSyncingAdsSpend(false)
        }
    }

    const runLLMCreditCheck = useCallback(async () => {
        setLlmCreditLoading(true)
        try {
            const res = await fetch('/api/admin/llm-credits')
            const data = await res.json()
            setLlmCreditCheck(data)
        } catch {
            setLlmCreditCheck({ success: false })
        } finally {
            setLlmCreditLoading(false)
        }
    }, [])

    useEffect(() => {
        runLLMCreditCheck()
    }, [runLLMCreditCheck])

    const getStatusColor = (status?: LLMProviderStatus) => {
        if (status === 'ok') return '#22c55e'
        if (status === 'no_credits') return '#ef4444'
        if (status === 'invalid_key') return '#f97316'
        if (status === 'missing_key') return '#6b7280'
        return '#f59e0b'
    }

    const getStatusLabel = (status?: LLMProviderStatus) => {
        if (status === 'ok') return 'OK'
        if (status === 'no_credits') return 'Sem Créditos/Quota'
        if (status === 'invalid_key') return 'Chave Inválida'
        if (status === 'missing_key') return 'Chave Ausente'
        return 'Erro'
    }

    const getAgentSeverityColor = (severity: AgentLogSeverity) => {
        if (severity === 'error') return '#ef4444'
        if (severity === 'warning') return '#f59e0b'
        if (severity === 'success') return '#22c55e'
        return '#60a5fa'
    }

    const getAgentSeverityLabel = (severity: AgentLogSeverity) => {
        if (severity === 'error') return 'Erro'
        if (severity === 'warning') return 'Alerta'
        if (severity === 'success') return 'OK'
        return 'Info'
    }

    const getAgentActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            agent_skip_stale_queue: 'Fila antiga ignorada',
            agent_no_queue_work: 'Fila vazia',
            agent_batch_read: 'Lote lido',
            agent_no_pending_after_debounce: 'Sem fila apos espera',
            agent_empty_input: 'Entrada vazia',
            agent_response_sent: 'Resposta enviada',
            dispatched: 'Webhook despachado',
            responded_fast_webhook: 'Resposta rapida',
            ignored_empty: 'Evento vazio',
            ignored_no_phone: 'Sem telefone',
            error: 'Erro no webhook',
        }
        return labels[action] || action.replace(/_/g, ' ')
    }

    const getPayloadString = (payload: AgentLogEntry['payload'], key: string) => {
        const value = payload?.[key]
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
        return ''
    }

    const getAgentLogDetail = (log: AgentLogEntry) => {
        if (log.error) return log.error
        const reason = getPayloadString(log.payload, 'reason') || getPayloadString(log.payload, 'queueReason')
        if (reason) return reason
        return log.summary || ''
    }

    const getGeminiFeatureLabel = (feature: string) => {
        const labels: Record<string, string> = {
            whatsapp_agent_response: 'WhatsApp - resposta',
            whatsapp_audio_transcription: 'WhatsApp - audio',
            whatsapp_image_analysis: 'WhatsApp - imagem',
            whatsapp_video_analysis: 'WhatsApp - video',
            whatsapp_document_analysis: 'WhatsApp - documento',
            whatsapp_shadow_agent: 'WhatsApp - co-piloto',
            ads_campaign_analysis: 'Trafego - analise',
            ads_daily_report: 'Relatorio diario',
            lead_extraction: 'Extracao de lead',
            gemini_chat: 'Chat Gemini',
            gemini_chat_rest: 'Chat Gemini',
        }
        return labels[feature] || feature.replace(/_/g, ' ')
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const allKeys = [
                ...INTEGRATIONS.flatMap(i => i.fields.map(f => f.key)),
                'ai_provider',
                'gemini_api_key',
                'openai_api_key',
                'pilger_ai_system_prompt',
                'pilger_ai_rules_prompt',
                'gemini_pilger_model',
                'openai_pilger_model',
                'pilger_provider',
                'ceo_provider',
                'gemini_ceo_model',
                'openai_ceo_model',
                'ceo_agent_system_prompt',
                'lead_extraction_prompt',
                'ads_provider',
                'gemini_ads_model',
                'openai_ads_model',
                'vapid_subject',
                'vapid_public_key',
                'vapid_private_key',
                'r2_account_id',
                'r2_access_key_id',
                'r2_secret_access_key',
                'r2_bucket_name',
                'r2_public_url',
                'meta_app_id',
                'meta_app_secret',
                'meta_access_token',
                'meta_ad_account_id',
                'meta_pixel_id',
                'google_ads_developer_token',
                'google_ads_client_id',
                'google_ads_client_secret',
                'google_ads_refresh_token',
                'google_ads_manager_id',
                'google_ads_customer_id',
                'gemini_billing_bigquery_project_id',
                'gemini_billing_bigquery_dataset',
                'gemini_billing_bigquery_table',
                'gemini_billing_google_project_id',
                'gemini_billing_service_account_json',
                'gemini_billing_client_email',
                'gemini_billing_private_key',
                'serpapi_api_key',
                'dataforseo_login',
                'dataforseo_password',
                'inngest_event_key',
                'inngest_signing_key',
                'pilger_daily_days',
                'pilger_daily_time',
                'pilger_weekly_day',
                'pilger_weekly_time',
                'pilger_weekly_days',
                'pilger_weekly_times',
                'radar_collection_days',
                'radar_collection_times',
                'radar_ai_enabled',
                'radar_ai_min_opportunity_score',
                'radar_ai_max_insights_per_run',
                'radar_opportunity_alert_threshold',
                'radar_analyst_system_prompt',
                'ads_sync_interval_minutes',
                'ads_analyst_system_prompt',
                'pilger_daily_system_prompt',
                'pilger_weekly_system_prompt',
                'whatsapp_provider',
                'gemini_whatsapp_model',
                'openai_whatsapp_model',

                'elevenlabs_api_key',
                'ads_provider',
                'openai_ads_model',
                'gemini_ads_model'
            ]
            const configsToSave: Record<string, string> = {}
            for (const key of allKeys) {
                if (configs[key] !== undefined && configs[key] !== '') {
                    configsToSave[key] = configs[key]
                }
            }
            const res = await fetch('/api/admin/configs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs: configsToSave }),
            })
            const json = await res.json()
            if (!json.success) {
                console.error('Save error:', json.message)
            }
        } catch (err) {
            console.error('Error saving configs:', err)
        }
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    const toggleVisibility = (key: string) => {
        setVisibleFields(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const testConnection = async (integrationId: string) => {
        setTestResults(prev => ({
            ...prev,
            [integrationId]: { status: 'testing', message: 'Testando conexo...' },
        }))

        try {
            const res = await fetch('/api/admin/test-integration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: integrationId,
                    config: configs,
                }),
            })
            const data = await res.json()
            setTestResults(prev => ({
                ...prev,
                [integrationId]: {
                    status: data.success ? 'success' : 'error',
                    message: data.message,
                },
            }))
        } catch {
            setTestResults(prev => ({
                ...prev,
                [integrationId]: { status: 'error', message: 'Erro ao testar conexo' },
            }))
        }
    }

    const getIcon = (icon: string) => {
        switch (icon) {
            case 'whatsapp': return <MessageSquare size={22} />
            case 'gemini': return <Brain size={22} />
            case 'openai': return <Bot size={22} />
            case 'vapid': return <Bell size={22} />
            case 'meta_ads': return <Megaphone size={22} />
            case 'google_ads': return <BarChart3 size={22} />
            case 'serpapi': return <Search size={22} />
            case 'dataforseo': return <TrendingUp size={22} />
            case 'r2': return <Database size={22} />
            case 'inngest': return <Zap size={22} />
            case 'elevenlabs': return <Mic size={22} />
            default: return null
        }
    }

    const getStatusIndicator = (integrationId: string) => {
        const result = testResults[integrationId]
        if (!result || result.status === 'idle') {
            const hasConfig = INTEGRATIONS
                .find(i => i.id === integrationId)
                ?.fields.some(f => configs[f.key])
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: hasConfig ? 'var(--text-muted)' : '#ef4444',
                }}>
                    {hasConfig ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {hasConfig ? 'Configurado' : 'No configurado'}
                </span>
            )
        }
        if (result.status === 'testing') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--gold)',
                }}>
                    <RefreshCw size={14} className="spin" /> Testando...
                </span>
            )
        }
        if (result.status === 'success') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: '#22c55e',
                }}>
                    <Wifi size={14} /> Conectado
                </span>
            )
        }
        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                color: '#ef4444',
            }}>
                <WifiOff size={14} /> Falha
            </span>
        )
    }

    if (loading) {
        return <AdminLoadingState message="Carregando configurações..." />
    }

    return (
        <div>
            <div className="admin-header">
                <div>
                    <h1>Sala de Manutenção</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Gerencie as chaves de API e integrações externas do sistema.
                    </p>
                </div>
                <div className="admin-header-actions">
                    {saved && <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>Salvo com sucesso!</span>}
                    <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
                        <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Tudo'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
                {INTEGRATIONS.map(integration => (
                    <div
                        key={integration.id}
                        className="chart-card"
                        style={{
                            border: testResults[integration.id]?.status === 'success'
                                ? '1px solid rgba(34, 197, 94, 0.3)'
                                : testResults[integration.id]?.status === 'error'
                                    ? '1px solid rgba(239, 68, 68, 0.3)'
                                    : undefined,
                        }}
                    >
                        {/* Card Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#000',
                                }}>
                                    {getIcon(integration.icon)}
                                </div>
                                <div>
                                    <div className="chart-title" style={{ marginBottom: '2px' }}>
                                        {integration.title}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {integration.description}
                                    </div>
                                </div>
                            </div>
                            {getStatusIndicator(integration.id)}
                        </div>

                        {/* Fields */}
                        <div style={{ display: 'grid', gap: '14px' }}>
                            {integration.fields.map(field => (
                                <div key={field.key} className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.85rem' }}>
                                        {field.label}
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        {field.type !== 'select' ? (
                                            <input
                                                className="form-input"
                                                type={field.isSecret && !visibleFields[field.key] ? 'password' : 'text'}
                                                value={configs[field.key] || ''}
                                                onChange={e => setConfigs({ ...configs, [field.key]: e.target.value })}
                                                placeholder={field.placeholder}
                                                style={{
                                                    paddingRight: field.isSecret ? '44px' : undefined,
                                                    fontFamily: field.isSecret && !visibleFields[field.key] ? 'inherit' : 'monospace',
                                                    fontSize: '0.9rem',
                                                }}
                                            />
                                        ) : field.key === 'openai_model' ? (
                                            <div style={{ position: 'relative' }}>
                                                <select
                                                    className="form-input"
                                                    value={configs[field.key] || 'gpt-3.5-turbo'}
                                                    onChange={e => setConfigs({ ...configs, [field.key]: e.target.value })}
                                                    style={{ appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }}
                                                >
                                                    <option value="gpt-4o">GPT-4o (Mais inteligente e rápido)</option>
                                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Mais rápido e barato)</option>
                                                </select>
                                            </div>
                                        ) : (
                                            <input
                                                className="form-input"
                                                type={field.isSecret && !visibleFields[field.key] ? 'password' : 'text'}
                                                value={configs[field.key] || ''}
                                                onChange={e => setConfigs({ ...configs, [field.key]: e.target.value })}
                                                placeholder={field.placeholder}
                                                style={{
                                                    paddingRight: field.isSecret ? '44px' : undefined,
                                                    fontFamily: field.isSecret && !visibleFields[field.key] ? 'inherit' : 'monospace',
                                                    fontSize: '0.9rem',
                                                }}
                                            />
                                        )}
                                        {field.isSecret && (
                                            <button
                                                type="button"
                                                onClick={() => toggleVisibility(field.key)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                }}
                                                title={visibleFields[field.key] ? 'Esconder' : 'Mostrar'}
                                            >
                                                {visibleFields[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Test Connection Button + Result */}
                        <div style={{
                            marginTop: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <button
                                className="btn"
                                onClick={() => testConnection(integration.id)}
                                disabled={testResults[integration.id]?.status === 'testing'}
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                    padding: '8px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                }}
                            >
                                <RefreshCw size={14} /> Testar Conexão
                            </button>
                            {testResults[integration.id]?.message && testResults[integration.id]?.status !== 'testing' && (
                                <span style={{
                                    fontSize: '0.8rem',
                                    color: testResults[integration.id]?.status === 'success' ? '#22c55e' : '#ef4444',
                                }}>
                                    {testResults[integration.id].message}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ............................................... */}
            {/* CENTRAL DE CONTROLE AI                         */}
            {/* ............................................... */}
            <div className="chart-card" style={{ marginTop: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{
                        width: '48px', height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.4rem'
                    }}>
                        Y-
                    </div>
                    <div>
                        <div className="chart-title" style={{ marginBottom: '2px', fontSize: '1.1rem' }}>Central de Controle AI (Multi-Provedor)</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Gerencie provedores e modelos especficos para cada funo (Agentes IA WhatsApp e Pilger AI).
                        </div>
                    </div>
                </div>

                {/* Global Default Provider */}
                <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <Zap size={18} style={{ color: 'var(--gold)' }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Provedor Padrão (Global)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Usado quando uma funo no tem provedor especfico selecionado.</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', borderRadius: '8px', border: configs['ai_provider'] === 'gemini' ? '1px solid var(--gold)' : '1px solid var(--border-color)', background: configs['ai_provider'] === 'gemini' ? 'rgba(201, 169, 110, 0.1)' : 'transparent' }}>
                            <input
                                type="radio"
                                name="ai_provider"
                                value="gemini"
                                checked={(!configs['ai_provider'] || configs['ai_provider'] === 'gemini')}
                                onChange={() => setConfigs({ ...configs, ai_provider: 'gemini' })}
                                style={{ accentColor: 'var(--gold)' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Brain size={16} /> <span>Google Gemini</span>
                            </div>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', borderRadius: '8px', border: configs['ai_provider'] === 'openai' ? '1px solid var(--gold)' : '1px solid var(--border-color)', background: configs['ai_provider'] === 'openai' ? 'rgba(201, 169, 110, 0.1)' : 'transparent' }}>
                            <input
                                type="radio"
                                name="ai_provider"
                                value="openai"
                                checked={configs['ai_provider'] === 'openai'}
                                onChange={() => setConfigs({ ...configs, ai_provider: 'openai' })}
                                style={{ accentColor: 'var(--gold)' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Bot size={16} /> <span>OpenAI</span>
                            </div>
                        </label>
                    </div>

                    {/* API Keys (Conditional) */}
                    {/* API Keys (Conditional) */}
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                        {/* Gemini Key */}
                        {(configs['ai_provider'] !== 'openai' || [configs['concierge_provider'], configs['pilger_provider']].includes('gemini')) && (
                            <div className="form-group" style={{ marginBottom: (configs['ai_provider'] === 'openai' || [configs['concierge_provider'], configs['cloner_provider'], configs['pilger_provider']].includes('openai')) ? '20px' : '0' }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Brain size={16} style={{ color: 'var(--gold)' }} />
                                    Google Gemini API Key
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="form-input"
                                        type={!visibleFields['gemini_api_key'] ? 'password' : 'text'}
                                        value={configs['gemini_api_key'] || ''}
                                        onChange={e => setConfigs({ ...configs, gemini_api_key: e.target.value })}
                                        placeholder="AIzaSy..."
                                        style={{ fontFamily: 'monospace', paddingRight: '40px', fontSize: '0.9rem' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleVisibility('gemini_api_key')}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        {visibleFields['gemini_api_key'] ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => testConnection('gemini')}
                                        disabled={testResults['gemini']?.status === 'testing'}
                                        style={{
                                            fontSize: '0.75rem',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        {testResults['gemini']?.status === 'testing' ? <RefreshCw size={12} className="spin" /> : <Wifi size={12} />}
                                        Testar Conexão
                                    </button>
                                    {testResults['gemini']?.message && (
                                        <span style={{ fontSize: '0.8rem', color: testResults['gemini']?.status === 'success' ? '#22c55e' : '#ef4444' }}>
                                            {testResults['gemini'].message}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {(configs['ai_provider'] !== 'openai' || [configs['concierge_provider'], configs['cloner_provider'], configs['pilger_provider']].includes('gemini')) && (
                            <details style={{ marginTop: '18px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-primary)' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                                    Faturamento oficial Gemini / Google Billing
                                </summary>
                                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    Use estes campos quando a exportacao do Cloud Billing para BigQuery estiver ativa. O painel usa essa fonte para mostrar o valor oficial ja apurado pelo Google.
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '14px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Projeto BigQuery</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_bigquery_project_id'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_bigquery_project_id: e.target.value })}
                                            placeholder="pilger-billing"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Dataset</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_bigquery_dataset'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_bigquery_dataset: e.target.value })}
                                            placeholder="billing_export"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Tabela</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_bigquery_table'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_bigquery_table: e.target.value })}
                                            placeholder="gcp_billing_export_v1_..."
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Projeto Gemini</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_google_project_id'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_google_project_id: e.target.value })}
                                            placeholder="gen-lang-client-..."
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '12px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Client email da service account</label>
                                        <input
                                            className="form-input"
                                            value={configs['gemini_billing_client_email'] || ''}
                                            onChange={e => setConfigs({ ...configs, gemini_billing_client_email: e.target.value })}
                                            placeholder="billing-reader@projeto.iam.gserviceaccount.com"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Private key</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                className="form-input"
                                                type={!visibleFields['gemini_billing_private_key'] ? 'password' : 'text'}
                                                value={configs['gemini_billing_private_key'] || ''}
                                                onChange={e => setConfigs({ ...configs, gemini_billing_private_key: e.target.value })}
                                                placeholder="-----BEGIN PRIVATE KEY-----"
                                                style={{ fontFamily: 'monospace', paddingRight: '40px', fontSize: '0.82rem' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => toggleVisibility('gemini_billing_private_key')}
                                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                            >
                                                {visibleFields['gemini_billing_private_key'] ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </details>
                        )}

                        {/* OpenAI Key */}
                        {(configs['ai_provider'] === 'openai' || [configs['concierge_provider'], configs['pilger_provider']].includes('openai')) && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Bot size={16} style={{ color: 'var(--gold)' }} />
                                    OpenAI API Key
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="form-input"
                                        type={!visibleFields['openai_api_key'] ? 'password' : 'text'}
                                        value={configs['openai_api_key'] || ''}
                                        onChange={e => setConfigs({ ...configs, openai_api_key: e.target.value })}
                                        placeholder="sk-..."
                                        style={{ fontFamily: 'monospace', paddingRight: '40px', fontSize: '0.9rem' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleVisibility('openai_api_key')}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        {visibleFields['openai_api_key'] ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => testConnection('openai')}
                                        disabled={testResults['openai']?.status === 'testing'}
                                        style={{
                                            fontSize: '0.75rem',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        {testResults['openai']?.status === 'testing' ? <RefreshCw size={12} className="spin" /> : <Wifi size={12} />}
                                        Testar Conexão
                                    </button>
                                    {testResults['openai']?.message && (
                                        <span style={{ fontSize: '0.8rem', color: testResults['openai']?.status === 'success' ? '#22c55e' : '#ef4444' }}>
                                            {testResults['openai'].message}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 1. PILGER AI */}
                <div style={{ marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px dashed var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#818cf8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>Y</span> 1. Pilger AI (Assistente Admin)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Provedor do Pilger AI</label>
                            <select
                                className="form-input"
                                value={configs['pilger_provider'] || ''}
                                onChange={e => setConfigs({ ...configs, pilger_provider: e.target.value })}
                            >
                                <option value="">Usar Padrão Global ({configs['ai_provider'] === 'openai' ? 'OpenAI' : 'Gemini'})</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Modelo do Pilger AI</label>
                            {(configs['pilger_provider'] === 'openai' || (!configs['pilger_provider'] && configs['ai_provider'] === 'openai')) ? (
                                <div style={{ position: 'relative' }}>
                                    <select className="form-input" value={configs['openai_pilger_model'] || ''} onChange={e => setConfigs({ ...configs, openai_pilger_model: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        {openaiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <select className="form-input" value={configs['gemini_pilger_model'] || ''} onChange={e => setConfigs({ ...configs, gemini_pilger_model: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        {geminiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Prompt do Sistema (Pilger AI)</label>
                        <textarea
                            className="form-textarea"
                            rows={10}
                            value={configs['pilger_ai_system_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, pilger_ai_system_prompt: e.target.value })}
                            placeholder="Digite o prompt completo do Pilger AI"
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem', borderColor: 'rgba(129, 140, 248, 0.3)' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Prompt principal do assistente administrativo.
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prompt de Regras (Pilger AI)</label>
                        <textarea
                            className="form-textarea"
                            rows={8}
                            value={configs['pilger_ai_rules_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, pilger_ai_rules_prompt: e.target.value })}
                            placeholder="Digite as regras complementares do Pilger AI"
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem', borderColor: 'rgba(129, 140, 248, 0.3)' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Regras extras que sero aplicadas junto ao prompt principal.
                        </div>
                    </div>
                </div>

                {/* 2. AGENTES IA WHATSAPP */}
                <div style={{ marginBottom: '40px', paddingBottom: '30px', borderBottom: '1px dashed var(--border-color)' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#22c55e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span></span> 2. Agentes IA WhatsApp (Corretores)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Provedor dos Agentes WhatsApp</label>
                            <select
                                className="form-input"
                                value={configs['whatsapp_provider'] || ''}
                                onChange={e => setConfigs({ ...configs, whatsapp_provider: e.target.value })}
                            >
                                <option value="">Usar Padrão Global ({configs['ai_provider'] === 'openai' ? 'OpenAI' : 'Gemini'})</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Modelo dos Agentes WhatsApp</label>
                            {isWhatsAppOpenAI ? (
                                <div style={{ position: 'relative' }}>
                                    <select className="form-input" value={configs['openai_whatsapp_model'] || ''} onChange={e => setConfigs({ ...configs, openai_whatsapp_model: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        {openaiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <select className="form-input" value={configs['gemini_whatsapp_model'] || ''} onChange={e => setConfigs({ ...configs, gemini_whatsapp_model: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        {geminiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>



                    {isWhatsAppOpenAI && (
                        <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: '20px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                <strong>Atencao:</strong> usando OpenAI nos agentes WhatsApp, fotos/prints continuam sendo analisados, mas videos nao serao interpretados automaticamente. Quando um cliente enviar video, o agente vai pedir foto, print ou uma descricao para continuar o atendimento.
                            </div>
                        </div>
                    )}

                    <div style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.06)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.15)', marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            O provedor e modelo escolhidos aqui serão usados por <strong>todos os agentes IA de WhatsApp</strong> (corretores). O prompt de cada agente é configurado individualmente na <strong>página de Corretores</strong>.
                        </div>
                    </div>
                </div>

                    <div className="form-group">
                        <label className="form-label">Prompt Global Automático dos Agentes WhatsApp</label>
                        <textarea
                            className="form-textarea"
                            rows={22}
                            value={WHATSAPP_SYSTEM_PROMPT_PREVIEW}
                            readOnly
                            style={{
                                fontFamily: 'monospace',
                                fontSize: '0.82rem',
                                borderColor: 'rgba(34, 197, 94, 0.3)',
                                background: 'rgba(34, 197, 94, 0.03)',
                                lineHeight: 1.55,
                            }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Visualização técnica da camada global aplicada automaticamente. O conteúdo real recebe dados dinâmicos de cada lead, agente, tags e catálogo no momento da resposta.
                        </div>
                    </div>

                {/* 3. EXTRAÇÃO DE LEADS */}
                <div style={{ paddingBottom: '30px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#34d399', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span></span> 3. Extração de Leads (WhatsApp)
                    </h3>

                    <div className="form-group">
                        <label className="form-label">Prompt de Extração de Dados</label>
                        <textarea
                            className="form-textarea"
                            rows={6}
                            value={configs['lead_extraction_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, lead_extraction_prompt: e.target.value })}
                            placeholder="Digite o prompt completo de extração de leads"
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem', borderColor: 'rgba(52, 211, 153, 0.3)' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Controla como a IA identifica e extrai leads da conversa.
                        </div>
                    </div>
                </div>

                {/* 4. TRÁFEGO (GESTOR IA) */}
                <div style={{ paddingBottom: '30px', borderBottom: '1px dashed var(--border-color)', marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#ec4899', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span></span> 4. Gestor de Tráfego (Análise Autônoma)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Provedor do Gestor de Tráfego</label>
                            <select className="form-input" value={configs['ads_provider'] || ''} onChange={e => setConfigs({ ...configs, ads_provider: e.target.value })}>
                                <option value="">Usar Padrão Global</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Modelo do Gestor de Tráfego</label>
                            <select className="form-input" value={configs['ads_provider'] === 'openai' ? (configs['openai_ads_model'] || '') : (configs['gemini_ads_model'] || '')} onChange={e => {
                                if (configs['ads_provider'] === 'openai') {
                                    setConfigs({ ...configs, openai_ads_model: e.target.value })
                                } else {
                                    setConfigs({ ...configs, gemini_ads_model: e.target.value })
                                }
                            }}>
                                <option value="">Selecione...</option>
                                {configs['ads_provider'] === 'openai' ? openaiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>) : geminiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '20px', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Intervalo da sincronizacao Ads</label>
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                max={1440}
                                step={1}
                                value={configs['ads_sync_interval_minutes'] || '60'}
                                onChange={e => setConfigs({ ...configs, ads_sync_interval_minutes: e.target.value })}
                            />
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Minutos entre leituras de metricas e sincronizacao financeira.
                            </div>
                        </div>
                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'grid', gap: '8px' }}>
                            <div>Ultima conclusao: <b style={{ color: 'var(--text-primary)' }}>{formatConfigDateTime(configs['ads_sync_last_run_at'])}</b></div>
                            <div>Ultimo inicio: <b style={{ color: 'var(--text-primary)' }}>{formatConfigDateTime(configs['ads_sync_last_started_at'])}</b></div>
                            {configs['ads_sync_last_error'] && (
                                <div style={{ color: '#ef4444' }}>Ultimo erro: <b>{configs['ads_sync_last_error']}</b></div>
                            )}
                            <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={syncAdsSpendNow}
                                disabled={syncingAdsSpend}
                                style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                <RefreshCw size={14} className={syncingAdsSpend ? 'spin' : ''} />
                                {syncingAdsSpend ? 'Sincronizando...' : 'Sincronizar agora'}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Prompt do Sistema (Gestor de Tráfego)</label>
                        <textarea
                            className="form-textarea"
                            rows={8}
                            value={configs['ads_analyst_system_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, ads_analyst_system_prompt: e.target.value })}
                            placeholder="Digite o prompt completo do Gestor de Tráfego"
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                        />
                    </div>
                </div>

                {/* 5. AGENDAMENTOS */}
                <div style={{ paddingBottom: '30px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#8b5cf6', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span></span> 5. Agendamento de Relatórios Pilger CEO
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px', alignItems: 'start' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <CalendarDays size={18} style={{ color: 'var(--gold)' }} />
                                <div style={{ fontWeight: 700 }}>Relatório Diário & Análise</div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                Selecione os dias e horários em que o relatório deve rodar automaticamente.
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Dias da semana</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {WEEK_DAYS.map(day => {
                                        const selected = dailyDays.has(day.value)
                                        return (
                                            <button key={`daily-day-${day.value}`} type="button" className="btn btn-sm" onClick={() => toggleDay('pilger_daily_days', day.value, '0,1,2,3,4,5,6')} style={{ background: selected ? 'var(--gold)' : 'transparent', color: selected ? '#111' : 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '3px 10px', fontSize: '0.75rem' }}>
                                                {day.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Horários (Brasília)</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {HOUR_OPTIONS.map(hour => {
                                        const selected = dailyHours.has(hour)
                                        return (
                                            <button key={`daily-hour-${hour}`} type="button" className="btn btn-sm" onClick={() => toggleHour('pilger_daily_time', hour, '23')} style={{ background: selected ? 'var(--gold)' : 'transparent', color: selected ? '#111' : 'var(--text-primary)', border: '1px solid var(--border-color)', minWidth: '56px', padding: '3px 8px', fontSize: '0.74rem', flex: '0 0 auto' }}>
                                                {formatHourLabel(hour)}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Resumo: roda em <b>{Array.from(dailyDays).sort((a, b) => Number(a) - Number(b)).map(dayLabel).join(', ')}</b> às <b>{Array.from(dailyHours).sort((a, b) => Number(a) - Number(b)).map(formatHourLabel).join(', ')}</b>.
                            </div>
                        </div>

                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <Clock3 size={18} style={{ color: '#8b5cf6' }} />
                                <div style={{ fontWeight: 700 }}>Diretriz Semanal Pilger AI</div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                Também pode rodar mais de uma vez por semana e em múltiplos horários.
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Dias da semana</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {WEEK_DAYS.map(day => {
                                        const selected = weeklyDays.has(day.value)
                                        return (
                                            <button key={`weekly-day-${day.value}`} type="button" className="btn btn-sm" onClick={() => toggleDay('pilger_weekly_days', day.value, '1')} style={{ background: selected ? '#8b5cf6' : 'transparent', color: selected ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '3px 10px', fontSize: '0.75rem' }}>
                                                {day.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Horários (Brasília)</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {HOUR_OPTIONS.map(hour => {
                                        const selected = weeklyHours.has(hour)
                                        return (
                                            <button key={`weekly-hour-${hour}`} type="button" className="btn btn-sm" onClick={() => toggleHour('pilger_weekly_times', hour, '23')} style={{ background: selected ? '#8b5cf6' : 'transparent', color: selected ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', minWidth: '56px', padding: '3px 8px', fontSize: '0.74rem', flex: '0 0 auto' }}>
                                                {formatHourLabel(hour)}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Resumo: roda em <b>{Array.from(weeklyDays).sort((a, b) => Number(a) - Number(b)).map(dayLabel).join(', ')}</b> às <b>{Array.from(weeklyHours).sort((a, b) => Number(a) - Number(b)).map(formatHourLabel).join(', ')}</b>.
                            </div>
                        </div>

                        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <TrendingUp size={18} style={{ color: 'var(--gold)' }} />
                                <div style={{ fontWeight: 700 }}>Radar de Mercado</div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                Configure facilmente quando o radar coleta dados de mercado.
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Dias da semana</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {WEEK_DAYS.map(day => {
                                        const selected = radarDays.has(day.value)
                                        return (
                                            <button key={`radar-day-${day.value}`} type="button" className="btn btn-sm" onClick={() => toggleDay('radar_collection_days', day.value, '0,1,2,3,4,5,6')} style={{ background: selected ? 'var(--gold)' : 'transparent', color: selected ? '#111' : 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '3px 10px', fontSize: '0.75rem' }}>
                                                {day.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Horários (Brasília)</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {HOUR_OPTIONS.map(hour => {
                                        const selected = radarHours.has(hour)
                                        return (
                                            <button key={`radar-hour-${hour}`} type="button" className="btn btn-sm" onClick={() => toggleHour('radar_collection_times', hour, '06,12,18')} style={{ background: selected ? 'var(--gold)' : 'transparent', color: selected ? '#111' : 'var(--text-primary)', border: '1px solid var(--border-color)', minWidth: '56px', padding: '3px 8px', fontSize: '0.74rem', flex: '0 0 auto' }}>
                                                {formatHourLabel(hour)}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Resumo: coleta em <b>{Array.from(radarDays).sort((a, b) => Number(a) - Number(b)).map(dayLabel).join(', ')}</b> às <b>{Array.from(radarHours).sort((a, b) => Number(a) - Number(b)).map(formatHourLabel).join(', ')}</b>.
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid rgba(201, 169, 110, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                            <Brain size={18} style={{ color: 'var(--gold)' }} />
                            <div>
                                <div style={{ fontWeight: 800 }}>Inteligencia IA do Radar</div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                    Controla quando o radar gera analises comerciais, score Pilger e recomendacoes para blog, campanhas e vitrines.
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Analise IA</label>
                                <select
                                    className="form-input"
                                    value={configs['radar_ai_enabled'] || 'true'}
                                    onChange={e => setConfigs({ ...configs, radar_ai_enabled: e.target.value })}
                                >
                                    <option value="true">Ativada</option>
                                    <option value="false">Desativada (apenas regras)</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Score minimo para chamar IA</label>
                                <input className="form-input" type="number" min={0} max={100} value={configs['radar_ai_min_opportunity_score'] || '70'} onChange={e => setConfigs({ ...configs, radar_ai_min_opportunity_score: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Maximo de analises IA por coleta</label>
                                <input className="form-input" type="number" min={0} max={50} value={configs['radar_ai_max_insights_per_run'] || '6'} onChange={e => setConfigs({ ...configs, radar_ai_max_insights_per_run: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Alerta de oportunidade acima de</label>
                                <input className="form-input" type="number" min={0} max={100} value={configs['radar_opportunity_alert_threshold'] || '75'} onChange={e => setConfigs({ ...configs, radar_opportunity_alert_threshold: e.target.value })} />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Prompt do Analista de Radar de Mercado</label>
                            <textarea
                                className="form-textarea"
                                rows={7}
                                value={configs['radar_analyst_system_prompt'] || ''}
                                onChange={e => setConfigs({ ...configs, radar_analyst_system_prompt: e.target.value })}
                                placeholder="Digite o prompt do Analista de Radar de Mercado"
                                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>

                    {/* Prompts dos Relatórios */}
                    <div className="form-group" style={{ marginTop: '20px' }}>
                        <label className="form-label">Prompt do Relatório Diário</label>
                        <textarea className="form-textarea" rows={6} value={configs['pilger_daily_system_prompt'] || ''} onChange={e => setConfigs({ ...configs, pilger_daily_system_prompt: e.target.value })} placeholder="Digite o prompt completo do relatório diário" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prompt da Diretriz Semanal</label>
                        <textarea className="form-textarea" rows={6} value={configs['pilger_weekly_system_prompt'] || ''} onChange={e => setConfigs({ ...configs, pilger_weekly_system_prompt: e.target.value })} placeholder="Digite o prompt completo da diretriz semanal" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
                    </div>
                </div>

                {/* 6. AGENTE CEO IA */}
                <div style={{ paddingBottom: '30px', borderBottom: '1px dashed var(--border-color)', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#6366f1', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span></span> 6. Agente CEO IA (WhatsApp + ERP)
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Provedor do CEO IA</label>
                            <select
                                className="form-input"
                                value={configs['ceo_provider'] || ''}
                                onChange={e => setConfigs({ ...configs, ceo_provider: e.target.value })}
                            >
                                <option value="">Usar Padrão do Pilger AI ({configs['pilger_provider'] === 'openai' ? 'OpenAI' : (configs['pilger_provider'] === 'gemini' ? 'Gemini' : (configs['ai_provider'] === 'openai' ? 'OpenAI' : 'Gemini'))})</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Modelo do CEO IA</label>
                            {(configs['ceo_provider'] === 'openai' || (!configs['ceo_provider'] && (configs['pilger_provider'] === 'openai' || (!configs['pilger_provider'] && configs['ai_provider'] === 'openai')))) ? (
                                <select className="form-input" value={configs['openai_ceo_model'] || ''} onChange={e => setConfigs({ ...configs, openai_ceo_model: e.target.value })}>
                                    <option value="">Selecione...</option>
                                    {openaiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            ) : (
                                <select className="form-input" value={configs['gemini_ceo_model'] || ''} onChange={e => setConfigs({ ...configs, gemini_ceo_model: e.target.value })}>
                                    <option value="">Selecione...</option>
                                    {geminiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Prompt Base do Agente CEO IA</label>
                        <textarea
                            className="form-textarea"
                            rows={7}
                            value={configs['ceo_agent_system_prompt'] || ''}
                            onChange={e => setConfigs({ ...configs, ceo_agent_system_prompt: e.target.value })}
                            placeholder="Digite o prompt base do CEO IA"
                            style={{ fontFamily: 'monospace', fontSize: '0.85rem', borderColor: 'rgba(99, 102, 241, 0.35)' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Este prompt define o comportamento executivo do CEO IA e e combinado com os prompts de relatorio diario e semanal.
                        </div>
                    </div>
                </div>
            </div>

            {/* Agent Logs */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
                        <Activity size={20} style={{ color: 'var(--gold)' }} />
                        Logs dos Agentes WhatsApp
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <select
                            className="form-input"
                            value={agentLogHours}
                            onChange={e => setAgentLogHours(Number(e.target.value))}
                            style={{ width: '130px', height: '36px', fontSize: '0.8rem' }}
                        >
                            <option value={1}>1 hora</option>
                            <option value={6}>6 horas</option>
                            <option value={24}>24 horas</option>
                            <option value={72}>72 horas</option>
                        </select>
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={fetchAgentLogs}
                            disabled={agentLogsLoading}
                            style={{ minWidth: '110px' }}
                        >
                            <RefreshCw size={15} className={agentLogsLoading ? 'spin' : ''} />
                            Atualizar
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    {[
                        { label: 'Erros', value: agentLogSummary.error || 0, severity: 'error' as AgentLogSeverity, icon: <Bug size={16} /> },
                        { label: 'Alertas', value: agentLogSummary.warning || 0, severity: 'warning' as AgentLogSeverity, icon: <AlertTriangle size={16} /> },
                        { label: 'Respondidos', value: agentLogSummary.success || 0, severity: 'success' as AgentLogSeverity, icon: <MessageSquare size={16} /> },
                        { label: 'Total', value: agentLogSummary.total || 0, severity: 'info' as AgentLogSeverity, icon: <Clock3 size={16} /> },
                    ].map(item => {
                        const color = getAgentSeverityColor(item.severity)
                        return (
                            <div key={item.label} style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                background: 'var(--bg-primary)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color }}>
                                    {item.icon}
                                    <strong style={{ fontSize: '1.15rem' }}>{item.value}</strong>
                                </div>
                                <div style={{ marginTop: '5px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.label}</div>
                            </div>
                        )
                    })}
                </div>

                {agentLogsError && (
                    <div style={{ marginBottom: '12px', color: '#ef4444', fontSize: '0.82rem' }}>
                        {agentLogsError}
                    </div>
                )}

                <div style={{ display: 'grid', gap: '8px', maxHeight: '430px', overflowY: 'auto', paddingRight: '4px' }}>
                    {agentLogs.length === 0 && !agentLogsLoading ? (
                        <div style={{ border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '14px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                            Nenhum evento de agente encontrado nesse periodo.
                        </div>
                    ) : agentLogs.slice(0, 18).map(log => {
                        const color = getAgentSeverityColor(log.severity)
                        const detail = getAgentLogDetail(log)
                        return (
                            <div key={log.id} style={{
                                display: 'grid',
                                gridTemplateColumns: '130px 1fr',
                                gap: '10px',
                                border: '1px solid var(--border-color)',
                                borderLeft: `3px solid ${color}`,
                                borderRadius: '8px',
                                padding: '10px 12px',
                                background: 'var(--bg-primary)',
                            }}>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    <div>{formatConfigDateTime(log.created_at)}</div>
                                    <span style={{
                                        display: 'inline-flex',
                                        marginTop: '6px',
                                        padding: '3px 8px',
                                        borderRadius: '999px',
                                        color,
                                        background: `${color}22`,
                                        border: `1px solid ${color}55`,
                                        fontWeight: 700,
                                    }}>
                                        {getAgentSeverityLabel(log.severity)}
                                    </span>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                        <strong style={{ fontSize: '0.86rem' }}>{getAgentActionLabel(log.action)}</strong>
                                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                            {log.from_phone || 'sem telefone'} {log.message_type ? `- ${log.message_type}` : ''}
                                        </span>
                                    </div>
                                    {detail && (
                                        <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                                            {detail}
                                        </div>
                                    )}
                                    {(log.instance_name || log.sender_name) && (
                                        <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {log.instance_name || 'Instancia'} {log.sender_name ? `- ${log.sender_name}` : ''}
                                        </div>
                                    )}
                                    <details style={{ marginTop: '6px' }}>
                                        <summary style={{ cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Detalhes</summary>
                                        <pre style={{
                                            marginTop: '6px',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            background: 'rgba(0,0,0,0.16)',
                                            borderRadius: '6px',
                                            padding: '8px',
                                            maxHeight: '180px',
                                            overflow: 'auto',
                                        }}>
                                            {JSON.stringify(log.payload || {}, null, 2).slice(0, 1400)}
                                        </pre>
                                    </details>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Diagnostic Tools */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div className="chart-title" style={{ marginBottom: '12px' }}>Ferramentas de Diagnóstico</div>
                <div style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                            Status de Créditos / Quota (LLMs)
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Provider ativo: <strong>{llmCreditCheck?.active_provider || '—'}</strong>
                                {llmCreditCheck?.whatsapp_provider ? ` • WhatsApp: ${llmCreditCheck.whatsapp_provider}` : ''}
                            </div>
                        </div>
                        <button
                            onClick={runLLMCreditCheck}
                            disabled={llmCreditLoading}
                            className="btn btn-outline btn-sm"
                            style={{ minWidth: 170 }}
                        >
                            {llmCreditLoading ? 'Verificando...' : 'Verificar Créditos Agora'}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px', marginTop: '12px' }}>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <strong>OpenAI</strong>
                                <span style={{
                                    fontSize: '0.72rem',
                                    padding: '3px 8px',
                                    borderRadius: '999px',
                                    background: `${getStatusColor(llmCreditCheck?.openai?.status)}22`,
                                    color: getStatusColor(llmCreditCheck?.openai?.status),
                                    border: `1px solid ${getStatusColor(llmCreditCheck?.openai?.status)}55`,
                                    fontWeight: 700,
                                }}>
                                    {getStatusLabel(llmCreditCheck?.openai?.status)}
                                </span>
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                {llmCreditCheck?.openai?.message || 'Sem verificação ainda.'}
                            </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <strong>Gemini</strong>
                                <span style={{
                                    fontSize: '0.72rem',
                                    padding: '3px 8px',
                                    borderRadius: '999px',
                                    background: `${getStatusColor(llmCreditCheck?.gemini?.status)}22`,
                                    color: getStatusColor(llmCreditCheck?.gemini?.status),
                                    border: `1px solid ${getStatusColor(llmCreditCheck?.gemini?.status)}55`,
                                    fontWeight: 700,
                                }}>
                                    {getStatusLabel(llmCreditCheck?.gemini?.status)}
                                </span>
                            </div>
                            <div style={{ marginTop: '6px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                {llmCreditCheck?.gemini?.message || 'Sem verificação ainda.'}
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                            Gasto Gemini em Tempo Real
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Estimativa por tokens do nosso sistema. Cambio USD/BRL: <strong>{geminiCostSummary?.usd_to_brl || 5}</strong>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => fetchGeminiCosts(true)}
                                disabled={geminiCostsLoading}
                            >
                                <RefreshCw size={15} className={geminiCostsLoading ? 'spin' : ''} />
                                Atualizar gasto
                            </button>
                            <button
                                type="button"
                                className="btn btn-gold btn-sm"
                                onClick={syncGeminiCostsToFinance}
                                disabled={syncingGeminiFinance || !geminiCostSummary || geminiCostSummary.month_total.estimated_brl <= 0}
                            >
                                {syncingGeminiFinance ? 'Lancando...' : 'Lancar no financeiro'}
                            </button>
                        </div>
                    </div>

                    {geminiCostsError && (
                        <div style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '10px' }}>{geminiCostsError}</div>
                    )}

                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Google Billing oficial</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {geminiCostSummary?.official_billing?.message || 'Aguardando leitura do faturamento oficial.'}
                                </div>
                            </div>
                            <span style={{
                                fontSize: '0.72rem',
                                padding: '3px 8px',
                                borderRadius: '999px',
                                background: `${getOfficialBillingColor(geminiCostSummary?.official_billing?.status)}22`,
                                color: getOfficialBillingColor(geminiCostSummary?.official_billing?.status),
                                border: `1px solid ${getOfficialBillingColor(geminiCostSummary?.official_billing?.status)}55`,
                                fontWeight: 700,
                            }}>
                                {geminiCostSummary?.official_billing?.status === 'ok'
                                    ? 'Conectado'
                                    : geminiCostSummary?.official_billing?.status === 'error'
                                        ? 'Erro'
                                        : 'Nao configurado'}
                            </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hoje apurado</div>
                                <strong>{formatCurrency(geminiCostSummary?.official_billing?.today_cost_brl || 0)}</strong>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ultimas 24h apuradas</div>
                                <strong>{formatCurrency(geminiCostSummary?.official_billing?.last_24h_cost_brl || 0)}</strong>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mes a pagar</div>
                                <strong>{formatCurrency(geminiCostSummary?.official_billing?.month_cost_brl || 0)}</strong>
                            </div>
                        </div>
                        {geminiCostSummary?.official_billing?.latest_usage_end_time && (
                            <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Ultimo uso no Billing: {formatConfigDateTime(geminiCostSummary.official_billing.latest_usage_end_time)}
                            </div>
                        )}
                        {(geminiCostSummary?.official_billing?.rows || []).length > 0 && (
                            <div style={{ marginTop: '8px', display: 'grid', gap: '5px' }}>
                                {(geminiCostSummary?.official_billing?.rows || []).slice(0, 3).map((row, index) => (
                                    <div key={`${row.project_id}-${row.sku}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.72rem' }}>
                                        <span style={{ color: 'var(--text-muted)', wordBreak: 'break-word' }}>{row.sku || row.service || row.project_id}</span>
                                        <strong>{formatCurrency(row.month_cost_brl)}</strong>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ fontSize: '0.78rem', fontWeight: 800, marginBottom: '8px' }}>Uso em tempo real capturado pelo sistema</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                        {[
                            { label: 'Hoje', total: geminiCostSummary?.today_total },
                            { label: 'Ultimas 24h', total: geminiCostSummary?.last_24h_total },
                            { label: `Mes ${geminiCostSummary?.month || ''}`.trim(), total: geminiCostSummary?.month_total },
                        ].map(item => (
                            <div key={item.label} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.label}</div>
                                <div style={{ marginTop: '4px', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                    {formatCurrency(item.total?.estimated_brl || 0)}
                                </div>
                                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {formatTokenBreakdown(item.total)}
                                </div>
                                <div style={{ marginTop: '3px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {item.total?.calls || 0} chamadas
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px', marginTop: '10px' }}>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px' }}>Por modelo</div>
                            {(geminiCostSummary?.by_model || []).slice(0, 4).map(row => (
                                <div key={row.model} style={{ display: 'grid', gap: '2px', fontSize: '0.74rem', marginTop: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                        <span style={{ color: 'var(--text-muted)', wordBreak: 'break-word' }}>{row.model}</span>
                                        <strong>{formatCurrency(row.estimated_brl)}</strong>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{formatTokenBreakdown(row)}</div>
                                </div>
                            ))}
                            {(!geminiCostSummary?.by_model || geminiCostSummary.by_model.length === 0) && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Sem consumo registrado apos o deploy.</div>
                            )}
                        </div>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px' }}>Por uso</div>
                            {(geminiCostSummary?.by_feature || []).slice(0, 4).map(row => (
                                <div key={row.feature} style={{ display: 'grid', gap: '2px', fontSize: '0.74rem', marginTop: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{getGeminiFeatureLabel(row.feature)}</span>
                                        <strong>{formatCurrency(row.estimated_brl)}</strong>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{formatTokenBreakdown(row)}</div>
                                </div>
                            ))}
                            {(!geminiCostSummary?.by_feature || geminiCostSummary.by_feature.length === 0) && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>As proximas chamadas Gemini ja entram aqui.</div>
                            )}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                    <Link
                        href="/admin/gemini-diagnostic"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 16px',
                            borderRadius: '10px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            textDecoration: 'none',
                            color: 'var(--text-primary)',
                            transition: 'border-color 0.2s',
                        }}
                    >
                        <Microscope size={20} style={{ color: 'var(--gold)' }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Diagnóstico Gemini API</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Verificar modelos disponíveis para sua API Key
                            </div>
                        </div>
                    </Link>
                    <Link
                        href="/admin/openai-diagnostic"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 16px',
                            borderRadius: '10px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            textDecoration: 'none',
                            color: 'var(--text-primary)',
                            transition: 'border-color 0.2s',
                        }}
                    >
                        <Bot size={20} style={{ color: '#10a37f' }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Diagnóstico OpenAI API</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Verificar modelos disponíveis para sua API Key
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Info Card */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div className="chart-title">Sobre a Sala de Manutenção</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <p>As chaves de API configuradas aqui têm <strong>prioridade</strong> sobre as variáveis de ambiente do servidor (<code>.env</code>).</p>
                    <p style={{ marginTop: '8px' }}>
                        Se uma chave for removida daqui, o sistema automaticamente usar a varivel de ambiente como fallback.
                    </p>
                    <p style={{ marginTop: '8px' }}>
                        <strong>Chaves de infraestrutura</strong> (Supabase) são gerenciadas apenas via variáveis de ambiente. O <strong>Inngest</strong> precisa estar configurado tanto aqui quanto nas variáveis de ambiente da Vercel.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
            `}</style>
        </div >
    )
}

