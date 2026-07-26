'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { corretorNota8Content, corretorNota8Offer } from '@/lib/products/corretor-nota-8-content'
import {
    Check,
    Copy,
    ExternalLink,
    FileText,
    Loader2,
    MessageSquare,
    Package,
    Plus,
    Save,
    Search,
    ShoppingCart,
    Trash2,
    User,
    X,
} from 'lucide-react'
import Link from 'next/link'

type LandingPageType = 'development' | 'product'
type StageFilter = 'all' | 'launch' | 'ready'

interface LandingPage {
    id: string
    slug: string
    title: string
    status: string
    page_type?: LandingPageType | null
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

type ProductDraft = {
    title: string
    slug: string
    price: string
    checkoutUrl: string
    heroImage: string
    description: string
    benefits: string
    aiContext: string
}

const TEMPLATES = [
    { id: 'corretor-nota-8', name: 'Corretor Nota 8', description: 'Landing editorial premium para venda de produto', color: '#c8a25a', type: 'product' },
    { id: 'brava-concetto', name: 'Brava Concetto', description: 'Estilo Clarus Construtora, tons terrosos e quiet luxury', color: '#948369', type: 'development' },
    { id: 'modern', name: 'Modern Luxury', description: 'Design moderno escuro com acentos dourados', color: '#c9a96e', type: 'development' },
    { id: 'classic', name: 'Classic', description: 'Layout classico elegante', color: '#b8945f', type: 'development' },
    { id: 'lead-capture', name: 'Lead Capture', description: 'Focado em conversao e captura de leads', color: '#4ade80', type: 'development' },
    { id: 'urgency', name: 'Urgencia', description: 'Gatilhos de escassez e urgencia', color: '#ef4444', type: 'development' },
    { id: 'social-proof', name: 'Prova Social', description: 'Depoimentos e credibilidade', color: '#3b82f6', type: 'development' },
    { id: 'vip', name: 'VIP Exclusivo', description: 'Experiencia premium e exclusiva', color: '#a855f7', type: 'development' },
]

const TYPE_TABS: Array<{ id: LandingPageType; label: string; icon: any; description: string }> = [
    { id: 'development', label: 'Empreendimentos', icon: FileText, description: 'Landings de imoveis e lancamentos' },
    { id: 'product', label: 'Produtos', icon: Package, description: 'Landings de venda de produtos Pilger' },
]

const STAGE_TABS: Array<{ id: StageFilter; label: string }> = [
    { id: 'all', label: 'Todas' },
    { id: 'launch', label: 'Lancamentos' },
    { id: 'ready', label: 'Prontas' },
]

const DEFAULT_PRODUCT_DRAFT: ProductDraft = {
    title: corretorNota8Offer.productName,
    slug: 'corretor-nota-8',
    price: corretorNota8Offer.priceDisplay,
    checkoutUrl: corretorNota8Offer.checkoutUrl,
    heroImage: corretorNota8Content.coverImage,
    description: corretorNota8Content.description,
    benefits: corretorNota8Content.benefits.map(item => item.title).join('\n'),
    aiContext: 'Produto: livro Corretor Nota 8, de Guilherme Pilger. Objetivo: vender o livro para corretores e profissionais imobiliarios que querem posicionamento, metodo e disciplina no alto padrao.',
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function normalizeFilterText(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function pageType(page: LandingPage): LandingPageType {
    const content = asRecord(page.content)
    if (page.page_type === 'product' || asRecord(content.product).name || content.template === 'corretor-nota-8') {
        return 'product'
    }
    return 'development'
}

function stageFromText(value: unknown): Exclude<StageFilter, 'all'> | null {
    const text = normalizeFilterText(value)
    if (!text) return null
    if (/\b(launch|construction|lancamento|pre lancamento|pre-lancamento|na planta|em construcao|construcao|obra|em obra|entrega prevista)\b/.test(text)) return 'launch'
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
    const product = asRecord(content.product)
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
        product.name,
        product.author,
        product.price,
        content.custom_title,
        content.custom_description,
    ].filter(Boolean).join(' '))

    return haystack.includes(search)
}

function listFromTextarea(value: string) {
    return value
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean)
}

export default function LandingPagesAdmin() {
    const [pages, setPages] = useState<LandingPage[]>([])
    const [loading, setLoading] = useState(true)
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
    const [brokers, setBrokers] = useState<Broker[]>([])
    const [activeType, setActiveType] = useState<LandingPageType>('development')
    const [stageFilter, setStageFilter] = useState<StageFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showProductModal, setShowProductModal] = useState(false)
    const [productDraft, setProductDraft] = useState<ProductDraft>(DEFAULT_PRODUCT_DRAFT)
    const [savingProduct, setSavingProduct] = useState(false)
    const [productError, setProductError] = useState('')

    const [editingContextId, setEditingContextId] = useState<string | null>(null)
    const [contextText, setContextText] = useState('')
    const [savingContext, setSavingContext] = useState(false)

    const supabase = createClient()

    const fetchPages = async () => {
        const { data, error } = await supabase
            .from('landing_pages')
            .select('*, property:properties(title)')
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('Error loading landing pages:', error.message)
        }

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
            fetchPages()
        } catch (error) {
            console.error('Error saving context:', error)
            alert('Erro ao salvar as instrucoes.')
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

    const updateProductDraft = (field: keyof ProductDraft, value: string) => {
        setProductDraft(prev => ({ ...prev, [field]: value }))
    }

    const createProductLandingPage = async () => {
        setSavingProduct(true)
        setProductError('')
        try {
            const response = await fetch('/api/admin/landing-pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    page_type: 'product',
                    template: 'corretor-nota-8',
                    title: productDraft.title,
                    productName: productDraft.title,
                    slug: productDraft.slug,
                    description: productDraft.description,
                    price: productDraft.price,
                    checkoutUrl: productDraft.checkoutUrl,
                    heroImage: productDraft.heroImage,
                    amenities: listFromTextarea(productDraft.benefits),
                    ai_context: productDraft.aiContext,
                    cta: 'Garantir meu exemplar',
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.error || 'Erro ao criar landing page de produto')

            setShowProductModal(false)
            setProductDraft(DEFAULT_PRODUCT_DRAFT)
            setActiveType('product')
            fetchPages()
        } catch (error: any) {
            setProductError(error?.message || 'Erro ao criar landing page de produto')
        } finally {
            setSavingProduct(false)
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
        return TEMPLATES.find(t => t.id === templateId) || TEMPLATES[3]
    }

    const typeCounts = useMemo(() => {
        return pages.reduce<Record<LandingPageType, number>>((acc, page) => {
            acc[pageType(page)] += 1
            return acc
        }, { development: 0, product: 0 })
    }, [pages])

    const stageCounts = useMemo(() => {
        return pages
            .filter(page => pageType(page) === 'development')
            .reduce<Record<StageFilter, number>>((acc, page) => {
                const stage = getPageStage(page)
                acc.all += 1
                acc[stage] += 1
                return acc
            }, { all: 0, launch: 0, ready: 0 })
    }, [pages])

    const filteredPages = useMemo(() => {
        return pages.filter(page => {
            const matchesType = pageType(page) === activeType
            const matchesStage = activeType !== 'development' || stageFilter === 'all' || getPageStage(page) === stageFilter
            return matchesType && matchesStage && pageMatchesSearch(page, searchQuery)
        })
    }, [pages, activeType, stageFilter, searchQuery])

    const activeTotal = typeCounts[activeType]
    const hasActiveFilters = Boolean(searchQuery.trim()) || (activeType === 'development' && stageFilter !== 'all')
    const activeTypeMeta = TYPE_TABS.find(tab => tab.id === activeType) || TYPE_TABS[0]

    return (
        <div className="landing-pages-admin-page">
            <div className="admin-header landing-admin-header">
                <div>
                    <h1>
                        <FileText className="text-gold" size={28} /> Landing Pages
                    </h1>
                    <p>Separe paginas de empreendimentos das paginas de venda dos produtos do Guilherme Pilger.</p>
                </div>

                {activeType === 'product' && (
                    <button type="button" className="btn btn-primary landing-admin-new-product" onClick={() => setShowProductModal(true)}>
                        <Plus size={16} />
                        Nova landing de produto
                    </button>
                )}
            </div>

            <section className="landing-admin-type-tabs" aria-label="Tipos de landing page">
                {TYPE_TABS.map(tab => {
                    const Icon = tab.icon
                    const active = activeType === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className={`landing-admin-type-tab ${active ? 'is-active' : ''}`}
                            onClick={() => {
                                setActiveType(tab.id)
                                setStageFilter('all')
                            }}
                        >
                            <Icon size={20} />
                            <span>
                                <strong>{tab.label}</strong>
                                <small>{tab.description}</small>
                            </span>
                            <em>{typeCounts[tab.id]}</em>
                        </button>
                    )
                })}
            </section>

            <div>
                <h3 className="landing-admin-list-title">
                    <span>
                        {activeTypeMeta.label} ({hasActiveFilters ? `${filteredPages.length} de ${activeTotal}` : activeTotal})
                    </span>
                </h3>

                {!loading && activeTotal > 0 && (
                    <div className="landing-admin-filters">
                        <label className="landing-admin-search">
                            <Search size={15} />
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={activeType === 'product'
                                    ? 'Buscar por titulo, slug, produto ou autor...'
                                    : 'Buscar por titulo, slug, cidade ou empreendimento...'}
                            />
                        </label>

                        {activeType === 'development' && (
                            <div className="landing-admin-tabs" role="tablist" aria-label="Filtrar landing pages por estagio">
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
                        )}

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
                    <div className="chart-card landing-admin-empty">
                        <Loader2 size={32} className="animate-spin" />
                        <p>Carregando paginas...</p>
                    </div>
                ) : activeTotal === 0 ? (
                    <div className="chart-card landing-admin-empty">
                        {activeType === 'product' ? <ShoppingCart size={48} /> : <FileText size={48} />}
                        <p>{activeType === 'product' ? 'Nenhuma landing page de produto encontrada.' : 'Nenhuma landing page de empreendimento encontrada.'}</p>
                        <span>
                            {activeType === 'product'
                                ? 'Crie a primeira pagina de venda para produtos do Guilherme Pilger.'
                                : 'As landing pages de empreendimentos criadas apareceram aqui.'}
                        </span>
                        {activeType === 'product' && (
                            <button type="button" className="btn btn-primary" onClick={() => setShowProductModal(true)}>
                                <Plus size={16} />
                                Criar produto
                            </button>
                        )}
                    </div>
                ) : filteredPages.length === 0 ? (
                    <div className="chart-card landing-admin-empty">
                        <Search size={40} />
                        <p>Nenhuma landing page encontrada para este filtro.</p>
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
                    <div className="landing-page-list">
                        {filteredPages.map((page) => {
                            const template = getTemplateInfo(page.content)
                            const selectedBroker = brokers.find(broker => broker.id === page.assigned_broker_id)
                            const currentType = pageType(page)
                            const currentProduct = asRecord(asRecord(page.content).product)
                            const pageStage = getPageStage(page)
                            const stageLabel = STAGE_TABS.find(tab => tab.id === pageStage)?.label || 'Prontas'
                            return (
                                <div
                                    key={page.id}
                                    className="chart-card landing-page-card"
                                    style={{
                                        borderLeft: `3px solid ${template.color}`,
                                    }}
                                >
                                    <div
                                        className="landing-page-template-icon"
                                        style={{
                                            background: `${template.color}15`,
                                            border: `1px solid ${template.color}30`,
                                        }}
                                    >
                                        {currentType === 'product'
                                            ? <Package size={20} style={{ color: template.color }} />
                                            : <FileText size={20} style={{ color: template.color }} />}
                                    </div>

                                    <div className="landing-page-info">
                                        <div className="landing-page-title-row">
                                            <h4 className="landing-page-title">
                                                {page.title || 'Sem titulo'}
                                            </h4>
                                            <span
                                                className="landing-page-template-badge"
                                                style={{
                                                    background: `${template.color}15`,
                                                    color: template.color,
                                                    border: `1px solid ${template.color}30`,
                                                }}
                                            >
                                                {template.name}
                                            </span>
                                            <span className="landing-admin-stage-badge">
                                                {currentType === 'product' ? 'Produto' : stageLabel}
                                            </span>
                                        </div>
                                        <div className="landing-page-meta-row">
                                            <span>/{page.slug}</span>
                                            <span>|</span>
                                            <span>{page.page_views || 0} views</span>
                                            {currentType === 'product' && currentProduct.price && (
                                                <>
                                                    <span>|</span>
                                                    <span>{currentProduct.price}</span>
                                                </>
                                            )}
                                            <span>|</span>
                                            <div className="landing-page-broker">
                                                <User size={12} />
                                                <div className="landing-page-broker-select">
                                                    <select
                                                        value={page.assigned_broker_id || ''}
                                                        onChange={(e) => handleBrokerChange(page.id, e.target.value)}
                                                        title="Responsavel que recebera leads desta landing page"
                                                    >
                                                        <option value="">Escala de Plantao (Auto)</option>
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
                                                        <span className="landing-page-broker-detail">
                                                            {brokerDetail(selectedBroker)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="landing-page-actions">
                                        <button
                                            className="btn btn-outline btn-sm"
                                            title="Instrucoes e treinamento da IA"
                                            onClick={() => openContextModal(page)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: page.ai_context ? 'var(--gold)' : 'var(--border)', color: page.ai_context ? 'var(--gold)' : 'inherit' }}
                                        >
                                            <MessageSquare size={15} /> IA
                                        </button>

                                        <Link href={`/${page.slug}`} target="_blank">
                                            <button className="btn btn-outline btn-sm" title="Ver ao vivo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <ExternalLink size={15} /> Ver
                                            </button>
                                        </Link>

                                        <button
                                            className="btn btn-outline btn-sm"
                                            title="Copiar link"
                                            onClick={() => copyLink(page.slug)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            {copiedSlug === page.slug ? (
                                                <><Check size={15} style={{ color: 'var(--success)' }} /> Copiado</>
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

            {showProductModal && (
                <div className="landing-admin-modal">
                    <div className="landing-admin-product-modal">
                        <div className="landing-admin-modal-head">
                            <div>
                                <h3><Package size={20} /> Nova landing de produto</h3>
                                <p>Use este cadastro para produtos do Guilherme Pilger, como o livro Corretor Nota 8.</p>
                            </div>
                            <button type="button" onClick={() => setShowProductModal(false)} aria-label="Fechar">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="landing-admin-form-grid">
                            <label>
                                <span>Titulo</span>
                                <input value={productDraft.title} onChange={(event) => updateProductDraft('title', event.target.value)} />
                            </label>
                            <label>
                                <span>Slug</span>
                                <input value={productDraft.slug} onChange={(event) => updateProductDraft('slug', event.target.value)} />
                            </label>
                            <label>
                                <span>Preco</span>
                                <input value={productDraft.price} onChange={(event) => updateProductDraft('price', event.target.value)} placeholder="Ex: R$ 97" />
                            </label>
                            <label>
                                <span>URL do checkout</span>
                                <input value={productDraft.checkoutUrl} onChange={(event) => updateProductDraft('checkoutUrl', event.target.value)} placeholder="https://..." />
                            </label>
                            <label className="landing-admin-wide">
                                <span>Imagem/capa</span>
                                <input value={productDraft.heroImage} onChange={(event) => updateProductDraft('heroImage', event.target.value)} />
                            </label>
                            <label className="landing-admin-wide">
                                <span>Descricao</span>
                                <textarea value={productDraft.description} onChange={(event) => updateProductDraft('description', event.target.value)} rows={3} />
                            </label>
                            <label className="landing-admin-wide">
                                <span>Beneficios, um por linha</span>
                                <textarea value={productDraft.benefits} onChange={(event) => updateProductDraft('benefits', event.target.value)} rows={4} />
                            </label>
                            <label className="landing-admin-wide">
                                <span>Contexto da IA/WhatsApp</span>
                                <textarea value={productDraft.aiContext} onChange={(event) => updateProductDraft('aiContext', event.target.value)} rows={4} />
                            </label>
                        </div>

                        {productError && <div className="landing-admin-error">{productError}</div>}

                        <div className="landing-admin-modal-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setShowProductModal(false)} disabled={savingProduct}>
                                Cancelar
                            </button>
                            <button type="button" className="btn btn-primary" onClick={createProductLandingPage} disabled={savingProduct}>
                                {savingProduct ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Criar landing de produto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingContextId && (
                <div className="landing-admin-modal">
                    <div className="landing-admin-context-modal">
                        <div className="landing-admin-modal-head">
                            <h3><MessageSquare size={20} /> Instrucoes para a Inteligencia Artificial</h3>
                            <button onClick={() => setEditingContextId(null)} aria-label="Fechar">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="landing-admin-context-body">
                            <p>
                                Cole aqui gatilhos, diferenciais, FAQ, regras comerciais e orientacoes para a IA atender melhor os leads desta landing page.
                            </p>

                            <textarea
                                value={contextText}
                                onChange={(e) => setContextText(e.target.value)}
                                placeholder="Ex: enfatize posicionamento, informacoes confirmadas da oferta e proximos passos..."
                            />
                        </div>

                        <div className="landing-admin-modal-actions">
                            <button className="btn btn-outline" onClick={() => setEditingContextId(null)} disabled={savingContext}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" onClick={saveContext} disabled={savingContext}>
                                {savingContext ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Salvar instrucoes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .landing-pages-admin-page {
                    width: min(100%, 1320px);
                    margin: 0 auto;
                    padding: 0 8px;
                    box-sizing: border-box;
                }

                .landing-admin-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                }

                .landing-admin-header h1 {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin: 0;
                }

                .landing-admin-header p {
                    margin: 8px 0 0;
                    color: var(--text-secondary);
                }

                .landing-admin-new-product,
                .landing-admin-empty .btn,
                .landing-admin-modal-actions .btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .landing-admin-type-tabs {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                    margin: 8px 0 24px;
                }

                .landing-admin-type-tab {
                    min-width: 0;
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 14px;
                    padding: 16px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.02);
                    color: var(--text-primary);
                    cursor: pointer;
                    text-align: left;
                }

                .landing-admin-type-tab:hover,
                .landing-admin-type-tab.is-active {
                    border-color: var(--gold);
                    background: rgba(148, 131, 105, 0.12);
                }

                .landing-admin-type-tab span {
                    min-width: 0;
                    display: grid;
                    gap: 3px;
                }

                .landing-admin-type-tab strong,
                .landing-admin-type-tab small {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .landing-admin-type-tab small {
                    color: var(--text-muted);
                    font-size: 0.76rem;
                }

                .landing-admin-type-tab em {
                    min-width: 32px;
                    height: 28px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 999px;
                    background: rgba(148, 131, 105, 0.16);
                    color: var(--text-primary);
                    font-size: 0.8rem;
                    font-style: normal;
                    font-weight: 800;
                }

                .landing-admin-list-title {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin: 0 0 16px;
                    color: var(--text-secondary);
                    font-family: Inter, sans-serif;
                    font-size: 1rem;
                    font-weight: 500;
                }

                .landing-page-list {
                    display: grid;
                    gap: 12px;
                    width: 100%;
                    min-width: 0;
                }

                .landing-page-card {
                    width: 100%;
                    max-width: 100%;
                    display: grid;
                    grid-template-columns: 48px minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 18px;
                    padding: 20px 24px;
                    margin-bottom: 0;
                    box-sizing: border-box;
                    overflow: hidden;
                }

                .landing-page-template-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .landing-page-info {
                    min-width: 0;
                }

                .landing-page-title-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-width: 0;
                    margin-bottom: 4px;
                }

                .landing-page-title {
                    flex: 1 1 auto;
                    min-width: 0;
                    margin: 0;
                    overflow: hidden;
                    color: var(--text-primary);
                    font-family: Inter, sans-serif;
                    font-size: 1.05rem;
                    font-weight: 600;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    letter-spacing: 0;
                }

                .landing-page-template-badge,
                .landing-admin-stage-badge {
                    flex-shrink: 0;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.65rem;
                    font-weight: 600;
                    letter-spacing: 0;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .landing-admin-stage-badge {
                    border: 1px solid rgba(148, 131, 105, 0.28);
                    background: rgba(148, 131, 105, 0.08);
                    color: var(--text-secondary);
                }

                .landing-page-meta-row {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 10px 14px;
                    min-width: 0;
                    color: var(--text-muted);
                    font-size: 0.8rem;
                }

                .landing-page-meta-row > span:first-child {
                    max-width: min(260px, 100%);
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .landing-page-broker {
                    display: flex;
                    align-items: center;
                    flex: 1 1 260px;
                    gap: 6px;
                    min-width: 0;
                    max-width: 380px;
                }

                .landing-page-broker-select {
                    display: grid;
                    gap: 3px;
                    width: 100%;
                    min-width: 180px;
                    max-width: 360px;
                }

                .landing-page-broker-select select {
                    width: 100%;
                    border: 1px solid var(--border);
                    border-radius: 4px;
                    background: transparent;
                    color: var(--text-secondary);
                    outline: none;
                    padding: 3px 6px;
                    font-size: 0.75rem;
                }

                .landing-page-broker-detail {
                    min-width: 0;
                    overflow: hidden;
                    color: var(--text-muted);
                    font-size: 0.68rem;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .landing-page-actions {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 8px;
                    min-width: max-content;
                }

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

                .landing-admin-tab,
                .landing-admin-clear {
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

                .landing-admin-empty {
                    display: grid;
                    justify-items: center;
                    gap: 12px;
                    padding: 48px;
                    text-align: center;
                    color: var(--text-muted);
                }

                .landing-admin-empty p {
                    margin: 0;
                    color: var(--text-secondary);
                    font-size: 1.05rem;
                }

                .landing-admin-empty span {
                    color: var(--text-muted);
                    font-size: 0.86rem;
                }

                .landing-admin-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    background: rgba(0, 0, 0, 0.82);
                }

                .landing-admin-product-modal,
                .landing-admin-context-modal {
                    width: min(100%, 760px);
                    max-height: min(92vh, 880px);
                    overflow: auto;
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    background: #111;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
                }

                .landing-admin-context-modal {
                    width: min(100%, 620px);
                }

                .landing-admin-modal-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 18px;
                    padding: 20px 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    background: #1a1a1a;
                }

                .landing-admin-modal-head h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0;
                    color: #fff;
                    font-size: 1.1rem;
                }

                .landing-admin-modal-head p {
                    margin: 8px 0 0;
                    color: #bbb;
                    font-size: 0.86rem;
                    line-height: 1.5;
                }

                .landing-admin-modal-head button {
                    border: 0;
                    background: none;
                    color: #fff;
                    cursor: pointer;
                }

                .landing-admin-form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 14px;
                    padding: 24px;
                }

                .landing-admin-form-grid label,
                .landing-admin-context-body {
                    display: grid;
                    gap: 8px;
                }

                .landing-admin-form-grid span {
                    color: #ddd;
                    font-size: 0.76rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .landing-admin-wide {
                    grid-column: 1 / -1;
                }

                .landing-admin-form-grid input,
                .landing-admin-form-grid textarea,
                .landing-admin-context-body textarea {
                    width: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    background: #1a1a1a;
                    color: #fff;
                    outline: none;
                    padding: 12px 14px;
                    font: inherit;
                    letter-spacing: 0;
                }

                .landing-admin-form-grid textarea,
                .landing-admin-context-body textarea {
                    resize: vertical;
                    line-height: 1.5;
                }

                .landing-admin-context-body {
                    padding: 24px;
                }

                .landing-admin-context-body p {
                    margin: 0;
                    color: #ddd;
                    line-height: 1.6;
                }

                .landing-admin-context-body textarea {
                    min-height: 250px;
                }

                .landing-admin-error {
                    margin: 0 24px;
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    border-radius: 8px;
                    background: rgba(239, 68, 68, 0.12);
                    color: #fecaca;
                    padding: 12px 14px;
                    font-size: 0.86rem;
                }

                .landing-admin-modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 16px 24px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    background: #1a1a1a;
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

                @media (max-width: 1380px) {
                    .landing-page-card {
                        grid-template-columns: 48px minmax(0, 1fr);
                    }

                    .landing-page-title-row {
                        flex-wrap: wrap;
                    }

                    .landing-page-actions {
                        grid-column: 2;
                        justify-content: flex-start;
                        flex-wrap: wrap;
                        min-width: 0;
                    }
                }

                @media (max-width: 720px) {
                    .landing-pages-admin-page {
                        padding: 0;
                    }

                    .landing-admin-header,
                    .landing-admin-modal-actions {
                        align-items: stretch;
                        flex-direction: column;
                    }

                    .landing-admin-type-tabs,
                    .landing-admin-form-grid {
                        grid-template-columns: 1fr;
                    }

                    .landing-page-card {
                        grid-template-columns: 1fr;
                        padding: 16px;
                    }

                    .landing-page-template-icon {
                        width: 42px;
                        height: 42px;
                    }

                    .landing-page-actions {
                        grid-column: 1;
                    }

                    .landing-page-actions .btn,
                    .landing-page-actions a {
                        flex: 1 1 auto;
                    }
                }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
