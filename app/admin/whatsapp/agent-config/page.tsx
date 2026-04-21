'use client'

import { useState, useEffect } from 'react'
import { Building2, Clock, FileText, Map, Save, Plus, X, Loader2, Check, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface WorkingHours {
    seg_sex_inicio: string
    seg_sex_fim: string
    sab_inicio: string
    sab_fim: string
    dom: string
}

interface AgentInstance {
    id: string
    instance_name: string
    status: 'connected' | 'connecting' | 'disconnected'
    broker_id?: string | null
    virtual_brokers?: { name?: string | null } | null
}

interface Broker {
    id: string
    name: string
    is_active?: boolean
}

interface Empreendimento {
    id: string
    nome: string
    slug: string
    ativo?: boolean
}

interface CustomLinkButton {
    id: string
    name: string
    type: 'URL' | 'BUTTON' | 'LIST' | 'POLL' | 'LOCATION' | 'PIX' | 'CAROUSEL'
    tag: string
    // URL
    url?: string
    // BUTTON / POLL
    title?: string
    options?: string[]
    // LIST
    listButton?: string
    listChoices?: string[]
    // PIX
    pixKey?: string
    pixName?: string
    pixType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'
    // CAROUSEL (JSON free-form)
    carouselJson?: string
}

const ACTION_TYPE_HELP: Record<CustomLinkButton['type'], string> = {
    URL: 'Envia botão com link externo (Instagram, site, YouTube). Use URL completa com https://.',
    BUTTON: 'Envia até 3 botões de resposta rápida. Ideal para opções simples como "Comprar", "Alugar", "Falar com consultor".',
    LIST: 'Envia uma lista expandível com várias opções. Melhor para catálogos ou menus com muitos itens.',
    POLL: 'Envia enquete com votação. Use para coletar preferência rápida do cliente.',
    LOCATION: 'Envia solicitação para o cliente compartilhar a localização atual no WhatsApp.',
    PIX: 'Envia botão PIX nativo para facilitar pagamento/copiar chave com um toque.',
    CAROUSEL: 'Envia carrossel com cards (texto, imagem e botões). Útil para mostrar imóveis/produtos em sequência.',
}

const CAROUSEL_EXAMPLE = `{
  "text": "Confira 2 opções",
  "cards": [
    {
      "text": "Apartamento em Balneário Camboriú",
      "image": "https://seu-site.com/imovel-1.jpg",
      "buttons": [
        { "id": "https://seu-site.com/imovel-1", "text": "Ver detalhes", "type": "URL" },
        { "id": "quero_imovel_1", "text": "Tenho interesse", "type": "REPLY" }
      ]
    }
  ]
}`

function toDateTimeLocalValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseFollowupScheduleToDateTimes(raw: string | undefined): string[] {
    if (!raw) return ['']
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            // Compatibilidade legado: offsets em minutos.
            const now = Date.now()
            return parsed
                .map((m) => Number(m))
                .filter((m) => Number.isFinite(m) && m > 0)
                .map((m) => toDateTimeLocalValue(new Date(now + m * 60000)))
                .sort()
        }
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.absolute_datetimes)) {
            return parsed.absolute_datetimes
                .map((iso: string) => new Date(String(iso || '')))
                .filter((d: Date) => !Number.isNaN(d.getTime()))
                .map((d: Date) => toDateTimeLocalValue(d))
                .sort()
        }
    } catch {
        return ['']
    }
    return ['']
}

function slugifyTagName(value: string) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

export default function AgentConfigPage() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Empresa
    const [companyName, setCompanyName] = useState('Pilger Imóveis')
    const [companyCreci, setCompanyCreci] = useState('')
    const [companyPhone, setCompanyPhone] = useState('')
    const [companyDescription, setCompanyDescription] = useState('')
    const [linkButtons, setLinkButtons] = useState<CustomLinkButton[]>([])
    const [newActionName, setNewActionName] = useState('')
    const [newActionType, setNewActionType] = useState<CustomLinkButton['type']>('URL')
    const [newActionField1, setNewActionField1] = useState('')
    const [newActionField2, setNewActionField2] = useState('')
    const [newActionField3, setNewActionField3] = useState('')
    const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([])
    const [newEmpreendimentoName, setNewEmpreendimentoName] = useState('')

    // Horários
    const [hours, setHours] = useState<WorkingHours>({
        seg_sex_inicio: '09:00',
        seg_sex_fim: '18:00',
        sab_inicio: '09:00',
        sab_fim: '13:00',
        dom: 'Fechado'
    })

    // Regiões
    const [regions, setRegions] = useState<string[]>([])
    const [newRegion, setNewRegion] = useState('')

    // Documentos
    const [documents, setDocuments] = useState<string[]>([])
    const [newDocument, setNewDocument] = useState('')

    // Transferência
    const [transferMsgLead, setTransferMsgLead] = useState(
        'Vou te passar para nosso especialista, que vai te ajudar com todos os detalhes. Ele ja tem suas informacoes.'
    )
    const [transferMsgBroker, setTransferMsgBroker] = useState(
        '*Lead qualificado transferido!*\n\nNome: {nome_lead}\nTelefone: {telefone}\nInteresse: {interesse}\nOrcamento: {orcamento}\nRegiao: {regiao}\n\nEntre em contato agora!'
    )
    const [agentTone, setAgentTone] = useState('amigavel')
    const [transferScoreThreshold, setTransferScoreThreshold] = useState('80')
    const [defaultInstanceId, setDefaultInstanceId] = useState('')
    const [transferInstanceIds, setTransferInstanceIds] = useState<string[]>([])
    const [transferMode, setTransferMode] = useState<'round_robin' | 'fixed'>('round_robin')
    const [whatsappRescueEnabled, setWhatsappRescueEnabled] = useState(false)
    const [whatsappRescueDelayMinutes, setWhatsappRescueDelayMinutes] = useState('5')
    const [whatsappRescueMaxAttempts, setWhatsappRescueMaxAttempts] = useState('2')
    const [whatsappRescueMessageTemplate, setWhatsappRescueMessageTemplate] = useState(
        'Oi {nome_lead}! Vi seu cadastro e estou por aqui para te ajudar. Se quiser, já te explico tudo rapidinho por aqui.'
    )
    const [whatsappFollowupEnabled, setWhatsappFollowupEnabled] = useState(false)
    const [whatsappFollowupDateTimes, setWhatsappFollowupDateTimes] = useState<string[]>([''])
    const [whatsappFollowupMessageTemplate, setWhatsappFollowupMessageTemplate] = useState(
        'Oi {nome_lead}! Passando para saber se posso te ajudar com mais detalhes.'
    )
    const [instances, setInstances] = useState<AgentInstance[]>([])
    const [brokers, setBrokers] = useState<Broker[]>([])
    const [defaultBrokerId, setDefaultBrokerId] = useState('')
    const [defaultStatus, setDefaultStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')
    const [defaultPhone, setDefaultPhone] = useState('')

    useEffect(() => {
        loadConfig()
        loadBrokers()
        loadInstances()
        loadEmpreendimentos()
    }, [])

    const selectedDefaultInstance = instances.find(i => i.id === defaultInstanceId)

    async function loadBrokers() {
        try {
            const { data } = await supabase
                .from('virtual_brokers')
                .select('id, name, is_active')
                .order('name', { ascending: true })
            setBrokers((data || []) as Broker[])
        } catch {
            setBrokers([])
        }
    }

    async function loadInstances() {
        try {
            const res = await fetch('/api/admin/whatsapp/instances')
            const data = await res.json()
            const all = (data?.instances || []) as AgentInstance[]
            const onlyAgents = all.filter(i => !!i.broker_id)
            setInstances(onlyAgents)
        } catch {
            setInstances([])
        }
    }

    async function loadConfig() {
        try {
            const res = await fetch('/api/admin/whatsapp/agent-config')
            const data = await res.json()
            if (data.success && data.config) {
                const c = data.config
                if (c.agent_company_name) setCompanyName(c.agent_company_name)
                if (c.agent_company_creci) setCompanyCreci(c.agent_company_creci)
                if (c.agent_company_phone) setCompanyPhone(c.agent_company_phone)
                if (c.agent_company_description) setCompanyDescription(c.agent_company_description)
                if (c.agent_link_buttons) {
                    try {
                        const parsed = JSON.parse(c.agent_link_buttons)
                        if (Array.isArray(parsed)) {
                            setLinkButtons(parsed.filter(Boolean))
                        }
                    } catch {}
                }
                if (c.agent_working_hours) {
                    try { setHours(JSON.parse(c.agent_working_hours)) } catch {}
                }
                if (c.agent_regions) {
                    try { setRegions(JSON.parse(c.agent_regions)) } catch {}
                }
                if (c.agent_required_documents) {
                    try { setDocuments(JSON.parse(c.agent_required_documents)) } catch {}
                }
                if (c.agent_transfer_message_lead) setTransferMsgLead(c.agent_transfer_message_lead)
                if (c.agent_transfer_message_broker) setTransferMsgBroker(c.agent_transfer_message_broker)
                if (c.agent_tone) setAgentTone(c.agent_tone)
                if (c.agent_transfer_score_threshold) setTransferScoreThreshold(c.agent_transfer_score_threshold)
                if (c.agent_default_broker_id) setDefaultBrokerId(c.agent_default_broker_id)
                if (c.agent_default_instance_id) setDefaultInstanceId(c.agent_default_instance_id)
                if (c.agent_transfer_mode) setTransferMode(c.agent_transfer_mode)
                if (c.agent_transfer_instance_ids) {
                    try { setTransferInstanceIds(JSON.parse(c.agent_transfer_instance_ids)) } catch {}
                }
                if (typeof c.whatsapp_rescue_enabled === 'string') {
                    setWhatsappRescueEnabled(c.whatsapp_rescue_enabled !== 'false')
                }
                if (c.whatsapp_rescue_delay_minutes) setWhatsappRescueDelayMinutes(c.whatsapp_rescue_delay_minutes)
                if (c.whatsapp_rescue_max_attempts) setWhatsappRescueMaxAttempts(c.whatsapp_rescue_max_attempts)
                if (c.whatsapp_rescue_message_template) setWhatsappRescueMessageTemplate(c.whatsapp_rescue_message_template)
                if (typeof c.whatsapp_followup_enabled === 'string') setWhatsappFollowupEnabled(c.whatsapp_followup_enabled !== 'false')
                if (c.whatsapp_followup_schedule_json) {
                    const parsedTimes = parseFollowupScheduleToDateTimes(c.whatsapp_followup_schedule_json)
                    setWhatsappFollowupDateTimes(parsedTimes)
                }
                if (c.whatsapp_followup_message_template) setWhatsappFollowupMessageTemplate(c.whatsapp_followup_message_template)
            }
        } catch (err) {
            console.error('Erro ao carregar config:', err)
        } finally {
            setLoading(false)
        }
    }

    async function saveConfig() {
        setSaving(true)
        setSaved(false)
        try {
            const validDateCount = whatsappFollowupDateTimes
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .map(v => new Date(v))
                .filter((d) => !Number.isNaN(d.getTime()))
                .length

            if (whatsappRescueEnabled && validDateCount === 0) {
                alert('Para ativar o resgate, selecione ao menos uma data e hora de follow-up.')
                setSaving(false)
                return
            }

            const absoluteDatetimes = whatsappFollowupDateTimes
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .map(v => new Date(v))
                .filter((d) => !Number.isNaN(d.getTime()))
                .map((d) => d.toISOString())
                .sort()

            const res = await fetch('/api/admin/whatsapp/agent-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config: {
                        agent_company_name: companyName,
                        agent_company_creci: companyCreci,
                        agent_company_phone: companyPhone,
                        agent_company_description: companyDescription,
                        agent_link_buttons: JSON.stringify(linkButtons),
                        agent_working_hours: JSON.stringify(hours),
                        agent_regions: JSON.stringify(regions),
                        agent_required_documents: JSON.stringify(documents),
                        agent_transfer_message_lead: transferMsgLead,
                        agent_transfer_message_broker: transferMsgBroker,
                        agent_tone: agentTone,
                        agent_transfer_score_threshold: transferScoreThreshold,
                        agent_default_broker_id: defaultBrokerId,
                        agent_default_instance_id: defaultInstanceId,
                        agent_transfer_mode: transferMode,
                        agent_transfer_instance_ids: JSON.stringify(transferInstanceIds),
                        whatsapp_rescue_enabled: String(whatsappRescueEnabled),
                        whatsapp_rescue_delay_minutes: whatsappRescueDelayMinutes,
                        whatsapp_rescue_max_attempts: whatsappRescueMaxAttempts,
                        whatsapp_rescue_message_template: whatsappRescueMessageTemplate,
                        whatsapp_followup_enabled: String(whatsappRescueEnabled),
                        whatsapp_followup_schedule_json: JSON.stringify({ absolute_datetimes: absoluteDatetimes }),
                        whatsapp_followup_message_template: whatsappFollowupMessageTemplate,
                    }
                })
            })
            const data = await res.json()
            if (data.success) {
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
            }
        } catch (err) {
            console.error('Erro ao salvar:', err)
        } finally {
            setSaving(false)
        }
    }

    function addRegion() {
        if (newRegion.trim() && !regions.includes(newRegion.trim())) {
            setRegions([...regions, newRegion.trim()])
            setNewRegion('')
        }
    }

    function removeRegion(r: string) {
        setRegions(regions.filter(x => x !== r))
    }

    function addDocument() {
        if (newDocument.trim() && !documents.includes(newDocument.trim())) {
            setDocuments([...documents, newDocument.trim()])
            setNewDocument('')
        }
    }

    function removeDocument(d: string) {
        setDocuments(documents.filter(x => x !== d))
    }

    async function loadEmpreendimentos() {
        try {
            const res = await fetch('/api/admin/empreendimentos')
            const data = await res.json()
            setEmpreendimentos((data?.data || []) as Empreendimento[])
        } catch {
            setEmpreendimentos([])
        }
    }

    async function createEmpreendimento() {
        const nome = newEmpreendimentoName.trim()
        if (!nome) return
        try {
            const res = await fetch('/api/admin/empreendimentos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Erro ao criar empreendimento')
            setNewEmpreendimentoName('')
            await loadEmpreendimentos()
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erro ao criar empreendimento')
        }
    }

    async function deleteEmpreendimento(id: string) {
        const ok = window.confirm('Excluir este empreendimento?')
        if (!ok) return
        try {
            const res = await fetch(`/api/admin/empreendimentos?id=${id}`, { method: 'DELETE' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.error || 'Erro ao excluir empreendimento')
            await loadEmpreendimentos()
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Erro ao excluir empreendimento')
        }
    }

    function addLinkButton() {
        const name = newActionName.trim()
        if (!name) return
        const slug = slugifyTagName(name)
        if (!slug) return
        const tag = `{botao_${slug}}`
        if (linkButtons.some(b => b.tag === tag)) {
            alert('Já existe uma ação com esse nome/tag.')
            return
        }

        const base: CustomLinkButton = {
            id: `lb_${Date.now()}`,
            name,
            type: newActionType,
            tag,
        }

        let next: CustomLinkButton = base
        if (newActionType === 'URL') {
            const url = newActionField1.trim()
            if (!/^https?:\/\//i.test(url)) {
                alert('A URL deve começar com http:// ou https://')
                return
            }
            next = { ...base, url }
        } else if (newActionType === 'BUTTON') {
            const title = newActionField1.trim() || name
            const options = newActionField2.split('|').map(s => s.trim()).filter(Boolean)
            if (options.length === 0) {
                alert('Informe as opções separadas por |')
                return
            }
            next = { ...base, title, options }
        } else if (newActionType === 'LIST') {
            const listButton = newActionField1.trim() || 'Ver opções'
            const listChoices = newActionField2.split('|').map(s => s.trim()).filter(Boolean)
            if (listChoices.length === 0) {
                alert('Informe os itens da lista separados por |')
                return
            }
            next = { ...base, listButton, listChoices }
        } else if (newActionType === 'POLL') {
            const title = newActionField1.trim() || 'Qual opção você prefere?'
            const options = newActionField2.split('|').map(s => s.trim()).filter(Boolean)
            if (options.length < 2) {
                alert('Enquete precisa de ao menos 2 opções')
                return
            }
            next = { ...base, title, options }
        } else if (newActionType === 'LOCATION') {
            next = { ...base }
        } else if (newActionType === 'PIX') {
            const pixKey = newActionField1.trim()
            const pixName = newActionField2.trim() || 'Pagamento'
            const pixTypeRaw = (newActionField3.trim().toUpperCase() || 'EVP') as CustomLinkButton['pixType']
            const allowed = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP']
            if (!pixKey) {
                alert('Informe a chave PIX')
                return
            }
            if (!allowed.includes(pixTypeRaw || '')) {
                alert('Tipo PIX inválido. Use: CPF, CNPJ, EMAIL, PHONE ou EVP')
                return
            }
            next = { ...base, pixKey, pixName, pixType: pixTypeRaw }
        } else if (newActionType === 'CAROUSEL') {
            const carouselJson = newActionField1.trim()
            if (!carouselJson) {
                alert('Cole o JSON dos cards do carousel')
                return
            }
            try {
                const parsed = JSON.parse(carouselJson)
                const cards = Array.isArray(parsed) ? parsed : parsed?.cards
                if (!Array.isArray(cards) || cards.length === 0) throw new Error('invalid')
            } catch {
                alert('JSON do carousel inválido. Use um array de cards ou objeto com { text, cards }.')
                return
            }
            next = { ...base, carouselJson }
        }

        setLinkButtons(prev => [...prev, next])
        setNewActionName('')
        setNewActionType('URL')
        setNewActionField1('')
        setNewActionField2('')
        setNewActionField3('')
    }

    function removeLinkButton(id: string) {
        setLinkButtons(prev => prev.filter(b => b.id !== id))
    }

    useEffect(() => {
        if (!selectedDefaultInstance) {
            setDefaultStatus('disconnected')
            setDefaultPhone('')
            return
        }
        setDefaultStatus(selectedDefaultInstance.status || 'disconnected')
    }, [selectedDefaultInstance])

    useEffect(() => {
        if (!defaultBrokerId) return
        if (defaultInstanceId) return
        const brokerInstance = instances.find(i => i.broker_id === defaultBrokerId)
        if (brokerInstance?.id) setDefaultInstanceId(brokerInstance.id)
    }, [defaultBrokerId, defaultInstanceId, instances])

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        )
    }

    const sectionStyle: React.CSSProperties = {
        background: '#fff',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 20,
        border: '1px solid #e8e5e0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
    }

    const sectionHeaderStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 18,
        paddingBottom: 12,
        borderBottom: '2px solid #f0ede8'
    }

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: '#555',
        marginBottom: 6,
        letterSpacing: '0.02em'
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        border: '1px solid #e0ddd8',
        borderRadius: 8,
        fontSize: '0.88rem',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        fontFamily: 'inherit',
        background: '#fafafa'
    }

    const textareaStyle: React.CSSProperties = {
        ...inputStyle,
        minHeight: 80,
        resize: 'vertical' as const
    }

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16
    }

    const tagStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: '#f0ede8',
        borderRadius: 20,
        fontSize: '0.82rem',
        fontWeight: 500,
        color: '#555'
    }

    const btnSmall: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 14px',
        background: 'linear-gradient(135deg, #b8945f, #d4b87a)',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontSize: '0.78rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'opacity 0.2s'
    }

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                        Configuracao do Agente IA
                    </h1>
                    <p style={{ color: '#888', fontSize: '0.85rem', margin: '4px 0 0' }}>
                        Configure os dados que o agente usa durante as conversas
                    </p>
                </div>
                <button
                    onClick={saveConfig}
                    disabled={saving}
                    style={{
                        ...btnSmall,
                        padding: '10px 24px',
                        fontSize: '0.88rem',
                        opacity: saving ? 0.6 : 1,
                        background: saved ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #b8945f, #d4b87a)'
                    }}
                >
                    {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> :
                     saved ? <><Check size={16} /> Salvo!</> :
                     <><Save size={16} /> Salvar Tudo</>}
                </button>
            </div>

            {/* Corretor padrao do sistema */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#b8945f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Corretor Padrao do Sistema</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Triagem inicial e instancia padrao</span>
                </div>

                <div style={gridStyle}>
                    <div>
                        <label style={labelStyle}>Corretor padrao</label>
                        <select
                            style={inputStyle}
                            value={defaultBrokerId}
                            onChange={(e) => {
                                const brokerId = e.target.value
                                setDefaultBrokerId(brokerId)
                                const brokerInstance = instances.find(i => i.broker_id === brokerId)
                                setDefaultInstanceId(brokerInstance?.id || '')
                                setDefaultPhone('')
                            }}
                        >
                            <option value="">Selecione o corretor padrao...</option>
                            {brokers.map((broker) => (
                                <option key={broker.id} value={broker.id}>
                                    {broker.name} {broker.is_active === false ? '- inativo' : ''}
                                </option>
                            ))}
                        </select>
                        <p style={{ fontSize: '0.72rem', color: '#888', marginTop: 6 }}>
                            Este corretor sera o primeiro contato com leads no WhatsApp.
                        </p>
                    </div>
                    <div>
                        <label style={labelStyle}>Status da instancia padrao</label>
                        <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>
                                {defaultStatus === 'connected' ? 'Online' : defaultStatus === 'connecting' ? 'Conectando' : 'Desconectado'}
                            </span>
                            <span style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: defaultStatus === 'connected' ? '#22c55e' : defaultStatus === 'connecting' ? '#f59e0b' : '#ef4444'
                            }} />
                        </div>
                        {!!selectedDefaultInstance?.instance_name && (
                            <p style={{ fontSize: '0.72rem', color: '#888', marginTop: 6 }}>
                                Instancia: {selectedDefaultInstance.instance_name}{defaultPhone ? ` - ${defaultPhone}` : ''}
                            </p>
                        )}
                    </div>
                </div>

                <p style={{ fontSize: '0.74rem', color: '#888', marginTop: 14 }}>
                    A conexao de instancias e feita em <b>WhatsApp Web - Instancias</b> ou dentro de <b>Corretores IA</b>.
                </p>
            </div>

            {/* EMPRESA */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Building2 size={20} color="#b8945f" />
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Informações da Empresa</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Tag: {'{empresa}'}</span>
                </div>
                <div style={gridStyle}>
                    <div>
                        <label style={labelStyle}>Nome da Empresa</label>
                        <input style={inputStyle} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Pilger Imóveis" />
                    </div>
                    <div>
                        <label style={labelStyle}>CRECI</label>
                        <input style={inputStyle} value={companyCreci} onChange={e => setCompanyCreci(e.target.value)} placeholder="SC 6772-J" />
                    </div>
                    <div>
                        <label style={labelStyle}>Telefone Principal</label>
                        <input style={inputStyle} value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="(47) 9.9252-8080" />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Descrição da Empresa</label>
                        <textarea
                            style={textareaStyle}
                            value={companyDescription}
                            onChange={e => setCompanyDescription(e.target.value)}
                            placeholder="Referência em imóveis de alto padrão no litoral catarinense, com mais de X anos de experiência..."
                        />
                    </div>
                </div>
            </div>

            {/* ACOES INTERATIVAS */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Globe size={20} color="#0ea5e9" />
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Ações Interativas por Tag</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>
                        O admin define os botões e usa as tags no prompt
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 1fr auto', gap: 8, marginBottom: 8 }}>
                    <input
                        style={inputStyle}
                        value={newActionName}
                        onChange={e => setNewActionName(e.target.value)}
                        placeholder="Nome da ação (ex: Instagram Premium)"
                    />
                    <select style={inputStyle} value={newActionType} onChange={e => setNewActionType(e.target.value as CustomLinkButton['type'])}>
                        <option value="URL">URL</option>
                        <option value="BUTTON">Botões</option>
                        <option value="LIST">Lista</option>
                        <option value="POLL">Enquete</option>
                        <option value="LOCATION">Solicitar Localização</option>
                        <option value="PIX">Botão PIX</option>
                        <option value="CAROUSEL">Carousel</option>
                    </select>
                    <input
                        style={inputStyle}
                        value={newActionField1}
                        onChange={e => setNewActionField1(e.target.value)}
                        placeholder={
                            newActionType === 'URL' ? 'https://seu-link.com'
                                : newActionType === 'BUTTON' ? 'Título dos botões'
                                : newActionType === 'LIST' ? 'Texto do botão da lista'
                                : newActionType === 'POLL' ? 'Pergunta da enquete'
                                : newActionType === 'PIX' ? 'Chave PIX'
                                : newActionType === 'CAROUSEL' ? 'Use o campo JSON abaixo'
                                : 'Não precisa'
                        }
                        disabled={newActionType === 'LOCATION' || newActionType === 'CAROUSEL'}
                    />
                    <button onClick={addLinkButton} style={btnSmall}>
                        <Plus size={14} /> Criar
                    </button>
                </div>
                <div style={{ marginBottom: 10, fontSize: '0.78rem', color: '#666', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
                    <strong>Para que serve este tipo:</strong> {ACTION_TYPE_HELP[newActionType]}
                    {newActionType === 'CAROUSEL' && (
                        <div style={{ marginTop: 6, color: '#4b5563' }}>
                            Formato recomendado: objeto JSON com <code>text</code> e <code>cards</code>.
                        </div>
                    )}
                </div>
                {(newActionType === 'BUTTON' || newActionType === 'LIST' || newActionType === 'POLL' || newActionType === 'PIX') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <input
                            style={inputStyle}
                            value={newActionField2}
                            onChange={e => setNewActionField2(e.target.value)}
                            placeholder={
                                newActionType === 'PIX'
                                    ? 'Nome exibido no PIX (ex: Pilger Imóveis)'
                                    : 'Opções separadas por | (ex: Opção 1|Opção 2)'
                            }
                        />
                        {newActionType === 'PIX' ? (
                            <input
                                style={inputStyle}
                                value={newActionField3}
                                onChange={e => setNewActionField3(e.target.value)}
                                placeholder="Tipo PIX: EVP, CPF, CNPJ, EMAIL ou PHONE"
                            />
                        ) : (
                            <div />
                        )}
                    </div>
                )}
                {newActionType === 'CAROUSEL' && (
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 6 }}>
                            Exemplo de carousel (copie e ajuste links/textos):
                        </div>
                        <textarea
                            style={{ ...textareaStyle, minHeight: 160, fontFamily: 'monospace', fontSize: '0.76rem' }}
                            value={newActionField1}
                            onChange={e => setNewActionField1(e.target.value)}
                            placeholder={CAROUSEL_EXAMPLE}
                        />
                    </div>
                )}

                <div style={{ display: 'grid', gap: 8 }}>
                    {linkButtons.length === 0 && (
                        <span style={{ color: '#bbb', fontSize: '0.82rem' }}>
                            Nenhuma ação interativa cadastrada ainda.
                        </span>
                    )}
                    {linkButtons.map(btn => (
                        <div key={btn.id} style={{
                            border: '1px solid #e7e4df',
                            background: '#fafafa',
                            borderRadius: 10,
                            padding: '10px 12px',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1.3fr auto',
                            gap: 8,
                            alignItems: 'center',
                        }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#444' }}>
                                {btn.name} <span style={{ fontSize: '0.72rem', color: '#888', marginLeft: 6 }}>({btn.type})</span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {btn.type === 'URL' ? btn.url :
                                    btn.type === 'BUTTON' ? `${btn.title} • ${(btn.options || []).join(' | ')}` :
                                        btn.type === 'LIST' ? `${btn.listButton} • ${(btn.listChoices || []).join(' | ')}` :
                                            btn.type === 'POLL' ? `${btn.title} • ${(btn.options || []).join(' | ')}` :
                                                btn.type === 'PIX' ? `${btn.pixType || 'EVP'} • ${btn.pixName || ''}` :
                                                    btn.type === 'CAROUSEL' ? 'Carousel configurado via JSON' :
                                                        'Solicita localização do cliente'}
                            </div>
                            <button onClick={() => removeLinkButton(btn.id)} style={{ ...btnSmall, background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '6px 10px' }}>
                                <X size={14} /> Remover
                            </button>
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.74rem', color: '#8b5cf6' }}>
                                Tag no prompt: <code>{btn.tag}</code>
                            </div>
                        </div>
                    ))}
                </div>

                {linkButtons.length > 0 && (
                    <p style={{ fontSize: '0.74rem', color: '#888', marginTop: 10 }}>
                        Use as tags acima no prompt do agente. Cada tag dispara a ação interativa configurada.
                    </p>
                )}
            </div>

            {/* EMPREENDIMENTOS (CATÁLOGO GLOBAL) */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Building2 size={20} color="#0ea5e9" />
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Empreendimentos (Catálogo Global)</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>
                        Corretores IA apenas selecionam daqui
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <input
                        style={{ ...inputStyle, flex: 1 }}
                        value={newEmpreendimentoName}
                        onChange={e => setNewEmpreendimentoName(e.target.value)}
                        placeholder="Nome do empreendimento (ex: Brava Concetto)"
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), createEmpreendimento())}
                    />
                    <button onClick={createEmpreendimento} style={btnSmall}><Plus size={14} /> Criar</button>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                    {empreendimentos.length === 0 && (
                        <span style={{ color: '#bbb', fontSize: '0.82rem' }}>Nenhum empreendimento cadastrado.</span>
                    )}
                    {empreendimentos.map(e => (
                        <div key={e.id} style={{
                            border: '1px solid #e7e4df',
                            background: '#fafafa',
                            borderRadius: 10,
                            padding: '10px 12px',
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: 8,
                            alignItems: 'center',
                        }}>
                            <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#444' }}>{e.nome}</div>
                                <div style={{ fontSize: '0.74rem', color: '#888' }}>/ {e.slug}</div>
                            </div>
                            <button onClick={() => deleteEmpreendimento(e.id)} style={{ ...btnSmall, background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '6px 10px' }}>
                                <X size={14} /> Excluir
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* HORARIO DE ATENDIMENTO */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Clock size={20} color="#3b82f6" />
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Horário de Atendimento</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Tag: {'{horario}'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                        <label style={labelStyle}>Segunda a Sexta - Inicio</label>
                        <input type="time" style={inputStyle} value={hours.seg_sex_inicio} onChange={e => setHours({ ...hours, seg_sex_inicio: e.target.value })} />
                    </div>
                    <div>
                        <label style={labelStyle}>Segunda a Sexta - Fim</label>
                        <input type="time" style={inputStyle} value={hours.seg_sex_fim} onChange={e => setHours({ ...hours, seg_sex_fim: e.target.value })} />
                    </div>
                    <div />
                    <div>
                        <label style={labelStyle}>Sabado - Inicio</label>
                        <input type="time" style={inputStyle} value={hours.sab_inicio} onChange={e => setHours({ ...hours, sab_inicio: e.target.value })} />
                    </div>
                    <div>
                        <label style={labelStyle}>Sabado - Fim</label>
                        <input type="time" style={inputStyle} value={hours.sab_fim} onChange={e => setHours({ ...hours, sab_fim: e.target.value })} />
                    </div>
                    <div />
                    <div>
                        <label style={labelStyle}>Domingo</label>
                        <select style={inputStyle} value={hours.dom} onChange={e => setHours({ ...hours, dom: e.target.value })}>
                            <option value="Fechado">Fechado</option>
                            <option value="09:00 - 13:00">09:00 - 13:00</option>
                            <option value="10:00 - 14:00">10:00 - 14:00</option>
                            <option value="Sob agendamento">Sob agendamento</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* REGIOES */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Map size={20} color="#22c55e" />
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Regiões de Atuação</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Tag: {'{regioes}'}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {regions.length === 0 && <span style={{ color: '#bbb', fontSize: '0.82rem' }}>Nenhuma região cadastrada</span>}
                    {regions.map(r => (
                        <span key={r} style={tagStyle}>
                            {r}
                            <button onClick={() => removeRegion(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                <X size={14} color="#999" />
                            </button>
                        </span>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        style={{ ...inputStyle, flex: 1 }}
                        value={newRegion}
                        onChange={e => setNewRegion(e.target.value)}
                        placeholder="Ex: Balneário Camboriú"
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRegion())}
                    />
                    <button onClick={addRegion} style={btnSmall}><Plus size={14} /> Adicionar</button>
                </div>
            </div>

            {/* DOCUMENTOS */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <FileText size={20} color="#8b5cf6" />
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Documentos Solicitados</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Tag: {'{documentos}'}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    {documents.length === 0 && <span style={{ color: '#bbb', fontSize: '0.82rem' }}>Nenhum documento cadastrado</span>}
                    {documents.map(d => (
                        <span key={d} style={tagStyle}>
                            {d}
                            <button onClick={() => removeDocument(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                <X size={14} color="#999" />
                            </button>
                        </span>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        style={{ ...inputStyle, flex: 1 }}
                        value={newDocument}
                        onChange={e => setNewDocument(e.target.value)}
                        placeholder="Ex: RG e CPF"
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDocument())}
                    />
                    <button onClick={addDocument} style={btnSmall}><Plus size={14} /> Adicionar</button>
                </div>
            </div>

            {/* TRANSFERENCIA */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Mensagens de Transferência</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Tag: {'{transferir}'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                        <label style={labelStyle}>Tom de voz</label>
                        <select style={inputStyle} value={agentTone} onChange={e => setAgentTone(e.target.value)}>
                            <option value="amigavel">Amigável</option>
                            <option value="formal">Formal</option>
                            <option value="consultivo">Consultivo</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Score para transferência automática</label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            style={inputStyle}
                            value={transferScoreThreshold}
                            onChange={e => setTransferScoreThreshold(e.target.value)}
                            placeholder="80"
                        />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                        <label style={labelStyle}>Instancia de triagem (definida no topo)</label>
                        <input
                            style={inputStyle}
                            value={selectedDefaultInstance ? (selectedDefaultInstance.virtual_brokers?.name || selectedDefaultInstance.instance_name) : 'Nao configurada'}
                            readOnly
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Modo de distribuição</label>
                        <select style={inputStyle} value={transferMode} onChange={e => setTransferMode((e.target.value as any) || 'round_robin')}>
                            <option value="round_robin">Fila (Round-robin)</option>
                            <option value="fixed">Fixo (primeiro da lista)</option>
                        </select>
                    </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Lista de instâncias destino (especialistas)</label>
                    <div style={{ display: 'grid', gap: 8 }}>
                        {instances
                            .filter(inst => inst.id !== defaultInstanceId)
                            .map(inst => {
                                const checked = transferInstanceIds.includes(inst.id)
                                return (
                                    <label key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#444' }}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => {
                                                const next = e.target.checked
                                                    ? [...transferInstanceIds, inst.id]
                                                    : transferInstanceIds.filter(x => x !== inst.id)
                                                setTransferInstanceIds(next)
                                            }}
                                        />
                                        {(inst.virtual_brokers?.name || inst.instance_name)} ({inst.status})
                                    </label>
                                )
                            })}
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#888', marginTop: 6 }}>
                        Quando o agente padrão usar {'{transferir}'}, o lead será distribuído para uma dessas instâncias.
                    </p>
                </div>
                <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Mensagem para o Lead (quando transferir)</label>
                    <textarea
                        style={textareaStyle}
                        value={transferMsgLead}
                        onChange={e => setTransferMsgLead(e.target.value)}
                        placeholder="Vou te passar pro nosso especialista..."
                    />
                    <p style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 4 }}>Esta mensagem é enviada ao lead quando o agente decide transferir</p>
                </div>
                <div>
                    <label style={labelStyle}>Notificação para o Corretor Humano</label>
                    <textarea
                        style={{ ...textareaStyle, minHeight: 120 }}
                        value={transferMsgBroker}
                        onChange={e => setTransferMsgBroker(e.target.value)}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: '#888' }}>Variáveis disponíveis:</span>
                        {['{nome_lead}', '{telefone}', '{interesse}', '{orcamento}', '{regiao}'].map(v => (
                            <code key={v} style={{ fontSize: '0.7rem', background: '#f5f0ea', padding: '2px 6px', borderRadius: 4, color: '#b8945f' }}>{v}</code>
                        ))}
                    </div>
                </div>
            </div>

            {/* RESGATE WHATSAPP */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Resgate de Lead no WhatsApp</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Pós-cadastro sem resposta</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                        <label style={labelStyle}>Ativar resgate automático</label>
                        <select
                            style={inputStyle}
                            value={whatsappRescueEnabled ? 'true' : 'false'}
                            onChange={e => {
                                const active = e.target.value === 'true'
                                setWhatsappRescueEnabled(active)
                                setWhatsappFollowupEnabled(active)
                                if (active && whatsappFollowupDateTimes.every(x => !String(x || '').trim())) {
                                    setWhatsappFollowupDateTimes([toDateTimeLocalValue(new Date(Date.now() + 5 * 60000)), ''])
                                }
                            }}
                        >
                            <option value="true">Ativo</option>
                            <option value="false">Inativo</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Aguardar (minutos)</label>
                        <input
                            type="number"
                            min={1}
                            max={120}
                            style={inputStyle}
                            value={whatsappRescueDelayMinutes}
                            onChange={e => setWhatsappRescueDelayMinutes(e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Máximo de tentativas</label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            style={inputStyle}
                            value={whatsappRescueMaxAttempts}
                            onChange={e => setWhatsappRescueMaxAttempts(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Mensagem de resgate</label>
                    <textarea
                        style={textareaStyle}
                        value={whatsappRescueMessageTemplate}
                        onChange={e => setWhatsappRescueMessageTemplate(e.target.value)}
                        placeholder="Oi {nome_lead}! Vi seu cadastro e estou por aqui para te ajudar..."
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: '#888' }}>Variáveis disponíveis:</span>
                        {['{nome_lead}'].map(v => (
                            <code key={v} style={{ fontSize: '0.7rem', background: '#ecfdf5', padding: '2px 6px', borderRadius: 4, color: '#047857' }}>{v}</code>
                        ))}
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#888', marginTop: 6 }}>
                        Esta mensagem só é enviada se o lead não iniciar conversa no WhatsApp dentro do tempo configurado.
                    </p>
                </div>
                {whatsappRescueEnabled && (
                    <div style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                        <div>
                            <label style={labelStyle}>Agenda visual de follow-up</label>
                        </div>
                        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                            {whatsappFollowupDateTimes.map((dt, idx) => (
                                <div key={`${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                                    <input
                                        type="datetime-local"
                                        style={inputStyle}
                                        value={dt}
                                        onChange={e => {
                                            const value = e.target.value
                                            const next = [...whatsappFollowupDateTimes]
                                            next[idx] = value

                                            // Sem botão "adicionar": ao preencher a última linha, cria uma nova linha vazia.
                                            if (idx === next.length - 1 && value.trim()) {
                                                next.push('')
                                            }

                                            // Mantém apenas uma linha vazia no final.
                                            const normalized = next.filter((v, i) => v.trim() || i === next.length - 1)
                                            setWhatsappFollowupDateTimes(normalized.length ? normalized : [''])
                                        }}
                                    />
                                    {idx < whatsappFollowupDateTimes.length - 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = whatsappFollowupDateTimes.filter((_, i) => i !== idx)
                                                setWhatsappFollowupDateTimes(next.length ? next : [''])
                                            }}
                                            style={{ ...btnSmall, background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '6px 10px' }}
                                        >
                                            <X size={14} /> Remover
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div>
                            <label style={labelStyle}>Mensagem de follow-up</label>
                            <textarea
                                style={textareaStyle}
                                value={whatsappFollowupMessageTemplate}
                                onChange={e => setWhatsappFollowupMessageTemplate(e.target.value)}
                                placeholder="Oi {nome_lead}! Passando para saber se posso te ajudar com mais detalhes."
                            />
                        </div>
                        <p style={{ fontSize: '0.72rem', color: '#888', marginTop: 6 }}>
                            Com o resgate ativo, você define apenas data e hora. Sem agenda preenchida, o sistema não salva.
                        </p>
                    </div>
                )}
            </div>

            {/* Save Button (Bottom) */}
            <div style={{ textAlign: 'right', paddingBottom: 40 }}>
                <button
                    onClick={saveConfig}
                    disabled={saving}
                    style={{
                        ...btnSmall,
                        padding: '12px 32px',
                        fontSize: '0.92rem',
                        opacity: saving ? 0.6 : 1,
                        background: saved ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #b8945f, #d4b87a)'
                    }}
                >
                    {saving ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> :
                     saved ? <><Check size={18} /> Configurações Salvas!</> :
                     <><Save size={18} /> Salvar Todas as Configurações</>}
                </button>
            </div>
        </div>
    )
}

