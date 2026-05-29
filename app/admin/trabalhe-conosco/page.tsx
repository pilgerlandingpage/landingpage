'use client'

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
    BriefcaseBusiness,
    CheckCircle2,
    Clock,
    Loader2,
    MessageSquare,
    RefreshCw,
    Save,
    Send,
    ShieldCheck,
    Sparkles,
    Trash2,
    Users,
} from 'lucide-react'
import {
    formatPhoneDisplay,
    potentialLabel,
    segmentLabel,
    statusLabel,
    triggerTypeLabel,
} from '@/lib/broker-candidates/utils'

type CandidateRow = Record<string, any>
type RuleRow = Record<string, any>
type MessageRow = Record<string, any>
type LogRow = Record<string, any>
type EventRow = Record<string, any>

const defaultMessage = [
    'Ola {nome}, recebemos seu cadastro para trabalhar com a Pilger.',
    '',
    'Nosso agente de recrutamento vai analisar seu perfil e nossa equipe acompanha a proxima etapa.',
    '',
    'Enquanto isso, pode acompanhar nosso ecossistema por aqui: {link_trabalhe_conosco}',
].join('\n')

function kpiValue(value: unknown) {
    const number = Number(value || 0)
    return Number.isFinite(number) ? number.toLocaleString('pt-BR') : '0'
}

function formatShortDate(value?: string) {
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

function candidateActivity(events: EventRow[], candidate: CandidateRow) {
    if (!candidate?.visitor_id) return []
    return events.filter(event => event.visitor_id === candidate.visitor_id)
}

function scoreTone(level: string): CSSProperties {
    const tones: Record<string, { color: string; bg: string }> = {
        hot: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
        warm: { color: '#eab308', bg: 'rgba(234,179,8,0.14)' },
        review: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
        cold: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    }
    const tone = tones[level] || tones.cold
    return {
        background: tone.bg,
        border: `1px solid ${tone.color}45`,
        color: tone.color,
    }
}

function SectionTitle({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
    return (
        <div style={{ alignItems: 'center', display: 'flex', gap: 10, justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ alignItems: 'center', color: 'var(--text-primary)', display: 'flex', fontSize: '1.02rem', gap: 8, margin: 0 }}>
                {icon}
                {title}
            </h2>
            {action}
        </div>
    )
}

export default function AdminTrabalheConoscoPage() {
    const [candidates, setCandidates] = useState<CandidateRow[]>([])
    const [rules, setRules] = useState<RuleRow[]>([])
    const [messages, setMessages] = useState<MessageRow[]>([])
    const [logs, setLogs] = useState<LogRow[]>([])
    const [events, setEvents] = useState<EventRow[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [message, setMessage] = useState('')
    const [activeTab, setActiveTab] = useState<'candidates' | 'messages' | 'logs'>('candidates')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [ruleForm, setRuleForm] = useState({
        name: 'Boas-vindas apos cadastro',
        trigger_type: 'immediate',
        segment: 'all',
        offset_minutes: '0',
        fixed_datetime: '',
        message_template: defaultMessage,
    })

    const selectedCandidate = selectedId
        ? candidates.find(candidate => candidate.id === selectedId) || null
        : candidates[0] || null

    async function load() {
        setLoading(true)
        setMessage('')
        try {
            const response = await fetch('/api/admin/broker-candidates', { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao carregar candidatos.')
            setCandidates(data.candidates || [])
            setRules(data.rules || [])
            setMessages(data.messages || [])
            setLogs(data.logs || [])
            setEvents(data.events || [])
            setSelectedId(prev => prev || data.candidates?.[0]?.id || null)
        } catch (err: any) {
            setMessage(err?.message || 'Erro ao carregar candidatos.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void load()
    }, [])

    const stats = useMemo(() => ({
        total: candidates.length,
        hot: candidates.filter(candidate => candidate.potential_level === 'hot' || Number(candidate.potential_score || 0) >= 80).length,
        review: candidates.filter(candidate => ['new', 'in_review', 'potential'].includes(candidate.status)).length,
        approved: candidates.filter(candidate => candidate.status === 'approved').length,
        pendingMessages: messages.filter(row => row.status === 'pending').length,
        failedMessages: messages.filter(row => row.status === 'failed').length,
    }), [candidates, messages])

    const updateCandidateStatus = async (candidateId: string, status: string) => {
        setMessage('')
        const response = await fetch(`/api/admin/broker-candidates/${candidateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        })
        const data = await response.json()
        if (!response.ok) {
            setMessage(data.error || 'Erro ao atualizar status.')
            return
        }
        await load()
    }

    const sendNextMessage = async (candidateId: string) => {
        setMessage('')
        const response = await fetch(`/api/admin/broker-candidates/${candidateId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_next_message' }),
        })
        const data = await response.json()
        if (!response.ok) {
            setMessage(data.error || 'Erro ao enviar mensagem.')
            return
        }
        await load()
    }

    const processQueue = async () => {
        setProcessing(true)
        setMessage('')
        try {
            const response = await fetch('/api/admin/broker-candidates/process-queue', { method: 'POST' })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao processar fila.')
            setMessage(`Fila processada: ${data.results?.length || 0} itens avaliados.`)
            await load()
        } catch (err: any) {
            setMessage(err?.message || 'Erro ao processar fila.')
        } finally {
            setProcessing(false)
        }
    }

    const saveRule = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setSaving(true)
        setMessage('')
        try {
            const response = await fetch('/api/admin/broker-candidates/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...ruleForm,
                    offset_minutes: Number(ruleForm.offset_minutes || 0),
                    fixed_datetime: ruleForm.fixed_datetime || null,
                    metadata: {
                        source: 'broker-candidate-admin',
                        interaction_type: 'none',
                        tracking_enabled: true,
                        tracking_tag: 'broker_candidate_admin_rule',
                    },
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao salvar automacao.')
            setMessage('Automacao criada.')
            setRuleForm(prev => ({ ...prev, name: '', message_template: defaultMessage }))
            await load()
        } catch (err: any) {
            setMessage(err?.message || 'Erro ao salvar automacao.')
        } finally {
            setSaving(false)
        }
    }

    const toggleRule = async (rule: RuleRow) => {
        const response = await fetch(`/api/admin/broker-candidates/rules/${rule.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !rule.is_active }),
        })
        const data = await response.json()
        if (!response.ok) {
            setMessage(data.error || 'Erro ao atualizar automacao.')
            return
        }
        await load()
    }

    const deleteRule = async (rule: RuleRow) => {
        if (!window.confirm(`Remover a automacao "${rule.name}"?`)) return
        const response = await fetch(`/api/admin/broker-candidates/rules/${rule.id}`, { method: 'DELETE' })
        const data = await response.json()
        if (!response.ok) {
            setMessage(data.error || 'Erro ao remover automacao.')
            return
        }
        await load()
    }

    const selectedEvents = selectedCandidate ? candidateActivity(events, selectedCandidate) : []

    return (
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 8px 56px' }}>
            <div className="admin-header">
                <div>
                    <h1 style={{ alignItems: 'center', display: 'flex', gap: 12 }}>
                        <BriefcaseBusiness className="text-gold" size={28} />
                        Trabalhe Conosco
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                        Candidatos corretores, score do agente, tracking do ecossistema e regua de mensagens pelo WhatsApp.
                    </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn btn-outline" onClick={() => load()} disabled={loading}>
                        {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                        Atualizar
                    </button>
                    <button className="btn btn-primary" onClick={processQueue} disabled={processing}>
                        {processing ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                        Processar fila
                    </button>
                </div>
            </div>

            {message && (
                <div className="chart-card" style={{ padding: 14, marginBottom: 18, color: 'var(--text-secondary)' }}>
                    {message}
                </div>
            )}

            <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', marginBottom: 18 }}>
                <Stat icon={<Users size={18} />} label="Cadastros" value={stats.total} />
                <Stat icon={<Sparkles size={18} />} label="Alto potencial" value={stats.hot} />
                <Stat icon={<Clock size={18} />} label="Em analise" value={stats.review} />
                <Stat icon={<ShieldCheck size={18} />} label="Aprovados" value={stats.approved} />
                <Stat icon={<MessageSquare size={18} />} label="Pendentes" value={stats.pendingMessages} />
                <Stat icon={<RefreshCw size={18} />} label="Falhas" value={stats.failedMessages} />
            </section>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {[
                    ['candidates', 'Candidatos'],
                    ['messages', 'Mensagens'],
                    ['logs', 'Logs'],
                ].map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        className={`btn ${activeTab === key ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setActiveTab(key as any)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="chart-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader2 className="spin" size={28} style={{ margin: '0 auto 12px' }} />
                    Carregando candidatos...
                </div>
            ) : activeTab === 'candidates' ? (
                <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 18, alignItems: 'start' }}>
                    <div className="chart-card" style={{ padding: 18, overflowX: 'auto' }}>
                        <SectionTitle icon={<Users size={18} />} title="Candidatos cadastrados" />
                        <table style={{ borderCollapse: 'collapse', minWidth: 980, width: '100%' }}>
                            <thead>
                                <tr style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    <th style={thStyle}>Nome</th>
                                    <th style={thStyle}>Contato</th>
                                    <th style={thStyle}>Perfil</th>
                                    <th style={thStyle}>Score</th>
                                    <th style={thStyle}>Atividade</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={thStyle}>Acoes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {candidates.map(candidate => {
                                    const activity = candidateActivity(events, candidate)
                                    const social = candidate.social_links || {}
                                    const socialCount = Object.values(social).filter(Boolean).length
                                    return (
                                        <tr key={candidate.id} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td style={tdStyle}>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedId(candidate.id)}
                                                    style={{ background: 'none', border: 0, color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 900, padding: 0, textAlign: 'left' }}
                                                >
                                                    {candidate.full_name}
                                                </button>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginTop: 4 }}>{candidate.city || 'Cidade nao informada'} {candidate.state || ''}</div>
                                            </td>
                                            <td style={tdStyle}>
                                                <div>{formatPhoneDisplay(candidate.phone)}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{candidate.email}</div>
                                            </td>
                                            <td style={tdStyle}>
                                                {candidate.broker_type || 'autonomo'}
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{candidate.experience_years || 0} anos · {socialCount} redes</div>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ ...pillStyle, ...scoreTone(candidate.potential_level) }}>
                                                    {potentialLabel(candidate.potential_level)} · {candidate.potential_score}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <strong style={{ color: 'var(--text-primary)' }}>{activity.length}</strong>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{formatShortDate(activity[0]?.created_at || candidate.last_activity_at)}</div>
                                            </td>
                                            <td style={tdStyle}>
                                                <select
                                                    value={candidate.status}
                                                    onChange={event => updateCandidateStatus(candidate.id, event.target.value)}
                                                    style={selectStyle}
                                                >
                                                    <option value="new">Novo</option>
                                                    <option value="in_review">Em analise</option>
                                                    <option value="potential">Potencial</option>
                                                    <option value="contacted">Contatado</option>
                                                    <option value="approved">Aprovado</option>
                                                    <option value="rejected">Recusado</option>
                                                    <option value="archived">Arquivado</option>
                                                </select>
                                            </td>
                                            <td style={tdStyle}>
                                                <button className="btn btn-outline btn-sm" onClick={() => sendNextMessage(candidate.id)}>
                                                    <Send size={14} />
                                                    Enviar prox.
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <aside className="chart-card" style={{ padding: 18, position: 'sticky', top: 20 }}>
                        <SectionTitle icon={<Sparkles size={18} />} title="Detalhe" />
                        {selectedCandidate ? (
                            <div style={{ display: 'grid', gap: 14 }}>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '1.05rem' }}>{selectedCandidate.full_name}</strong>
                                    <span style={{ color: 'var(--text-muted)' }}>{formatPhoneDisplay(selectedCandidate.phone)}</span>
                                </div>
                                <span style={{ ...pillStyle, width: 'fit-content', ...scoreTone(selectedCandidate.potential_level) }}>
                                    {potentialLabel(selectedCandidate.potential_level)} · {selectedCandidate.potential_score} pts
                                </span>
                                <Detail label="Resumo do agente" value={selectedCandidate.ai_summary || 'Sem resumo ainda.'} />
                                <Detail label="Recomendacao" value={selectedCandidate.ai_recommendation || 'Sem recomendacao.'} />
                                <Detail label="Origem" value={selectedCandidate.source || selectedCandidate.utm_source || 'Direto'} />
                                <Detail label="CRECI" value={[selectedCandidate.creci, selectedCandidate.creci_state].filter(Boolean).join(' / ') || 'Nao informado'} />
                                <div>
                                    <small style={detailLabel}>Atividade recente</small>
                                    <div style={{ display: 'grid', gap: 8, marginTop: 8, maxHeight: 220, overflow: 'auto' }}>
                                        {selectedEvents.length === 0 ? (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sem eventos vinculados.</span>
                                        ) : selectedEvents.slice(0, 12).map(event => (
                                            <div key={event.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>{event.event_type}</strong>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{formatShortDate(event.created_at)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)' }}>Nenhum candidato selecionado.</p>
                        )}
                    </aside>
                </section>
            ) : activeTab === 'messages' ? (
                <section style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 0.86fr) minmax(0, 1.14fr)', gap: 18, alignItems: 'start' }}>
                    <form onSubmit={saveRule} className="chart-card" style={{ padding: 20 }}>
                        <SectionTitle icon={<Save size={18} />} title="Nova automacao" />
                        <label style={labelStyle}>Nome<input style={inputStyle} value={ruleForm.name} onChange={event => setRuleForm(prev => ({ ...prev, name: event.target.value }))} required /></label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <label style={labelStyle}>Gatilho<select style={inputStyle} value={ruleForm.trigger_type} onChange={event => setRuleForm(prev => ({ ...prev, trigger_type: event.target.value }))}>
                                <option value="immediate">Apos cadastro</option>
                                <option value="after_signup">Depois do cadastro</option>
                                <option value="high_potential">Alto potencial</option>
                                <option value="status_changed">Mudanca de status</option>
                                <option value="return_visit">Voltou ao ecossistema</option>
                                <option value="fixed_datetime">Data fixa</option>
                                <option value="manual">Manual</option>
                            </select></label>
                            <label style={labelStyle}>Segmento<select style={inputStyle} value={ruleForm.segment} onChange={event => setRuleForm(prev => ({ ...prev, segment: event.target.value }))}>
                                <option value="all">Todos</option>
                                <option value="high_potential">Alto potencial</option>
                                <option value="medium_potential">Medio potencial</option>
                                <option value="low_potential">Baixo potencial</option>
                                <option value="creci_informed">CRECI informado</option>
                                <option value="creci_missing">CRECI pendente</option>
                                <option value="new">Novos</option>
                                <option value="in_review">Em analise</option>
                                <option value="approved">Aprovados</option>
                                <option value="contacted">Contatados</option>
                            </select></label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '0.65fr 1fr', gap: 12 }}>
                            <label style={labelStyle}>Atraso em minutos<input type="number" min="0" style={inputStyle} value={ruleForm.offset_minutes} onChange={event => setRuleForm(prev => ({ ...prev, offset_minutes: event.target.value }))} /></label>
                            <label style={labelStyle}>Data fixa<input type="datetime-local" style={inputStyle} value={ruleForm.fixed_datetime} onChange={event => setRuleForm(prev => ({ ...prev, fixed_datetime: event.target.value }))} /></label>
                        </div>
                        <label style={labelStyle}>Mensagem<textarea style={{ ...textareaStyle, minHeight: 210 }} value={ruleForm.message_template} onChange={event => setRuleForm(prev => ({ ...prev, message_template: event.target.value }))} required /></label>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5, marginTop: 10 }}>
                            Variaveis: {'{nome}'}, {'{cidade}'}, {'{creci}'}, {'{score_potencial}'}, {'{nivel_potencial}'}, {'{instagram}'}, {'{link_trabalhe_conosco}'}.
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 16 }}>
                            {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                            Salvar automacao
                        </button>
                    </form>

                    <div style={{ display: 'grid', gap: 18 }}>
                        <div className="chart-card" style={{ padding: 20 }}>
                            <SectionTitle icon={<MessageSquare size={18} />} title="Automacoes cadastradas" />
                            <div style={{ display: 'grid', gap: 10 }}>
                                {rules.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)' }}>Nenhuma automacao cadastrada.</p>
                                ) : rules.map(rule => (
                                    <div key={rule.id} style={{ border: '1px solid var(--border)', borderRadius: 10, display: 'grid', gap: 8, padding: 12 }}>
                                        <div style={{ alignItems: 'center', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                                            <strong style={{ color: 'var(--text-primary)' }}>{rule.name}</strong>
                                            <span style={{ ...pillStyle, color: rule.is_active ? '#22c55e' : '#94a3b8', borderColor: rule.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.3)' }}>
                                                {rule.is_active ? 'Ativa' : 'Pausada'}
                                            </span>
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                            {triggerTypeLabel(rule.trigger_type)} · {segmentLabel(rule.segment)} · {rule.offset_minutes || 0} min
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                                            {String(rule.message_template || '').slice(0, 180)}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => toggleRule(rule)}>
                                                {rule.is_active ? 'Pausar' : 'Ativar'}
                                            </button>
                                            <button className="btn btn-outline btn-sm" onClick={() => deleteRule(rule)}>
                                                <Trash2 size={14} />
                                                Remover
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="chart-card" style={{ padding: 20 }}>
                            <SectionTitle icon={<Clock size={18} />} title="Fila de mensagens" />
                            <div style={{ display: 'grid', gap: 8, maxHeight: 420, overflow: 'auto' }}>
                                {messages.slice(0, 80).map(row => (
                                    <div key={row.id} style={{ borderBottom: '1px solid var(--border)', display: 'grid', gap: 5, padding: '8px 0' }}>
                                        <div style={{ alignItems: 'center', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.84rem' }}>{row.target_name || row.target_phone}</strong>
                                            <span style={{ ...pillStyle }}>{statusLabel(row.status)}</span>
                                        </div>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{formatShortDate(row.scheduled_for)} · {String(row.content || '').slice(0, 120)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            ) : (
                <section className="chart-card" style={{ padding: 20 }}>
                    <SectionTitle icon={<MessageSquare size={18} />} title="Logs do agente" />
                    <div style={{ display: 'grid', gap: 8 }}>
                        {logs.map(log => (
                            <div key={log.id} style={{ borderBottom: '1px solid var(--border)', display: 'grid', gap: 4, padding: '8px 0' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{log.action}</strong>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{formatShortDate(log.created_at)} · {log.message || ''}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: unknown }) {
    return (
        <article className="chart-card" style={{ display: 'grid', gap: 6, padding: 16 }}>
            <div style={{ alignItems: 'center', color: 'var(--gold)', display: 'flex', gap: 8 }}>
                {icon}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
            </div>
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', fontSize: '1.8rem' }}>{kpiValue(value)}</strong>
        </article>
    )
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <small style={detailLabel}>{label}</small>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5, margin: '5px 0 0' }}>{value}</p>
        </div>
    )
}

const thStyle: CSSProperties = {
    padding: '10px 10px',
    textAlign: 'left',
}

const tdStyle: CSSProperties = {
    color: 'var(--text-secondary)',
    fontSize: '0.84rem',
    padding: '12px 10px',
    verticalAlign: 'top',
}

const pillStyle: CSSProperties = {
    border: '1px solid rgba(148,163,184,0.3)',
    borderRadius: 999,
    display: 'inline-flex',
    fontSize: '0.68rem',
    fontWeight: 950,
    letterSpacing: '0.04em',
    padding: '4px 8px',
    textTransform: 'uppercase',
}

const selectStyle: CSSProperties = {
    background: 'rgba(15,23,42,0.58)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    minHeight: 34,
    padding: '0 8px',
}

const labelStyle: CSSProperties = {
    color: 'var(--text-secondary)',
    display: 'grid',
    fontSize: '0.76rem',
    fontWeight: 800,
    gap: 7,
    letterSpacing: '0.05em',
    marginTop: 12,
    textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
    background: 'rgba(15,23,42,0.58)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    minHeight: 42,
    padding: '0 12px',
}

const textareaStyle: CSSProperties = {
    ...inputStyle,
    minHeight: 120,
    padding: 12,
    resize: 'vertical',
}

const detailLabel: CSSProperties = {
    color: 'var(--text-muted)',
    display: 'block',
    fontSize: '0.68rem',
    fontWeight: 950,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
}
