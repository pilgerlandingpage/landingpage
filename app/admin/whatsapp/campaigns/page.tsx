'use client'

import { useState, useEffect } from 'react'
import {
    Send, Loader2, AlertCircle, CheckCircle2, Clock, Users,
    Plus, Trash2, Pause, Play, FileText, Image, Mic, Video,
    Tag, RefreshCw, MessageSquare, Calendar, ChevronDown, ChevronUp,
    Smartphone, Search
} from 'lucide-react'

interface Instance {
    id: string
    instance_name: string
    instance_token: string
    status: string
    broker_id?: string
    virtual_brokers?: { name: string } | null
}

interface CampaignFolder {
    id: string
    name: string
    status: string
    total: number
    sent: number
    failed: number
    created_at: string
}

const MSG_TYPES = [
    { value: 'text', label: '📝 Texto', icon: FileText },
    { value: 'image', label: '🖼️ Imagem + Texto', icon: Image },
    { value: 'audio', label: '🎤 Áudio', icon: Mic },
    { value: 'video', label: '📹 Vídeo', icon: Video },
]

export default function CampaignsPage() {
    const [instances, setInstances] = useState<Instance[]>([])
    const [selectedInstance, setSelectedInstance] = useState<string>('')
    const [campaigns, setCampaigns] = useState<CampaignFolder[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingCampaigns, setLoadingCampaigns] = useState(false)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [sending, setSending] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Campaign form state
    const [msgType, setMsgType] = useState('text')
    const [msgText, setMsgText] = useState('')
    const [mediaUrl, setMediaUrl] = useState('')
    const [numbersInput, setNumbersInput] = useState('')
    const [campaignName, setCampaignName] = useState('')
    const [delayMin, setDelayMin] = useState(10)
    const [delayMax, setDelayMax] = useState(30)
    const [scheduleDate, setScheduleDate] = useState('')

    useEffect(() => { loadInstances() }, [])

    const loadInstances = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/whatsapp/instances')
            const data = await res.json()
            const connected = (data.instances || []).filter((i: Instance) => i.status === 'connected' && i.instance_token)
            setInstances(connected)
            if (connected.length > 0 && !selectedInstance) {
                setSelectedInstance(connected[0].id)
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }

    useEffect(() => {
        if (selectedInstance) loadCampaigns()
    }, [selectedInstance])

    const loadCampaigns = async () => {
        if (!selectedInstance) return
        setLoadingCampaigns(true)
        try {
            const res = await fetch(`/api/admin/whatsapp/campaigns?instance_id=${selectedInstance}`)
            const data = await res.json()
            if (data.success) {
                const folders = Array.isArray(data.campaigns) ? data.campaigns : (data.campaigns?.folders || [])
                setCampaigns(folders)
            }
        } catch { /* ignore */ }
        finally { setLoadingCampaigns(false) }
    }

    const parseNumbers = (): string[] => {
        return numbersInput
            .split(/[\n,;]+/)
            .map(n => n.replace(/\D/g, '').trim())
            .filter(n => n.length >= 10)
    }

    const sendCampaign = async () => {
        const numbers = parseNumbers()
        if (numbers.length === 0) {
            setFeedback({ type: 'error', text: 'Adicione pelo menos um número válido' })
            return
        }
        if (!msgText && msgType === 'text') {
            setFeedback({ type: 'error', text: 'Digite a mensagem da campanha' })
            return
        }

        setSending(true)
        setFeedback(null)
        try {
            const res = await fetch('/api/admin/whatsapp/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'simple',
                    instanceId: selectedInstance,
                    numbers,
                    type: msgType,
                    text: msgText,
                    file: mediaUrl || undefined,
                    folder: campaignName || `campanha_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`,
                    delayMin,
                    delayMax,
                    scheduled_for: scheduleDate ? new Date(scheduleDate).getTime() / 1000 : undefined,
                })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: `✅ ${data.message}` })
                setShowCreateForm(false)
                setNumbersInput('')
                setMsgText('')
                setMediaUrl('')
                loadCampaigns()
            } else {
                setFeedback({ type: 'error', text: `❌ ${data.message}` })
            }
        } catch (e) {
            setFeedback({ type: 'error', text: '❌ Erro de conexão' })
        } finally {
            setSending(false)
        }
    }

    const manageCampaign = async (folderId: string, action: 'stop' | 'continue' | 'delete') => {
        try {
            const res = await fetch('/api/admin/whatsapp/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'manage',
                    instanceId: selectedInstance,
                    folderId,
                    manageAction: action,
                })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: `✅ Campanha ${action === 'stop' ? 'pausada' : action === 'continue' ? 'retomada' : 'deletada'}` })
                loadCampaigns()
            }
        } catch { /* ignore */ }
    }

    const currentInstance = instances.find(i => i.id === selectedInstance)
    const parsedNumbers = parseNumbers()

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="spin" /> Carregando...
        </div>
    )

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', margin: 0 }}>
                        <Send size={26} style={{ color: 'var(--gold)' }} /> Campanhas WhatsApp
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                        Envio em massa com controle de velocidade e agendamento
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowCreateForm(!showCreateForm)}
                        style={{
                            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                            background: showCreateForm ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, var(--gold), #b8860b)',
                            color: showCreateForm ? '#ef4444' : '#000', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                        {showCreateForm ? <><ChevronUp size={16} /> Fechar</> : <><Plus size={16} /> Nova Campanha</>}
                    </button>
                </div>
            </div>

            {/* Instance Selector */}
            <div style={{
                padding: '16px 20px', borderRadius: '12px', marginBottom: '20px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            }}>
                <Smartphone size={18} style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Instância:</span>
                <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
                    style={{
                        padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', cursor: 'pointer', flex: 1, minWidth: '200px',
                    }}>
                    {instances.map(inst => (
                        <option key={inst.id} value={inst.id}>
                            {inst.virtual_brokers?.name || inst.instance_name} (✅ Conectada)
                        </option>
                    ))}
                </select>
                <button onClick={loadCampaigns} disabled={loadingCampaigns}
                    style={{
                        padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                    <RefreshCw size={14} className={loadingCampaigns ? 'spin' : ''} />
                </button>
            </div>

            {/* Feedback */}
            {feedback && (
                <div style={{
                    padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem',
                    background: feedback.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    color: feedback.type === 'success' ? '#22c55e' : '#ef4444',
                    border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                    {feedback.text}
                </div>
            )}

            {/* Create Campaign Form */}
            {showCreateForm && (
                <div style={{
                    padding: '24px', borderRadius: '14px', marginBottom: '24px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--gold-30, rgba(201,169,110,0.3))',
                }}>
                    <h2 style={{ fontSize: '1.1rem', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} style={{ color: 'var(--gold)' }} /> Nova Campanha
                    </h2>

                    <div style={{ display: 'grid', gap: '16px' }}>
                        {/* Campaign Name */}
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Nome da Campanha
                            </label>
                            <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                                placeholder="Ex: Lançamento Torre Sul - Abril 2026"
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                }} />
                        </div>

                        {/* Message Type */}
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Tipo de Mensagem
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {MSG_TYPES.map(t => (
                                    <button key={t.value} onClick={() => setMsgType(t.value)}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                                            border: `1px solid ${msgType === t.value ? 'var(--gold)' : 'var(--border)'}`,
                                            background: msgType === t.value ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                                            color: msgType === t.value ? 'var(--gold)' : 'var(--text-secondary)',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                        }}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Message Text */}
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Mensagem
                            </label>
                            <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
                                placeholder="Digite a mensagem da campanha..."
                                rows={4}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
                                    fontFamily: 'inherit', boxSizing: 'border-box',
                                }} />
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Variáveis: {'{{name}}'} para o nome do contato
                            </div>
                        </div>

                        {/* Media URL (for image/audio/video) */}
                        {msgType !== 'text' && (
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    URL da Mídia
                                </label>
                                <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
                                    placeholder="https://... (URL pública da imagem/áudio/vídeo)"
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                        color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                    }} />
                            </div>
                        )}

                        {/* Numbers */}
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Números (um por linha, ou separados por vírgula)
                            </label>
                            <textarea value={numbersInput} onChange={e => setNumbersInput(e.target.value)}
                                placeholder={"5547999999999\n5547888888888\n5511777777777"}
                                rows={5}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
                                    fontFamily: 'monospace', boxSizing: 'border-box',
                                }} />
                            <div style={{
                                fontSize: '0.78rem', color: parsedNumbers.length > 0 ? '#22c55e' : 'var(--text-muted)',
                                marginTop: '4px', fontWeight: 600,
                            }}>
                                {parsedNumbers.length > 0 ? `✅ ${parsedNumbers.length} número(s) válido(s)` : 'Nenhum número adicionado'}
                            </div>
                        </div>

                        {/* Delay & Schedule */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Delay Mín (seg)
                                </label>
                                <input type="number" value={delayMin} onChange={e => setDelayMin(Number(e.target.value))} min={5} max={120}
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                        color: 'var(--gold)', outline: 'none', fontWeight: 600, boxSizing: 'border-box',
                                    }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Delay Máx (seg)
                                </label>
                                <input type="number" value={delayMax} onChange={e => setDelayMax(Number(e.target.value))} min={10} max={300}
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                        color: 'var(--gold)', outline: 'none', fontWeight: 600, boxSizing: 'border-box',
                                    }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Agendar (opcional)
                                </label>
                                <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                        color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                                    }} />
                            </div>
                        </div>

                        {/* Send Button */}
                        <button onClick={sendCampaign} disabled={sending || parsedNumbers.length === 0}
                            style={{
                                padding: '14px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                                color: '#000', fontWeight: 700, fontSize: '1rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                opacity: sending || parsedNumbers.length === 0 ? 0.5 : 1,
                                transition: 'all 0.2s',
                            }}>
                            {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                            {sending ? 'Enviando...' : scheduleDate ? `Agendar para ${parsedNumbers.length} contatos` : `Enviar para ${parsedNumbers.length} contatos`}
                        </button>
                    </div>
                </div>
            )}

            {/* Campaigns List */}
            <div>
                <h2 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <MessageSquare size={18} style={{ color: 'var(--gold)' }} /> Campanhas Enviadas
                </h2>

                {loadingCampaigns ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <Loader2 size={20} className="spin" /> Carregando campanhas...
                    </div>
                ) : campaigns.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '40px', borderRadius: '12px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                    }}>
                        <Send size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                        <p>Nenhuma campanha encontrada nesta instância</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {campaigns.map((camp, idx) => (
                            <CampaignCard key={camp.id || idx} campaign={camp}
                                onManage={(action) => manageCampaign(camp.id, action)} />
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                .spin { animation: spin 1.2s linear infinite; }
            `}</style>
        </div>
    )
}

function CampaignCard({ campaign, onManage }: { campaign: CampaignFolder; onManage: (action: 'stop' | 'continue' | 'delete') => void }) {
    const progress = campaign.total > 0 ? Math.round((campaign.sent / campaign.total) * 100) : 0
    const isSending = campaign.status === 'sending' || campaign.status === 'active'
    const isPaused = campaign.status === 'paused' || campaign.status === 'stopped'
    const isDone = campaign.status === 'done' || campaign.status === 'completed' || progress === 100

    return (
        <div style={{
            padding: '16px 20px', borderRadius: '12px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        }}>
            {/* Status indicator */}
            <div style={{
                width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                background: isDone ? '#22c55e' : isSending ? '#f59e0b' : isPaused ? '#6366f1' : 'var(--text-muted)',
                boxShadow: isSending ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
            }} />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {campaign.name || 'Campanha sem nome'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {campaign.sent || 0}/{campaign.total || 0} enviadas
                    {campaign.failed > 0 && <span style={{ color: '#ef4444' }}> • {campaign.failed} falhas</span>}
                </div>
            </div>

            {/* Progress bar */}
            <div style={{ width: '120px', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <div style={{
                    width: `${progress}%`, height: '100%', borderRadius: '3px',
                    background: isDone ? '#22c55e' : 'var(--gold)',
                    transition: 'width 0.3s',
                }} />
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gold)', width: '35px', textAlign: 'right' }}>
                {progress}%
            </span>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {isSending && (
                    <button onClick={() => onManage('stop')} title="Pausar"
                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', cursor: 'pointer' }}>
                        <Pause size={14} />
                    </button>
                )}
                {isPaused && (
                    <button onClick={() => onManage('continue')} title="Continuar"
                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', cursor: 'pointer' }}>
                        <Play size={14} />
                    </button>
                )}
                <button onClick={() => onManage('delete')} title="Deletar"
                    style={{ padding: '6px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    )
}
