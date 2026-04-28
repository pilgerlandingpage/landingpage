'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, Save, Rocket, Building2, DollarSign, Calendar, Target,
    Image as ImageIcon, Brain, CheckCircle, AlertCircle
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

interface Property {
    id: string
    title: string
    city?: string
    status: string
}

export default function NewCampaignPage() {
    const router = useRouter()
    const [properties, setProperties] = useState<Property[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    const [form, setForm] = useState({
        name: '',
        property_id: '',
        platform: 'meta' as 'meta' | 'google',
        total_budget: '',
        duration_days: '30',
        ai_auto_manage: true,
        // Targeting
        age_min: '25',
        age_max: '65',
        cities: '',
        interests: '',
    })

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 4000)
    }

    useEffect(() => {
        fetch('/api/admin/properties')
            .then(r => r.json())
            .then(data => {
                setProperties(Array.isArray(data) ? data.filter((p: Property) => p.status === 'active') : [])
            })
            .catch(() => showToast('Erro ao carregar imóveis', 'error'))
            .finally(() => setLoading(false))
    }, [])

    // Auto-fill campaign name when property changes
    useEffect(() => {
        if (form.property_id) {
            const prop = properties.find(p => p.id === form.property_id)
            if (prop && !form.name) {
                setForm(f => ({ ...f, name: `${prop.title} — ${form.platform === 'meta' ? 'Meta' : 'Google'} Ads` }))
            }
        }
    }, [form.property_id, form.platform])

    const dailyBudget = form.total_budget && form.duration_days
        ? (Number(form.total_budget) / Number(form.duration_days))
        : 0

    const handleSaveDraft = async () => {
        if (!form.name.trim()) return showToast('Nome da campanha é obrigatório', 'error')
        if (!form.total_budget || Number(form.total_budget) <= 0) return showToast('Orçamento total é obrigatório', 'error')
        if (!form.duration_days || Number(form.duration_days) <= 0) return showToast('Duração é obrigatória', 'error')

        setSaving(true)
        try {
            const payload = {
                name: form.name,
                property_id: form.property_id || null,
                platform: form.platform,
                total_budget: Number(form.total_budget),
                duration_days: Number(form.duration_days),
                ai_auto_manage: form.ai_auto_manage,
                target_audience: {
                    age_min: Number(form.age_min) || 25,
                    age_max: Number(form.age_max) || 65,
                    cities: form.cities ? form.cities.split(',').map(c => c.trim()).filter(Boolean) : [],
                    interests: form.interests ? form.interests.split(',').map(i => i.trim()).filter(Boolean) : [],
                },
            }

            const res = await fetch('/api/admin/ads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Erro ao criar campanha')
            }

            const campaign = await res.json()
            showToast('Campanha criada como rascunho!', 'success')
            router.push(`/admin/ads/${campaign.id}`)
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleSaveAndPublish = async () => {
        if (!form.name.trim()) return showToast('Nome da campanha é obrigatório', 'error')
        if (!form.total_budget || Number(form.total_budget) <= 0) return showToast('Orçamento total é obrigatório', 'error')

        setPublishing(true)
        try {
            // First create the campaign
            const payload = {
                name: form.name,
                property_id: form.property_id || null,
                platform: form.platform,
                total_budget: Number(form.total_budget),
                duration_days: Number(form.duration_days),
                ai_auto_manage: form.ai_auto_manage,
                target_audience: {
                    age_min: Number(form.age_min) || 25,
                    age_max: Number(form.age_max) || 65,
                    cities: form.cities ? form.cities.split(',').map(c => c.trim()).filter(Boolean) : [],
                    interests: form.interests ? form.interests.split(',').map(i => i.trim()).filter(Boolean) : [],
                },
            }

            const createRes = await fetch('/api/admin/ads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!createRes.ok) throw new Error('Erro ao criar campanha')
            const campaign = await createRes.json()

            // Then publish
            const pubRes = await fetch('/api/admin/ads/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaign_id: campaign.id }),
            })

            if (!pubRes.ok) {
                const err = await pubRes.json()
                throw new Error(err.error || 'Erro ao publicar')
            }

            showToast('Campanha criada e enviada para publicação!', 'success')
            setTimeout(() => router.push('/admin/ads'), 1500)
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setPublishing(false)
        }
    }

    if (loading) {
        return <AdminLoadingState message="Carregando dados da campanha..." />
    }

    return (
        <div>
            {toast && (
                <div className={`admin-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => router.push('/admin/ads')}
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1>🚀 Nova Campanha</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
                            Configure e lance sua campanha de tráfego pago
                        </p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="chart-card" style={{ marginBottom: '24px' }}>
                <div className="chart-title" style={{ marginBottom: '20px' }}>📋 Dados da Campanha</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Property */}
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={14} style={{ color: 'var(--gold)' }} /> Imóvel (opcional)
                        </label>
                        <select
                            className="form-input"
                            value={form.property_id}
                            onChange={e => setForm({ ...form, property_id: e.target.value })}
                        >
                            <option value="">Selecione um imóvel...</option>
                            {properties.map(p => (
                                <option key={p.id} value={p.id}>{p.title}{p.city ? ` — ${p.city}` : ''}</option>
                            ))}
                        </select>
                    </div>

                    {/* Platform */}
                    <div className="form-group">
                        <label className="form-label">Plataforma</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <label style={{
                                flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                                border: form.platform === 'meta' ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                                background: form.platform === 'meta' ? 'rgba(59,130,246,0.1)' : 'transparent',
                            }}>
                                <input
                                    type="radio"
                                    value="meta"
                                    checked={form.platform === 'meta'}
                                    onChange={() => setForm({ ...form, platform: 'meta' })}
                                    style={{ accentColor: '#3b82f6' }}
                                />
                                <span style={{ fontWeight: 500 }}>📘 Meta Ads</span>
                            </label>
                            <label style={{
                                flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                                border: form.platform === 'google' ? '1px solid #ea4335' : '1px solid var(--border-color)',
                                background: form.platform === 'google' ? 'rgba(234,67,53,0.1)' : 'transparent',
                            }}>
                                <input
                                    type="radio"
                                    value="google"
                                    checked={form.platform === 'google'}
                                    onChange={() => setForm({ ...form, platform: 'google' })}
                                    style={{ accentColor: '#ea4335' }}
                                />
                                <span style={{ fontWeight: 500 }}>🔍 Google Ads</span>
                            </label>
                        </div>
                    </div>

                    {/* Campaign Name */}
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Nome da Campanha *</label>
                        <input
                            className="form-input"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Ex: Brava Concetto — Meta Leads"
                        />
                    </div>

                    {/* Budget */}
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <DollarSign size={14} style={{ color: '#22c55e' }} /> Orçamento Total (R$) *
                        </label>
                        <input
                            className="form-input"
                            type="number"
                            value={form.total_budget}
                            onChange={e => setForm({ ...form, total_budget: e.target.value })}
                            placeholder="5000"
                            min="10"
                            step="100"
                        />
                    </div>

                    {/* Duration */}
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} style={{ color: '#6366f1' }} /> Duração (dias) *
                        </label>
                        <input
                            className="form-input"
                            type="number"
                            value={form.duration_days}
                            onChange={e => setForm({ ...form, duration_days: e.target.value })}
                            placeholder="30"
                            min="1"
                        />
                    </div>
                </div>

                {/* Daily Budget Preview */}
                {dailyBudget > 0 && (
                    <div style={{
                        marginTop: '16px', padding: '12px 16px', borderRadius: '8px',
                        background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)'
                    }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Orçamento diário estimado: </span>
                        <strong style={{ color: 'var(--gold)', fontFamily: 'Playfair Display, serif' }}>
                            R$ {dailyBudget.toFixed(2)}/dia
                        </strong>
                    </div>
                )}
            </div>

            {/* Targeting */}
            <div className="chart-card" style={{ marginBottom: '24px' }}>
                <div className="chart-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={18} style={{ color: 'var(--gold)' }} /> Segmentação de Público
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                        <label className="form-label">Idade Mínima</label>
                        <input
                            className="form-input"
                            type="number"
                            value={form.age_min}
                            onChange={e => setForm({ ...form, age_min: e.target.value })}
                            min="18" max="65"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Idade Máxima</label>
                        <input
                            className="form-input"
                            type="number"
                            value={form.age_max}
                            onChange={e => setForm({ ...form, age_max: e.target.value })}
                            min="18" max="65"
                        />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Cidades (separadas por vírgula)</label>
                        <input
                            className="form-input"
                            value={form.cities}
                            onChange={e => setForm({ ...form, cities: e.target.value })}
                            placeholder="Balneário Camboriú, Itajaí, Florianópolis"
                        />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Interesses (separados por vírgula)</label>
                        <input
                            className="form-input"
                            value={form.interests}
                            onChange={e => setForm({ ...form, interests: e.target.value })}
                            placeholder="Imóveis de luxo, Investimento imobiliário, Decoração"
                        />
                    </div>
                </div>
            </div>

            {/* AI Toggle */}
            <div className="chart-card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '42px', height: '42px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Brain size={22} style={{ color: '#000' }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600 }}>Gerenciamento Autônomo da IA</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                A IA poderá pausar, escalar e ajustar orçamento automaticamente
                            </div>
                        </div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                        <input
                            type="checkbox"
                            checked={form.ai_auto_manage}
                            onChange={e => setForm({ ...form, ai_auto_manage: e.target.checked })}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: 'absolute', cursor: 'pointer', inset: 0, borderRadius: '26px',
                            background: form.ai_auto_manage ? 'var(--gold)' : 'var(--border-color)',
                            transition: '0.3s',
                        }}>
                            <span style={{
                                position: 'absolute', height: '20px', width: '20px', borderRadius: '50%',
                                left: form.ai_auto_manage ? '26px' : '3px', bottom: '3px',
                                background: '#fff', transition: '0.3s',
                            }} />
                        </span>
                    </label>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => router.push('/admin/ads')}>
                    Cancelar
                </button>
                <button className="btn btn-outline" onClick={handleSaveDraft} disabled={saving}>
                    <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Rascunho'}
                </button>
                <button className="btn btn-gold" onClick={handleSaveAndPublish} disabled={publishing}>
                    <Rocket size={16} /> {publishing ? 'Publicando...' : 'Criar e Publicar'}
                </button>
            </div>

            {/* Toast Styles */}
            <style>{`
                .admin-toast {
                    position: fixed; top: 24px; right: 24px;
                    padding: 14px 24px; border-radius: 12px;
                    font-size: 0.9rem; font-weight: 500;
                    display: flex; align-items: center; gap: 10px;
                    z-index: 10000; animation: toastIn 0.35s ease-out;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                }
                .admin-toast.success { background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.3); color: var(--success); }
                .admin-toast.error { background: rgba(248,113,113,0.15); border: 1px solid rgba(248,113,113,0.3); color: var(--danger); }
                @keyframes toastIn { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
            `}</style>
        </div>
    )
}
