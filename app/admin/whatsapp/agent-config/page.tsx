'use client'

import { useState, useEffect } from 'react'
import { Building2, Clock, MapPin, FileText, Map, Save, Plus, X, Loader2, Check } from 'lucide-react'

interface WorkingHours {
    seg_sex_inicio: string
    seg_sex_fim: string
    sab_inicio: string
    sab_fim: string
    dom: string
}

export default function AgentConfigPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Empresa
    const [companyName, setCompanyName] = useState('Pilger Imóveis')
    const [companyCreci, setCompanyCreci] = useState('')
    const [companyPhone, setCompanyPhone] = useState('')
    const [companyDescription, setCompanyDescription] = useState('')

    // Localização
    const [companyAddress, setCompanyAddress] = useState('')
    const [companyMapsLink, setCompanyMapsLink] = useState('')

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
        'Vou te passar pro nosso especialista que vai te ajudar com todos os detalhes. Ele já tem todas as suas informações 😊'
    )
    const [transferMsgBroker, setTransferMsgBroker] = useState(
        '🔔 *Lead qualificado transferido!*\n\n👤 Nome: {nome_lead}\n📱 Telefone: {telefone}\n🏠 Interesse: {interesse}\n💰 Orçamento: {orcamento}\n📍 Região: {regiao}\n\n⚡ Entre em contato agora!'
    )

    useEffect(() => {
        loadConfig()
    }, [])

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
                if (c.agent_company_address) setCompanyAddress(c.agent_company_address)
                if (c.agent_company_maps_link) setCompanyMapsLink(c.agent_company_maps_link)
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
            const res = await fetch('/api/admin/whatsapp/agent-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config: {
                        agent_company_name: companyName,
                        agent_company_creci: companyCreci,
                        agent_company_phone: companyPhone,
                        agent_company_description: companyDescription,
                        agent_company_address: companyAddress,
                        agent_company_maps_link: companyMapsLink,
                        agent_working_hours: JSON.stringify(hours),
                        agent_regions: JSON.stringify(regions),
                        agent_required_documents: JSON.stringify(documents),
                        agent_transfer_message_lead: transferMsgLead,
                        agent_transfer_message_broker: transferMsgBroker,
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
                        ⚙️ Configuração do Agente IA
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

            {/* ═══ EMPRESA ═══ */}
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

            {/* ═══ LOCALIZAÇÃO ═══ */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <MapPin size={20} color="#ef4444" />
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Localização</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Tag: {'{localizacao}'}</span>
                </div>
                <div style={gridStyle}>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Endereço Completo</label>
                        <input style={inputStyle} value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="Av. Atlântica, 2000 - Balneário Camboriú/SC" />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Link do Google Maps</label>
                        <input style={inputStyle} value={companyMapsLink} onChange={e => setCompanyMapsLink(e.target.value)} placeholder="https://maps.google.com/..." />
                        <p style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 4 }}>Cole o link de compartilhamento do Google Maps do seu escritório</p>
                    </div>
                </div>
            </div>

            {/* ═══ HORÁRIO DE ATENDIMENTO ═══ */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <Clock size={20} color="#3b82f6" />
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Horário de Atendimento</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Tag: {'{horario}'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                        <label style={labelStyle}>Segunda a Sexta — Início</label>
                        <input type="time" style={inputStyle} value={hours.seg_sex_inicio} onChange={e => setHours({ ...hours, seg_sex_inicio: e.target.value })} />
                    </div>
                    <div>
                        <label style={labelStyle}>Segunda a Sexta — Fim</label>
                        <input type="time" style={inputStyle} value={hours.seg_sex_fim} onChange={e => setHours({ ...hours, seg_sex_fim: e.target.value })} />
                    </div>
                    <div />
                    <div>
                        <label style={labelStyle}>Sábado — Início</label>
                        <input type="time" style={inputStyle} value={hours.sab_inicio} onChange={e => setHours({ ...hours, sab_inicio: e.target.value })} />
                    </div>
                    <div>
                        <label style={labelStyle}>Sábado — Fim</label>
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

            {/* ═══ REGIÕES ═══ */}
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
                            📍 {r}
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

            {/* ═══ DOCUMENTOS ═══ */}
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
                            📄 {d}
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

            {/* ═══ TRANSFERÊNCIA ═══ */}
            <div style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#333', margin: 0 }}>Mensagens de Transferência</h2>
                    <span style={{ fontSize: '0.72rem', color: '#aaa', marginLeft: 'auto' }}>Tag: {'{transferir}'}</span>
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
