'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, User, Trash2, Edit2, Shield, Search, Upload, X, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Broker {
    id: string
    name: string
    creci: string
    photo_url: string
    is_active: boolean
}

export default function BrokersAdmin() {
    const supabase = createClient()
    const [brokers, setBrokers] = useState<Broker[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [editingBroker, setEditingBroker] = useState<Broker | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        creci: '',
        photo_url: '',
        is_active: true
    })

    useEffect(() => {
        fetchBrokers()
    }, [])

    async function fetchBrokers() {
        setLoading(true)
        const { data } = await supabase
            .from('virtual_brokers')
            .select('*')
            .order('name')
        if (data) setBrokers(data)
        setLoading(false)
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('folder', 'brokers')

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: uploadFormData
            })
            const data = await res.json()
            if (data.url) {
                setFormData(prev => ({ ...prev, photo_url: data.url }))
            }
        } catch (error) {
            console.error('Upload failed:', error)
            alert('Falha ao enviar imagem.')
        } finally {
            setUploading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (editingBroker) {
            const { error } = await supabase
                .from('virtual_brokers')
                .update(formData)
                .eq('id', editingBroker.id)
            if (!error) {
                setEditingBroker(null)
                fetchBrokers()
            }
        } else {
            const { error } = await supabase
                .from('virtual_brokers')
                .insert([formData])
            if (!error) {
                setIsAdding(false)
                fetchBrokers()
            }
        }
        setFormData({ name: '', creci: '', photo_url: '', is_active: true })
    }

    async function deleteBroker(id: string) {
        if (!confirm('Tem certeza que deseja excluir este corretor?')) return
        await supabase.from('virtual_brokers').delete().eq('id', id)
        fetchBrokers()
    }

    return (
        <div className="admin-page-container">
            <div className="admin-header" style={{ marginBottom: '32px' }}>
                <div className="flex justify-between items-center w-full">
                    <div>
                        <h1 className="flex items-center gap-3">
                            <Shield className="text-gold" size={28} /> Gerenciar Corretores de Plantão
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                            Configure os perfis reais ou virtuais que atendem os clientes no site.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setIsAdding(true)
                            setEditingBroker(null)
                            setFormData({ name: '', creci: '', photo_url: '', is_active: true })
                        }}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
                    >
                        <Plus size={20} /> Novo Corretor
                    </button>
                </div>
            </div>

            {(isAdding || editingBroker) && (
                <div className="chart-card" style={{ marginBottom: '32px', padding: '32px', border: '1px solid rgba(201, 169, 110, 0.2)' }}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--gold)' }}>
                            {editingBroker ? 'Editar Perfil' : 'Novo Perfil de Corretor'}
                        </h2>
                        <button onClick={() => { setIsAdding(false); setEditingBroker(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Photo Upload Area */}
                        <div className="flex flex-col items-center gap-4">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: '150px',
                                    height: '150px',
                                    borderRadius: '50%',
                                    border: '2px dashed var(--gold)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    backgroundColor: 'rgba(201, 169, 110, 0.05)',
                                    position: 'relative'
                                }}
                            >
                                {formData.photo_url ? (
                                    <img src={formData.photo_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <Upload size={32} style={{ marginBottom: '8px' }} />
                                        <div style={{ fontSize: '0.8rem' }}>Upload Foto</div>
                                    </div>
                                )}
                                {uploading && (
                                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Loader2 className="animate-spin" color="var(--gold)" />
                                    </div>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                                accept="image/*"
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                Use fotos quadradas (1:1) de alta qualidade.
                            </p>
                        </div>

                        {/* Fields Area */}
                        <div className="md:col-span-2 grid grid-cols-1 gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Nome do Corretor</label>
                                    <input
                                        placeholder="Ex: Guilherme Pilger"
                                        className="admin-input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Registro (CRECI)</label>
                                    <input
                                        placeholder="Ex: CRECI 1234-F"
                                        className="admin-input"
                                        value={formData.creci}
                                        onChange={(e) => setFormData({ ...formData, creci: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>URL da Foto (Opcional se fez upload)</label>
                                <input
                                    placeholder="https://exemplo.com/foto.jpg"
                                    className="admin-input"
                                    value={formData.photo_url}
                                    onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    style={{ width: '20px', height: '20px', accentColor: 'var(--gold)' }}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" style={{ fontSize: '1rem', color: 'white', cursor: 'pointer' }}>
                                    Ativar no Plantão (Aparecerá aleatoriamente no chat)
                                </label>
                            </div>

                            <div className="flex gap-4 mt-4">
                                <button type="submit" className="btn-primary" style={{ padding: '12px 32px' }}>
                                    {editingBroker ? 'Atualizar Perfil' : 'Criar Corretor'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsAdding(false); setEditingBroker(null); }}
                                    className="btn-secondary"
                                    style={{ padding: '12px 24px' }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-20" style={{ color: 'var(--text-muted)' }}>
                        <Loader2 className="animate-spin" style={{ margin: '0 auto 16px' }} />
                        Carregando corretores...
                    </div>
                ) : brokers.length === 0 ? (
                    <div className="col-span-full text-center py-20 chart-card">
                        <User size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                        <p>Nenhum corretor cadastrado ainda.</p>
                    </div>
                ) : brokers.map(broker => (
                    <div key={broker.id} className="chart-card flex items-center gap-5 group" style={{ padding: '24px', position: 'relative' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--gold)', flexShrink: 0, backgroundColor: 'var(--bg-lighter)' }}>
                            {broker.photo_url ? (
                                <img src={broker.photo_url} alt={broker.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <User style={{ width: '100%', height: '100%', padding: '16px', color: 'rgba(255,255,255,0.1)' }} />
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{broker.name}</h3>
                            <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{broker.creci}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: broker.is_active ? '#22c55e' : '#666'
                                }} />
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    color: broker.is_active ? '#22c55e' : 'var(--text-muted)'
                                }}>
                                    {broker.is_active ? 'Online no Site' : 'Inativo'}
                                </span>
                            </div>
                        </div>

                        {/* Ações separadas e sempre visíveis dentro do card */}
                        <div style={{ display: 'flex', gap: '8px', position: 'absolute', top: '16px', right: '16px' }}>
                            <button
                                onClick={() => {
                                    setEditingBroker(broker)
                                    setFormData({
                                        name: broker.name,
                                        creci: broker.creci,
                                        photo_url: broker.photo_url,
                                        is_active: broker.is_active
                                    })
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                style={{
                                    background: 'rgba(96, 165, 250, 0.1)',
                                    border: '1px solid rgba(96, 165, 250, 0.2)',
                                    color: '#60a5fa',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Editar"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={() => deleteBroker(broker.id)}
                                style={{
                                    background: 'rgba(248, 113, 113, 0.1)',
                                    border: '1px solid rgba(248, 113, 113, 0.2)',
                                    color: '#f87171',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Excluir"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>{`
                .admin-page-container {
                    padding: 32px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .text-gold { color: var(--gold); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
