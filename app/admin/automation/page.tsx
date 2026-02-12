'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Zap, ZapOff } from 'lucide-react'

interface AutomationRule {
    id: string
    name: string
    trigger_type: string
    delay_minutes: number
    message_template: string
    active: boolean
    landing_page_id: string | null
    created_at: string
}

const triggerLabels: Record<string, string> = {
    lead_created: '📞 Lead Capturado',
    time_delay: '⏰ Tempo Após Cadastro',
    funnel_stage: '📊 Mudança de Estágio',
    vip_detected: '⭐ VIP Detectado',
}

export default function AutomationPage() {
    const [rules, setRules] = useState<AutomationRule[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({
        name: '',
        trigger_type: 'lead_created',
        delay_minutes: '0',
        message_template: 'Olá {{name}}! 👋 Obrigado pelo interesse em {{property}}.',
        active: true,
    })

    const supabase = createClient()

    const fetchRules = async () => {
        const { data } = await supabase.from('lp_automation_rules').select('*').order('created_at', { ascending: false })
        setRules((data as AutomationRule[]) || [])
        setLoading(false)
    }

    useEffect(() => { fetchRules() }, [])

    const handleSave = async () => {
        await supabase.from('lp_automation_rules').insert({
            name: form.name,
            trigger_type: form.trigger_type,
            delay_minutes: parseInt(form.delay_minutes),
            message_template: form.message_template,
            active: form.active,
        })
        setShowForm(false)
        setForm({ name: '', trigger_type: 'lead_created', delay_minutes: '0', message_template: 'Olá {{name}}! 👋 Obrigado pelo interesse em {{property}}.', active: true })
        fetchRules()
    }

    const toggleActive = async (id: string, active: boolean) => {
        await supabase.from('lp_automation_rules').update({ active: !active }).eq('id', id)
        fetchRules()
    }

    const handleDelete = async (id: string) => {
        if (confirm('Excluir esta regra?')) {
            await supabase.from('lp_automation_rules').delete().eq('id', id)
            fetchRules()
        }
    }

    return (
        <div>
            <div className="admin-header">
                <h1>Automações</h1>
                <button className="btn btn-gold" onClick={() => setShowForm(!showForm)}>
                    <Plus size={18} /> Nova Regra
                </button>
            </div>

            {showForm && (
                <div className="chart-card" style={{ marginBottom: '24px' }}>
                    <div className="chart-title">Nova Regra de Automação</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">Nome da Regra</label>
                            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Boas-vindas WhatsApp" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Gatilho</label>
                            <select className="form-select" value={form.trigger_type} onChange={e => setForm({ ...form, trigger_type: e.target.value })}>
                                <option value="lead_created">Lead Capturado</option>
                                <option value="time_delay">Tempo Após Cadastro</option>
                                <option value="funnel_stage">Mudança de Estágio</option>
                                <option value="vip_detected">VIP Detectado</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Atraso (minutos)</label>
                            <input className="form-input" type="number" value={form.delay_minutes} onChange={e => setForm({ ...form, delay_minutes: e.target.value })} placeholder="0 = imediato" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Template da Mensagem</label>
                        <textarea className="form-textarea" value={form.message_template} onChange={e => setForm({ ...form, message_template: e.target.value })} placeholder="Use {{name}} e {{property}} como variáveis" />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Variáveis: {'{{name}}'}, {'{{property}}'}, {'{{phone}}'}, {'{{email}}'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button className="btn btn-gold" onClick={handleSave}>Salvar</button>
                        <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loading ? (
                    <p style={{ color: 'var(--text-muted)', padding: '40px' }}>Carregando...</p>
                ) : rules.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', padding: '40px' }}>Nenhuma regra criada.</p>
                ) : (
                    rules.map(rule => (
                        <div key={rule.id} className="chart-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600 }}>{rule.name}</span>
                                    <span className={`badge ${rule.active ? 'badge-success' : 'badge-danger'}`}>
                                        {rule.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {triggerLabels[rule.trigger_type] || rule.trigger_type}
                                    {rule.delay_minutes > 0 && ` • Atraso: ${rule.delay_minutes} min`}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                    &quot;{rule.message_template.substring(0, 80)}...&quot;
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-outline btn-sm" onClick={() => toggleActive(rule.id, rule.active)}>
                                    {rule.active ? <ZapOff size={14} /> : <Zap size={14} />}
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => handleDelete(rule.id)} style={{ color: 'var(--danger)' }}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
