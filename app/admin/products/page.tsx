'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    BookOpen,
    CheckCircle2,
    CircleDollarSign,
    ExternalLink,
    FileText,
    Gift,
    Layers,
    Loader2,
    Package,
    Plus,
    Save,
    Search,
    ShoppingCart,
} from 'lucide-react'

type ProductStatus = 'draft' | 'active' | 'hidden' | 'archived'
type OfferStatus = 'draft' | 'active' | 'paused' | 'archived'

type Product = {
    id: string
    slug: string
    title: string
    subtitle: string | null
    description: string | null
    product_type: string
    status: ProductStatus
    access_model: string
    cover_image_url: string | null
    thumbnail_url: string | null
    updated_at: string
}

type Offer = {
    id: string
    product_id: string
    landing_page_id: string | null
    slug: string
    name: string
    description: string | null
    status: OfferStatus
    price_cents: number
    currency: string
    checkout_path: string | null
    payment_methods: string[]
    max_installments: number
}

type ProductContent = {
    id: string
    product_id: string
    parent_id: string | null
    content_type: string
    title: string
    description: string | null
    body: string | null
    asset_url: string | null
    duration_seconds: number | null
    position: number
    is_preview: boolean
    is_active: boolean
}

type OrderBump = {
    id: string
    offer_id: string
    bump_product_id: string
    title: string
    description: string | null
    price_cents: number
    is_active: boolean
    position: number
}

type LandingPage = {
    id: string
    slug: string
    title: string
    status: string | null
    page_type: string | null
}

type ProductDraft = {
    title: string
    slug: string
    subtitle: string
    description: string
    product_type: string
    status: ProductStatus
    cover_image_url: string
}

type OfferDraft = {
    id?: string
    name: string
    slug: string
    description: string
    status: OfferStatus
    price: string
    checkout_path: string
    landing_page_id: string
    max_installments: string
}

type ContentDraft = {
    id?: string
    title: string
    parent_id: string
    content_type: string
    description: string
    body: string
    asset_url: string
    duration_seconds: string
    position: string
    is_preview: boolean
    is_active: boolean
}

type BumpDraft = {
    offer_id: string
    bump_product_id: string
    title: string
    description: string
    price: string
    position: string
    is_active: boolean
}

const EMPTY_PRODUCT: ProductDraft = {
    title: '',
    slug: '',
    subtitle: '',
    description: '',
    product_type: 'course',
    status: 'draft',
    cover_image_url: '',
}

const EMPTY_OFFER: OfferDraft = {
    name: '',
    slug: '',
    description: '',
    status: 'draft',
    price: 'R$ 97,00',
    checkout_path: '',
    landing_page_id: '',
    max_installments: '1',
}

const EMPTY_CONTENT: ContentDraft = {
    title: '',
    parent_id: '',
    content_type: 'lesson',
    description: '',
    body: '',
    asset_url: '',
    duration_seconds: '',
    position: '0',
    is_preview: false,
    is_active: true,
}

const EMPTY_BUMP: BumpDraft = {
    offer_id: '',
    bump_product_id: '',
    title: '',
    description: '',
    price: 'R$ 0,00',
    position: '0',
    is_active: true,
}

function slugify(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function money(cents: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function statusLabel(status: string) {
    const labels: Record<string, string> = {
        active: 'Ativo',
        draft: 'Rascunho',
        hidden: 'Oculto',
        archived: 'Arquivado',
        paused: 'Pausado',
    }
    return labels[status] || status
}

function productDraftFrom(product: Product): ProductDraft {
    return {
        title: product.title || '',
        slug: product.slug || '',
        subtitle: product.subtitle || '',
        description: product.description || '',
        product_type: product.product_type || 'course',
        status: product.status || 'draft',
        cover_image_url: product.cover_image_url || '',
    }
}

function offerDraftFrom(offer: Offer): OfferDraft {
    return {
        id: offer.id,
        name: offer.name || '',
        slug: offer.slug || '',
        description: offer.description || '',
        status: offer.status || 'draft',
        price: money(offer.price_cents),
        checkout_path: offer.checkout_path || '',
        landing_page_id: offer.landing_page_id || '',
        max_installments: String(offer.max_installments || 1),
    }
}

function contentDraftFrom(content: ProductContent): ContentDraft {
    return {
        id: content.id,
        title: content.title || '',
        parent_id: content.parent_id || '',
        content_type: content.content_type || 'lesson',
        description: content.description || '',
        body: content.body || '',
        asset_url: content.asset_url || '',
        duration_seconds: content.duration_seconds ? String(Math.round(content.duration_seconds / 60)) : '',
        position: String(content.position || 0),
        is_preview: content.is_preview === true,
        is_active: content.is_active !== false,
    }
}

export default function ProductsAdminPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [offers, setOffers] = useState<Offer[]>([])
    const [contents, setContents] = useState<ProductContent[]>([])
    const [bumps, setBumps] = useState<OrderBump[]>([])
    const [landingPages, setLandingPages] = useState<LandingPage[]>([])
    const [selectedProductId, setSelectedProductId] = useState('')
    const [productDraft, setProductDraft] = useState<ProductDraft>(EMPTY_PRODUCT)
    const [offerDraft, setOfferDraft] = useState<OfferDraft>(EMPTY_OFFER)
    const [contentDraft, setContentDraft] = useState<ContentDraft>(EMPTY_CONTENT)
    const [bumpDraft, setBumpDraft] = useState<BumpDraft>(EMPTY_BUMP)
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState('')
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const selectedProduct = products.find(product => product.id === selectedProductId) || null
    const selectedOffers = offers.filter(offer => offer.product_id === selectedProductId)
    const selectedContents = contents.filter(content => content.product_id === selectedProductId)
    const selectedModules = selectedContents.filter(content => content.content_type === 'module')
    const selectedOfferIds = new Set(selectedOffers.map(offer => offer.id))
    const selectedBumps = bumps.filter(bump => selectedOfferIds.has(bump.offer_id))

    const filteredProducts = useMemo(() => {
        const normalized = query
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
        if (!normalized) return products
        return products.filter(product => {
            const text = `${product.title} ${product.slug} ${product.product_type} ${product.status}`
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
            return text.includes(normalized)
        })
    }, [products, query])

    const activeOffers = offers.filter(offer => offer.status === 'active')
    const activeProducts = products.filter(product => product.status === 'active')

    const loadData = async (preferredProductId?: string) => {
        setLoading(true)
        setError('')
        try {
            const response = await fetch('/api/admin/products', { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.error || 'Erro ao carregar produtos.')

            const loadedProducts = Array.isArray(payload.products) ? payload.products : []
            setProducts(loadedProducts)
            setOffers(Array.isArray(payload.offers) ? payload.offers : [])
            setContents(Array.isArray(payload.contents) ? payload.contents : [])
            setBumps(Array.isArray(payload.order_bumps) ? payload.order_bumps : [])
            setLandingPages(Array.isArray(payload.landing_pages) ? payload.landing_pages : [])

            const nextSelected = preferredProductId || selectedProductId || loadedProducts[0]?.id || ''
            setSelectedProductId(nextSelected)
            const nextProduct = loadedProducts.find((product: Product) => product.id === nextSelected) || loadedProducts[0]
            if (nextProduct) setProductDraft(productDraftFrom(nextProduct))
        } catch (err: any) {
            setError(err?.message || 'Erro ao carregar produtos.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const selectProduct = (product: Product) => {
        setSelectedProductId(product.id)
        setProductDraft(productDraftFrom(product))
        const firstOffer = offers.find(offer => offer.product_id === product.id)
        setOfferDraft(firstOffer ? offerDraftFrom(firstOffer) : EMPTY_OFFER)
        setContentDraft(EMPTY_CONTENT)
        setBumpDraft(prev => ({ ...EMPTY_BUMP, offer_id: firstOffer?.id || prev.offer_id }))
        setNotice('')
        setError('')
    }

    const newProduct = () => {
        setSelectedProductId('')
        setProductDraft(EMPTY_PRODUCT)
        setOfferDraft(EMPTY_OFFER)
        setContentDraft(EMPTY_CONTENT)
        setBumpDraft(EMPTY_BUMP)
        setNotice('')
        setError('')
    }

    const updateProduct = (field: keyof ProductDraft, value: string) => {
        setProductDraft(prev => ({
            ...prev,
            [field]: value,
            slug: field === 'title' && !prev.slug ? slugify(value) : prev.slug,
        }))
    }

    const saveProduct = async () => {
        setSaving('product')
        setError('')
        setNotice('')
        try {
            const response = await fetch('/api/admin/products', {
                method: selectedProductId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resource: 'product',
                    id: selectedProductId || undefined,
                    ...productDraft,
                    thumbnail_url: productDraft.cover_image_url,
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.error || 'Erro ao salvar produto.')
            await loadData(payload.data?.id || selectedProductId)
            setNotice('Produto salvo.')
        } catch (err: any) {
            setError(err?.message || 'Erro ao salvar produto.')
        } finally {
            setSaving('')
        }
    }

    const saveOffer = async () => {
        if (!selectedProductId) return
        setSaving('offer')
        setError('')
        setNotice('')
        try {
            const response = await fetch('/api/admin/products', {
                method: offerDraft.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resource: 'offer',
                    id: offerDraft.id,
                    product_id: selectedProductId,
                    ...offerDraft,
                    price: offerDraft.price,
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.error || 'Erro ao salvar oferta.')
            await loadData(selectedProductId)
            setOfferDraft(offerDraftFrom(payload.data))
            setNotice('Oferta salva.')
        } catch (err: any) {
            setError(err?.message || 'Erro ao salvar oferta.')
        } finally {
            setSaving('')
        }
    }

    const saveContent = async () => {
        if (!selectedProductId) return
        setSaving('content')
        setError('')
        setNotice('')
        try {
            const response = await fetch('/api/admin/products', {
                method: contentDraft.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resource: 'content',
                    id: contentDraft.id,
                    product_id: selectedProductId,
                    ...contentDraft,
                    duration_seconds: contentDraft.duration_seconds
                        ? Math.max(0, Number(contentDraft.duration_seconds) || 0) * 60
                        : null,
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.error || 'Erro ao salvar conteúdo.')
            await loadData(selectedProductId)
            setContentDraft(contentDraftFrom(payload.data))
            setNotice(contentDraft.id ? 'Conteúdo atualizado.' : 'Conteúdo adicionado.')
        } catch (err: any) {
            setError(err?.message || 'Erro ao salvar conteúdo.')
        } finally {
            setSaving('')
        }
    }

    const saveBump = async () => {
        if (!selectedProductId) return
        setSaving('bump')
        setError('')
        setNotice('')
        try {
            const response = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resource: 'order_bump',
                    ...bumpDraft,
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.error || 'Erro ao salvar order bump.')
            await loadData(selectedProductId)
            setBumpDraft(EMPTY_BUMP)
            setNotice('Order bump adicionado.')
        } catch (err: any) {
            setError(err?.message || 'Erro ao salvar order bump.')
        } finally {
            setSaving('')
        }
    }

    return (
        <div className="products-admin-page">
            <div className="admin-header products-admin-header">
                <div>
                    <h1><Package className="text-gold" size={28} /> Produtos Digitais</h1>
                    <p>Cadastre produtos, ofertas, conteúdos e order bumps para a plataforma de educação Pilger.</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={newProduct}>
                    <Plus size={16} />
                    Novo produto
                </button>
            </div>

            <section className="products-admin-kpis">
                <div><Package size={18} /><span>Produtos</span><strong>{products.length}</strong></div>
                <div><CheckCircle2 size={18} /><span>Ativos</span><strong>{activeProducts.length}</strong></div>
                <div><CircleDollarSign size={18} /><span>Ofertas ativas</span><strong>{activeOffers.length}</strong></div>
                <div><BookOpen size={18} /><span>Conteúdos</span><strong>{contents.length}</strong></div>
            </section>

            {error && <div className="products-admin-alert is-error">{error}</div>}
            {notice && <div className="products-admin-alert is-success">{notice}</div>}

            <div className="products-admin-grid">
                <aside className="products-admin-list-panel">
                    <label className="products-admin-search">
                        <Search size={15} />
                        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto..." />
                    </label>

                    {loading ? (
                        <div className="products-admin-empty">
                            <Loader2 className="animate-spin" size={24} />
                            <span>Carregando produtos...</span>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="products-admin-empty">
                            <Package size={28} />
                            <span>Nenhum produto encontrado.</span>
                        </div>
                    ) : (
                        <div className="products-admin-product-list">
                            {filteredProducts.map(product => {
                                const productOffers = offers.filter(offer => offer.product_id === product.id)
                                const firstOffer = productOffers[0]
                                const active = product.id === selectedProductId
                                return (
                                    <button
                                        key={product.id}
                                        type="button"
                                        className={`products-admin-product-card ${active ? 'is-active' : ''}`}
                                        onClick={() => selectProduct(product)}
                                    >
                                        <span className="products-admin-product-thumb">
                                            {product.cover_image_url ? <img src={product.cover_image_url} alt="" /> : <Package size={20} />}
                                        </span>
                                        <span>
                                            <strong>{product.title}</strong>
                                            <small>/{product.slug}</small>
                                            <em>{statusLabel(product.status)} {firstOffer ? `| ${money(firstOffer.price_cents)}` : ''}</em>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </aside>

                <section className="products-admin-workspace">
                    <div className="products-admin-card">
                        <div className="products-admin-card-head">
                            <div>
                                <h2><Package size={19} /> Produto</h2>
                                <p>Dados principais que alimentam checkout, biblioteca e área de membros.</p>
                            </div>
                            <button type="button" className="btn btn-primary" onClick={saveProduct} disabled={saving === 'product'}>
                                {saving === 'product' ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Salvar
                            </button>
                        </div>

                        <div className="products-admin-form-grid">
                            <label>
                                <span>Título</span>
                                <input value={productDraft.title} onChange={event => updateProduct('title', event.target.value)} />
                            </label>
                            <label>
                                <span>Slug</span>
                                <input value={productDraft.slug} onChange={event => updateProduct('slug', slugify(event.target.value))} />
                            </label>
                            <label>
                                <span>Tipo</span>
                                <select value={productDraft.product_type} onChange={event => updateProduct('product_type', event.target.value)}>
                                    <option value="ebook">E-book</option>
                                    <option value="course">Curso</option>
                                    <option value="mentorship">Mentoria</option>
                                    <option value="bundle">Combo</option>
                                    <option value="digital_download">Download digital</option>
                                </select>
                            </label>
                            <label>
                                <span>Status</span>
                                <select value={productDraft.status} onChange={event => updateProduct('status', event.target.value as ProductStatus)}>
                                    <option value="draft">Rascunho</option>
                                    <option value="active">Ativo</option>
                                    <option value="hidden">Oculto</option>
                                    <option value="archived">Arquivado</option>
                                </select>
                            </label>
                            <label className="products-admin-wide">
                                <span>Subtítulo</span>
                                <input value={productDraft.subtitle} onChange={event => updateProduct('subtitle', event.target.value)} />
                            </label>
                            <label className="products-admin-wide">
                                <span>URL da capa</span>
                                <input value={productDraft.cover_image_url} onChange={event => updateProduct('cover_image_url', event.target.value)} />
                            </label>
                            <label className="products-admin-wide">
                                <span>Descrição</span>
                                <textarea rows={3} value={productDraft.description} onChange={event => updateProduct('description', event.target.value)} />
                            </label>
                        </div>
                    </div>

                    <div className="products-admin-split">
                        <div className="products-admin-card">
                            <div className="products-admin-card-head">
                                <div>
                                    <h2><CircleDollarSign size={19} /> Ofertas</h2>
                                    <p>Preço, landing vinculada e caminho do checkout.</p>
                                </div>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => setOfferDraft(EMPTY_OFFER)} disabled={!selectedProductId}>
                                    <Plus size={15} /> Nova
                                </button>
                            </div>

                            <div className="products-admin-mini-list">
                                {selectedOffers.map(offer => (
                                    <button key={offer.id} type="button" onClick={() => setOfferDraft(offerDraftFrom(offer))}>
                                        <span>{offer.name}</span>
                                        <strong>{money(offer.price_cents)}</strong>
                                        <em>{statusLabel(offer.status)}</em>
                                    </button>
                                ))}
                            </div>

                            <div className="products-admin-form-grid is-compact">
                                <label>
                                    <span>Nome</span>
                                    <input value={offerDraft.name} onChange={event => setOfferDraft(prev => ({ ...prev, name: event.target.value, slug: prev.slug || slugify(event.target.value) }))} disabled={!selectedProductId} />
                                </label>
                                <label>
                                    <span>Preço</span>
                                    <input value={offerDraft.price} onChange={event => setOfferDraft(prev => ({ ...prev, price: event.target.value }))} disabled={!selectedProductId} />
                                </label>
                                <label>
                                    <span>Status</span>
                                    <select value={offerDraft.status} onChange={event => setOfferDraft(prev => ({ ...prev, status: event.target.value as OfferStatus }))} disabled={!selectedProductId}>
                                        <option value="draft">Rascunho</option>
                                        <option value="active">Ativa</option>
                                        <option value="paused">Pausada</option>
                                        <option value="archived">Arquivada</option>
                                    </select>
                                </label>
                                <label>
                                    <span>Parcelas</span>
                                    <input value={offerDraft.max_installments} onChange={event => setOfferDraft(prev => ({ ...prev, max_installments: event.target.value }))} disabled={!selectedProductId} />
                                </label>
                                <label className="products-admin-wide">
                                    <span>Slug da oferta</span>
                                    <input value={offerDraft.slug} onChange={event => setOfferDraft(prev => ({ ...prev, slug: slugify(event.target.value) }))} disabled={!selectedProductId} />
                                </label>
                                <label className="products-admin-wide">
                                    <span>Landing page vinculada</span>
                                    <select value={offerDraft.landing_page_id} onChange={event => setOfferDraft(prev => ({ ...prev, landing_page_id: event.target.value }))} disabled={!selectedProductId}>
                                        <option value="">Sem vínculo</option>
                                        {landingPages.map(page => <option key={page.id} value={page.id}>{page.title} /{page.slug}</option>)}
                                    </select>
                                </label>
                                <label className="products-admin-wide">
                                    <span>Caminho do checkout</span>
                                    <input value={offerDraft.checkout_path} onChange={event => setOfferDraft(prev => ({ ...prev, checkout_path: event.target.value }))} placeholder="/checkout/corretor-nota-8" disabled={!selectedProductId} />
                                </label>
                            </div>
                            <button type="button" className="btn btn-primary products-admin-full-button" onClick={saveOffer} disabled={!selectedProductId || saving === 'offer'}>
                                {saving === 'offer' ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Salvar oferta
                            </button>
                        </div>

                        <div className="products-admin-card">
                            <div className="products-admin-card-head">
                                <div>
                                    <h2><Layers size={19} /> Conteúdos</h2>
                                    <p>Aulas, PDFs, bônus e materiais da biblioteca.</p>
                                </div>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => setContentDraft(EMPTY_CONTENT)} disabled={!selectedProductId}>
                                    <Plus size={15} /> Novo
                                </button>
                            </div>

                            <div className="products-admin-mini-list">
                                {selectedContents.map(item => (
                                    <button key={item.id} type="button" onClick={() => setContentDraft(contentDraftFrom(item))}>
                                        <span>{item.position}. {item.title}</span>
                                        <strong>{item.content_type}</strong>
                                        <em>{item.is_active ? 'Ativo' : 'Inativo'}</em>
                                    </button>
                                ))}
                            </div>

                            <div className="products-admin-form-grid is-compact">
                                <label>
                                    <span>Título</span>
                                    <input value={contentDraft.title} onChange={event => setContentDraft(prev => ({ ...prev, title: event.target.value }))} disabled={!selectedProductId} />
                                </label>
                                <label>
                                    <span>Tipo</span>
                                    <select value={contentDraft.content_type} onChange={event => setContentDraft(prev => ({ ...prev, content_type: event.target.value }))} disabled={!selectedProductId}>
                                        <option value="module">Módulo</option>
                                        <option value="lesson">Aula</option>
                                        <option value="video">Vídeo</option>
                                        <option value="pdf">PDF</option>
                                        <option value="ebook">E-book</option>
                                        <option value="bonus">Bônus</option>
                                        <option value="external_link">Link externo</option>
                                    </select>
                                </label>
                                <label>
                                    <span>Módulo pai</span>
                                    <select value={contentDraft.parent_id} onChange={event => setContentDraft(prev => ({ ...prev, parent_id: event.target.value }))} disabled={!selectedProductId || contentDraft.content_type === 'module'}>
                                        <option value="">Sem módulo</option>
                                        {selectedModules
                                            .filter(module => module.id !== contentDraft.id)
                                            .map(module => <option key={module.id} value={module.id}>{module.position}. {module.title}</option>)}
                                    </select>
                                </label>
                                <label>
                                    <span>Ordem</span>
                                    <input value={contentDraft.position} onChange={event => setContentDraft(prev => ({ ...prev, position: event.target.value }))} disabled={!selectedProductId} />
                                </label>
                                <label>
                                    <span>Duração (min)</span>
                                    <input value={contentDraft.duration_seconds} onChange={event => setContentDraft(prev => ({ ...prev, duration_seconds: event.target.value }))} disabled={!selectedProductId} />
                                </label>
                                <label className="products-admin-check">
                                    <input type="checkbox" checked={contentDraft.is_preview} onChange={event => setContentDraft(prev => ({ ...prev, is_preview: event.target.checked }))} disabled={!selectedProductId} />
                                    <span>Prévia grátis</span>
                                </label>
                                <label className="products-admin-check">
                                    <input type="checkbox" checked={contentDraft.is_active} onChange={event => setContentDraft(prev => ({ ...prev, is_active: event.target.checked }))} disabled={!selectedProductId} />
                                    <span>Ativo na área de membros</span>
                                </label>
                                <label className="products-admin-wide">
                                    <span>URL do conteúdo</span>
                                    <input value={contentDraft.asset_url} onChange={event => setContentDraft(prev => ({ ...prev, asset_url: event.target.value }))} disabled={!selectedProductId} />
                                </label>
                                <label className="products-admin-wide">
                                    <span>Descrição</span>
                                    <textarea rows={2} value={contentDraft.description} onChange={event => setContentDraft(prev => ({ ...prev, description: event.target.value }))} disabled={!selectedProductId} />
                                </label>
                                <label className="products-admin-wide">
                                    <span>Texto / instruções do conteúdo</span>
                                    <textarea rows={4} value={contentDraft.body} onChange={event => setContentDraft(prev => ({ ...prev, body: event.target.value }))} disabled={!selectedProductId} />
                                </label>
                            </div>
                            <button type="button" className="btn btn-primary products-admin-full-button" onClick={saveContent} disabled={!selectedProductId || saving === 'content'}>
                                {saving === 'content' ? <Loader2 className="animate-spin" size={16} /> : contentDraft.id ? <Save size={16} /> : <Plus size={16} />}
                                {contentDraft.id ? 'Salvar conteúdo' : 'Adicionar conteúdo'}
                            </button>
                        </div>
                    </div>

                    <div className="products-admin-card">
                        <div className="products-admin-card-head">
                            <div>
                                <h2><Gift size={19} /> Order Bump</h2>
                                <p>Oferta complementar no checkout, sem variação de tamanho, cor ou frete.</p>
                            </div>
                        </div>

                        <div className="products-admin-mini-list is-row">
                            {selectedBumps.map(bump => (
                                <div key={bump.id}>
                                    <span>{bump.title}</span>
                                    <strong>{money(bump.price_cents)}</strong>
                                    <em>{bump.is_active ? 'Ativo' : 'Inativo'}</em>
                                </div>
                            ))}
                        </div>

                        <div className="products-admin-form-grid">
                            <label>
                                <span>Oferta principal</span>
                                <select value={bumpDraft.offer_id} onChange={event => setBumpDraft(prev => ({ ...prev, offer_id: event.target.value }))} disabled={!selectedOffers.length}>
                                    <option value="">Selecione</option>
                                    {selectedOffers.map(offer => <option key={offer.id} value={offer.id}>{offer.name}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>Produto complementar</span>
                                <select value={bumpDraft.bump_product_id} onChange={event => setBumpDraft(prev => ({ ...prev, bump_product_id: event.target.value }))} disabled={!selectedProductId}>
                                    <option value="">Selecione</option>
                                    {products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>Título</span>
                                <input value={bumpDraft.title} onChange={event => setBumpDraft(prev => ({ ...prev, title: event.target.value }))} disabled={!selectedProductId} />
                            </label>
                            <label>
                                <span>Preço</span>
                                <input value={bumpDraft.price} onChange={event => setBumpDraft(prev => ({ ...prev, price: event.target.value }))} disabled={!selectedProductId} />
                            </label>
                            <label className="products-admin-wide">
                                <span>Descrição</span>
                                <textarea rows={2} value={bumpDraft.description} onChange={event => setBumpDraft(prev => ({ ...prev, description: event.target.value }))} disabled={!selectedProductId} />
                            </label>
                        </div>
                        <button type="button" className="btn btn-primary products-admin-full-button" onClick={saveBump} disabled={!selectedProductId || saving === 'bump'}>
                            {saving === 'bump' ? <Loader2 className="animate-spin" size={16} /> : <ShoppingCart size={16} />}
                            Adicionar order bump
                        </button>
                    </div>

                    {selectedProduct && (
                        <div className="products-admin-live-links">
                            <a href={`/membros`} target="_blank" rel="noreferrer"><BookOpen size={15} /> Área de membros</a>
                            <a href={`/membros/${selectedProduct.slug}`} target="_blank" rel="noreferrer"><BookOpen size={15} /> Player do produto</a>
                            {selectedOffers[0]?.checkout_path && (
                                <a href={selectedOffers[0].checkout_path} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Checkout futuro</a>
                            )}
                            <a href={`/admin/landing-pages`}><FileText size={15} /> Landing pages</a>
                        </div>
                    )}
                </section>
            </div>

            <style jsx>{`
                .products-admin-page {
                    width: min(100%, 1400px);
                    margin: 0 auto;
                    padding: 0 8px 48px;
                    box-sizing: border-box;
                }

                .products-admin-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                }

                .products-admin-header h1,
                .products-admin-card-head h2 {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 0;
                }

                .products-admin-header p,
                .products-admin-card-head p {
                    margin: 7px 0 0;
                    color: var(--text-secondary);
                }

                .products-admin-kpis {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                    margin: 8px 0 18px;
                }

                .products-admin-kpis div {
                    min-width: 0;
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    align-items: center;
                    gap: 10px;
                    padding: 14px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.02);
                }

                .products-admin-kpis span {
                    color: var(--text-secondary);
                    font-size: 0.82rem;
                }

                .products-admin-kpis strong {
                    font-size: 1.15rem;
                }

                .products-admin-grid {
                    display: grid;
                    grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
                    gap: 16px;
                    align-items: start;
                }

                .products-admin-list-panel,
                .products-admin-card {
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.02);
                }

                .products-admin-list-panel {
                    position: sticky;
                    top: 18px;
                    padding: 14px;
                }

                .products-admin-search {
                    height: 42px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 0 12px;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.03);
                }

                .products-admin-search input,
                .products-admin-form-grid input,
                .products-admin-form-grid select,
                .products-admin-form-grid textarea {
                    width: 100%;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.03);
                    color: var(--text-primary);
                    font: inherit;
                    box-sizing: border-box;
                }

                .products-admin-search input {
                    border: 0;
                    outline: 0;
                    background: transparent;
                }

                .products-admin-product-list {
                    display: grid;
                    gap: 9px;
                    margin-top: 12px;
                }

                .products-admin-product-card {
                    min-width: 0;
                    display: grid;
                    grid-template-columns: 48px minmax(0, 1fr);
                    align-items: center;
                    gap: 11px;
                    padding: 10px;
                    border: 1px solid transparent;
                    border-radius: 8px;
                    background: transparent;
                    color: var(--text-primary);
                    cursor: pointer;
                    text-align: left;
                }

                .products-admin-product-card:hover,
                .products-admin-product-card.is-active {
                    border-color: var(--gold);
                    background: rgba(148, 131, 105, 0.12);
                }

                .products-admin-product-thumb {
                    width: 48px;
                    height: 48px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    border: 1px solid rgba(148, 131, 105, 0.22);
                    border-radius: 7px;
                    background: rgba(148, 131, 105, 0.08);
                }

                .products-admin-product-thumb img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .products-admin-product-card span:last-child {
                    min-width: 0;
                    display: grid;
                    gap: 3px;
                }

                .products-admin-product-card strong,
                .products-admin-product-card small,
                .products-admin-product-card em {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .products-admin-product-card small,
                .products-admin-product-card em {
                    color: var(--text-muted);
                    font-size: 0.76rem;
                    font-style: normal;
                }

                .products-admin-workspace {
                    display: grid;
                    gap: 16px;
                    min-width: 0;
                }

                .products-admin-card {
                    padding: 18px;
                }

                .products-admin-card-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .products-admin-form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                }

                .products-admin-form-grid.is-compact {
                    gap: 10px;
                }

                .products-admin-form-grid label {
                    min-width: 0;
                    display: grid;
                    gap: 6px;
                }

                .products-admin-form-grid label > span {
                    color: var(--text-secondary);
                    font-size: 0.78rem;
                    font-weight: 700;
                }

                .products-admin-form-grid input,
                .products-admin-form-grid select {
                    height: 40px;
                    padding: 0 11px;
                }

                .products-admin-form-grid textarea {
                    min-height: 82px;
                    padding: 10px 11px;
                    resize: vertical;
                }

                .products-admin-wide {
                    grid-column: 1 / -1;
                }

                .products-admin-split {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 16px;
                }

                .products-admin-mini-list {
                    display: grid;
                    gap: 8px;
                    margin-bottom: 14px;
                }

                .products-admin-mini-list button,
                .products-admin-mini-list div {
                    min-width: 0;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto auto;
                    align-items: center;
                    gap: 8px;
                    padding: 9px 10px;
                    border: 1px solid var(--border);
                    border-radius: 7px;
                    background: rgba(255, 255, 255, 0.025);
                    color: var(--text-primary);
                    text-align: left;
                }

                .products-admin-mini-list button {
                    cursor: pointer;
                }

                .products-admin-mini-list span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .products-admin-mini-list strong,
                .products-admin-mini-list em {
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    font-style: normal;
                    white-space: nowrap;
                }

                .products-admin-check {
                    align-content: end;
                    grid-template-columns: auto 1fr;
                    align-items: center;
                    min-height: 40px;
                }

                .products-admin-check input {
                    width: 17px;
                    height: 17px;
                }

                .products-admin-full-button {
                    width: 100%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 12px;
                }

                .products-admin-alert {
                    margin: 0 0 14px;
                    padding: 11px 14px;
                    border-radius: 7px;
                    font-size: 0.88rem;
                }

                .products-admin-alert.is-error {
                    border: 1px solid rgba(239, 68, 68, 0.28);
                    background: rgba(239, 68, 68, 0.08);
                    color: #fecaca;
                }

                .products-admin-alert.is-success {
                    border: 1px solid rgba(34, 197, 94, 0.26);
                    background: rgba(34, 197, 94, 0.08);
                    color: #bbf7d0;
                }

                .products-admin-empty {
                    min-height: 180px;
                    display: grid;
                    place-items: center;
                    gap: 8px;
                    color: var(--text-muted);
                    text-align: center;
                }

                .products-admin-live-links {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }

                .products-admin-live-links a {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 36px;
                    padding: 0 12px;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    color: var(--text-secondary);
                    text-decoration: none;
                }

                @media (max-width: 1100px) {
                    .products-admin-grid,
                    .products-admin-split {
                        grid-template-columns: 1fr;
                    }

                    .products-admin-list-panel {
                        position: static;
                    }
                }

                @media (max-width: 760px) {
                    .products-admin-header,
                    .products-admin-card-head {
                        align-items: stretch;
                        flex-direction: column;
                    }

                    .products-admin-kpis,
                    .products-admin-form-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
