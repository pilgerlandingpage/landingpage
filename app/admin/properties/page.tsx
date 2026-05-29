'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { AlertCircle, Bot, CheckCircle, Edit, FileText, Filter, ImageIcon, Loader2, Plus, Save, Search, Trash2, Video, X, Upload, Camera, MapPin, Home, Sparkles, GripVertical, User, Wand2 } from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

interface Property {
    id: string
    title: string
    description: string | null
    city: string | null
    state: string | null
    price: number | null
    property_type: string | null
    bedrooms: number | null
    bathrooms: number | null
    area_m2: number | null
    status: string
    video_url: string | null
    featured_image: string | null
    images: string[] | null
    amenities: string[] | null
    owner_name: string | null
    owner_phone: string | null
    owner_email: string | null
    neighborhood?: string | null
    source_reference?: string | null
    source_payload?: Record<string, any> | null
    created_at: string
}

const emptyForm = {
    title: '',
    description: '',
    city: '',
    state: '',
    price: '',
    property_type: '',
    bedrooms: '',
    bathrooms: '',
    area_m2: '',
    featured_image: '',
    status: 'under_review',
    images: [] as string[],
    amenities: '',
    video_url: '',
    owner_name: '',
    owner_phone: '',
    owner_email: '',
}

const propertyTypes = [
    'Apartamento', 'Casa', 'Casa em Condomínio', 'Cobertura',
    'Cobertura Duplex', 'Apartamento Duplex', 'Apartamento Garden',
    'Terreno', 'Terreno em Condomínio', 'Sala Comercial',
    'Galpão / Depósito', 'Loft', 'Studio',
]

const statusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'draft', label: 'Rascunhos' },
    { value: 'under_review', label: 'Em analise' },
    { value: 'active', label: 'Ativos' },
    { value: 'reserved', label: 'Reservados' },
    { value: 'sold', label: 'Vendidos' },
    { value: 'inactive', label: 'Inativos' },
]

function statusLabel(s: string) {
    if (s === 'draft') return 'Rascunho'
    if (s === 'active') return 'Ativo'
    if (s === 'under_review') return 'Em analise'
    if (s === 'sold') return 'Vendido'
    if (s === 'reserved') return 'Reservado'
    return 'Inativo'
}

function statusColor(s: string) {
    if (s === 'draft') return '#94a3b8'
    if (s === 'active') return 'var(--success)'
    if (s === 'under_review') return 'var(--gold)'
    if (s === 'sold') return 'var(--danger)'
    if (s === 'reserved') return 'var(--warning)'
    return 'var(--text-muted)'
}

/* ── helpers ── */
const AI_UPLOAD_LIMITS = {
    image: 20 * 1024 * 1024,
    video: 16 * 1024 * 1024,
    document: 100 * 1024 * 1024,
}

function normalizeText(value: string | null | undefined) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function getPropertyIssues(prop: Property) {
    const issues: string[] = []
    const hasFeatured = Boolean(prop.featured_image || prop.images?.[0])
    if (!hasFeatured) issues.push('Sem foto principal')
    if (!prop.price) issues.push('Sem preco')
    if (!prop.city) issues.push('Sem cidade')
    if (!prop.property_type) issues.push('Sem tipo')
    if (!prop.owner_name || !prop.owner_phone) issues.push('Proprietario incompleto')
    if (!prop.images?.length) issues.push('Sem galeria')
    return issues
}

function getPropertyCompletion(prop: Property) {
    const checks = [
        Boolean(prop.title),
        Boolean(prop.description),
        Boolean(prop.city),
        Boolean(prop.state),
        Boolean(prop.price),
        Boolean(prop.property_type),
        Boolean(prop.featured_image || prop.images?.[0]),
        Boolean(prop.images?.length),
        Boolean(prop.owner_name),
        Boolean(prop.owner_phone),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function formatFileSize(bytes: number) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.0', '')}MB`
    if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`
    return `${bytes}B`
}

function validateAiUploadFile(file: File, kind: 'image' | 'video' | 'document') {
    const maxSize = AI_UPLOAD_LIMITS[kind]
    const label = kind === 'image' ? 'foto' : kind === 'video' ? 'video' : 'documento'

    if (file.size > maxSize) {
        return `O ${label} "${file.name}" tem ${formatFileSize(file.size)}. Limite atual: ${formatFileSize(maxSize)}.`
    }

    if (kind === 'image' && !file.type.startsWith('image/')) return `"${file.name}" nao parece ser uma foto valida.`
    if (kind === 'video' && !file.type.startsWith('video/')) return `"${file.name}" nao parece ser um video valido.`

    return ''
}

async function uploadToR2Detailed(file: File, folder = 'properties', kind: 'image' | 'video' | 'document' = 'image'): Promise<{ url: string | null; error?: string }> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)
    fd.append('kind', kind)
    try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
            return {
                url: null,
                error: data?.details || data?.error || `Falha no upload (${res.status})`,
            }
        }
        return { url: data?.url || null }
    } catch (e) {
        console.error('Upload error', e)
        return { url: null, error: e instanceof Error ? e.message : 'Upload failed' }
    }
}

async function uploadToR2(file: File, folder = 'properties', kind: 'image' | 'video' | 'document' = 'image'): Promise<string | null> {
    const result = await uploadToR2Detailed(file, folder, kind)
    if (result.error) console.error('Upload error', result.error)
    return result.url
}

async function deleteFromR2(url: string) {
    try {
        await fetch('/api/upload/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        })
    } catch (e) {
        console.error('Delete R2 error', e)
    }
}

/* ── Dropzone component ── */
function normalizeBriefingText(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function getAiBriefingTriage(context: string, imageCount: number) {
    const text = normalizeBriefingText(context)
    const missing: string[] = []

    const hasType = /\b(apartamento|casa|cobertura|terreno|loft|studio|sala comercial|galpao|duplex|garden|imovel)\b/.test(text)
    const hasStreet = /\b(rua|avenida|av\.?|alameda|travessa|rodovia|estrada|br|sc-)\b/.test(text)
    const hasNeighborhood = /\b(bairro|barra sul|centro|praia brava|meia praia|pioneiros|nacoes|vila real|fazenda|cabecudas)\b/.test(text)
    const hasCity = /\b(balneario camboriu|itajai|itapema|porto belo|bombinhas|camboriu|florianopolis|joinville|curitiba)\b/.test(text)
    const hasState = /\b(sc|santa catarina|pr|parana)\b/.test(text)
    const hasLocation = hasStreet && hasNeighborhood && hasCity && hasState
    const hasPurpose = /\b(venda|vender|aluguel|alugar|locacao|temporada|investimento)\b/.test(text)
    const hasPrice = /r\$\s*\d/i.test(context) || /\b\d+([.,]\d+)?\s*(mi|milhao|milhoes|mil)\b/.test(text) || /\b(sob consulta|faixa de preco|valor|preco)\b/.test(text)
    const hasArea = /\b\d+([.,]\d+)?\s*(m2|m²|metros|metro quadrado|metros quadrados)\b/.test(text) || /\b(area|metragem|privativa|terreno)\b/.test(text)
    const hasEvidence = imageCount >= 3 || context.trim().length >= 120
    const hasOwner = /\b(proprietario|proprietaria|dono|dona|consignante|responsavel)\b/.test(text)
        && /(\(?\d{2}\)?\s?\d{4,5}-?\d{4}|\btelefone\b|\bwhatsapp\b|\bcontato\b)/.test(text)

    if (!hasType) missing.push('tipo do imovel')
    if (!hasLocation) missing.push('endereco completo: rua, bairro, cidade e estado')
    if (!hasPurpose) missing.push('finalidade: venda ou aluguel')
    if (!hasPrice) missing.push('preco, faixa ou sob consulta')
    if (!hasArea) missing.push('metragem ou area aproximada')
    if (!hasOwner) missing.push('dados do proprietario: nome e telefone/WhatsApp')
    if (!hasEvidence) missing.push('pelo menos 3 fotos ou briefing mais detalhado')

    return {
        ready: missing.length === 0,
        missing,
        completed: [hasType, hasLocation, hasPurpose, hasPrice, hasArea, hasOwner, hasEvidence].filter(Boolean).length,
        total: 7,
    }
}

function ImageDropzone({ currentUrl, onUploaded, onRemove, label, large }: {
    currentUrl: string | null
    onUploaded: (url: string) => void
    onRemove: () => void
    label: string
    large?: boolean
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)
    const [uploading, setUploading] = useState(false)

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        const file = files[0]
        if (!file.type.startsWith('image/')) return
        setUploading(true)
        const url = await uploadToR2(file)
        setUploading(false)
        if (url) onUploaded(url)
    }

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
    const onDragLeave = () => setDragging(false)
    const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }

    if (currentUrl) {
        return (
            <div className={`prop-dropzone has-image ${large ? 'large' : ''}`}>
                <img src={currentUrl} alt={label} />
                <div className="prop-dropzone-overlay">
                    <button type="button" className="prop-dropzone-btn" onClick={() => inputRef.current?.click()} title="Substituir">
                        <Camera size={18} />
                    </button>
                    <button type="button" className="prop-dropzone-btn danger" onClick={onRemove} title="Remover">
                        <Trash2 size={18} />
                    </button>
                </div>
                <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => handleFiles(e.target.files)} />
            </div>
        )
    }

    return (
        <div
            className={`prop-dropzone empty ${large ? 'large' : ''} ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !uploading && inputRef.current?.click()}
        >
            {uploading ? (
                <div className="prop-dropzone-loading"><div className="prop-spinner" /><span>Enviando...</span></div>
            ) : (
                <>
                    <Upload size={large ? 32 : 24} />
                    <span>{label}</span>
                    <small>Arraste ou clique para enviar</small>
                </>
            )}
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => handleFiles(e.target.files)} />
        </div>
    )
}

/* ── Gallery multi-upload ── */
function GalleryUpload({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)
    const [uploadingCount, setUploadingCount] = useState(0)

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
        if (imageFiles.length === 0) return
        setUploadingCount(imageFiles.length)
        const results: string[] = []
        for (const file of imageFiles) {
            const url = await uploadToR2(file)
            if (url) results.push(url)
            setUploadingCount(prev => prev - 1)
        }
        if (results.length > 0) onChange([...images, ...results])
    }

    const handleRemove = async (index: number) => {
        const url = images[index]
        const next = images.filter((_, i) => i !== index)
        onChange(next)
        await deleteFromR2(url)
    }

    return (
        <div className="prop-gallery-zone">
            <div
                className={`prop-gallery-grid ${dragging ? 'dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
            >
                {images.map((url, i) => (
                    <div key={`${url}-${i}`} className="prop-gallery-item">
                        <img src={url} alt={`Imagem ${i + 1}`} loading="lazy" />
                        <button type="button" className="prop-gallery-remove" onClick={() => handleRemove(i)} title="Remover">
                            <X size={14} />
                        </button>
                        <span className="prop-gallery-num">{i + 1}</span>
                    </div>
                ))}

                {uploadingCount > 0 && Array.from({ length: uploadingCount }).map((_, i) => (
                    <div key={`uploading-${i}`} className="prop-gallery-item loading">
                        <div className="prop-spinner" />
                    </div>
                ))}

                <div className="prop-gallery-add" onClick={() => inputRef.current?.click()}>
                    <Plus size={24} />
                    <span>Adicionar</span>
                </div>
            </div>
            {images.length === 0 && !dragging && uploadingCount === 0 && (
                <div className="prop-gallery-hint">Arraste as imagens aqui ou clique em &quot;Adicionar&quot;</div>
            )}
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
        </div>
    )
}

/* ── Main page ── */
function AiMediaUpload({
    images,
    videos,
    documents,
    uploading,
    onFiles,
    onRemoveImage,
    onRemoveVideo,
    onRemoveDocument,
}: {
    images: string[]
    videos: string[]
    documents: string[]
    uploading: boolean
    onFiles: (files: FileList | null, kind: 'image' | 'video' | 'document') => void
    onRemoveImage: (index: number) => void
    onRemoveVideo: (index: number) => void
    onRemoveDocument: (index: number) => void
}) {
    const imageInputRef = useRef<HTMLInputElement>(null)
    const videoInputRef = useRef<HTMLInputElement>(null)
    const documentInputRef = useRef<HTMLInputElement>(null)

    const fileNameFromUrl = (url: string) => decodeURIComponent(url.split('/').pop() || 'documento')

    return (
        <div className="ai-property-media">
            <div className="ai-upload-groups">
                <div className="ai-upload-group">
                    <button type="button" className="ai-property-upload" onClick={() => imageInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 size={22} className="spin" /> : <Camera size={22} />}
                        <span>Adicionar fotos</span>
                        <small>Ambientes, fachada, vista e lazer ate 20MB.</small>
                    </button>
                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={e => {
                            onFiles(e.target.files, 'image')
                            e.target.value = ''
                        }}
                    />
                    {images.length > 0 && (
                        <div className="ai-property-media-grid">
                            {images.map((url, index) => (
                                <div key={`ai-image-${url}-${index}`} className="ai-property-thumb">
                                    <img src={url} alt={`Foto IA ${index + 1}`} />
                                    <button type="button" onClick={() => onRemoveImage(index)} title="Remover"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="ai-upload-group">
                    <button type="button" className="ai-property-upload" onClick={() => videoInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 size={22} className="spin" /> : <Video size={22} />}
                        <span>Adicionar videos</span>
                        <small>Tours, detalhes e apresentacao ate 16MB.</small>
                    </button>
                    <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/mp4,video/webm"
                        multiple
                        hidden
                        onChange={e => {
                            onFiles(e.target.files, 'video')
                            e.target.value = ''
                        }}
                    />
                    {videos.length > 0 && (
                        <div className="ai-property-file-list">
                            {videos.map((url, index) => (
                                <div key={`ai-video-${url}-${index}`} className="ai-property-file-row">
                                    <Video size={18} />
                                    <span>Video {index + 1}</span>
                                    <button type="button" onClick={() => onRemoveVideo(index)} title="Remover"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="ai-upload-group">
                    <button type="button" className="ai-property-upload" onClick={() => documentInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 size={22} className="spin" /> : <FileText size={22} />}
                        <span>Adicionar documentos</span>
                        <small>PDF, TXT, CSV, DOCX ou planilha com dados do imovel.</small>
                    </button>
                    <input
                        ref={documentInputRef}
                        type="file"
                        accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        multiple
                        hidden
                        onChange={e => {
                            onFiles(e.target.files, 'document')
                            e.target.value = ''
                        }}
                    />
                    {documents.length > 0 && (
                        <div className="ai-property-file-list">
                            {documents.map((url, index) => (
                                <div key={`ai-document-${url}-${index}`} className="ai-property-file-row">
                                    <FileText size={18} />
                                    <span>{fileNameFromUrl(url)}</span>
                                    <button type="button" onClick={() => onRemoveDocument(index)} title="Remover"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function PropertiesPage() {
    const [properties, setProperties] = useState<Property[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [showAiForm, setShowAiForm] = useState(false)
    const [aiContext, setAiContext] = useState('')
    const [aiImages, setAiImages] = useState<string[]>([])
    const [aiVideos, setAiVideos] = useState<string[]>([])
    const [aiDocuments, setAiDocuments] = useState<string[]>([])
    const [aiUploading, setAiUploading] = useState(false)
    const [aiGenerating, setAiGenerating] = useState(false)
    const [aiNotes, setAiNotes] = useState<string[]>([])
    const [editingProp, setEditingProp] = useState<Property | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [cityFilter, setCityFilter] = useState('all')
    const [qualityFilter, setQualityFilter] = useState('all')
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [errorPopup, setErrorPopup] = useState<string | null>(null)
    const reviewOpenedRef = useRef(false)
    const aiTriage = getAiBriefingTriage(aiContext, aiImages.length)

    const typeOptions = useMemo(() => {
        const values = new Set(properties.map(prop => prop.property_type).filter(Boolean) as string[])
        return Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }, [properties])

    const cityOptions = useMemo(() => {
        const values = new Set(properties.map(prop => prop.city).filter(Boolean) as string[])
        return Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }, [properties])

    const statusCounts = useMemo(() => {
        return properties.reduce<Record<string, number>>((acc, prop) => {
            const status = prop.status || 'inactive'
            acc.all = (acc.all || 0) + 1
            acc[status] = (acc[status] || 0) + 1
            return acc
        }, { all: 0 })
    }, [properties])

    const filteredProperties = useMemo(() => {
        const query = normalizeText(searchQuery)
        return properties.filter(prop => {
            const issues = getPropertyIssues(prop)
            const haystack = normalizeText([
                prop.title,
                prop.city,
                prop.state,
                prop.neighborhood,
                prop.property_type,
                prop.owner_name,
                prop.owner_phone,
                prop.owner_email,
                prop.source_reference,
            ].filter(Boolean).join(' '))

            if (statusFilter !== 'all' && prop.status !== statusFilter) return false
            if (typeFilter !== 'all' && prop.property_type !== typeFilter) return false
            if (cityFilter !== 'all' && prop.city !== cityFilter) return false
            if (query && !haystack.includes(query)) return false
            if (qualityFilter === 'missing_photo' && !issues.includes('Sem foto principal')) return false
            if (qualityFilter === 'missing_owner' && !issues.includes('Proprietario incompleto')) return false
            if (qualityFilter === 'incomplete' && getPropertyCompletion(prop) >= 80) return false
            return true
        })
    }, [cityFilter, properties, qualityFilter, searchQuery, statusFilter, typeFilter])

    const overviewStats = useMemo(() => {
        return [
            { label: 'Total', value: properties.length, tone: 'gold' },
            { label: 'Ativos no site', value: statusCounts.active || 0, tone: 'success' },
            { label: 'Em analise', value: statusCounts.under_review || 0, tone: 'warning' },
            { label: 'Rascunhos', value: statusCounts.draft || 0, tone: 'muted' },
            { label: 'Sem foto', value: properties.filter(prop => !prop.featured_image && !prop.images?.length).length, tone: 'danger' },
        ]
    }, [properties, statusCounts])

    const showToast = (message: string, type: 'success' | 'error') => {
        if (type === 'error') {
            setErrorPopup(message)
            return
        }
        setToast({ message, type })
        setTimeout(() => setToast(null), 4000)
    }

    const fetchProps = async () => {
        try {
            const res = await fetch('/api/admin/properties')
            if (!res.ok) throw new Error('Falha ao carregar imóveis')
            const data = await res.json()
            setProperties(data)
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchProps() }, [])

    const resetForm = () => {
        setShowForm(false)
        setEditingProp(null)
        setForm(emptyForm)
    }

    const resetAiForm = () => {
        setShowAiForm(false)
        setAiContext('')
        setAiImages([])
        setAiVideos([])
        setAiDocuments([])
        setAiNotes([])
    }

    const handleEdit = (prop: Property) => {
        setShowAiForm(false)
        setEditingProp(prop)
        setForm({
            title: prop.title,
            description: prop.description || '',
            city: prop.city || '',
            state: prop.state || '',
            price: prop.price?.toString() || '',
            property_type: prop.property_type || '',
            bedrooms: prop.bedrooms?.toString() || '',
            bathrooms: prop.bathrooms?.toString() || '',
            area_m2: prop.area_m2?.toString() || '',
            featured_image: prop.featured_image || '',
            images: prop.images || [],
            amenities: prop.amenities?.join(', ') || '',
            status: prop.status,
            video_url: prop.video_url || '',
            owner_name: prop.owner_name || '',
            owner_phone: prop.owner_phone || '',
            owner_email: prop.owner_email || '',
        })
        setShowForm(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleAiFiles = async (files: FileList | null, kind: 'image' | 'video' | 'document') => {
        if (!files || files.length === 0) return
        const selected = Array.from(files).filter(file => {
            if (kind === 'image') return file.type.startsWith('image/')
            if (kind === 'video') return file.type.startsWith('video/')
            return true
        })
        if (selected.length === 0) return

        setAiUploading(true)
        const nextImages: string[] = []
        const nextVideos: string[] = []
        const nextDocuments: string[] = []

        for (const file of selected) {
            const validationError = validateAiUploadFile(file, kind)
            if (validationError) {
                showToast(validationError, 'error')
                continue
            }

            const folder = kind === 'image'
                ? 'properties/ai-images'
                : kind === 'video'
                    ? 'properties/ai-videos'
                    : 'properties/ai-documents'
            const result = await uploadToR2Detailed(file, folder, kind)
            const url = result.url
            if (!url) {
                showToast(result.error || `Falha ao enviar ${file.name}`, 'error')
                continue
            }
            if (kind === 'image') nextImages.push(url)
            else if (kind === 'video') nextVideos.push(url)
            else nextDocuments.push(url)
        }

        if (nextImages.length) setAiImages(prev => [...prev, ...nextImages])
        if (nextVideos.length) setAiVideos(prev => [...prev, ...nextVideos])
        if (nextDocuments.length) setAiDocuments(prev => [...prev, ...nextDocuments])
        setAiUploading(false)
    }

    const handleAiCreate = async () => {
        if (!aiTriage.ready) {
            showToast(`As informacoes estao inconsistentes. Para iniciar o cadastro ainda falta informacao sobre o imovel: ${aiTriage.missing.join(', ')}.`, 'error')
            return
        }

        setAiGenerating(true)
        setAiNotes([])

        try {
            const draftRes = await fetch('/api/admin/properties/ai-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context: aiContext, images: aiImages, videos: aiVideos, documents: aiDocuments }),
            })
            const draftJson = await draftRes.json()
            if (!draftRes.ok || !draftJson.success) throw new Error(draftJson.error || 'Erro ao gerar cadastro com IA')

            const draft = draftJson.draft || {}
            const payload = {
                title: draft.title || 'Imovel em analise',
                description: draft.description || aiContext || null,
                city: draft.city || null,
                state: draft.state || null,
                price: draft.price ?? null,
                property_type: draft.property_type || null,
                bedrooms: draft.bedrooms ?? null,
                bathrooms: draft.bathrooms ?? null,
                area_m2: draft.area_m2 ?? null,
                featured_image: aiImages[0] || null,
                images: aiImages,
                amenities: Array.isArray(draft.amenities) ? draft.amenities : [],
                status: 'under_review',
                video_url: aiVideos[0] || null,
                owner_name: draft.owner_name || null,
                owner_phone: draft.owner_phone || null,
                owner_email: draft.owner_email || null,
                source_payload: {
                    created_by: 'property_ai_registration',
                    ai_notes: draft.ai_notes || [],
                    missing_information: draft.missing_information || [],
                    seo_title: draft.seo_title || '',
                    seo_description: draft.seo_description || '',
                    videos: aiVideos,
                    documents: aiDocuments,
                    original_context: aiContext,
                },
            }

            const createRes = await fetch('/api/admin/properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const createJson = await createRes.json().catch(() => null)
            if (!createRes.ok) throw new Error(createJson?.error || 'Erro ao cadastrar imovel gerado pela IA')

            const notes = [
                ...(Array.isArray(draft.ai_notes) ? draft.ai_notes : []),
                ...(Array.isArray(draft.missing_information) ? draft.missing_information.map((item: string) => `Falta confirmar: ${item}`) : []),
            ]
            setAiNotes(notes)
            showToast(createJson?.notification?.sent
                ? 'Cadastro com IA criado em analise e marketing avisado no WhatsApp.'
                : 'Cadastro com IA criado em analise.',
                'success'
            )
            resetAiForm()
            fetchProps()
        } catch (err: any) {
            showToast(err.message || 'Erro no cadastro com IA', 'error')
        } finally {
            setAiGenerating(false)
        }
    }

    useEffect(() => {
        if (reviewOpenedRef.current || loading || properties.length === 0) return
        const reviewId = new URLSearchParams(window.location.search).get('review')
        if (!reviewId) return

        const reviewProperty = properties.find(prop => prop.id === reviewId)
        if (!reviewProperty) return

        reviewOpenedRef.current = true
        handleEdit(reviewProperty)
        showToast('Cadastro aberto para analise e publicacao.', 'success')
    }, [loading, properties])

    const handleSave = async (statusOverride?: string) => {
        if (!form.title.trim()) { showToast('O título é obrigatório.', 'error'); return }
        const nextStatus = statusOverride || form.status
        const nextFeaturedImage = form.featured_image || form.images[0] || null
        if (nextStatus === 'active') {
            const missing = [
                !form.city ? 'cidade' : '',
                !form.property_type ? 'tipo' : '',
                !nextFeaturedImage ? 'foto principal' : '',
                !form.price ? 'preco' : '',
            ].filter(Boolean)
            if (missing.length > 0) {
                showToast(`Para publicar como ativo, complete: ${missing.join(', ')}.`, 'error')
                return
            }
        }
        setSaving(true)
        const payload = {
            title: form.title,
            description: form.description || null,
            city: form.city || null,
            state: form.state || null,
            price: form.price ? parseFloat(form.price) : null,
            property_type: form.property_type || null,
            bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
            bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
            area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
            featured_image: nextFeaturedImage,
            images: form.images,
            amenities: form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [],
            status: nextStatus,
            video_url: form.video_url || null,
            owner_name: form.owner_name || null,
            owner_phone: form.owner_phone || null,
            owner_email: form.owner_email || null,
        }
        try {
            const res = await fetch('/api/admin/properties', {
                method: editingProp ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingProp ? { id: editingProp.id, ...payload } : payload),
            })
            if (!res.ok) throw new Error(editingProp ? 'Erro ao atualizar' : 'Erro ao criar')
            const json = await res.json().catch(() => null)
            const notification = json?.notification
            if (editingProp) {
                showToast('Imovel atualizado!', 'success')
            } else if (notification?.sent) {
                showToast('Imovel criado em analise e marketing avisado no WhatsApp.', 'success')
            } else if (notification?.reason || notification?.error) {
                showToast(`Imovel criado em analise. Aviso WhatsApp pendente: ${notification.reason || notification.error}`, 'success')
            } else {
                showToast('Imovel criado em analise!', 'success')
            }
            resetForm()
            setForm(prev => ({ ...prev, status: nextStatus }))
            fetchProps()
        } catch (err: any) { showToast(err.message, 'error') }
        finally { setSaving(false) }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este imóvel? Todas as imagens serão removidas do servidor.')) return
        try {
            const res = await fetch(`/api/admin/properties?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Erro ao excluir')
            showToast('Imóvel excluído!', 'success')
            fetchProps()
        } catch (err: any) { showToast(err.message, 'error') }
    }

    const handleFeaturedRemove = async () => {
        if (form.featured_image) await deleteFromR2(form.featured_image)
        setForm({ ...form, featured_image: '' })
    }

    const handleFeaturedReplace = async (url: string) => {
        if (form.featured_image) await deleteFromR2(form.featured_image)
        setForm({ ...form, featured_image: url })
    }

    return (
        <div className="admin-properties-page">
            {toast && (
                <div className={`admin-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}
            {errorPopup && (
                <div className="admin-error-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="property-error-title">
                    <div className="admin-error-modal">
                        <button type="button" className="admin-error-modal-close" onClick={() => setErrorPopup(null)} title="Fechar">
                            <X size={18} />
                        </button>
                        <div className="admin-error-modal-icon">
                            <AlertCircle size={24} />
                        </div>
                        <div id="property-error-title" className="admin-error-modal-title">Nao foi possivel continuar</div>
                        <p>{errorPopup}</p>
                        <button type="button" className="btn btn-gold" onClick={() => setErrorPopup(null)}>Entendi</button>
                    </div>
                </div>
            )}

            <div className="admin-header">
                <h1>Imóveis</h1>
                <div className="admin-property-create-actions">
                    <button className="btn btn-gold" onClick={() => { setShowAiForm(!showAiForm); setShowForm(false); setEditingProp(null) }}>
                        <Wand2 size={18} /> Criar com IA
                    </button>
                    <button className="btn btn-outline" onClick={() => { setShowForm(!showForm); setShowAiForm(false); setEditingProp(null); setForm(emptyForm) }}>
                        <Plus size={18} /> Cadastro manual
                    </button>
                </div>
            </div>

            <section className="property-overview-grid" aria-label="Resumo dos imoveis">
                {overviewStats.map(stat => (
                    <div key={stat.label} className={`property-overview-card tone-${stat.tone}`}>
                        <span>{stat.label}</span>
                        <strong>{stat.value}</strong>
                    </div>
                ))}
            </section>

            <section className="chart-card property-filter-panel" aria-label="Filtros de imoveis">
                <div className="property-status-tabs">
                    {statusOptions.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            className={`property-status-tab ${statusFilter === option.value ? 'active' : ''}`}
                            onClick={() => setStatusFilter(option.value)}
                        >
                            <span>{option.label}</span>
                            <strong>{statusCounts[option.value] || 0}</strong>
                        </button>
                    ))}
                </div>

                <div className="property-filter-row">
                    <label className="property-search-box">
                        <Search size={16} />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar por titulo, cidade, proprietario ou referencia"
                        />
                    </label>
                    <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                        <option value="all">Todos os tipos</option>
                        {typeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <select className="form-select" value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
                        <option value="all">Todas as cidades</option>
                        {cityOptions.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                    <select className="form-select" value={qualityFilter} onChange={e => setQualityFilter(e.target.value)}>
                        <option value="all">Qualidade do cadastro</option>
                        <option value="incomplete">Incompletos</option>
                        <option value="missing_photo">Sem foto principal</option>
                        <option value="missing_owner">Sem proprietario completo</option>
                    </select>
                    <button
                        type="button"
                        className="btn btn-outline property-filter-clear"
                        onClick={() => {
                            setSearchQuery('')
                            setStatusFilter('all')
                            setTypeFilter('all')
                            setCityFilter('all')
                            setQualityFilter('all')
                        }}
                    >
                        <Filter size={16} /> Limpar
                    </button>
                </div>

                <div className="property-filter-result">
                    Mostrando {filteredProperties.length} de {properties.length} imoveis cadastrados.
                </div>
            </section>

            {showAiForm && (
                <div className="chart-card ai-property-editor">
                    <div className="prop-editor-head">
                        <div>
                            <div className="chart-title" style={{ marginBottom: 4 }}>Criar imovel com IA</div>
                            <div className="ai-property-subtitle">Envie as midias, descreva o contexto em linguagem livre e o agente cria o cadastro em analise.</div>
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={resetAiForm}><X size={16} /></button>
                    </div>

                    <div className="ai-property-grid">
                        <div className="ai-property-panel">
                            <div className="prop-section-title"><Bot size={18} /> Briefing do agente</div>
                            <textarea
                                className="form-textarea ai-property-prompt"
                                value={aiContext}
                                onChange={e => setAiContext(e.target.value)}
                                placeholder="Exemplo: Apartamento para venda na Rua 3700, numero 500, apto 2801, Barra Sul, Balneario Camboriu, SC. 220m2 privativos, 4 suites, 3 vagas, vista mar, mobiliado, R$ 8.500.000. Proprietario: Joao da Silva, WhatsApp (47) 99999-9999..."
                                rows={10}
                            />
                            <div className="ai-briefing-example">
                                <strong>Exemplo de briefing ideal</strong>
                                <span>Apartamento para venda na Rua 3700, numero 500, apto 2801, Barra Sul, Balneario Camboriu, SC. 220m2 privativos, 4 suites, 3 vagas, vista mar, mobiliado, R$ 8.500.000. Proprietario: Joao da Silva, WhatsApp (47) 99999-9999, e-mail joao@email.com.</span>
                            </div>
                        </div>

                        <div className="ai-property-panel">
                            <div className="prop-section-title"><Camera size={18} /> Midias e documentos</div>
                            <AiMediaUpload
                                images={aiImages}
                                videos={aiVideos}
                                documents={aiDocuments}
                                uploading={aiUploading}
                                onFiles={handleAiFiles}
                                onRemoveImage={index => setAiImages(prev => prev.filter((_, i) => i !== index))}
                                onRemoveVideo={index => setAiVideos(prev => prev.filter((_, i) => i !== index))}
                                onRemoveDocument={index => setAiDocuments(prev => prev.filter((_, i) => i !== index))}
                            />
                        </div>
                    </div>

                    {aiNotes.length > 0 && (
                        <div className="ai-property-notes">
                            {aiNotes.slice(0, 4).map((note, index) => <span key={`${note}-${index}`}>{note}</span>)}
                        </div>
                    )}

                    <div className="prop-editor-actions">
                        <button className="btn btn-gold" onClick={handleAiCreate} disabled={aiGenerating || aiUploading}>
                            {aiGenerating ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
                            {aiGenerating ? 'Agente cadastrando...' : 'Gerar e cadastrar em analise'}
                        </button>
                        <button className="btn btn-outline" onClick={resetAiForm}>Cancelar</button>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="chart-card prop-editor">
                    <div className="prop-editor-head">
                        <div className="chart-title" style={{ marginBottom: 0 }}>{editingProp ? 'Editar imóvel' : 'Novo imóvel'}</div>
                        <button className="btn btn-outline btn-sm" onClick={resetForm}><X size={16} /></button>
                    </div>

                    {/* ── Section 1: Basic Info ── */}
                    <div className="prop-section">
                        <div className="prop-section-title"><Home size={18} /> Informações Básicas</div>
                        <div className="prop-form-grid">
                            <div className="form-group wide">
                                <label className="form-label">Título *</label>
                                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Cobertura Duplex Frente Mar" />
                            </div>
                            <div className="form-group wide">
                                <label className="form-label">Descrição</label>
                                <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição detalhada do imóvel..." rows={4} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tipo</label>
                                <select className="form-select" value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })}>
                                    <option value="">Selecione...</option>
                                    {propertyTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                    <option value="draft">Rascunho</option>
                                    <option value="under_review">Em analise</option>
                                    <option value="active">Ativo</option>
                                    <option value="inactive">Inativo</option>
                                    <option value="sold">Vendido</option>
                                    <option value="reserved">Reservado</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ── Section 2: Location & Details ── */}
                    <div className="prop-section">
                        <div className="prop-section-title"><MapPin size={18} /> Localização e Detalhes</div>
                        <div className="prop-form-grid">
                            <div className="form-group"><label className="form-label">Cidade</label><input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Balneário Camboriú" /></div>
                            <div className="form-group"><label className="form-label">Estado</label><input className="form-input" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="SC" /></div>
                            <div className="form-group"><label className="form-label">Preço (R$)</label><input className="form-input" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="4500000" /></div>
                            <div className="form-group"><label className="form-label">Dormitórios</label><input className="form-input" type="number" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} placeholder="4" /></div>
                            <div className="form-group"><label className="form-label">Banheiros</label><input className="form-input" type="number" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} placeholder="3" /></div>
                            <div className="form-group"><label className="form-label">Área (m²)</label><input className="form-input" type="number" value={form.area_m2} onChange={e => setForm({ ...form, area_m2: e.target.value })} placeholder="250" /></div>
                        </div>
                    </div>

                    {/* ── Section 3: Media ── */}
                    <div className="prop-section prop-section-media">
                        <div className="prop-section-title"><Camera size={18} /> Mídia</div>

                        <label className="form-label" style={{ marginBottom: 8 }}>Imagem Principal</label>
                        <ImageDropzone
                            currentUrl={form.featured_image || null}
                            onUploaded={handleFeaturedReplace}
                            onRemove={handleFeaturedRemove}
                            label="Imagem principal do imóvel"
                            large
                        />

                        <label className="form-label" style={{ marginTop: 20, marginBottom: 8 }}>Galeria de Imagens ({form.images.length} {form.images.length === 1 ? 'foto' : 'fotos'})</label>
                        <GalleryUpload images={form.images} onChange={imgs => setForm({ ...form, images: imgs })} />

                        <div className="form-group wide" style={{ marginTop: 16 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Video size={16} style={{ color: 'var(--gold)' }} /> Link do vídeo
                            </label>
                            <input className="form-input" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                        </div>
                    </div>

                    {/* ── Section 4: Amenities ── */}
                    <div className="prop-section">
                        <div className="prop-section-title"><Sparkles size={18} /> Comodidades</div>
                        <textarea className="form-textarea" value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} placeholder="Piscina, Academia, Vista mar, Churrasqueira" rows={2} />
                    </div>

                    {/* ── Section 5: Owner (admin only) ── */}
                    <div className="prop-section prop-section-owner">
                        <div className="prop-section-title"><User size={18} /> Proprietário <span className="prop-admin-badge">Somente Admin</span></div>
                        <div className="prop-form-grid">
                            <div className="form-group"><label className="form-label">Nome do Proprietário</label><input className="form-input" value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} placeholder="João da Silva" /></div>
                            <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" value={form.owner_phone} onChange={e => setForm({ ...form, owner_phone: e.target.value })} placeholder="(47) 99999-9999" /></div>
                            <div className="form-group wide"><label className="form-label">E-mail</label><input className="form-input" type="email" value={form.owner_email} onChange={e => setForm({ ...form, owner_email: e.target.value })} placeholder="proprietario@email.com" /></div>
                        </div>
                    </div>

                    <div className="prop-editor-actions">
                        <button className="btn btn-outline" onClick={() => handleSave('draft')} disabled={saving}>
                            <Save size={16} /> Salvar rascunho
                        </button>
                        <button className="btn btn-outline" onClick={() => handleSave('under_review')} disabled={saving}>
                            <CheckCircle size={16} /> Enviar para analise
                        </button>
                        <button className="btn btn-gold" onClick={() => handleSave()} disabled={saving}>
                            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar imóvel'}
                        </button>
                        <button className="btn btn-outline" onClick={resetForm}>Cancelar</button>
                    </div>
                </div>
            )}

            {/* ── Property cards grid ── */}
            <div className="admin-properties-grid">
                {loading ? (
                    <div style={{ gridColumn: '1 / -1' }}><AdminLoadingState message="Carregando imóveis..." minHeight="320px" embedded /></div>
                ) : properties.length === 0 ? (
                    <div className="chart-card admin-properties-empty">
                        <ImageIcon size={48} />
                        <p>Nenhum imóvel cadastrado</p>
                        <span>Clique em &quot;Novo imóvel&quot; para começar.</span>
                    </div>
                ) : filteredProperties.length === 0 ? (
                    <div className="chart-card admin-properties-empty">
                        <Search size={48} />
                        <p>Nenhum imovel encontrado</p>
                        <span>Ajuste os filtros ou limpe a busca para ver todos os cadastros.</span>
                    </div>
                ) : (
                    filteredProperties.map(prop => {
                        const issues = getPropertyIssues(prop)
                        const completion = getPropertyCompletion(prop)
                        return (
                        <div key={prop.id} className={`chart-card admin-property-card status-${prop.status || 'inactive'}`}>
                            {(prop.featured_image || prop.images?.[0]) ? (
                                <div className="admin-property-image">
                                    <img src={prop.featured_image || prop.images?.[0]} alt={prop.title} loading="lazy" />
                                    <div className="admin-property-status" style={{ background: statusColor(prop.status) }}>{statusLabel(prop.status)}</div>
                                </div>
                            ) : (
                                <div className="admin-property-image admin-property-image-empty">
                                    <ImageIcon size={30} />
                                    <span>Sem foto principal</span>
                                    <div className="admin-property-status" style={{ background: statusColor(prop.status) }}>{statusLabel(prop.status)}</div>
                                </div>
                            )}
                            <div className="admin-property-body">
                                <div className="admin-property-head">
                                    <div>
                                        <div className="admin-property-title">{prop.title}</div>
                                        <div className="admin-property-location">{prop.city || 'Cidade pendente'}{prop.state ? `, ${prop.state}` : ''}</div>
                                    </div>
                                    <div className="admin-property-actions">
                                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(prop)}><Edit size={14} /></button>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(prop.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div className="admin-property-card-statusline">
                                    <span className="admin-property-inline-status" style={{ color: statusColor(prop.status) }}>{statusLabel(prop.status)}</span>
                                    <span>{completion}% completo</span>
                                </div>
                                {prop.price ? <div className="admin-property-price">R$ {prop.price.toLocaleString('pt-BR')}</div> : <div className="admin-property-price muted">Preco pendente</div>}
                                <div className="admin-property-meta">
                                    {prop.property_type && <span>{prop.property_type}</span>}
                                    {prop.bedrooms && <span>{prop.bedrooms} dormitórios</span>}
                                    {prop.bathrooms && <span>{prop.bathrooms} banheiros</span>}
                                    {prop.area_m2 && <span>{prop.area_m2}m²</span>}
                                    {prop.images?.length ? <span>{prop.images.length} fotos</span> : null}
                                </div>
                                {issues.length > 0 && (
                                    <div className="admin-property-issues">
                                        {issues.slice(0, 3).map(issue => <span key={issue}>{issue}</span>)}
                                        {issues.length > 3 && <span>+{issues.length - 3} pendencias</span>}
                                    </div>
                                )}
                                {prop.amenities && prop.amenities.length > 0 && (
                                    <div className="admin-property-tags">
                                        {prop.amenities.slice(0, 3).map((a, i) => <span key={`${a}-${i}`}>{a}</span>)}
                                        {prop.amenities.length > 3 && <span>+{prop.amenities.length - 3}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
