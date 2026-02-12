'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2 } from 'lucide-react'

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
    featured_image: string | null
    images: string[] | null
    amenities: string[] | null
    created_at: string
}

export default function PropertiesPage() {
    const [properties, setProperties] = useState<Property[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingProp, setEditingProp] = useState<Property | null>(null)
    const [form, setForm] = useState({
        title: '', description: '', city: '', state: '', price: '', property_type: '',
        bedrooms: '', bathrooms: '', area_m2: '', featured_image: '', status: 'active',
        images: '', amenities: '',
    })

    const supabase = createClient()

    const fetchProps = async () => {
        const { data } = await supabase.from('properties').select('*').order('created_at', { ascending: false })
        setProperties((data as Property[]) || [])
        setLoading(false)
    }

    useEffect(() => { fetchProps() }, [])

    const handleSave = async () => {
        const data = {
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
        }

        if (editingProp) {
            await supabase.from('properties').update(data).eq('id', editingProp.id)
        } else {
            await supabase.from('properties').insert(data)
        }
        setShowForm(false)
        setEditingProp(null)
        setForm({
            title: '', description: '', city: '', state: '', price: '', property_type: '',
            bedrooms: '', bathrooms: '', area_m2: '', featured_image: '', status: 'active',
            images: '', amenities: '',
        })
        fetchProps()
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
        })
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Excluir este imóvel?')) {
            await supabase.from('properties').delete().eq('id', id)
            fetchProps()
        }
    }

    return (
        <div>
            <div className="admin-header">
                <h1>Imóveis</h1>
                <button className="btn btn-gold" onClick={() => { setShowForm(!showForm); setEditingProp(null) }}>
                    <Plus size={18} /> Novo Imóvel
                </button>
            </div>

            {showForm && (
                <div className="chart-card" style={{ marginBottom: '24px' }}>
                    <div className="chart-title">{editingProp ? 'Editar Imóvel' : 'Novo Imóvel'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Título</label>
                            <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Cobertura Duplex Frente Mar" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Descrição</label>
                            <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição detalhada do imóvel..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cidade</label>
                            <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Estado</label>
                            <input className="form-input" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Preço (R$)</label>
                            <input className="form-input" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
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
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Quartos</label>
                            <input className="form-input" type="number" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Banheiros</label>
                            <input className="form-input" type="number" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Área (m²)</label>
                            <input className="form-input" type="number" value={form.area_m2} onChange={e => setForm({ ...form, area_m2: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">URL da Imagem Principal</label>
                            <input className="form-input" value={form.featured_image} onChange={e => setForm({ ...form, featured_image: e.target.value })} placeholder="https://..." />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Galeria de Imagens (uma URL por linha)</label>
                            <textarea
                                className="form-textarea"
                                value={form.images}
                                onChange={e => setForm({ ...form, images: e.target.value })}
                                placeholder="https://...\nhttps://..."
                                rows={4}
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Comodidades (separadas por vírgula)</label>
                            <textarea
                                className="form-textarea"
                                value={form.amenities}
                                onChange={e => setForm({ ...form, amenities: e.target.value })}
                                placeholder="Piscina, Academia, Vista Mar,..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button className="btn btn-gold" onClick={handleSave}>Salvar</button>
                        <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditingProp(null) }}>Cancelar</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {loading ? (
                    <p style={{ color: 'var(--text-muted)', padding: '40px' }}>Carregando...</p>
                ) : properties.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', padding: '40px' }}>Nenhum imóvel cadastrado.</p>
                ) : (
                    properties.map(prop => (
                        <div key={prop.id} className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
                            {prop.featured_image && (
                                <div style={{ height: '180px', overflow: 'hidden' }}>
                                    <img src={prop.featured_image} alt={prop.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            )}
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{prop.title}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {prop.city}{prop.state ? `, ${prop.state}` : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
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
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
