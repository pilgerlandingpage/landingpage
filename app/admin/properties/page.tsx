'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { AlertCircle, CheckCircle, Edit, ImageIcon, Plus, Save, Trash2, Video, X, Upload, Camera, MapPin, Home, Sparkles, GripVertical, User } from 'lucide-react'
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
    status: 'active',
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

function statusLabel(s: string) {
    if (s === 'active') return 'Ativo'
    if (s === 'sold') return 'Vendido'
    if (s === 'reserved') return 'Reservado'
    return 'Inativo'
}

function statusColor(s: string) {
    if (s === 'active') return 'var(--success)'
    if (s === 'sold') return 'var(--danger)'
    if (s === 'reserved') return 'var(--warning)'
    return 'var(--text-muted)'
}

/* ── helpers ── */
async function uploadToR2(file: File, folder = 'properties'): Promise<string | null> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', folder)
    fd.append('kind', 'image')
    try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        return data.url || null
    } catch (e) {
        console.error('Upload error', e)
        return null
    }
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
                <div className="prop-gallery-hint">Arraste as imagens aqui ou clique em "Adicionar"</div>
            )}
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
        </div>
    )
}

/* ── Main page ── */
export default function PropertiesPage() {
    const [properties, setProperties] = useState<Property[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [editingProp, setEditingProp] = useState<Property | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    const showToast = (message: string, type: 'success' | 'error') => {
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

    const handleEdit = (prop: Property) => {
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

    const handleSave = async () => {
        if (!form.title.trim()) { showToast('O título é obrigatório.', 'error'); return }
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
            featured_image: form.featured_image || form.images[0] || null,
            images: form.images,
            amenities: form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [],
            status: form.status,
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
            showToast(editingProp ? 'Imóvel atualizado!' : 'Imóvel criado!', 'success')
            resetForm()
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

            <div className="admin-header">
                <h1>Imóveis</h1>
                <button className="btn btn-gold" onClick={() => { setShowForm(!showForm); setEditingProp(null); setForm(emptyForm) }}>
                    <Plus size={18} /> Novo imóvel
                </button>
            </div>

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
                            <div className="form-group"><label className="form-label">Quartos</label><input className="form-input" type="number" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} placeholder="4" /></div>
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
                        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
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
                        <span>Clique em "Novo imóvel" para começar.</span>
                    </div>
                ) : (
                    properties.map(prop => (
                        <div key={prop.id} className="chart-card admin-property-card">
                            {prop.featured_image && (
                                <div className="admin-property-image">
                                    <img src={prop.featured_image} alt={prop.title} loading="lazy" />
                                    <div className="admin-property-status" style={{ background: statusColor(prop.status) }}>{statusLabel(prop.status)}</div>
                                </div>
                            )}
                            <div className="admin-property-body">
                                <div className="admin-property-head">
                                    <div>
                                        <div className="admin-property-title">{prop.title}</div>
                                        <div className="admin-property-location">{prop.city}{prop.state ? `, ${prop.state}` : ''}</div>
                                    </div>
                                    <div className="admin-property-actions">
                                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(prop)}><Edit size={14} /></button>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(prop.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                {prop.price && <div className="admin-property-price">R$ {prop.price.toLocaleString('pt-BR')}</div>}
                                <div className="admin-property-meta">
                                    {prop.property_type && <span>{prop.property_type}</span>}
                                    {prop.bedrooms && <span>{prop.bedrooms} quartos</span>}
                                    {prop.bathrooms && <span>{prop.bathrooms} banheiros</span>}
                                    {prop.area_m2 && <span>{prop.area_m2}m²</span>}
                                    {prop.images?.length ? <span>{prop.images.length} fotos</span> : null}
                                </div>
                                {prop.amenities && prop.amenities.length > 0 && (
                                    <div className="admin-property-tags">
                                        {prop.amenities.slice(0, 3).map((a, i) => <span key={`${a}-${i}`}>{a}</span>)}
                                        {prop.amenities.length > 3 && <span>+{prop.amenities.length - 3}</span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
