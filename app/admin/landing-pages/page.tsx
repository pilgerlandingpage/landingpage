'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, ExternalLink, Copy, Trash2, Loader2, Check, MessageSquare, X, Save, User, Search } from 'lucide-react'
import Link from 'next/link'

interface LandingPage {
    id: string
    slug: string
    title: string
    status: string
    page_views: number
    content: any
    primary_color: string
    created_at: string
    ai_context?: string | null
    assigned_broker_id?: string | null
    property?: { title: string } | null
}

interface Broker {
    id: string
    name: string
    phone?: string | null
    is_active?: boolean
    source?: 'whatsapp_instance' | 'virtual_broker'
    instance_name?: string | null
    instance_status?: string | null
}

const TEMPLATES = [
    { id: 'brava-concetto', name: 'Brava Concetto', description: 'Estilo Clarus Construtora — tons terrosos, quiet luxury', color: '#948369' },
    { id: 'modern', name: 'Modern Luxury', description: 'Design moderno escuro com acentos dourados', color: '#c9a96e' },
    { id: 'classic', name: 'Classic', description: 'Layout clássico elegante', color: '#b8945f' },
    { id: 'lead-capture', name: 'Lead Capture', description: 'Focado em conversão e captura de leads', color: '#4ade80' },
    { id: 'urgency', name: 'Urgência', description: 'Gatilhos de escassez e urgência', color: '#ef4444' },
    { id: 'social-proof', name: 'Prova Social', description: 'Depoimentos e credibilidade', color: '#3b82f6' },
    { id: 'vip', name: 'VIP Exclusivo', description: 'Experiência premium e exclusiva', color: '#a855f7' },
]

type StageFilter = 'all' | 'launch' | 'construction' | 'ready'

const STAGE_TABS: Array<{ id: StageFilter; label: string }> = [
    { id: 'all', label: 'Todas' },
    { id: 'launch', label: 'Lançamentos' },
    { id: 'construction', label: 'Em construção' },
    { id: 'ready', label: 'Prontas' },
]

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function normalizeFilterText(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function stageFromText(value: unknown): Exclude<StageFilter, 'all'> | null {
    const text = normalizeFilterText(value)
    if (!text) return null
    if (/\b(launch|lancamento|pre lancamento|pre-lancamento|na planta)\b/.test(text)) return 'launch'
    if (/\b(construction|em construcao|construcao|obra|em obra|entrega prevista)\b/.test(text)) return 'construction'
    if (/\b(ready|pronto|pronta|pronto para morar|entregue)\b/.test(text)) return 'ready'
    return null
}

function getPageStage(page: LandingPage): Exclude<StageFilter, 'all'> {
    const content = asRecord(page.content)
    const development = asRecord(content.development)
    const explicit = stageFromText(
        development.stage
        ?? development.status
        ?? development.constructionStatus
        ?? development.construction_status
        ?? content.development_stage
        ?? content.stage
    )
    if (explicit) return explicit

    return stageFromText([
        page.title,
        content.custom_title,
        content.custom_description,
        development.name,
        development.tagline,
        development.description,
        development.stageLabel,
        development.stage_label,
    ].filter(Boolean).join(' ')) || 'ready'
}

function pageMatchesSearch(page: LandingPage, query: string) {
    const search = normalizeFilterText(query).trim()
    if (!search) return true

    const content = asRecord(page.content)
    const development = asRecord(content.development)
    const haystack = normalizeFilterText([
        page.title,
        page.slug,
        page.status,
        page.property?.title,
        development.name,
        development.locationName,
        development.location_name,
        development.city,
        development.priceRange,
        development.price_range,
        development.stageLabel,
        development.stage_label,
        content.custom_title,
        content.custom_description,
    ].filter(Boolean).join(' '))

    return haystack.includes(search)
}

export default function LandingPagesAdmin() {
    const [pages, setPages] = useState<LandingPage[]>([])
    const [loading, setLoading] = useState(true)
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
    const [brokers, setBrokers] = useState<Broker[]>([])
    const [stageFilter, setStageFilter] = useState<StageFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')

    // AI Context Modal State
    const [editingContextId, setEditingContextId] = useState<string | null>(null)
    const [contextText, setContextText] = useState('')
    const [savingContext, setSavingContext] = useState(false)

    const supabase = createClient()

    const fetchPages = async () => {
        const { data } = await supabase
            .from('landing_pages')
            .select('*, property:properties(title)')
            .order('created_at', { ascending: false })

        if (data) setPages(data as LandingPage[])
        setLoading(false)
    }

    const fetchBrokers = async () => {
        try {
            const response = await fetch('/api/admin/landing-page-brokers', { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.error || 'Erro ao carregar corretores')

            setBrokers(Array.isArray(payload?.data) ? payload.data : [])
        } catch (error) {
            console.warn('Error loading broker instances:', error)
            const { data } = await supabase
                .from('virtual_brokers')
                .select('id, name, phone')
                .eq('is_active', true)
                .order('name')
            if (data) setBrokers(data.map(broker => ({ ...broker, source: 'virtual_broker' })))
        }
    }

    useEffect(() => {
        fetchPages()
        fetchBrokers()

        const subscription = supabase
            .channel('landing-pages-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'landing_pages' }, fetchPages)
            .subscribe()

        return () => { subscription.unsubscribe() }
    }, [])

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta landing page?')) {
            await supabase.from('landing_pages').delete().eq('id', id)
            fetchPages()
        }
    }

    const copyLink = (slug: string) => {
        const url = `${window.location.origin}/${slug}`
        navigator.clipboard.writeText(url)
        setCopiedSlug(slug)
        setTimeout(() => setCopiedSlug(null), 2000)
    }

    const openContextModal = (page: LandingPage) => {
        setContextText(page.ai_context || '')
        setEditingContextId(page.id)
    }

    const saveContext = async () => {
        if (!editingContextId) return
        setSavingContext(true)
        try {
            await supabase
                .from('landing_pages')
                .update({ ai_context: contextText })
                .eq('id', editingContextId)

            setEditingContextId(null)
            fetchPages() // Refresh to get updated data
        } catch (error) {
            console.error('Error saving context:', error)
            alert('Erro ao salvar as instruções.')
        } finally {
            setSavingContext(false)
        }
    }

    const handleBrokerChange = async (pageId: string, brokerId: string | null) => {
        try {
            await supabase
                .from('landing_pages')
                .update({ assigned_broker_id: brokerId || null })
                .eq('id', pageId)

            fetchPages()
        } catch (error) {
            console.error('Error updating broker:', error)
            alert('Erro ao atualizar o corretor.')
        }
    }

    const brokerGroups = {
        whatsapp: brokers.filter(broker => broker.source === 'whatsapp_instance'),
        others: brokers.filter(broker => broker.source !== 'whatsapp_instance'),
    }

    const formatBrPhone = (phone?: string | null) => {
        const digits = String(phone || '').replace(/\D/g, '')
        if (!digits) return ''
        if (digits.length === 13 && digits.startsWith('55')) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
        if (digits.length === 12 && digits.startsWith('55')) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
        return `+${digits}`
    }

    const statusLabel = (status?: string | null) => {
        const normalized = String(status || '').toLowerCase()
        if (normalized === 'connected' || normalized === 'open') return 'online'
        if (normalized === 'connecting') return 'conectando'
        if (normalized === 'disconnected') return 'offline'
        return null
    }

    const brokerOptionLabel = (broker: Broker) => {
        const phone = formatBrPhone(broker.phone)
        return phone ? `${broker.name} - ${phone}` : broker.name
    }

    const brokerDetail = (broker?: Broker) => {
        if (!broker) return ''
        const details = [
            statusLabel(broker.instance_status) ? `WhatsApp ${statusLabel(broker.instance_status)}` : null,
            broker.instance_name || null,
        ].filter(Boolean)
        return details.join(' - ')
    }

    const getTemplateInfo = (content: any) => {
        const templateId = content?.template || 'classic'
        return TEMPLATES.find(t => t.id === templateId) || TEMPLATES[2]
    }

    const stageCounts = useMemo(() => {
        return pages.reduce<Record<StageFilter, number>>((acc, page) => {
            const stage = getPageStage(page)
            acc.all += 1
            acc[stage] += 1
            return acc
        }, { all: 0, launch: 0, construction: 0, ready: 0 })
    }, [pages])

    const filteredPages = useMemo(() => {
        return pages.filter(page => {
            const matchesStage = stageFilter === 'all' || getPageStage(page) === stageFilter
            return matchesStage && pageMatchesSearch(page, searchQuery)
        })
    }, [pages, stageFilter, searchQuery])

    const hasActiveFilters = stageFilter !== 'all' || Boolean(searchQuery.trim())

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 8px' }}>
            <div className="admin-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <FileText className="text-gold" size={28} /> Landing Pages
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                        Gerencie suas landing pages personalizadas.
                    </p>
                </div>
            </div>

            {/* ═══════════ PAGES LIST ═══════════ */}
            <div>
                <h3 style={{
                    fontSize: '1rem', color: 'var(--text-secondary)',
                    marginBottom: 16, fontFamily: 'Inter, sans-serif', fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <span>
                        Páginas Criadas ({hasActiveFilters ? `${filteredPages.length} de ${pages.length}` : pages.length})
                    </span>
                </h3>

                {!loading && pages.length > 0 && (
                    <div className="landing-admin-filters">
                        <label className="landing-admin-search">
                            <Search size={15} />
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Buscar por título, slug, cidade ou empreendimento..."
                            />
                        </label>

                        <div className="landing-admin-tabs" role="tablist" aria-label="Filtrar landing pages por estágio">
                            {STAGE_TABS.map(tab => {
                                const active = stageFilter === tab.id
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        className={`landing-admin-tab ${active ? 'is-active' : ''}`}
                                        onClick={() => setStageFilter(tab.id)}
                                    >
                                        <span>{tab.label}</span>
                                        <strong>{stageCounts[tab.id]}</strong>
                                    </button>
                                )
                            })}
                        </div>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                className="landing-admin-clear"
                                onClick={() => {
                                    setStageFilter('all')
                                    setSearchQuery('')
                                }}
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="chart-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px', display: 'block' }} />
                        <p>Carregando páginas...</p>
                    </div>
                ) : pages.length === 0 ? (
                    <div className="chart-card" style={{ padding: 48, textAlign: 'center' }}>
                        <FileText size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: '1.1rem' }}>Nenhuma landing page encontrada.</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
                            As landing pages criadas aparecerão aqui.
                        </p>
                    </div>
                ) : filteredPages.length === 0 ? (
                    <div className="chart-card" style={{ padding: 42, textAlign: 'center' }}>
                        <Search size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: '1.05rem' }}>
                            Nenhuma landing page encontrada para este filtro.
                        </p>
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                                setStageFilter('all')
                                setSearchQuery('')
                            }}
                        >
                            Limpar filtros
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {filteredPages.map((page) => {
                            const template = getTemplateInfo(page.content)
                            const selectedBroker = brokers.find(broker => broker.id === page.assigned_broker_id)
                            const pageStage = getPageStage(page)
                            const stageLabel = STAGE_TABS.find(tab => tab.id === pageStage)?.label || 'Prontas'
                            return (
                                <div
                                    key={page.id}
                                    className="chart-card"
                                    style={{
                                        padding: '20px 24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                        borderLeft: `3px solid ${template.color}`,
                                    }}
                                >
                                    {/* Template indicator */}
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 8,
                                        background: `${template.color}15`,
                                        border: `1px solid ${template.color}30`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <FileText size={20} style={{ color: template.color }} />
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                            <h4 style={{
                                                fontSize: '1.05rem', color: 'var(--text-primary)',
                                                margin: 0, fontFamily: 'Inter, sans-serif', fontWeight: 600,
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                minWidth: 0,
                                            }}>
                                                {page.title || 'Sem título'}
                                            </h4>
                                            <span style={{
                                                fontSize: '0.65rem', padding: '2px 8px',
                                                borderRadius: 4,
                                                background: `${template.color}15`,
                                                color: template.color,
                                                border: `1px solid ${template.color}30`,
                                                fontWeight: 600, textTransform: 'uppercase',
                                                letterSpacing: 0, flexShrink: 0,
                                            }}>
                                                {template.name}
                                            </span>
                                            <span className="landing-admin-stage-badge">
                                                {stageLabel}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex', gap: 16, fontSize: '0.8rem',
                                            color: 'var(--text-muted)', flexWrap: 'wrap',
                                            alignItems: 'center'
                                        }}>
                                            <span>/{page.slug}</span>
                                            <span>•</span>
                                            <span>{page.page_views || 0} views</span>
                                            <span>•</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                                <User size={12} />
                                                <div style={{ display: 'grid', gap: 3, minWidth: 220, maxWidth: 360 }}>
                                                <select
                                                    value={page.assigned_broker_id || ''}
                                                    onChange={(e) => handleBrokerChange(page.id, e.target.value)}
                                                    title="Corretor que recebera os leads desta landing page"
                                                    style={{
                                                        background: 'transparent',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-secondary)',
                                                        padding: '3px 6px',
                                                        outline: 'none',
                                                        width: '100%'
                                                    }}
                                                >
                                                    <option value="">Escala de Plantão (Auto)</option>
                                                    {brokerGroups.whatsapp.length > 0 && (
                                                        <optgroup label="Corretores com WhatsApp">
                                                            {brokerGroups.whatsapp.map(broker => (
                                                                <option key={broker.id} value={broker.id}>{brokerOptionLabel(broker)}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {brokerGroups.others.length > 0 && (
                                                        <optgroup label="Outros corretores">
                                                            {brokerGroups.others.map(broker => (
                                                                <option key={broker.id} value={broker.id}>{brokerOptionLabel(broker)}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                </select>
                                                {brokerDetail(selectedBroker) && (
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {brokerDetail(selectedBroker)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                        <button
                                            className="btn btn-outline btn-sm"
                                            title="Instruções e Treinamento da IA"
                                            onClick={() => openContextModal(page)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: page.ai_context ? 'var(--gold)' : 'var(--border)', color: page.ai_context ? 'var(--gold)' : 'inherit' }}
                                        >
                                            <MessageSquare size={15} /> IA
                                        </button>

                                        <Link href={`/${page.slug}`} target="_blank">
                                            <button className="btn btn-outline btn-sm" title="Ver ao Vivo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <ExternalLink size={15} /> Ver
                                            </button>
                                        </Link>

                                        <button
                                            className="btn btn-outline btn-sm"
                                            title="Copiar Link"
                                            onClick={() => copyLink(page.slug)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            {copiedSlug === page.slug ? (
                                                <><Check size={15} style={{ color: 'var(--success)' }} /> Copiado!</>
                                            ) : (
                                                <><Copy size={15} /> Link</>
                                            )}
                                        </button>

                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={() => handleDelete(page.id)}
                                            title="Excluir"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                borderColor: 'var(--border)',
                                            }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Modal de Instruções da IA */}
            {editingContextId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 99999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20
                }}>
                    <div style={{
                        backgroundColor: '#111', width: '100%', maxWidth: 600,
                        borderRadius: 16, border: '1px solid var(--border)',
                        overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', color: '#fff' }}>
                                <MessageSquare style={{ color: '#c9a96e' }} size={20} />
                                Instruções para a Inteligência Artificial
                            </h3>
                            <button onClick={() => setEditingContextId(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: 24, flex: 1, backgroundColor: '#111' }}>
                            <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#ddd', lineHeight: '1.6' }}>
                                Cole aqui o texto com gatilhos mentais, diferenciais, FAQ e regras de ouro deste empreendimento exclusivo.
                                Quando o cliente conversar com o chat desta Landing Page, a IA lerá essas instruções para atender melhor.
                            </p>

                            <textarea
                                value={contextText}
                                onChange={(e) => setContextText(e.target.value)}
                                placeholder="Ex: O valor de entrada é 20%. Foque na vista para o mar e no design neoclássico. Se perguntarem sobre permuta, diga que analisamos caso a caso..."
                                style={{
                                    width: '100%', height: 250, resize: 'none',
                                    backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12, padding: 20, color: '#fff',
                                    fontFamily: 'inherit', fontSize: '1rem', lineHeight: '1.6',
                                    outline: 'none',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                                }}
                            />
                        </div>

                        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 12, backgroundColor: '#1a1a1a' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setEditingContextId(null)}
                                disabled={savingContext}
                                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={saveContext}
                                disabled={savingContext}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                {savingContext ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Salvar Instruções
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .landing-admin-filters {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 10px;
                    margin: -2px 0 18px;
                }

                .landing-admin-search {
                    min-height: 40px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0 12px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.02);
                    color: var(--text-muted);
                }

                .landing-admin-search input {
                    width: 100%;
                    min-width: 0;
                    border: 0;
                    outline: 0;
                    background: transparent;
                    color: var(--text-primary);
                    font: inherit;
                    font-size: 0.86rem;
                    letter-spacing: 0;
                }

                .landing-admin-search input::placeholder {
                    color: var(--text-muted);
                }

                .landing-admin-tabs {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .landing-admin-tab {
                    min-height: 38px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 0 12px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font: inherit;
                    font-size: 0.82rem;
                    letter-spacing: 0;
                    white-space: nowrap;
                }

                .landing-admin-tab span {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .landing-admin-tab strong {
                    min-width: 24px;
                    height: 22px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 7px;
                    border-radius: 999px;
                    background: rgba(148, 131, 105, 0.12);
                    color: var(--text-primary);
                    font-size: 0.72rem;
                    font-weight: 700;
                    letter-spacing: 0;
                }

                .landing-admin-tab.is-active {
                    border-color: var(--gold);
                    background: rgba(148, 131, 105, 0.12);
                    color: var(--text-primary);
                }

                .landing-admin-clear {
                    min-height: 38px;
                    padding: 0 12px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font: inherit;
                    font-size: 0.82rem;
                    letter-spacing: 0;
                }

                .landing-admin-stage-badge {
                    flex-shrink: 0;
                    padding: 2px 8px;
                    border: 1px solid rgba(148, 131, 105, 0.28);
                    border-radius: 4px;
                    background: rgba(148, 131, 105, 0.08);
                    color: var(--text-secondary);
                    font-size: 0.65rem;
                    font-weight: 600;
                    letter-spacing: 0;
                    white-space: nowrap;
                }

                @media (min-width: 920px) {
                    .landing-admin-filters {
                        grid-template-columns: minmax(280px, 1fr) auto auto;
                        align-items: center;
                    }

                    .landing-admin-tabs {
                        justify-content: flex-end;
                    }
                }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
