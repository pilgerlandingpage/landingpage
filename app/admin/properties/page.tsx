'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Save, X, CheckCircle, AlertCircle, Image, Video } from 'lucide-react'

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
    created_at: string
}

const emptyForm = {
    title: '', description: '', city: '', state: '', price: '', property_type: '',
    bedrooms: '', bathrooms: '', area_m2: '', featured_image: '', status: 'active',
    images: '', amenities: '', video_url: '',
}

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

    const handleSave = async () => {
        if (!form.title.trim()) {
            showToast('O título é obrigatório.', 'error')
            return
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
            featured_image: form.featured_image || null,
            images: form.images ? form.images.split('\n').filter(s => s.trim()) : [],
            amenities: form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : [],
            status: form.status,
            video_url: form.video_url || null,
        }

        try {
            if (editingProp) {
                const res = await fetch('/api/admin/properties', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingProp.id, ...payload }),
                })
                if (!res.ok) throw new Error('Erro ao atualizar imóvel')
                showToast('Imóvel atualizado com sucesso!', 'success')
            } else {
                const res = await fetch('/api/admin/properties', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error('Erro ao criar imóvel')
                showToast('Imóvel criado com sucesso!', 'success')
            }
            setShowForm(false)
            setEditingProp(null)
            setForm(emptyForm)
            fetchProps()
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
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
            images: prop.images?.join('\n') || '',
            amenities: prop.amenities?.join(', ') || '',
            status: prop.status,
            video_url: prop.video_url || '',
        })
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este imóvel?')) return
        try {
            const res = await fetch(`/api/admin/properties?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Erro ao excluir imóvel')
            showToast('Imóvel excluído com sucesso!', 'success')
            fetchProps()
        } catch (err: any) {
            showToast(err.message, 'error')
        }
    }

    const resetForm = () => {
        setShowForm(false)
        setEditingProp(null)
        setForm(emptyForm)
    }

    return (
        <div>
            {/* Toast Notification */}
            {toast && (
                <div className={`admin-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}

            <div className="admin-header">
                <h1>Imóveis</h1>
                <button className="btn btn-gold" onClick={() => { setShowForm(!showForm); setEditingProp(null); setForm(emptyForm) }}>
                    <Plus size={18} /> Novo Imóvel
                </button>
            </div>

            {showForm && (
                <div className="chart-card" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div className="chart-title" style={{ marginBottom: 0 }}>{editingProp ? '✏️ Editar Imóvel' : '🏠 Novo Imóvel'}</div>
                        <button className="btn btn-outline btn-sm" onClick={resetForm}><X size={16} /></button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Título *</label>
                            <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Cobertura Duplex Frente Mar" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Descrição</label>
                            <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição detalhada do imóvel..." rows={4} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cidade</label>
                            <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Balneário Camboriú" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Estado</label>
                            <input className="form-input" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="SC" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Preço (R$)</label>
                            <input className="form-input" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="4500000" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tipo</label>
                            <select className="form-select" value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })}>
                                <option value="">Selecione...</option>
                                <option value="apartamento">Apartamento</option>
                                <option value="casa">Casa</option>
                                <option value="cobertura">Cobertura</option>
                                <option value="mansao">Mansão</option>
                                <option value="terreno">Terreno</option>
                                <option value="sala_comercial">Sala Comercial</option>
                                <option value="loft">Loft</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Quartos</label>
                            <input className="form-input" type="number" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} placeholder="4" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Banheiros</label>
                            <input className="form-input" type="number" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} placeholder="3" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Área (m²)</label>
                            <input className="form-input" type="number" value={form.area_m2} onChange={e => setForm({ ...form, area_m2: e.target.value })} placeholder="250" />
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
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">URL da Imagem Principal</label>
                            <input className="form-input" value={form.featured_image} onChange={e => setForm({ ...form, featured_image: e.target.value })} placeholder="https://..." />
                            {form.featured_image && (
                                <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', height: '120px', background: '#111' }}>
                                    <img src={form.featured_image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            )}
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Galeria de Imagens (uma URL por linha)</label>
                            <textarea className="form-textarea" value={form.images} onChange={e => setForm({ ...form, images: e.target.value })} placeholder={"https://...\nhttps://..."} rows={4} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Comodidades (separadas por vírgula)</label>
                            <textarea className="form-textarea" value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} placeholder="Piscina, Academia, Vista Mar, Churrasqueira" rows={2} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Video size={16} style={{ color: 'var(--gold)' }} /> Link do Vídeo (YouTube)
                            </label>
                            <input className="form-input" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                            {form.video_url && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                    O vídeo será exibido no carrossel de imagens do imóvel.
                                </p>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                        <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
                            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Imóvel'}
                        </button>
                        <button className="btn btn-outline" onClick={resetForm}>Cancelar</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {loading ? (
                    <p style={{ color: 'var(--text-muted)', padding: '40px' }}>Carregando...</p>
                ) : properties.length === 0 ? (
                    <div className="chart-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 24px' }}>
                        <Image size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '8px' }}>Nenhum imóvel cadastrado</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Clique em "Novo Imóvel" para começar.</p>
                    </div>
                ) : (
                    properties.map(prop => (
                        <div key={prop.id} className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
                            {prop.featured_image && (
                                <div style={{ height: '180px', overflow: 'hidden', position: 'relative' }}>
                                    <img src={prop.featured_image} alt={prop.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div style={{
                                        position: 'absolute', top: '10px', right: '10px',
                                        padding: '3px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                                        textTransform: 'uppercase', letterSpacing: '1px',
                                        background: prop.status === 'active' ? 'var(--success)' :
                                            prop.status === 'sold' ? 'var(--danger)' :
                                                prop.status === 'reserved' ? 'var(--warning)' : 'var(--text-muted)',
                                        color: '#0a0a0a',
                                    }}>
                                        {prop.status === 'active' ? 'Ativo' :
                                            prop.status === 'sold' ? 'Vendido' :
                                                prop.status === 'reserved' ? 'Reservado' : 'Inativo'}
                                    </div>
                                </div>
                            )}
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prop.title}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {prop.city}{prop.state ? `, ${prop.state}` : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleEdit(prop)}><Edit size={14} /></button>
                                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(prop.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                {prop.price && (
                                    <div style={{ color: 'var(--gold)', fontSize: '1.2rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', marginTop: '8px' }}>
                                        R$ {prop.price.toLocaleString('pt-BR')}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {prop.bedrooms && <span>{prop.bedrooms} quartos</span>}
                                    {prop.bathrooms && <span>{prop.bathrooms} banheiros</span>}
                                    {prop.area_m2 && <span>{prop.area_m2}m²</span>}
                                </div>
                                {prop.amenities && prop.amenities.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                                        {prop.amenities.slice(0, 3).map((a, i) => (
                                            <span key={i} style={{
                                                fontSize: '0.7rem', padding: '2px 8px',
                                                background: 'rgba(201,169,110,0.1)',
                                                border: '1px solid rgba(201,169,110,0.2)',
                                                borderRadius: '50px',
                                                color: 'var(--gold)',
                                            }}>{a}</span>
                                        ))}
                                        {prop.amenities.length > 3 && (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '2px 4px' }}>+{prop.amenities.length - 3}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Toast Styles */}
            <style>{`
                .admin-toast {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    padding: 14px 24px;
                    border-radius: 12px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10000;
                    animation: toastIn 0.35s ease-out;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                }
                .admin-toast.success {
                    background: rgba(74, 222, 128, 0.15);
                    border: 1px solid rgba(74, 222, 128, 0.3);
                    color: var(--success);
                }
                .admin-toast.error {
                    background: rgba(248, 113, 113, 0.15);
                    border: 1px solid rgba(248, 113, 113, 0.3);
                    color: var(--danger);
                }
                @keyframes toastIn {
                    from { opacity: 0; transform: translateY(-12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
