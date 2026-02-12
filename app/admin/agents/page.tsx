'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2 } from 'lucide-react'

interface Agent {
    id: string
    name: string
    system_prompt: string
    greeting_message: string | null
    extraction_goals: string[]
    temperature: number
    max_tokens: number
    created_at: string
}

export default function AgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
    const [form, setForm] = useState({
        name: '',
        system_prompt: 'Você é um corretor de imóveis de luxo sofisticado e cordial. Seu objetivo é ajudar o cliente a encontrar o imóvel perfeito e coletar seu nome, telefone e email de forma natural durante a conversa. Nunca peça todos os dados de uma vez. Seja elegante e consultivo.',
        greeting_message: 'Olá! 👋 Seja bem-vindo. Como posso ajudá-lo a encontrar o imóvel dos seus sonhos?',
        extraction_goals: 'name,phone,email',
        temperature: '0.7',
        max_tokens: '1024',
    })

    const supabase = createClient()

    const fetchAgents = async () => {
        const { data } = await supabase.from('ai_agents').select('*').order('created_at', { ascending: false })
        setAgents((data as Agent[]) || [])
        setLoading(false)
    }

    useEffect(() => { fetchAgents() }, [])

    const handleSave = async () => {
        const data = {
            name: form.name,
            system_prompt: form.system_prompt,
            greeting_message: form.greeting_message,
            extraction_goals: form.extraction_goals.split(',').map(g => g.trim()),
            temperature: parseFloat(form.temperature),
            max_tokens: parseInt(form.max_tokens),
        }

        if (editingAgent) {
            await supabase.from('ai_agents').update(data).eq('id', editingAgent.id)
        } else {
            await supabase.from('ai_agents').insert(data)
        }

        setShowForm(false)
        setEditingAgent(null)
        setForm({ name: '', system_prompt: form.system_prompt, greeting_message: '', extraction_goals: 'name,phone,email', temperature: '0.7', max_tokens: '1024' })
        fetchAgents()
    }

    const handleEdit = (agent: Agent) => {
        setEditingAgent(agent)
        setForm({
            name: agent.name,
            system_prompt: agent.system_prompt,
            greeting_message: agent.greeting_message || '',
            extraction_goals: agent.extraction_goals?.join(', ') || 'name,phone,email',
            temperature: String(agent.temperature),
            max_tokens: String(agent.max_tokens),
        })
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este agente?')) {
            await supabase.from('ai_agents').delete().eq('id', id)
            fetchAgents()
        }
    }

    return (
        <div>
            <div className="admin-header">
                <h1>Agentes IA</h1>
                <button className="btn btn-gold" onClick={() => { setShowForm(!showForm); setEditingAgent(null) }}>
                    <Plus size={18} /> Novo Agente
                </button>
            </div>

            {showForm && (
                <div className="chart-card" style={{ marginBottom: '24px' }}>
                    <div className="chart-title">{editingAgent ? 'Editar Agente' : 'Novo Agente IA'}</div>
                    <div className="form-group">
                        <label className="form-label">Nome do Agente</label>
                        <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Concierge Premium" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Prompt de Personalidade (System Prompt)</label>
                        <textarea className="form-textarea" style={{ minHeight: '200px' }} value={form.system_prompt} onChange={e => setForm({ ...form, system_prompt: e.target.value })} placeholder="Descreva a personalidade e objetivos do agente..." />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Mensagem de Boas-Vindas</label>
                        <input className="form-input" value={form.greeting_message} onChange={e => setForm({ ...form, greeting_message: e.target.value })} placeholder="Olá! 👋 Como posso ajudá-lo?" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">Objetivos de Extração</label>
                            <input className="form-input" value={form.extraction_goals} onChange={e => setForm({ ...form, extraction_goals: e.target.value })} placeholder="name, phone, email" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Temperatura (0.0 - 1.0)</label>
                            <input className="form-input" type="number" step="0.1" min="0" max="1" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Max Tokens</label>
                            <input className="form-input" type="number" value={form.max_tokens} onChange={e => setForm({ ...form, max_tokens: e.target.value })} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button className="btn btn-gold" onClick={handleSave}>Salvar</button>
                        <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditingAgent(null) }}>Cancelar</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {loading ? (
                    <p style={{ color: 'var(--text-muted)', padding: '40px' }}>Carregando...</p>
                ) : agents.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', padding: '40px' }}>Nenhum agente criado. Crie seu primeiro agente IA!</p>
                ) : (
                    agents.map(agent => (
                        <div key={agent.id} className="chart-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <div className="chart-title" style={{ marginBottom: '4px' }}>🤖 {agent.name}</div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        Temp: {agent.temperature} | Max: {agent.max_tokens} tokens
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-outline btn-sm" onClick={() => handleEdit(agent)}><Edit size={14} /></button>
                                    <button className="btn btn-outline btn-sm" onClick={() => handleDelete(agent.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {agent.system_prompt.substring(0, 200)}...
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {agent.extraction_goals?.map((goal, i) => (
                                    <span key={i} className="badge badge-gold">{goal}</span>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
