import { createAdminClient } from '@/lib/supabase/server'
import {
    ADS_ANALYSIS_SYSTEM_PROMPT,
    BLOG_INTELLIGENCE_SYSTEM_PROMPT,
    CEO_AGENT_SYSTEM_PROMPT,
    DAILY_REPORT_PROMPT,
    EMAIL_ORCHESTRATOR_SYSTEM_PROMPT,
    INTERNAL_NOTIFIER_SYSTEM_PROMPT,
    IRIS_MEDIA_VOICE_SYSTEM_PROMPT,
    LEAD_EXTRACTION_PROMPT,
    GAIA_ANALYTICS_WEB_SYSTEM_PROMPT,
    MAYA_META_CONNECTIONS_SYSTEM_PROMPT,
    OTTO_INTEGRATIONS_SYSTEM_PROMPT,
    PILGER_AI_PROMPT,
    PILGER_AI_RULES_PROMPT,
    RADAR_ANALYST_SYSTEM_PROMPT,
    RESEARCH_PILGER_SYSTEM_PROMPT,
    BENCHMARK_EDITORIAL_SYSTEM_PROMPT,
    NEWS_INTELLIGENCE_SYSTEM_PROMPT,
    TEO_WEBHOOKS_EVENTS_SYSTEM_PROMPT,
    WEEKLY_REPORT_PROMPT,
} from '@/lib/ai/prompts'
import { DEFAULT_PROPERTY_REGISTER_AGENT_PROMPT } from '@/lib/properties/ai-registration'
import {
    DEFAULT_FIRST_ACCESS_MESSAGE,
    DEFAULT_PASSWORD_RESET_MESSAGE,
} from '@/lib/user-whatsapp-messages'
import { DEFAULT_WHATSAPP_GLOBAL_SYSTEM_PROMPT } from '@/lib/whatsapp/agent-global-prompt'
import {
    DEFAULT_WHATSAPP_FOLLOWUP_SYSTEM_PROMPT,
    DEFAULT_WHATSAPP_RESCUE_SYSTEM_PROMPT,
} from '@/lib/whatsapp/commercial-automation-prompts'
import {
    DEFAULT_WHATSAPP_ATTENDANCE_COACH_PROMPT,
    WHATSAPP_ATTENDANCE_COACH_PROMPT_KEY,
} from '@/lib/whatsapp/attendance-coach-agent'
import { getDefaultResearchPilgerTopicsJson } from '@/lib/research/topics'
import { DEFAULT_EVENT_AGENT_SYSTEM_PROMPT } from '@/lib/events/agent-prompt'
import { DEFAULT_BROKER_CANDIDATE_AGENT_PROMPT } from '@/lib/broker-candidates/agent-prompt'
import { getDefaultEmailAgentTemplatesJson, parseEmailAgentTemplatesJson } from '@/lib/email/agent-templates'
import { getDefaultWhatsAppEditorialTemplatesJson, parseWhatsAppEditorialTemplatesJson } from '@/lib/whatsapp/editorial-templates'
import { getDefaultPushEditorialTemplatesJson, parsePushEditorialTemplatesJson } from '@/lib/push/editorial-templates'
import { resolveAgentCentralProfile, type AgentCentralProfile } from '@/lib/intelligence/agent-runtime'

export type AgentOfficeTone = 'success' | 'warning' | 'danger' | 'info' | 'muted'

export type AgentOfficeBehaviorControl = {
    key: string
    label: string
    type: 'number' | 'select' | 'text' | 'date' | 'time' | 'multiselect' | 'textarea'
    value: string
    fallback: string
    help?: string
    min?: number
    max?: number
    step?: number
    options?: Array<{ label: string; value: string }>
}

export type AgentOfficeRuntimeFact = {
    label: string
    value: string
    tone?: AgentOfficeTone
}

export type AgentOfficeBehaviorAction = {
    id: 'sync_ads_spend' | 'generate_daily_report' | 'generate_weekly_report'
    label: string
    help?: string
}

export type AgentOfficeItem = {
    id: string
    name: string
    personaName: string
    avatarInitials: string
    avatarTone: string
    avatarUrl?: string | null
    avatarConfigKey?: string
    jobTitle: string
    bio: string
    role: string
    sector: string
    status: string
    tone: AgentOfficeTone
    source: 'app_config' | 'virtual_brokers' | 'system'
    promptKey?: string
    promptValue: string
    detail: string
    tools: string[]
    autonomy: string
    llmPolicy: string
    editHref?: string
    brokerId?: string
    behaviorControls?: AgentOfficeBehaviorControl[]
    runtimeFacts?: AgentOfficeRuntimeFact[]
    behaviorActions?: AgentOfficeBehaviorAction[]
    researchTopics?: string
    emailTemplates?: string
    whatsappTemplates?: string
    pushTemplates?: string
    centralContract?: AgentCentralProfile
}

export type AgentOfficeSnapshot = {
    globalProvider: string
    globalModel: string
    totalAgents: number
    activeAgents: number
    promptAgents: number
    brokerAgents: number
    agents: AgentOfficeItem[]
}

type ConfigMap = Record<string, string>

type AgentOfficeBrokerRow = {
    id?: string | number | null
    name?: string | null
    creci?: string | null
    is_active?: boolean | null
    assignment_type?: string | null
    system_prompt?: string | null
    photo_url?: string | null
    phone?: string | null
    whatsapp_instance_id?: string | number | null
    concierge_enabled?: boolean | null
    updated_at?: string | null
    created_at?: string | null
}

type AgentPersona = {
    personaName: string
    jobTitle: string
    bio: string
    avatarTone: string
}

type AgentOfficeDefinition = Omit<
    AgentOfficeItem,
    'status' | 'tone' | 'promptValue' | 'source' | 'llmPolicy' | 'behaviorControls' | 'runtimeFacts' | 'personaName' | 'avatarInitials' | 'avatarTone' | 'jobTitle' | 'bio'
> & {
    fallback: string
    identityPrompt?: boolean
    behaviorControls?: Array<Omit<AgentOfficeBehaviorControl, 'value'>>
    runtimeFacts?: (configs: ConfigMap) => AgentOfficeRuntimeFact[]
}

const WEEKDAY_OPTIONS = [
    { label: 'Dom', value: '0' },
    { label: 'Seg', value: '1' },
    { label: 'Ter', value: '2' },
    { label: 'Qua', value: '3' },
    { label: 'Qui', value: '4' },
    { label: 'Sex', value: '5' },
    { label: 'Sab', value: '6' },
]

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour).padStart(2, '0')
    return { label: `${value}h`, value }
})

function buildWeeklyScheduleControls(
    prefix: 'blog_agent' | 'news_agent',
    defaults: Array<{ day: string; time: string }>
): Array<Omit<AgentOfficeBehaviorControl, 'value'>> {
    return Array.from({ length: 7 }, (_, index) => {
        const slot = index + 1
        const itemDefaults = defaults[index]

        return [
            {
                key: `${prefix}_schedule_day_${slot}`,
                label: `Dia ${slot}`,
                type: 'select' as const,
                fallback: itemDefaults.day,
                options: WEEKDAY_OPTIONS,
            },
            {
                key: `${prefix}_schedule_time_${slot}`,
                label: `Hora ${slot}`,
                type: 'time' as const,
                fallback: itemDefaults.time,
            },
        ]
    }).flat()
}

const BLOG_AGENT_SCHEDULE_CONTROLS = buildWeeklyScheduleControls('blog_agent', [
    { day: '1', time: '09:00' },
    { day: '3', time: '09:00' },
    { day: '5', time: '09:00' },
    { day: 'off', time: '09:00' },
    { day: 'off', time: '09:00' },
    { day: 'off', time: '09:00' },
    { day: 'off', time: '09:00' },
])

const NEWS_AGENT_SCHEDULE_CONTROLS = buildWeeklyScheduleControls('news_agent', [
    { day: '2', time: '10:00' },
    { day: '4', time: '10:00' },
    { day: 'off', time: '10:00' },
    { day: 'off', time: '10:00' },
    { day: 'off', time: '10:00' },
    { day: 'off', time: '10:00' },
    { day: 'off', time: '10:00' },
])

const DEFAULT_FINANCE_OPS_AGENT_PROMPT = [
    'Voce e o Agente Financeiro da Pilger.',
    '',
    'Sua funcao e receber pedidos financeiros encaminhados pelo Pilger WhatsApp Global, organizar o contexto e preparar o lancamento para conferencia humana.',
    '',
    'Regras:',
    '- Antes de encaminhar comprovante, confirme se o lancamento pertence a CPF/PF ou CNPJ/PJ quando isso nao estiver claro.',
    '- Nunca crie, edite ou confirme lancamento financeiro sem permissao e sem os dados minimos.',
    '- Preserve comprovantes, origem da conversa, solicitante, valor, data, forma de pagamento e contraparte quando existirem.',
    '- Quando faltar informacao, devolva uma pendencia objetiva para o Pilger perguntar ao usuario.',
    '- Responda como colega de trabalho: direto, educado e sem inventar dados.',
].join('\n')

const AGENT_PERSONAS: Record<string, AgentPersona> = {
    'pilger-ai-core': {
        personaName: 'Helena Gestao Painel',
        jobTitle: 'Chief of Staff Digital',
        bio: 'Organiza o painel, responde duvidas internas e traduz o ecossistema Pilger em proximas acoes claras.',
        avatarTone: 'noir',
    },
    'pilger-ai-rules': {
        personaName: 'Tomas Governanca IA',
        jobTitle: 'Governanca e Qualidade',
        bio: 'Cuida dos limites, tom, seguranca e consistencia dos agentes antes de qualquer resposta sensivel.',
        avatarTone: 'graphite',
    },
    'property-triage': {
        personaName: 'Marina Triagem Imoveis',
        jobTitle: 'Analista de Briefing Imobiliario',
        bio: 'Confere se o imovel tem dados suficientes para virar um cadastro premium sem lacunas criticas.',
        avatarTone: 'emerald',
    },
    'property-register': {
        personaName: 'Bianca Cadastro Imoveis',
        jobTitle: 'Especialista em Cadastro Premium',
        bio: 'Transforma briefing, fotos e videos em titulo, descricao, SEO e dados de venda com acabamento editorial.',
        avatarTone: 'champagne',
    },
    'whatsapp-lead-extraction': {
        personaName: 'Laura Extracao Leads',
        jobTitle: 'Analista de Leads WhatsApp',
        bio: 'Le conversas, identifica intencao, origem e sinais comerciais para alimentar o CRM com precisao.',
        avatarTone: 'aqua',
    },
    'whatsapp-attendance-coach': {
        personaName: 'Helena Auditoria Comercial',
        jobTitle: 'Coach de Atendimento WhatsApp',
        bio: 'Audita conversas dos corretores, encontra oportunidades perdidas e transforma atendimentos em plano de melhoria diario.',
        avatarTone: 'emerald',
    },
    'whatsapp-global-agent': {
        personaName: 'WhatsApp Global',
        jobTitle: 'Instancia global do ecossistema',
        bio: 'Atende o ecossistema pelo numero global, identifica o perfil de quem conversa e roteia pedidos para o setor correto.',
        avatarTone: 'blue',
    },
    'whatsapp-rescue-agent': {
        personaName: 'Nara Resgate Leads',
        jobTitle: 'Especialista em Resgate',
        bio: 'Recupera leads silenciosos com mensagens curtas, humanas e orientadas a reabrir a conversa.',
        avatarTone: 'rose',
    },
    'whatsapp-followup-agent': {
        personaName: 'Caio Follow-up',
        jobTitle: 'Coordenador de Follow-up',
        bio: 'Retoma conversas no tempo certo e ajuda a manter oportunidades vivas no funil comercial.',
        avatarTone: 'amber',
    },
    'user-first-access-agent': {
        personaName: 'Sofia Onboarding',
        jobTitle: 'Onboarding Interno',
        bio: 'Recebe novos usuarios do painel com acesso, orientacao inicial e comunicacao de boas-vindas.',
        avatarTone: 'lilac',
    },
    'user-password-reset-agent': {
        personaName: 'Bruno Seguranca Acesso',
        jobTitle: 'Seguranca de Acesso',
        bio: 'Cuida das mensagens de reset de senha e comunicacoes internas ligadas a credenciais.',
        avatarTone: 'steel',
    },
    'ads-analyst': {
        personaName: 'Vitor Trafego Pago',
        jobTitle: 'Gestor de Trafego IA',
        bio: 'Monitora campanhas, gasto, CPA e sinais de oportunidade para orientar decisoes de midia paga.',
        avatarTone: 'magenta',
    },
    'finance-ops-agent': {
        personaName: 'Agente Financeiro',
        jobTitle: 'Operacoes Financeiras',
        bio: 'Recebe comprovantes e pedidos financeiros pelo Pilger, pede CPF/CNPJ quando falta classificacao e prepara rascunhos para conferencia.',
        avatarTone: 'steel',
    },
    'social-attendance-agent': {
        personaName: 'Livia Atendimento Social',
        jobTitle: 'Atendimento Social IA',
        bio: 'Analisa comentarios, Direct e Messenger, sugere respostas e identifica oportunidades comerciais nas redes sociais.',
        avatarTone: 'rose',
    },
    'organic-report-agent': {
        personaName: 'Renata Trafego Organico',
        jobTitle: 'Analista de Trafego Organico',
        bio: 'Le Instagram e Facebook organico, encontra conteudos fortes e transforma sinais de audiencia em relatorios acionaveis.',
        avatarTone: 'teal',
    },
    'gaia-analytics-web': {
        personaName: 'Gaia Analytics Web',
        jobTitle: 'Analista de Trafego Web e SEO',
        bio: 'Transforma Google Analytics, Search Console e tracking do site em inteligencia para conteudo, trafego e atendimento.',
        avatarTone: 'blue',
    },
    'maya-meta-connections': {
        personaName: 'Maya Conexoes Meta',
        jobTitle: 'Guardia das Conexoes Meta',
        bio: 'Cuida da saude das conexoes Facebook e Instagram, tokens, paginas, inbox bruto e sincronizacoes sociais.',
        avatarTone: 'rose',
    },
    'otto-integrations': {
        personaName: 'Otto Integracoes',
        jobTitle: 'Monitor de APIs e Conectores',
        bio: 'Transforma diagnosticos tecnicos de provedores externos em alertas e inteligencia operacional para a Central.',
        avatarTone: 'steel',
    },
    'iris-media-voice': {
        personaName: 'Iris Midia e Voz',
        jobTitle: 'Curadora de Midia, Voz e Assets',
        bio: 'Organiza imagens, videos, uploads, R2, bancos de imagem e voz para apoiar conteudo, WhatsApp e publicacao.',
        avatarTone: 'lilac',
    },
    'teo-webhooks-events': {
        personaName: 'Teo Webhooks e Eventos Externos',
        jobTitle: 'Guardiao das Entradas Externas',
        bio: 'Vigia webhooks, formularios, callbacks e eventos externos para garantir que sinais importantes virem memoria na Central.',
        avatarTone: 'graphite',
    },
    'creative-strategy-agent': {
        personaName: 'Clara Criativos',
        jobTitle: 'Estrategista de Criativos',
        bio: 'Transforma briefing, estoque, campanhas e contexto de mercado em copy, angulos e criativos para organico e pago.',
        avatarTone: 'champagne',
    },
    'content-publisher-agent': {
        personaName: 'Miguel Publicacao',
        jobTitle: 'Coordenador de Publicacoes',
        bio: 'Cuida da fila editorial, agenda posts aprovados e prepara publicacoes automaticas quando a governanca libera.',
        avatarTone: 'amber',
    },
    'event-agent': {
        personaName: 'Valentina Eventos',
        jobTitle: 'Orquestradora de Eventos',
        bio: 'Cria automacoes, botoes, enquetes e relatorios de potencial para os eventos da Guilherme Pilger.',
        avatarTone: 'champagne',
    },
    'broker-candidate-agent': {
        personaName: 'Helena Recrutamento',
        jobTitle: 'Agente de Recrutamento de Corretores',
        bio: 'Analisa candidatos do Trabalhe Conosco, pontua potencial e organiza a regua de relacionamento com corretores.',
        avatarTone: 'emerald',
    },
    'internal-notifier': {
        personaName: 'Nina Avisos Internos',
        jobTitle: 'Comunicacao Interna WhatsApp',
        bio: 'Transforma eventos do sistema em avisos curtos, roteados e acionaveis para os setores certos.',
        avatarTone: 'emerald',
    },
    'email-orchestrator': {
        personaName: 'Gabriel Distribuicao Inteligente',
        jobTitle: 'Orquestrador de E-mail, WhatsApp e Push',
        bio: 'Controla a distribuicao de blogs, noticias e recomendacoes por e-mail, WhatsApp global e push.',
        avatarTone: 'blue',
    },
    'pilger-daily-report': {
        personaName: 'Elisa Relatorio Diario',
        jobTitle: 'Relatorios Executivos',
        bio: 'Fecha o dia com leitura objetiva de resultados, riscos, oportunidades e prioridades de gestao.',
        avatarTone: 'sunset',
    },
    'pilger-weekly-report': {
        personaName: 'Augusto Diretriz Semanal',
        jobTitle: 'Planejamento Semanal',
        bio: 'Transforma indicadores em diretrizes semanais para diretoria, marketing, comercial e operacoes.',
        avatarTone: 'olive',
    },
    'ceo-agent': {
        personaName: 'Arthur CEO IA',
        jobTitle: 'CEO IA do Ecossistema',
        bio: 'Cruza informacoes do ERP e orienta decisoes executivas com visao entre setores.',
        avatarTone: 'royal',
    },
    'market-radar': {
        personaName: 'Lara Radar Mercado',
        jobTitle: 'Radar de Mercado',
        bio: 'Observa movimentos de mercado e converte sinais externos em oportunidades comerciais e editoriais.',
        avatarTone: 'teal',
    },
    'blog-intelligence': {
        personaName: 'Isadora Edicao Blog',
        jobTitle: 'Estrategista Editorial SEO',
        bio: 'Cruza conversas, radar, trafego, estoque e comportamento dos leads para decidir pautas de blog com intencao comercial.',
        avatarTone: 'champagne',
    },
    'news-intelligence': {
        personaName: 'Clara Edicao Noticias',
        jobTitle: 'Editora de Noticias',
        bio: 'Monitora fontes, pesquisas e sinais publicos para criar noticias verificaveis sobre cidades, economia e mercado.',
        avatarTone: 'teal',
    },
    'research-pilger': {
        personaName: 'Mateus Pesquisa Externa',
        jobTitle: 'Analista de Pesquisa Externa',
        bio: 'Investiga a internet com fontes atuais e transforma dados externos em contexto para Blog, Radar, CEO e Trafego.',
        avatarTone: 'steel',
    },
    'benchmark-editorial': {
        personaName: 'Lara Benchmark Editorial',
        jobTitle: 'Inteligencia Competitiva SEO/AEO/GEO',
        bio: 'Vigia portais, concorrentes, buscas organicas e respostas de IA, registra achados na Central de Inteligencia e entrega briefings para Clara e Isadora.',
        avatarTone: 'teal',
    },
}

function getInitials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || '')
        .join('') || 'AI'
}

function getPersonaForAgent(agent: { id: string; name: string; role: string; detail: string }): AgentPersona {
    return AGENT_PERSONAS[agent.id] || {
        personaName: agent.name,
        jobTitle: agent.role,
        bio: agent.detail,
        avatarTone: 'gold',
    }
}

function normalizeForIdentity(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function applyAgentIdentity(agent: AgentOfficeDefinition, persona: AgentPersona, prompt: string) {
    if (agent.identityPrompt === false) return prompt

    const safePrompt = prompt.trimStart()
    const normalizedPrompt = normalizeForIdentity(safePrompt)
    const normalizedName = normalizeForIdentity(persona.personaName)

    if (normalizedPrompt.includes(normalizedName)) return safePrompt

    const lines = safePrompt.split(/\r?\n/)
    const firstLine = lines[0] || ''
    const normalizedFirstLine = normalizeForIdentity(firstLine)
    const hasLegacyIdentityLine = normalizedFirstLine.startsWith('voce e ') && !normalizedFirstLine.includes(normalizedName)
    const promptBody = hasLegacyIdentityLine
        ? lines.slice(1).join('\n').trimStart()
        : safePrompt

    return [
        `Voce e ${persona.personaName}, ${persona.jobTitle} da Imobiliaria Guilherme Pilger.`,
        `Agente tecnico no sistema: ${agent.name}.`,
        `Funcao principal: ${agent.detail}`,
        '',
        promptBody,
    ].join('\n')
}

function formatConfigDateTime(value?: string) {
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

const PROPERTY_TRIAGE_PROMPT = [
    'Voce e o Agente de Triagem do Cadastro de Imoveis.',
    '',
    'Sua funcao e revisar o briefing antes do Agente de Cadastro iniciar o trabalho.',
    '',
    'Libere o cadastro somente quando houver informacoes minimas para criar um anuncio premium sem inventar dados:',
    '- tipo do imovel',
    '- endereco completo ou o maximo disponivel: rua, numero/complemento se houver, bairro/regiao, cidade e estado',
    '- finalidade: venda, aluguel ou ambos',
    '- preco exato, faixa de preco ou sob consulta',
    '- metragem/area aproximada',
    '- dados internos do proprietario/consignante: nome e telefone/WhatsApp',
    '- pelo menos 3 fotos ou um briefing realmente detalhado',
    '',
    'Se faltar algo, notifique o admin com uma lista objetiva do que precisa ser informado antes de acionar o Agente de Cadastro.',
].join('\n')

const OFFICE_PROMPT_AGENTS: AgentOfficeDefinition[] = [
    {
        id: 'pilger-ai-core',
        name: 'Pilger AI',
        role: 'Assistente administrativo central',
        sector: 'Compliance e Governança',
        promptKey: 'pilger_ai_system_prompt',
        fallback: PILGER_AI_PROMPT,
        detail: 'Orquestra respostas dentro do painel e entende o ecossistema administrativo.',
        tools: ['Painel admin', 'permissoes', 'rotas internas'],
        autonomy: 'Responde, orienta e prepara acoes; execucoes sensiveis exigem confirmacao.',
        editHref: '/admin/maintenance',
    },
    {
        id: 'pilger-ai-rules',
        name: 'Pilger AI - Regras',
        role: 'Camada de governanca do assistente',
        sector: 'Compliance e Governança',
        promptKey: 'pilger_ai_rules_prompt',
        fallback: PILGER_AI_RULES_PROMPT,
        detail: 'Define limites, tom, seguranca e regras complementares do assistente.',
        tools: ['Politicas internas', 'contexto do painel'],
        autonomy: 'Aplica guardrails antes das respostas do Pilger AI.',
        editHref: '/admin/maintenance',
    },
    {
        id: 'property-triage',
        name: 'Agente de Triagem de Imovel',
        role: 'Validador do briefing antes do cadastro',
        sector: 'Imoveis',
        promptKey: 'property_register_triage_prompt',
        fallback: PROPERTY_TRIAGE_PROMPT,
        detail: 'Confere se existem dados suficientes para iniciar o cadastro com IA.',
        tools: ['Briefing do admin', 'midias enviadas', 'regras minimas'],
        autonomy: 'Pode bloquear o inicio e pedir dados faltantes.',
        editHref: '/admin/properties',
    },
    {
        id: 'property-register',
        name: 'Agente de Cadastro de Imoveis',
        role: 'Copywriter, analista visual e cadastro premium',
        sector: 'Imoveis',
        promptKey: 'property_register_system_prompt',
        fallback: DEFAULT_PROPERTY_REGISTER_AGENT_PROMPT,
        detail: 'Cria titulo, descricao, SEO, dados tecnicos e observacoes internas a partir de briefing, fotos e videos.',
        tools: ['Gemini multimodal', 'R2', 'cadastro de imoveis'],
        autonomy: 'Gera o cadastro em analise; publicacao continua com aprovacao humana.',
        editHref: '/admin/properties',
    },
    {
        id: 'whatsapp-lead-extraction',
        name: 'Agente de Extracao de Leads',
        role: 'Leitura comercial das conversas',
        sector: 'WhatsApp',
        promptKey: 'lead_extraction_prompt',
        fallback: LEAD_EXTRACTION_PROMPT,
        detail: 'Extrai nome, contato, intencao, origem, temperatura e etapa do pipeline comercial.',
        tools: ['WhatsApp', 'CRM', 'funil'],
        autonomy: 'Classifica e organiza dados para o Kanban; nao envia mensagens sozinho por este prompt.',
        editHref: '/admin/whatsapp/agent-config',
    },
    {
        id: 'whatsapp-attendance-coach',
        name: 'Agente Coach de Atendimento',
        role: 'Auditoria diaria das conversas dos corretores',
        sector: 'WhatsApp',
        promptKey: WHATSAPP_ATTENDANCE_COACH_PROMPT_KEY,
        fallback: DEFAULT_WHATSAPP_ATTENDANCE_COACH_PROMPT,
        detail: 'Analisa conversas do WhatsApp com LLM, pontua qualidade do atendimento, oportunidades perdidas e recuperaveis.',
        tools: ['WhatsApp', 'CRM', 'relatorios de atendimento', 'coaching comercial'],
        autonomy: 'Gera relatorios e sugestoes para gestores e corretores; nao envia mensagens automaticamente ao lead.',
        editHref: '/admin/leads/relatorios-atendimento',
        behaviorControls: [
            {
                key: 'whatsapp_attendance_coach_enabled',
                label: 'Auditoria LLM ativa',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativa', value: 'true' },
                    { label: 'Pausada', value: 'false' },
                ],
                help: 'Controla se a Helena usa LLM para enriquecer os relatorios diarios de atendimento.',
            },
            {
                key: 'whatsapp_attendance_coach_max_conversations',
                label: 'Conversas por relatorio',
                type: 'number',
                fallback: '40',
                min: 1,
                max: 200,
                step: 1,
                help: 'Limite de conversas priorizadas para analise LLM por corretor em cada relatorio.',
            },
            {
                key: 'whatsapp_attendance_coach_batch_size',
                label: 'Lote por chamada LLM',
                type: 'number',
                fallback: '8',
                min: 1,
                max: 20,
                step: 1,
                help: 'Quantidade de conversas enviadas por chamada para controlar custo e estabilidade.',
            },
            {
                key: 'whatsapp_attendance_coach_min_messages',
                label: 'Minimo de mensagens',
                type: 'number',
                fallback: '2',
                min: 1,
                max: 20,
                step: 1,
                help: 'Conversas abaixo desse volume continuam no relatorio, mas nao precisam gastar LLM.',
            },
        ],
        runtimeFacts: configs => [
            {
                label: 'Modo atual',
                value: configs.whatsapp_attendance_coach_enabled === 'false' ? 'Auditoria pausada' : 'Auditoria LLM ativa',
                tone: configs.whatsapp_attendance_coach_enabled === 'false' ? 'warning' : 'success',
            },
            {
                label: 'Conversas por relatorio',
                value: `${configs.whatsapp_attendance_coach_max_conversations || '40'} conversas`,
            },
            {
                label: 'Lote LLM',
                value: `${configs.whatsapp_attendance_coach_batch_size || '8'} por chamada`,
            },
        ],
    },
    {
        id: 'whatsapp-global-agent',
        name: 'Agente WhatsApp Global',
        role: 'Diretoria de entrada e roteamento do WhatsApp',
        sector: 'Diretoria',
        promptKey: 'whatsapp_global_system_prompt',
        fallback: DEFAULT_WHATSAPP_GLOBAL_SYSTEM_PROMPT,
        detail: 'Centraliza o WhatsApp Global, identifica o papel de quem conversa e encaminha tarefas para agentes, corretores e setores internos.',
        tools: ['WhatsApp Global', 'CRM', 'usuarios', 'proprietarios', 'catalogo', 'agenda', 'midias'],
        autonomy: 'Atua como portaria inteligente: atende leads comuns, reconhece usuarios autorizados e roteia pedidos internos para o agente responsavel.',
        editHref: '/admin/whatsapp/agent-config',
    },
    {
        id: 'whatsapp-rescue-agent',
        name: 'Agente de Resgate WhatsApp',
        role: 'Recuperacao de leads sem resposta',
        sector: 'WhatsApp',
        promptKey: 'whatsapp_rescue_system_prompt',
        fallback: DEFAULT_WHATSAPP_RESCUE_SYSTEM_PROMPT,
        detail: 'Gera a mensagem inteligente de resgate quando o lead cadastra contato mas nao inicia conversa.',
        tools: ['WhatsApp', 'funil', 'follow-up'],
        autonomy: 'A automacao decide quando acionar; Nara usa IA, Central de Inteligencia e template aprovado para escrever o texto final.',
        editHref: '/admin/whatsapp/agent-config',
        behaviorControls: [
            {
                key: 'whatsapp_rescue_message_template',
                label: 'Template base de resgate',
                type: 'textarea',
                fallback: 'Oi {nome_lead}! Vi seu cadastro e estou por aqui para te ajudar. Se quiser, ja te explico tudo rapidinho por aqui.',
                help: 'Texto aprovado pelo admin que Nara usa como base. A IA pode adaptar o tom, mas deve respeitar este conteudo.',
            },
        ],
    },
    {
        id: 'whatsapp-followup-agent',
        name: 'Agente de Follow-up WhatsApp',
        role: 'Retomada programada de conversa',
        sector: 'WhatsApp',
        promptKey: 'whatsapp_followup_system_prompt',
        fallback: DEFAULT_WHATSAPP_FOLLOWUP_SYSTEM_PROMPT,
        detail: 'Gera a mensagem inteligente de follow-up para leads que precisam ser retomados.',
        tools: ['WhatsApp', 'agenda de follow-up', 'CRM'],
        autonomy: 'A agenda decide quando acionar; Caio usa IA, Central de Inteligencia, historico do lead e template aprovado para escrever cada tentativa.',
        editHref: '/admin/whatsapp/agent-config',
        behaviorControls: [
            {
                key: 'whatsapp_followup_message_template',
                label: 'Template base de follow-up',
                type: 'textarea',
                fallback: 'Oi {nome_lead}, passando para retomar seu atendimento. Quer que eu siga te ajudando por aqui?',
                help: 'Texto aprovado pelo admin que Caio usa como base. A IA adapta a mensagem conforme tentativa e contexto.',
            },
        ],
    },
    {
        id: 'user-first-access-agent',
        name: 'Agente de Primeiro Acesso',
        role: 'Comunicacao de acesso interno',
        sector: 'Operacoes',
        promptKey: 'user_first_access_whatsapp_message',
        fallback: DEFAULT_FIRST_ACCESS_MESSAGE,
        identityPrompt: false,
        detail: 'Mensagem enviada quando um usuario recebe acesso ao painel administrativo.',
        tools: ['WhatsApp global', 'usuarios', 'link seguro'],
        autonomy: 'Envia convite de acesso quando o admin cria ou reenvia credenciais.',
        editHref: '/admin/whatsapp/agent-config',
    },
    {
        id: 'user-password-reset-agent',
        name: 'Agente de Reset de Senha',
        role: 'Comunicacao de seguranca interna',
        sector: 'Operacoes',
        promptKey: 'user_password_reset_whatsapp_message',
        fallback: DEFAULT_PASSWORD_RESET_MESSAGE,
        identityPrompt: false,
        detail: 'Mensagem usada quando um usuario solicita ou recebe redefinicao de senha.',
        tools: ['WhatsApp global', 'usuarios', 'link seguro'],
        autonomy: 'Envia reset quando solicitado pelo admin ou pelo fluxo de acesso.',
        editHref: '/admin/whatsapp/agent-config',
    },
    {
        id: 'ads-analyst',
        name: 'Agente de Trafego Pago',
        role: 'Analista de Meta Ads e Google Ads',
        sector: 'Marketing',
        promptKey: 'ads_analyst_system_prompt',
        fallback: ADS_ANALYSIS_SYSTEM_PROMPT,
        detail: 'Analisa gasto, leads, CPA, campanhas e recomendacoes de performance.',
        tools: ['Meta Ads', 'Google Ads', 'dashboards', 'alertas'],
        autonomy: 'Gera diagnosticos e sugestoes; alteracoes de campanha devem passar por aprovacao.',
        editHref: '/admin/ads',
        behaviorControls: [
            {
                key: 'ads_sync_interval_minutes',
                label: 'Intervalo da sincronizacao Ads',
                type: 'number',
                fallback: '60',
                min: 1,
                max: 1440,
                step: 1,
                help: 'Minutos entre leituras de metricas e sincronizacao financeira.',
            },
        ],
        runtimeFacts: configs => [
            { label: 'Ultima conclusao', value: formatConfigDateTime(configs.ads_sync_last_run_at) },
            { label: 'Ultimo inicio', value: formatConfigDateTime(configs.ads_sync_last_started_at) },
            ...(configs.ads_sync_last_error
                ? [{ label: 'Ultimo erro', value: configs.ads_sync_last_error, tone: 'danger' as AgentOfficeTone }]
                : []),
        ],
        behaviorActions: [
            {
                id: 'sync_ads_spend',
                label: 'Sincronizar agora',
                help: 'Executa a leitura de gastos de trafego pago e atualiza os dados financeiros.',
            },
        ],
    },
    {
        id: 'finance-ops-agent',
        name: 'Agente Financeiro',
        role: 'Triagem financeira e comprovantes',
        sector: 'Financeiro',
        promptKey: 'finance_ops_agent_system_prompt',
        fallback: DEFAULT_FINANCE_OPS_AGENT_PROMPT,
        detail: 'Recebe comprovantes e solicitacoes financeiras encaminhadas pelo Pilger, valida permissao e organiza CPF/CNPJ, valor, data, categoria e contraparte para conferencia.',
        tools: ['WhatsApp Global', 'financeiro', 'comprovantes', 'CPF/CNPJ', 'pendencias'],
        autonomy: 'Pode classificar pedidos e pedir dados faltantes; lancamentos finais continuam dependentes de permissao e conferencia humana.',
        editHref: '/admin/finance',
    },
    {
        id: 'social-attendance-agent',
        name: 'Agente de Atendimento Social',
        role: 'Atendimento de comentarios, Direct e Messenger',
        sector: 'Marketing',
        promptKey: 'meta_social_agent_system_prompt',
        fallback: [
            'Voce e o Agente de Atendimento Social da Pilger Luxury Search.',
            '',
            'Sua funcao e analisar comentarios, Directs e mensagens do Messenger, identificar intencao comercial e sugerir respostas consultivas.',
            '',
            'Regras:',
            '- Nunca prometa informacoes que nao estejam no contexto.',
            '- Se houver interesse em imovel, direcione para atendimento especialista.',
            '- Se houver duvida objetiva, responda curto e com tom premium.',
            '- Se houver reclamacao, priorize acolhimento e encaminhamento humano.',
            '- Respostas automaticas so devem acontecer quando a governanca estiver liberada.',
        ].join('\n'),
        detail: 'Faz triagem de comentarios e mensagens sociais, cria sugestoes de resposta e pontua leads quentes.',
        tools: ['Caixa Meta', 'Instagram Direct', 'Messenger', 'comentarios', 'CRM'],
        autonomy: 'Sugere e aprova respostas; envio automatico depende da trava de autopiloto.',
        editHref: '/admin/ads/inbox',
        behaviorControls: [
            {
                key: 'meta_social_agent_enabled',
                label: 'Agente ativo',
                type: 'select',
                fallback: 'false',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Permite analise e sugestao de respostas sociais.',
            },
            {
                key: 'meta_social_agent_autopilot',
                label: 'Resposta automatica',
                type: 'select',
                fallback: 'false',
                options: [
                    { label: 'Ligada', value: 'true' },
                    { label: 'Desligada', value: 'false' },
                ],
                help: 'Trava sensivel: quando desligada, as respostas ficam para aprovacao humana.',
            },
        ],
        runtimeFacts: configs => [
            { label: 'Modo atual', value: configs.meta_social_agent_autopilot === 'true' ? 'Autopiloto ligado' : 'Aprovacao humana', tone: configs.meta_social_agent_autopilot === 'true' ? 'warning' : 'success' },
        ],
    },
    {
        id: 'organic-report-agent',
        name: 'Agente de Trafego Organico',
        role: 'Relatorios e diagnostico de redes sociais organicas',
        sector: 'Marketing',
        promptKey: 'organic_report_agent_system_prompt',
        fallback: [
            'Voce e o agente de relatorios de trafego organico da Pilger Luxury Search.',
            '',
            'Analise Instagram e Facebook organico com foco em alcance, views, interacoes, comentarios, salvamentos, compartilhamentos e sinais de demanda.',
            '',
            'Entregue diagnostico objetivo, proximas acoes e conteudos que devem virar pauta, criativo ou campanha paga.',
        ].join('\n'),
        detail: 'Gera relatorios do trafego organico, identifica posts de alta performance e recomenda proximos conteudos.',
        tools: ['Instagram organico', 'Facebook organico', 'relatorios IA', 'Central de Criativos'],
        autonomy: 'Gera relatorios e recomendacoes; publicacoes seguem pela fila editorial.',
        editHref: '/admin/ads/organic',
        behaviorControls: [
            {
                key: 'organic_report_agent_enabled',
                label: 'Relatorio organico',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
            },
            {
                key: 'organic_report_agent_interval_hours',
                label: 'Intervalo de analise',
                type: 'number',
                fallback: '24',
                min: 6,
                max: 168,
                step: 1,
                help: 'Horas entre relatorios automaticos.',
            },
        ],
        runtimeFacts: configs => [
            { label: 'Ultima conclusao', value: formatConfigDateTime(configs.organic_report_agent_last_run_at) },
            { label: 'Ultimo inicio', value: formatConfigDateTime(configs.organic_report_agent_last_started_at) },
            ...(configs.organic_report_agent_last_error
                ? [{ label: 'Ultimo erro', value: configs.organic_report_agent_last_error, tone: 'danger' as AgentOfficeTone }]
                : []),
        ],
    },
    {
        id: 'gaia-analytics-web',
        name: 'Agente Analytics Web',
        role: 'Coleta e interpreta Google Analytics, Search Console e tracking do site',
        sector: 'Inteligencia',
        promptKey: 'gaia_analytics_web_system_prompt',
        fallback: GAIA_ANALYTICS_WEB_SYSTEM_PROMPT,
        detail: 'Transforma trafego web, queries organicas, paginas fortes e paginas fracas em sinais para Central, Blog, Noticias, Trafego e CEO.',
        tools: ['Google Analytics', 'Search Console', 'tracking do site', 'paginas', 'Central de Inteligencia'],
        autonomy: 'Coleta e consolida inteligencia web; nao altera campanhas nem publica conteudo sozinho.',
        editHref: '/admin/ads/analytics',
        behaviorControls: [
            {
                key: 'gaia_analytics_web_enabled',
                label: 'Agente ativo',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Define se Gaia deve ser considerada dona operacional dos dados de Analytics, Search Console e tracking.',
            },
        ],
    },
    {
        id: 'maya-meta-connections',
        name: 'Agente Conexoes Meta',
        role: 'Saude das conexoes Facebook, Instagram e Meta',
        sector: 'Inteligencia',
        promptKey: 'maya_meta_connections_system_prompt',
        fallback: MAYA_META_CONNECTIONS_SYSTEM_PROMPT,
        detail: 'Monitora OAuth, tokens, paginas, contas, status de sync e sinais sociais brutos que entram pelo ecossistema Meta.',
        tools: ['Meta OAuth', 'Facebook Page', 'Instagram Business', 'Social Inbox', 'Central de Inteligencia'],
        autonomy: 'Registra saude e falhas das conexoes; nao publica nem responde leads sem os agentes responsaveis.',
        editHref: '/admin/maintenance',
        behaviorControls: [
            {
                key: 'maya_meta_connections_enabled',
                label: 'Agente ativo',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Define se Maya deve ser a responsavel operacional por conexoes Meta e sincronizacoes sociais brutas.',
            },
        ],
    },
    {
        id: 'otto-integrations',
        name: 'Agente Integracoes',
        role: 'Monitor de APIs, chaves, provedores e conectores',
        sector: 'Tecnologia',
        promptKey: 'otto_integrations_system_prompt',
        fallback: OTTO_INTEGRATIONS_SYSTEM_PROMPT,
        detail: 'Converte diagnosticos de OpenAI, Gemini, DataForSEO, Brevo, ElevenLabs, Inngest, Supabase, ConnectyHub, Google e Meta em inteligencia operacional.',
        tools: ['Diagnosticos', 'provedores IA', 'ConnectyHub', 'Brevo', 'ElevenLabs', 'DataForSEO', 'Central de Inteligencia'],
        autonomy: 'Pode registrar falhas, impactos e proximas acoes; nao corrige credenciais automaticamente.',
        editHref: '/admin/maintenance',
        behaviorControls: [
            {
                key: 'otto_integrations_enabled',
                label: 'Agente ativo',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Define se Otto deve ser o dono operacional dos diagnosticos e alertas de integracao.',
            },
        ],
    },
    {
        id: 'iris-media-voice',
        name: 'Agente Midia e Voz',
        role: 'Curadoria de assets, imagens, uploads e voz',
        sector: 'Marketing',
        promptKey: 'iris_media_voice_system_prompt',
        fallback: IRIS_MEDIA_VOICE_SYSTEM_PROMPT,
        detail: 'Organiza sinais de imagens, videos, R2, Pexels, Pixabay, ElevenLabs, OpenAI TTS e midias recebidas para apoiar criativos e conteudo.',
        tools: ['R2', 'uploads', 'Pexels', 'Pixabay', 'ElevenLabs', 'OpenAI TTS', 'midias editoriais'],
        autonomy: 'Registra qualidade, origem e falhas de midia; publicacao e uso final continuam com os agentes de conteudo/publicacao.',
        editHref: '/admin/ads/creatives',
        behaviorControls: [
            {
                key: 'iris_media_voice_enabled',
                label: 'Agente ativo',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Define se Iris deve ser a responsavel por memoria de midia, imagens, voz e assets.',
            },
        ],
    },
    {
        id: 'teo-webhooks-events',
        name: 'Agente Webhooks e Eventos',
        role: 'Normalizacao de entradas externas',
        sector: 'Operacoes',
        promptKey: 'teo_webhooks_events_system_prompt',
        fallback: TEO_WEBHOOKS_EVENTS_SYSTEM_PROMPT,
        detail: 'Vigia webhooks de WhatsApp, Meta, formularios, tracking e callbacks para garantir que sinais externos virem memoria util na Central.',
        tools: ['Webhooks', 'WhatsApp', 'Meta', 'formularios', 'tracking', 'Central de Inteligencia'],
        autonomy: 'Normaliza e roteia sinais externos; quando nao houver dono claro, encaminha para Otto ou Pilger AI Core.',
        editHref: '/admin/pilger-ai/saude',
        behaviorControls: [
            {
                key: 'teo_webhooks_events_enabled',
                label: 'Agente ativo',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Define se Teo deve ser o dono operacional dos webhooks, callbacks e eventos externos.',
            },
        ],
    },
    {
        id: 'creative-strategy-agent',
        name: 'Agente de Criativos',
        role: 'Copy, angulos e briefing para conteudo',
        sector: 'Marketing',
        promptKey: 'creative_strategy_agent_system_prompt',
        fallback: [
            'Voce e o agente de criativos da Pilger Luxury Search.',
            '',
            'Sua funcao e transformar briefing, imoveis, campanhas e sinais de audiencia em copy, hooks, headlines, CTAs e angulos para conteudo organico e trafego pago.',
            '',
            'Escreva sempre em portugues do Brasil, com tom premium, direto, consultivo e sem exageros.',
        ].join('\n'),
        detail: 'Cria copy, angulos e briefing para reels, posts, anuncios e conteudos de apoio ao gestor de trafego.',
        tools: ['Central de Criativos', 'estoque de imoveis', 'relatorios organicos', 'relatorios pagos'],
        autonomy: 'Gera rascunhos e briefing; aprovacao humana decide publicacao ou campanha.',
        editHref: '/admin/ads/creatives',
    },
    {
        id: 'content-publisher-agent',
        name: 'Agente Publicador',
        role: 'Fila editorial e publicacoes aprovadas',
        sector: 'Marketing',
        promptKey: 'content_publisher_agent_system_prompt',
        fallback: [
            'Voce e o agente publicador da Pilger Luxury Search.',
            '',
            'Sua funcao e monitorar a fila editorial, conferir posts aprovados, respeitar a agenda e publicar somente quando as credenciais e a governanca permitirem.',
            '',
            'Nunca publique conteudo sem status aprovado/agendado e sem autopiloto liberado.',
        ].join('\n'),
        detail: 'Monitora posts vencidos na fila editorial e executa publicacao automatica apenas quando liberado.',
        tools: ['Fila editorial', 'Instagram API', 'Facebook Pages API', 'Inngest'],
        autonomy: 'Pode publicar posts aprovados se autopiloto estiver ligado; sem isso opera em dry-run.',
        editHref: '/admin/ads/creatives',
        behaviorControls: [
            {
                key: 'marketing_publisher_agent_enabled',
                label: 'Publicador ativo',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
            },
            {
                key: 'marketing_publisher_autopilot',
                label: 'Publicacao automatica',
                type: 'select',
                fallback: 'false',
                options: [
                    { label: 'Ligada', value: 'true' },
                    { label: 'Desligada', value: 'false' },
                ],
                help: 'Trava final para publicar sozinho em Instagram/Facebook.',
            },
            {
                key: 'marketing_publisher_interval_minutes',
                label: 'Intervalo de checagem',
                type: 'number',
                fallback: '10',
                min: 5,
                max: 1440,
                step: 1,
                help: 'Minutos entre leituras da fila editorial.',
            },
        ],
        runtimeFacts: configs => [
            { label: 'Ultima conclusao', value: formatConfigDateTime(configs.marketing_publisher_last_run_at) },
            { label: 'Modo atual', value: configs.marketing_publisher_autopilot === 'true' ? 'Publica automaticamente' : 'Dry-run/aprovacao', tone: configs.marketing_publisher_autopilot === 'true' ? 'warning' : 'success' },
            ...(configs.marketing_publisher_last_error
                ? [{ label: 'Ultimo erro', value: configs.marketing_publisher_last_error, tone: 'danger' as AgentOfficeTone }]
                : []),
        ],
    },
    {
        id: 'event-agent',
        name: 'Agente de Eventos',
        role: 'Orquestrador de eventos e automacoes WhatsApp',
        sector: 'Marketing',
        promptKey: 'event_agent_system_prompt',
        fallback: DEFAULT_EVENT_AGENT_SYSTEM_PROMPT,
        detail: 'Analisa inscritos, conversas e tracking para criar automacoes, botoes, enquetes e relatorios de potencial por evento.',
        tools: ['Eventos', 'WhatsApp Global', 'CRM', 'tracking', 'botoes rastreaveis', 'enquetes'],
        autonomy: 'Cria estrategia e recomendacoes; o envio e a conversa acontecem pelo Agente WhatsApp Global.',
        editHref: '/admin/eventos',
        behaviorControls: [
            {
                key: 'event_agent_enabled',
                label: 'Agente ativo',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Liga a leitura operacional do agente dentro do escritorio.',
            },
            {
                key: 'event_agent_ai_report_enabled',
                label: 'Relatorio com IA',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Permite gerar leitura executiva com IA a partir de inscritos, conversas e tracking.',
            },
            {
                key: 'event_agent_button_tracking_enabled',
                label: 'Rastreamento de botoes',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Mantem os eventos de cliques, botoes e enquetes preparados para leitura posterior do agente.',
            },
            {
                key: 'event_agent_hot_score_threshold',
                label: 'Score minimo lead quente',
                type: 'number',
                fallback: '72',
                min: 40,
                max: 95,
                step: 1,
                help: 'Pontuacao minima para aparecer como lead quente no relatorio do evento.',
            },
            {
                key: 'event_agent_report_limit',
                label: 'Leads no relatorio',
                type: 'number',
                fallback: '12',
                min: 3,
                max: 40,
                step: 1,
                help: 'Quantidade maxima de leads priorizados no relatorio do agente.',
            },
        ],
        runtimeFacts: configs => [
            {
                label: 'Modo atual',
                value: configs.event_agent_enabled === 'false' ? 'Agente pausado' : 'Agente ativo',
                tone: configs.event_agent_enabled === 'false' ? 'warning' : 'success',
            },
            {
                label: 'Relatorio IA',
                value: configs.event_agent_ai_report_enabled === 'false' ? 'Desativado' : 'Ativado',
            },
            {
                label: 'Score quente',
                value: `${configs.event_agent_hot_score_threshold || '72'} pontos`,
            },
        ],
    },
    {
        id: 'internal-notifier',
        name: 'Agente de Avisos Internos',
        role: 'Comunicacao interna por setor',
        sector: 'Operacoes',
        promptKey: 'internal_notifier_system_prompt',
        fallback: INTERNAL_NOTIFIER_SYSTEM_PROMPT,
        detail: 'Roteia alertas do sistema para os telefones cadastrados por setor, evento e prioridade.',
        tools: ['WhatsApp global', 'setores', 'tags de aviso', 'blog', 'trafego', 'cadastro de imoveis'],
        autonomy: 'Envia avisos internos conforme eventos do sistema e respeita as tags de cada destinatario.',
    },
    {
        id: 'email-orchestrator',
        name: 'Agente de Distribuicao',
        role: 'Distribui conteudos por e-mail, WhatsApp e push',
        sector: 'Operacoes',
        promptKey: 'email_orchestrator_system_prompt',
        fallback: EMAIL_ORCHESTRATOR_SYSTEM_PROMPT,
        detail: 'Cria templates e controla a distribuicao de blogs, noticias e campanhas para leads por e-mail, WhatsApp global e push.',
        tools: ['Brevo', 'WhatsApp global', 'Push', 'templates', 'CRM'],
        autonomy: 'Orquestra a distribuicao editorial por e-mail, WhatsApp global e push; disparos sensiveis continuam dependendo de fluxo aprovado ou revisao humana.',
        editHref: '/admin/maintenance',
        behaviorControls: [
            {
                key: 'email_agent_enabled',
                label: 'Agente ativo',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativo', value: 'true' },
                    { label: 'Pausado', value: 'false' },
                ],
                help: 'Controla se Gabriel pode preparar campanhas e entrar na fila de envios.',
            },
            {
                key: 'email_agent_autopilot',
                label: 'Campanhas automaticas',
                type: 'select',
                fallback: 'false',
                options: [
                    { label: 'Manual por enquanto', value: 'false' },
                    { label: 'Criar ao publicar conteudo', value: 'true' },
                ],
                help: 'Quando ativado, conteudos aprovados poderao gerar campanha automaticamente.',
            },
            {
                key: 'email_agent_require_approval',
                label: 'Aprovacao humana',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Exigir aprovacao', value: 'true' },
                    { label: 'Liberar direto', value: 'false' },
                ],
                help: 'Mantem admin no controle antes de disparos amplos.',
            },
            {
                key: 'editorial_distribution_message_review_required',
                label: 'Revisao das mensagens',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Rascunho editavel', value: 'true' },
                    { label: 'Enviar direto', value: 'false' },
                ],
                help: 'Quando ativo, Gabriel prepara e explica a recomendacao antes do envio por e-mail, push ou WhatsApp.',
            },
            {
                key: 'email_agent_send_interval_minutes',
                label: 'Intervalo por lead',
                type: 'number',
                fallback: '5',
                min: 1,
                max: 1440,
                step: 1,
                help: 'Tempo minimo entre um e-mail e outro na fila.',
            },
            {
                key: 'email_agent_daily_limit',
                label: 'Limite diario',
                type: 'number',
                fallback: '150',
                min: 1,
                max: 5000,
                step: 1,
                help: 'Maximo de e-mails que o agente pode tentar enviar por dia.',
            },
            {
                key: 'email_agent_min_hours_between_lead_messages',
                label: 'Respiro por lead',
                type: 'number',
                fallback: '24',
                min: 1,
                max: 720,
                step: 1,
                help: 'Horas minimas antes do mesmo lead receber outro e-mail de nutricao.',
            },
            {
                key: 'email_agent_allowed_start_time',
                label: 'Inicio da janela',
                type: 'time',
                fallback: '09:00',
            },
            {
                key: 'email_agent_allowed_end_time',
                label: 'Fim da janela',
                type: 'time',
                fallback: '18:00',
            },
            {
                key: 'email_agent_default_audience',
                label: 'Publico padrao',
                type: 'select',
                fallback: 'active_leads',
                options: [
                    { label: 'Leads ativos', value: 'active_leads' },
                    { label: 'Todos os leads', value: 'all_leads' },
                    { label: 'Leads de evento', value: 'event_leads' },
                    { label: 'Leads de imoveis', value: 'property_leads' },
                    { label: 'Candidatos corretores', value: 'broker_candidates' },
                    { label: 'Personalizado', value: 'custom' },
                ],
            },
            {
                key: 'editorial_distribution_email_enabled',
                label: 'Enviar por e-mail',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativo', value: 'true' },
                    { label: 'Pausado', value: 'false' },
                ],
                help: 'Permite que campanhas de blog e noticias entrem na fila de e-mail via Brevo.',
            },
            {
                key: 'editorial_distribution_whatsapp_enabled',
                label: 'Enviar por WhatsApp',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativo', value: 'true' },
                    { label: 'Pausado', value: 'false' },
                ],
                help: 'Permite que campanhas de blog e noticias entrem na fila do WhatsApp global.',
            },
            {
                key: 'editorial_distribution_push_enabled',
                label: 'Enviar por push',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativo', value: 'true' },
                    { label: 'Pausado', value: 'false' },
                ],
                help: 'Permite que campanhas de blog e noticias entrem na fila de notificacoes push para leads inscritos.',
            },
            {
                key: 'editorial_distribution_recommendations_enabled',
                label: 'Recomendar por comportamento',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativo', value: 'true' },
                    { label: 'Pausado', value: 'false' },
                ],
                help: 'Permite que Gabriel use visitas, cliques e interesse do lead para recomendar imoveis e conteudos.',
            },
            {
                key: 'editorial_distribution_whatsapp_interval_minutes',
                label: 'Intervalo WhatsApp',
                type: 'number',
                fallback: '5',
                min: 1,
                max: 1440,
                step: 1,
                help: 'Tempo minimo entre um WhatsApp e outro na fila editorial.',
            },
            {
                key: 'editorial_distribution_whatsapp_daily_limit',
                label: 'Limite diario WhatsApp',
                type: 'number',
                fallback: '120',
                min: 1,
                max: 5000,
                step: 1,
                help: 'Maximo de mensagens editoriais que o agente pode tentar enviar por WhatsApp por dia.',
            },
            {
                key: 'editorial_distribution_push_interval_minutes',
                label: 'Intervalo Push',
                type: 'number',
                fallback: '5',
                min: 1,
                max: 1440,
                step: 1,
                help: 'Tempo minimo entre uma notificacao push e outra na fila editorial.',
            },
            {
                key: 'editorial_distribution_push_daily_limit',
                label: 'Limite diario Push',
                type: 'number',
                fallback: '300',
                min: 1,
                max: 10000,
                step: 1,
                help: 'Maximo de notificacoes push editoriais que o agente pode tentar enviar por dia.',
            },
            {
                key: 'editorial_distribution_recommendation_min_score',
                label: 'Score minimo recomendacao',
                type: 'number',
                fallback: '45',
                min: 1,
                max: 100,
                step: 1,
                help: 'Pontuacao minima de compatibilidade antes de Gabriel criar uma recomendacao personalizada.',
            },
            {
                key: 'editorial_distribution_recommendation_batch_limit',
                label: 'Lote de recomendacoes',
                type: 'number',
                fallback: '25',
                min: 1,
                max: 500,
                step: 1,
                help: 'Quantidade maxima de leads avaliados por rodada para gerar recomendacoes novas.',
            },
        ],
        runtimeFacts: configs => [
            {
                label: 'Brevo',
                value: configs.brevo_api_key && configs.brevo_sender_email ? 'Conectado para envio' : 'Aguardando configuracao',
                tone: configs.brevo_api_key && configs.brevo_sender_email ? 'success' : 'warning',
            },
            {
                label: 'Remetente',
                value: configs.brevo_sender_email || 'Nao configurado',
            },
            {
                label: 'Templates ativos',
                value: `${parseEmailAgentTemplatesJson(configs.email_agent_templates || getDefaultEmailAgentTemplatesJson()).filter(template => template.status === 'active').length} e-mail / ${parseWhatsAppEditorialTemplatesJson(configs.editorial_distribution_whatsapp_templates || getDefaultWhatsAppEditorialTemplatesJson()).filter(template => template.status === 'active').length} WhatsApp / ${parsePushEditorialTemplatesJson(configs.editorial_distribution_push_templates || getDefaultPushEditorialTemplatesJson()).filter(template => template.status === 'active').length} Push`,
            },
            {
                label: 'WhatsApp usado',
                value: 'Global do atendimento',
                tone: configs.editorial_distribution_whatsapp_enabled === 'false' ? 'warning' : 'success',
            },
            {
                label: 'Recomendacoes',
                value: configs.editorial_distribution_recommendations_enabled === 'false'
                    ? 'Pausadas'
                    : `Ativas a partir de ${configs.editorial_distribution_recommendation_min_score || '50'} pontos`,
                tone: configs.editorial_distribution_recommendations_enabled === 'false' ? 'warning' : 'success',
            },
            {
                label: 'Fila planejada',
                value: `${configs.email_agent_send_interval_minutes || '5'} min | ${[
                    configs.editorial_distribution_email_enabled === 'false' ? null : 'e-mail',
                    configs.editorial_distribution_whatsapp_enabled === 'false' ? null : 'WhatsApp',
                    configs.editorial_distribution_push_enabled === 'true' ? 'Push' : null,
                ].filter(Boolean).join(' + ') || 'pausado'}`,
                tone: configs.editorial_distribution_email_enabled === 'false' && configs.editorial_distribution_whatsapp_enabled === 'false' && configs.editorial_distribution_push_enabled !== 'true' ? 'warning' : 'success',
            },
        ],
    },
    {
        id: 'broker-candidate-agent',
        name: 'Agente de Recrutamento',
        role: 'Analise de candidatos corretores',
        sector: 'Recrutamento',
        promptKey: 'broker_candidate_agent_system_prompt',
        fallback: DEFAULT_BROKER_CANDIDATE_AGENT_PROMPT,
        detail: 'Organiza dados do Trabalhe Conosco, calcula potencial, acompanha comportamento e alimenta a Central de Inteligencia.',
        tools: ['Trabalhe Conosco', 'WhatsApp global', 'tracking', 'Central de Inteligencia'],
        autonomy: 'Classifica, agenda mensagens e recomenda proximas acoes; aprovacao continua com decisao humana.',
        editHref: '/admin/trabalhe-conosco',
        behaviorControls: [
            {
                key: 'broker_candidate_agent_enabled',
                label: 'Agente ativo',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativo', value: 'true' },
                    { label: 'Pausado', value: 'false' },
                ],
            },
            {
                key: 'broker_candidate_hot_score_threshold',
                label: 'Score alto potencial',
                type: 'number',
                fallback: '80',
                min: 40,
                max: 100,
                step: 1,
            },
        ],
        runtimeFacts: configs => [
            {
                label: 'Modo atual',
                value: configs.broker_candidate_agent_enabled === 'false' ? 'Agente pausado' : 'Agente ativo',
                tone: configs.broker_candidate_agent_enabled === 'false' ? 'warning' : 'success',
            },
            {
                label: 'Score alto potencial',
                value: `${configs.broker_candidate_hot_score_threshold || '80'} pontos`,
            },
        ],
    },
    {
        id: 'pilger-daily-report',
        name: 'Agente de Relatorio Diario',
        role: 'Fechamento executivo do dia',
        sector: 'Diretoria',
        promptKey: 'pilger_daily_system_prompt',
        fallback: DAILY_REPORT_PROMPT,
        detail: 'Resume performance diaria, riscos, oportunidades e prioridades.',
        tools: ['Dashboards', 'trafego', 'radar', 'WhatsApp'],
        autonomy: 'Publica relatorios configurados e registra historico.',
        editHref: '/admin/maintenance',
        behaviorControls: [
            {
                key: 'pilger_daily_days',
                label: 'Dias do relatorio',
                type: 'multiselect',
                fallback: '0,1,2,3,4,5,6',
                options: WEEKDAY_OPTIONS,
                help: 'Dias em que a Elisa Relatorio Diario fecha o relatorio.',
            },
            {
                key: 'pilger_daily_time',
                label: 'Horarios do relatorio',
                type: 'multiselect',
                fallback: '23',
                options: HOUR_OPTIONS,
                help: 'Janelas de execucao em horario de Sao Paulo.',
            },
        ],
        runtimeFacts: configs => [
            { label: 'Agenda atual', value: `${configs.pilger_daily_days || '0,1,2,3,4,5,6'} as ${configs.pilger_daily_time || '23'}h` },
        ],
        behaviorActions: [
            {
                id: 'generate_daily_report',
                label: 'Gerar agora',
                help: 'Executa o relatorio diario imediatamente, sem esperar o proximo horario.',
            },
        ],
    },
    {
        id: 'pilger-weekly-report',
        name: 'Agente de Diretriz Semanal',
        role: 'Planejamento executivo semanal',
        sector: 'Diretoria',
        promptKey: 'pilger_weekly_system_prompt',
        fallback: WEEKLY_REPORT_PROMPT,
        detail: 'Transforma indicadores em pauta semanal para marketing, comercial e operacoes.',
        tools: ['Dashboards', 'eventos', 'historico de leads'],
        autonomy: 'Gera diretrizes; execucao vira tarefa/aprovacao.',
        editHref: '/admin/maintenance',
        behaviorControls: [
            {
                key: 'pilger_weekly_days',
                label: 'Dias da diretriz',
                type: 'multiselect',
                fallback: '1',
                options: WEEKDAY_OPTIONS,
                help: 'Dias em que o Augusto Diretriz Semanal prepara a diretriz.',
            },
            {
                key: 'pilger_weekly_times',
                label: 'Horarios da diretriz',
                type: 'multiselect',
                fallback: '23',
                options: HOUR_OPTIONS,
                help: 'Janelas de execucao em horario de Sao Paulo.',
            },
        ],
        runtimeFacts: configs => [
            { label: 'Agenda atual', value: `${configs.pilger_weekly_days || configs.pilger_weekly_day || '1'} as ${configs.pilger_weekly_times || configs.pilger_weekly_time || '23'}h` },
        ],
        behaviorActions: [
            {
                id: 'generate_weekly_report',
                label: 'Gerar agora',
                help: 'Executa a diretriz semanal imediatamente, sem esperar o proximo horario.',
            },
        ],
    },
    {
        id: 'ceo-agent',
        name: 'Agente CEO IA',
        role: 'Diretor digital do ERP',
        sector: 'Diretoria',
        promptKey: 'ceo_agent_system_prompt',
        fallback: CEO_AGENT_SYSTEM_PROMPT,
        detail: 'Interpreta o negocio em nivel executivo e orienta decisoes entre setores.',
        tools: ['ERP', 'WhatsApp executivo', 'relatorios'],
        autonomy: 'Recomenda decisoes e pode acionar fluxos aprovados.',
        editHref: '/admin/maintenance',
    },
    {
        id: 'market-radar',
        name: 'Agente Radar de Mercado',
        role: 'Analista de oportunidades e tendencias',
        sector: 'Inteligencia',
        promptKey: 'radar_analyst_system_prompt',
        fallback: RADAR_ANALYST_SYSTEM_PROMPT,
        detail: 'Lê movimentos de mercado e transforma sinais em oportunidades comerciais.',
        tools: ['Radar', 'fontes publicas', 'campanhas', 'blog'],
        autonomy: 'Gera insights e alertas; publicacoes seguem aprovacao.',
        editHref: '/admin/radar',
        behaviorControls: [
            {
                key: 'radar_collection_days',
                label: 'Dias de coleta',
                type: 'multiselect',
                fallback: '0,1,2,3,4,5,6',
                options: WEEKDAY_OPTIONS,
                help: 'Dias em que a Lara Radar Mercado coleta sinais.',
            },
            {
                key: 'radar_collection_times',
                label: 'Horarios de coleta',
                type: 'multiselect',
                fallback: '06,12,18',
                options: HOUR_OPTIONS,
                help: 'Janelas em que o radar coleta dados de mercado.',
            },
            {
                key: 'radar_ai_enabled',
                label: 'Analise IA',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativada', value: 'true' },
                    { label: 'Desativada (apenas regras)', value: 'false' },
                ],
            },
            {
                key: 'radar_ai_min_opportunity_score',
                label: 'Score minimo para chamar IA',
                type: 'number',
                fallback: '70',
                min: 0,
                max: 100,
                step: 1,
            },
            {
                key: 'radar_ai_max_insights_per_run',
                label: 'Maximo de analises IA por coleta',
                type: 'number',
                fallback: '6',
                min: 0,
                max: 50,
                step: 1,
            },
            {
                key: 'radar_opportunity_alert_threshold',
                label: 'Alerta de oportunidade acima de',
                type: 'number',
                fallback: '75',
                min: 0,
                max: 100,
                step: 1,
            },
        ],
    },
    {
        id: 'blog-intelligence',
        name: 'Agente de Blog',
        role: 'Inteligencia editorial orientada por dados',
        sector: 'Marketing',
        promptKey: 'blog_intelligence_system_prompt',
        fallback: BLOG_INTELLIGENCE_SYSTEM_PROMPT,
        detail: 'Analisa WhatsApp, leads, radar, benchmark da Lara, trafego, localizacao, estoque e empreendimentos para decidir e criar artigos de blog com SEO, AEO e GEO.',
        tools: ['WhatsApp', 'CRM', 'Radar', 'Lara Benchmark', 'trafego pago', 'estoque', 'blog'],
        autonomy: 'Pode sugerir pautas e gerar rascunhos completos; publicacao exige aprovacao humana.',
        behaviorControls: [
            {
                key: 'blog_agent_enabled',
                label: 'Rotina automatica',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativada', value: 'true' },
                    { label: 'Desativada', value: 'false' },
                ],
                help: 'Quando a rotina estiver ativa, a Isadora Edicao Blog gera rascunhos para aprovacao humana.',
            },
            ...BLOG_AGENT_SCHEDULE_CONTROLS,
        ],
    },
    {
        id: 'news-intelligence',
        name: 'Agente de Noticias',
        role: 'Editor de noticias orientado por pesquisa',
        sector: 'Marketing',
        promptKey: 'news_intelligence_system_prompt',
        fallback: NEWS_INTELLIGENCE_SYSTEM_PROMPT,
        detail: 'Analisa Research Pilger, benchmark da Lara, noticias publicas, prefeitura, economia, turismo e mercado para criar rascunhos de noticias em revisao.',
        tools: ['Research Pilger', 'Lara Benchmark', 'fontes publicas', 'Radar', 'blog_posts', 'noticias'],
        autonomy: 'Pode sugerir e gerar rascunhos de noticias; publicacao exige aprovacao humana antes de distribuir aos leads.',
        behaviorControls: [
            {
                key: 'news_agent_enabled',
                label: 'Rotina automatica',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativada', value: 'true' },
                    { label: 'Desativada', value: 'false' },
                ],
                help: 'Quando a rotina estiver ativa, a Clara Edicao Noticias gera noticias em revisao conforme a agenda.',
            },
            ...NEWS_AGENT_SCHEDULE_CONTROLS,
        ],
        runtimeFacts: (configs) => [
            {
                label: 'Ultima noticia',
                value: formatConfigDateTime(configs.news_agent_last_run_at),
            },
            ...(configs.news_agent_last_error
                ? [{ label: 'Ultimo erro', value: configs.news_agent_last_error, tone: 'danger' as AgentOfficeTone }]
                : []),
        ],
    },
    {
        id: 'research-pilger',
        name: 'Research Pilger',
        role: 'Pesquisa externa profunda para agentes',
        sector: 'Inteligencia',
        promptKey: 'research_pilger_system_prompt',
        fallback: RESEARCH_PILGER_SYSTEM_PROMPT,
        detail: 'Pesquisa fontes atuais na internet e cria relatorios com fatos, inferencias, oportunidades e links consultados.',
        tools: ['Gemini Google Search', 'fontes externas', 'SEO', 'AEO', 'GEO'],
        autonomy: 'Pode pesquisar e salvar relatorios; decisoes e publicacoes continuam com aprovacao humana.',
        editHref: '/admin/research',
        behaviorControls: [
            {
                key: 'research_pilger_enabled',
                label: 'Pesquisa profunda',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativada', value: 'true' },
                    { label: 'Desativada', value: 'false' },
                ],
            },
            {
                key: 'research_pilger_depth',
                label: 'Profundidade padrao',
                type: 'select',
                fallback: 'media',
                options: [
                    { label: 'Leve', value: 'leve' },
                    { label: 'Media', value: 'media' },
                    { label: 'Profunda', value: 'profunda' },
                ],
            },
            {
                key: 'research_pilger_schedule_enabled',
                label: 'Rotina automatica',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativada', value: 'true' },
                    { label: 'Desativada', value: 'false' },
                ],
                help: 'Permite que o Mateus Pesquisa Externa pesquise sozinho conforme a agenda semanal.',
            },
            {
                key: 'research_pilger_weekdays',
                label: 'Dias de pesquisa',
                type: 'multiselect',
                fallback: 'mon,wed,fri',
                options: [
                    { label: 'Seg', value: 'mon' },
                    { label: 'Ter', value: 'tue' },
                    { label: 'Qua', value: 'wed' },
                    { label: 'Qui', value: 'thu' },
                    { label: 'Sex', value: 'fri' },
                    { label: 'Sab', value: 'sat' },
                    { label: 'Dom', value: 'sun' },
                ],
                help: 'A rotina escolhe os temas nesses dias e salva relatorios para os demais agentes.',
            },
            {
                key: 'research_pilger_run_times',
                label: 'Horarios de pesquisa',
                type: 'multiselect',
                fallback: '09,15',
                options: [
                    { label: '07h', value: '07' },
                    { label: '09h', value: '09' },
                    { label: '11h', value: '11' },
                    { label: '15h', value: '15' },
                    { label: '18h', value: '18' },
                    { label: '21h', value: '21' },
                ],
                help: 'Janelas de execucao em horario de Sao Paulo. A rotina automatica usa estes horarios.',
            },
            {
                key: 'research_pilger_daily_limit',
                label: 'Limite diario de pesquisas',
                type: 'number',
                fallback: '8',
                min: 0,
                max: 50,
                step: 1,
            },
        ],
    },
    {
        id: 'benchmark-editorial',
        name: 'Agente Benchmark Editorial',
        role: 'Inteligencia competitiva para conteudo',
        sector: 'Inteligencia',
        promptKey: 'benchmark_editorial_system_prompt',
        fallback: BENCHMARK_EDITORIAL_SYSTEM_PROMPT,
        detail: 'Monitora portais, concorrentes publicos, conteudos ranqueados e respostas de IA para explicar por que aparecem, registrar inteligencia e preparar material para Blog e Noticias.',
        tools: ['Gemini Google Search', 'Pesquisa Profunda IA', 'SERP publica', 'portais de luxo', 'Central de Inteligencia', 'SEO', 'AEO', 'GEO'],
        autonomy: 'Pode pesquisar, registrar oportunidades na Central e deixar briefings; Clara e Isadora transformam o material em conteudo sob aprovacao humana.',
        editHref: '/admin/benchmark-editorial',
        behaviorControls: [
            {
                key: 'benchmark_editorial_enabled',
                label: 'Benchmark editorial',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
            },
            {
                key: 'benchmark_editorial_auto_handoff_enabled',
                label: 'Handoff automatico',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativado', value: 'true' },
                    { label: 'Desativado', value: 'false' },
                ],
                help: 'Quando a Lara encontrar oportunidade acima do score minimo, aciona Isadora e/ou Clara automaticamente.',
            },
            {
                key: 'benchmark_editorial_depth',
                label: 'Profundidade padrao',
                type: 'select',
                fallback: 'media',
                options: [
                    { label: 'Leve', value: 'leve' },
                    { label: 'Media', value: 'media' },
                    { label: 'Profunda', value: 'profunda' },
                ],
            },
            {
                key: 'benchmark_editorial_schedule_enabled',
                label: 'Rotina automatica',
                type: 'select',
                fallback: 'true',
                options: [
                    { label: 'Ativada', value: 'true' },
                    { label: 'Desativada', value: 'false' },
                ],
                help: 'Permite que a Lara monitore rankings, portais e respostas de IA conforme agenda, salvando achados para Clara e Isadora.',
            },
            {
                key: 'benchmark_editorial_weekdays',
                label: 'Dias de benchmark',
                type: 'multiselect',
                fallback: 'mon,tue,wed,thu,fri',
                options: [
                    { label: 'Seg', value: 'mon' },
                    { label: 'Ter', value: 'tue' },
                    { label: 'Qua', value: 'wed' },
                    { label: 'Qui', value: 'thu' },
                    { label: 'Sex', value: 'fri' },
                    { label: 'Sab', value: 'sat' },
                    { label: 'Dom', value: 'sun' },
                ],
            },
            {
                key: 'benchmark_editorial_run_times',
                label: 'Horarios',
                type: 'multiselect',
                fallback: '09,15',
                options: [
                    { label: '08h', value: '08' },
                    { label: '10h', value: '10' },
                    { label: '12h', value: '12' },
                    { label: '14h', value: '14' },
                    { label: '16h', value: '16' },
                    { label: '18h', value: '18' },
                ],
            },
            {
                key: 'benchmark_editorial_daily_limit',
                label: 'Limite diario',
                type: 'number',
                fallback: '6',
                min: 0,
                max: 50,
                step: 1,
            },
            {
                key: 'benchmark_editorial_min_score',
                label: 'Score minimo',
                type: 'number',
                fallback: '70',
                min: 0,
                max: 100,
                step: 1,
            },
        ],
        runtimeFacts: (configs) => [
            {
                label: 'Ultima checagem',
                value: formatConfigDateTime(configs.benchmark_editorial_cron_last_checked_at),
            },
            {
                label: 'Ultimo benchmark',
                value: formatConfigDateTime(configs.benchmark_editorial_cron_last_run_at),
            },
            {
                label: 'Motivo do cron',
                value: configs.benchmark_editorial_cron_last_reason || 'Sem execucao',
            },
            ...(configs.benchmark_editorial_cron_last_error
                ? [{ label: 'Ultimo erro', value: configs.benchmark_editorial_cron_last_error, tone: 'danger' as AgentOfficeTone }]
                : []),
        ],
    },
]

function getConfig(configs: ConfigMap, key: string | undefined, fallback = '') {
    if (!key) return fallback
    return configs[key] || fallback
}

function resolveGlobalModel(configs: ConfigMap) {
    const provider = configs.ai_provider || 'gemini'
    if (provider === 'openai') return configs.openai_model || 'gpt-4o-mini'
    return configs.gemini_model || 'gemini-2.5-flash'
}

function isGlobalWhatsAppInstance(instance: any) {
    const type = String(instance?.instance_type || '').trim().toLowerCase()
    const name = String(instance?.instance_name || '').trim().toLowerCase()
    return (
        type === 'global' ||
        name === 'global' ||
        name.includes('global') ||
        name.includes('agente global') ||
        name.includes('whatsapp global')
    )
}

function isGlobalWhatsAppBroker(broker: any) {
    const normalizedName = normalizeForIdentity(String(broker?.name || '').trim())
    return (
        normalizedName === 'global' ||
        normalizedName.includes('global') ||
        normalizedName.includes('agente global') ||
        normalizedName.includes('whatsapp global')
    )
}

function pickGlobalWhatsAppInstance(instances: any[]) {
    return instances.find((instance: any) => instance?.status === 'connected') || instances[0] || null
}

function findLinkedInstanceForBroker(broker: any, instances: any[]) {
    if (!broker) return null
    const brokerId = String(broker?.id || '')
    const brokerInstanceId = String(broker?.whatsapp_instance_id || '')
    return instances.find((instance: any) => String(instance?.broker_id || '') === brokerId)
        || instances.find((instance: any) => brokerInstanceId && String(instance?.id || '') === brokerInstanceId)
        || null
}

function findGlobalWhatsAppBroker(brokers: any[], globalInstances: any[]) {
    const globalBrokerIds = new Set(
        globalInstances
            .map((instance: any) => String(instance?.broker_id || ''))
            .filter(Boolean)
    )
    const globalInstanceIds = new Set(
        globalInstances
            .map((instance: any) => String(instance?.id || ''))
            .filter(Boolean)
    )

    return brokers.find((broker: any) => globalBrokerIds.has(String(broker?.id || '')))
        || brokers.find((broker: any) => globalInstanceIds.has(String(broker?.whatsapp_instance_id || '')))
        || brokers.find((broker: any) => isGlobalWhatsAppBroker(broker))
        || null
}

function normalizeBrokerAgent(broker: any, globalProvider: string, globalModel: string, instance?: any): AgentOfficeItem {
    const active = broker?.is_active !== false
    const connected = instance?.status === 'connected'
    const whatsappName = connected
        ? (instance?.live_data?.pushName || instance?.live_data?.profileName || instance?.live_data?.me?.name || '')
        : ''
    const personaName = whatsappName || broker?.name || instance?.instance_name || 'Corretor IA sem nome'
    const avatarUrl = broker?.photo_url || (connected ? (instance?.live_data?.profilePicUrl || null) : null)
    const phone = instance?.live_data?.phone || instance?.phone_number || broker?.phone || ''
    const role = broker?.creci ? `Corretor IA - CRECI ${broker.creci}` : 'Corretor IA'
    const detail = connected
        ? `Instancia WhatsApp conectada${phone ? ` - ${phone}` : ''}.`
        : (broker?.assignment_type ? `Atendimento configurado como ${broker.assignment_type}.` : 'Atende, qualifica e transfere leads pelo WhatsApp.')
    return {
        id: `broker-${broker?.id || crypto.randomUUID()}`,
        brokerId: String(broker?.id || ''),
        name: 'Corretor IA',
        personaName,
        avatarInitials: getInitials(personaName),
        avatarTone: 'broker',
        avatarUrl,
        jobTitle: role,
        bio: connected
            ? 'Corretor IA conectado ao WhatsApp. Nome vem da instancia e a foto pode ser ajustada pelo admin.'
            : 'Corretor IA aguardando dados reais da instancia ou ajuste manual do cadastro.',
        role,
        sector: 'Comercial',
        status: active ? 'Ativo' : 'Inativo',
        tone: active ? 'success' : 'muted',
        source: 'virtual_brokers',
        promptValue: broker?.system_prompt || '',
        detail,
        tools: broker?.concierge_enabled
            ? ['WhatsApp', 'CRM', 'catalogo de imoveis', 'agenda', 'concierge']
            : ['WhatsApp', 'CRM', 'catalogo de imoveis', 'agenda'],
        autonomy: broker?.concierge_enabled
            ? 'Conversa com leads e tem concierge do dono configurado por telefones autorizados.'
            : 'Conversa com leads conforme prompt, tags e regras do agente global.',
        llmPolicy: `Herda ${globalProvider} / ${globalModel} da Sala de Manutencao`,
        centralContract: resolveAgentCentralProfile(`broker-${broker?.id || 'whatsapp'}`),
    }
}

function normalizeGlobalWhatsAppAgent(broker: any, globalProvider: string, globalModel: string, instance?: any): AgentOfficeItem {
    const base = normalizeBrokerAgent(broker, globalProvider, globalModel, instance)
    const connected = instance?.status === 'connected'
    const active = broker?.is_active !== false
    const phone = instance?.live_data?.phone || instance?.phone_number || broker?.phone || ''
    const instanceName = instance?.instance_name || 'Instancia global'
    const globalStatusLabel = connected
        ? 'conectada'
        : instance?.status === 'disconnected'
            ? 'desconectada'
            : 'cadastrada'

    return {
        ...base,
        id: 'whatsapp-global-agent',
        name: 'WhatsApp Global',
        personaName: 'WhatsApp Global',
        avatarInitials: 'WG',
        jobTitle: 'Instancia global do ecossistema',
        bio: connected
            ? 'Instancia global conectada ao WhatsApp para atender leads, usuarios internos, proprietarios e comandos do ecossistema.'
            : 'Instancia global do ecossistema com base operacional preservada no cadastro original.',
        role: 'Atendimento global e roteamento da Diretoria',
        sector: 'Diretoria',
        status: connected ? 'Conectado' : (active ? 'Ativo' : 'Inativo'),
        tone: connected || active ? 'success' : 'muted',
        detail: `Instancia global ${globalStatusLabel}${phone ? ` - ${phone}` : ''}. Base preservada em ${broker?.name || 'virtual_brokers'}.`,
        tools: broker?.concierge_enabled
            ? ['WhatsApp Global', 'CRM', 'catalogo de imoveis', 'agenda', 'comandos internos', 'concierge']
            : ['WhatsApp Global', 'CRM', 'catalogo de imoveis', 'agenda', 'comandos internos'],
        autonomy: 'Atua como porteiro inteligente do ecossistema: atende leads comuns, reconhece usuarios autorizados e roteia comandos internos para o setor ou agente responsavel.',
        runtimeFacts: [
            {
                label: 'Instancia WhatsApp',
                value: instanceName,
                tone: connected ? 'success' : 'warning',
            },
            {
                label: 'Numero conectado',
                value: phone || 'Sem numero sincronizado',
                tone: phone ? 'success' : 'muted',
            },
            {
                label: 'Base operacional',
                value: broker?.name || 'Cadastro global',
                tone: 'info',
            },
        ],
        centralContract: resolveAgentCentralProfile('whatsapp-global-agent'),
    }
}

async function loadAgentOfficeBrokers(supabase: ReturnType<typeof createAdminClient>): Promise<AgentOfficeBrokerRow[]> {
    const withConcierge = await supabase
        .from('virtual_brokers')
        .select('id,name,creci,is_active,assignment_type,system_prompt,photo_url,phone,whatsapp_instance_id,concierge_enabled,updated_at,created_at')
        .order('name')
        .limit(80)

    if (!withConcierge.error) return (withConcierge.data || []) as AgentOfficeBrokerRow[]

    const fallback = await supabase
        .from('virtual_brokers')
        .select('id,name,creci,is_active,assignment_type,system_prompt,photo_url,phone,whatsapp_instance_id,updated_at,created_at')
        .order('name')
        .limit(80)

    return (fallback.data || []) as AgentOfficeBrokerRow[]
}

async function loadAgentOfficeWhatsappInstances(supabase: ReturnType<typeof createAdminClient>) {
    const withTypeAndLiveData = await supabase
        .from('whatsapp_instances')
        .select('id, broker_id, instance_name, instance_type, phone_number, status, live_data')

    if (!withTypeAndLiveData.error) return withTypeAndLiveData.data || []

    const withType = await supabase
        .from('whatsapp_instances')
        .select('id, broker_id, instance_name, instance_type, phone_number, status')

    if (!withType.error) return withType.data || []

    const fallback = await supabase
        .from('whatsapp_instances')
        .select('id, broker_id, instance_name, phone_number, status')

    return fallback.data || []
}

async function loadAgentOfficeConfigRows(supabase: ReturnType<typeof createAdminClient>) {
    const rows: Array<{ key: string; value: string }> = []
    const pageSize = 1000

    for (let from = 0; from < 10000; from += pageSize) {
        const { data, error } = await supabase
            .from('app_config')
            .select('key,value')
            .not('key', 'like', '\\_%')
            .range(from, from + pageSize - 1)

        if (error) throw error

        rows.push(...(data || []))
        if (!data || data.length < pageSize) break
    }

    return rows
}

export async function getAgentOfficeSnapshot(): Promise<AgentOfficeSnapshot> {
    const supabase = createAdminClient()
    const [{ data: configRows }, { data: brokers }, { data: instances }] = await Promise.all([
        loadAgentOfficeConfigRows(supabase).then(data => ({ data })),
        loadAgentOfficeBrokers(supabase).then(data => ({ data })),
        loadAgentOfficeWhatsappInstances(supabase).then(data => ({ data })),
    ])

    const configs: ConfigMap = Object.fromEntries((configRows || []).map((row: any) => [row.key, String(row.value || '')]))
    const globalProvider = configs.ai_provider || 'gemini'
    const globalModel = resolveGlobalModel(configs)
    const llmPolicy = `Herda ${globalProvider} / ${globalModel} da Sala de Manutencao`
    const globalInstances = (instances || []).filter((instance: any) => isGlobalWhatsAppInstance(instance))
    const globalBroker = findGlobalWhatsAppBroker(brokers || [], globalInstances)
    const globalInstance = findLinkedInstanceForBroker(globalBroker, instances || []) || pickGlobalWhatsAppInstance(globalInstances)
    const globalAgent = globalBroker
        ? normalizeGlobalWhatsAppAgent(globalBroker, globalProvider, globalModel, globalInstance)
        : null
    const promptAgentDefinitions = globalAgent
        ? OFFICE_PROMPT_AGENTS.filter(agent => agent.id !== 'whatsapp-global-agent')
        : OFFICE_PROMPT_AGENTS

    const promptAgents: AgentOfficeItem[] = promptAgentDefinitions.map(agent => {
        const persona = getPersonaForAgent(agent)
        const isGlobalAgent = agent.id === 'whatsapp-global-agent'
        const globalPhone = globalInstance?.phone_number || ''
        const avatarUrl = configs[`agent_avatar_${agent.id}`] || `/api/admin/pilger-ai/agent-avatar/${agent.id}`
        const status = isGlobalAgent && globalInstance
            ? (globalInstance.status === 'connected' ? 'Conectado' : 'Desconectado')
            : undefined
        const globalStatusLabel = globalInstance?.status === 'connected'
            ? 'conectada'
            : globalInstance?.status === 'disconnected'
                ? 'desconectada'
                : 'cadastrada'
        const detail = isGlobalAgent && globalInstance
            ? `${agent.detail} Instancia global ${globalStatusLabel}${globalPhone ? ` - ${globalPhone}` : ''}.`
            : agent.detail
        const promptValue = applyAgentIdentity(agent, persona, getConfig(configs, agent.promptKey, agent.fallback))
        const runtimeFacts = [
            ...(agent.runtimeFacts?.(configs) || []),
            ...(isGlobalAgent ? [
                {
                    label: 'Instancia WhatsApp',
                    value: globalInstance?.instance_name || 'Nao vinculada',
                    tone: globalInstance?.status === 'connected' ? 'success' as const : 'warning' as const,
                },
                {
                    label: 'Numero conectado',
                    value: globalPhone || 'Sem numero sincronizado',
                    tone: globalPhone ? 'success' as const : 'muted' as const,
                },
                {
                    label: 'Base operacional',
                    value: globalBroker?.name ? `Sem corretor duplicado; instancia vinda de ${globalBroker.name}` : 'Independente dos corretores IA',
                    tone: 'info' as const,
                },
            ] : []),
        ]
        return {
            ...agent,
            personaName: persona.personaName,
            avatarInitials: getInitials(persona.personaName),
            avatarTone: persona.avatarTone,
            avatarConfigKey: `agent_avatar_${agent.id}`,
            avatarUrl,
            jobTitle: persona.jobTitle,
            bio: persona.bio,
            source: 'app_config',
            promptValue,
            detail,
            status: status || (promptValue.trim() ? 'Configurado' : 'Sem prompt'),
            tone: status === 'Conectado' ? 'success' : (promptValue.trim() ? 'success' : 'warning'),
            llmPolicy,
            behaviorControls: agent.behaviorControls?.map(control => ({
                ...control,
                value: getConfig(configs, control.key, control.fallback),
            })),
            runtimeFacts: runtimeFacts.length ? runtimeFacts : undefined,
            behaviorActions: agent.behaviorActions,
            centralContract: resolveAgentCentralProfile(agent.id),
            researchTopics: agent.id === 'research-pilger'
                ? getConfig(configs, 'research_pilger_topics', getDefaultResearchPilgerTopicsJson())
                : undefined,
            emailTemplates: agent.id === 'email-orchestrator'
                ? getConfig(configs, 'email_agent_templates', getDefaultEmailAgentTemplatesJson())
                : undefined,
            whatsappTemplates: agent.id === 'email-orchestrator'
                ? getConfig(configs, 'editorial_distribution_whatsapp_templates', getDefaultWhatsAppEditorialTemplatesJson())
                : undefined,
            pushTemplates: agent.id === 'email-orchestrator'
                ? getConfig(configs, 'editorial_distribution_push_templates', getDefaultPushEditorialTemplatesJson())
                : undefined,
        }
    })

    const globalBrokerId = String(globalBroker?.id || '')
    const globalInstanceIds = new Set(
        [
            ...globalInstances.map((instance: any) => String(instance.id || '')),
            String(globalInstance?.id || ''),
        ].filter(Boolean)
    )
    const brokerInstances = (instances || []).filter((instance: any) => {
        const instanceId = String(instance.id || '')
        const brokerId = String(instance.broker_id || '')
        return !globalInstanceIds.has(instanceId) &&
            (!globalBrokerId || brokerId !== globalBrokerId) &&
            !isGlobalWhatsAppInstance(instance)
    })
    const instancesByBrokerId = new Map(brokerInstances.map((instance: any) => [String(instance.broker_id), instance]))
    const brokerAgents = (brokers || [])
        .filter((broker: any) => {
            const brokerId = String(broker.id || '')
            const brokerInstanceId = String(broker.whatsapp_instance_id || '')
            return brokerId !== globalBrokerId &&
                !globalInstanceIds.has(brokerInstanceId) &&
                !isGlobalWhatsAppBroker(broker)
        })
        .map((broker: any) =>
            normalizeBrokerAgent(broker, globalProvider, globalModel, instancesByBrokerId.get(String(broker.id)))
        )
    const agents = [...promptAgents, ...(globalAgent ? [globalAgent] : []), ...brokerAgents]

    return {
        globalProvider,
        globalModel,
        totalAgents: agents.length,
        activeAgents: agents.filter(agent => agent.tone === 'success').length,
        promptAgents: promptAgents.length,
        brokerAgents: brokerAgents.length + (globalAgent ? 1 : 0),
        agents,
    }
}
