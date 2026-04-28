'use client'

import { useState, useEffect } from 'react'
import {
    Brain, Loader2, Save, Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
    MessageSquare, List, BarChart3, MapPin, ArrowRight, Clock, Shield,
    Smile, Type, Zap, Eye, Volume2, RefreshCw, Sparkles
} from 'lucide-react'
import type { AgentFlowConfig, AgentFlowStep } from '@/lib/ai/prompt-builder'
import { DEFAULT_FLOW_CONFIG, buildAgentPrompt } from '@/lib/ai/prompt-builder'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

const TONE_OPTIONS = [
    { value: 'formal', label: '🏢 Formal', desc: '"Bom dia, como posso ajudá-lo?"' },
    { value: 'friendly', label: '😊 Amigável', desc: '"Oi! Tudo bem? Me conta o que você tá procurando!"' },
    { value: 'casual', label: '🔥 Descontraído', desc: '"E aí! Beleza? Bora achar o apê perfeito!"' },
    { value: 'premium', label: '💎 Premium', desc: '"Seja bem-vindo. Que experiência exclusiva posso proporcionar?"' },
]

const EMOJI_OPTIONS = [
    { value: 'none', label: 'Nenhum', desc: 'Zero emojis' },
    { value: 'low', label: 'Pouco', desc: '1 por msg' },
    { value: 'medium', label: 'Médio', desc: '2-3 por msg' },
    { value: 'high', label: 'Muito', desc: '🏠🔥✨' },
]

const LENGTH_OPTIONS = [
    { value: 'short', label: 'Curto', desc: '1-2 linhas' },
    { value: 'medium', label: 'Médio', desc: '2-3 linhas' },
    { value: 'long', label: 'Longo', desc: '3-5 linhas' },
]

const STEP_TYPES = [
    { value: 'text', label: 'Texto Livre', icon: <Type size={14} /> },
    { value: 'buttons', label: 'Botões', icon: <MessageSquare size={14} /> },
    { value: 'list', label: 'Lista', icon: <List size={14} /> },
    { value: 'poll', label: 'Enquete', icon: <BarChart3 size={14} /> },
    { value: 'location', label: 'Localização', icon: <MapPin size={14} /> },
    { value: 'transfer', label: 'Transferir', icon: <ArrowRight size={14} /> },
]

const PRESETS: Record<string, { label: string; desc: string; steps: AgentFlowStep[] }> = {
    fast: {
        label: '⚡ Rápido (3 steps)',
        desc: 'Cumprimento → Botões → Transfere',
        steps: [
            { id: 's1', label: 'Cumprimento', type: 'text', instruction: 'Cumprimente e pergunte o interesse brevemente' },
            { id: 's2', label: 'Interesse + Região', type: 'buttons', instruction: 'Pergunte tipo e região junto', buttonTitle: 'Como posso ajudar?', buttonOptions: ['Comprar', 'Alugar', 'Investir'] },
            { id: 's3', label: 'Transferir', type: 'transfer', instruction: 'Transfira para o corretor', transferMessage: 'Beleza! Vou te passar pro corretor que cuida dessa área!' },
        ]
    },
    standard: {
        label: '📋 Padrão (5 steps)',
        desc: 'Cumprimento → Tipo → Região → Preço → Transfere',
        steps: DEFAULT_FLOW_CONFIG.steps,
    },
    complete: {
        label: '🏆 Completo (7 steps)',
        desc: 'Inclui enquete de prioridades e localização',
        steps: [
            { id: 's1', label: 'Cumprimento', type: 'text', instruction: 'Cumprimente pelo nome, crie rapport' },
            { id: 's2', label: 'Tipo de Interesse', type: 'buttons', instruction: 'Pergunte o objetivo', buttonTitle: 'O que te traria aqui?', buttonOptions: ['Morar', 'Investir', 'Ambos'] },
            { id: 's3', label: 'Região', type: 'list', instruction: 'Ofereça regiões', listButtonText: 'Ver regiões', listSections: DEFAULT_FLOW_CONFIG.steps[2]?.listSections || [] },
            { id: 's4', label: 'Prioridades', type: 'poll', instruction: 'Descubra o que importa mais', pollQuestion: 'O que é mais importante pra você?', pollOptions: ['Localização', 'Preço', 'Acabamento', 'Lazer', 'Vista'] },
            { id: 's5', label: 'Orçamento', type: 'text', instruction: 'Pergunte a faixa de preço de forma sutil' },
            { id: 's6', label: 'Localização', type: 'location', instruction: 'Peça a localização para sugerir imóveis próximos' },
            { id: 's7', label: 'Transferir', type: 'transfer', instruction: 'Confirme dados e transfira', transferMessage: 'Perfeito! Tenho tudo anotado. Vou te passar pro corretor especialista na região!' },
        ]
    },
}

export default function AgentFlowPage() {
    const [config, setConfig] = useState<AgentFlowConfig>(DEFAULT_FLOW_CONFIG)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [expandedSection, setExpandedSection] = useState<string | null>('personality')
    const [showPreview, setShowPreview] = useState(false)
    const [showPrompt, setShowPrompt] = useState(false)
    const [newTag, setNewTag] = useState('')
    const [newMentionTag, setNewMentionTag] = useState('')

    useEffect(() => { loadConfig() }, [])

    const loadConfig = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/whatsapp/agent-flow')
            const data = await res.json()
            if (data.success && data.config) {
                setConfig({ ...DEFAULT_FLOW_CONFIG, ...data.config })
            }
        } catch { /* use defaults */ }
        finally { setLoading(false) }
    }

    const saveConfig = async () => {
        setSaving(true)
        setFeedback(null)
        try {
            const res = await fetch('/api/admin/whatsapp/agent-flow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: '✅ Fluxo salvo! O agente já usará estas configurações.' })
            } else {
                setFeedback({ type: 'error', text: `❌ ${data.message}` })
            }
        } catch { setFeedback({ type: 'error', text: '❌ Erro de conexão' }) }
        finally { setSaving(false) }
    }

    const updatePersonality = (key: string, value: any) => {
        setConfig(prev => ({ ...prev, personality: { ...prev.personality, [key]: value } }))
    }

    const updateBehavior = (key: string, value: any) => {
        setConfig(prev => ({ ...prev, behavior: { ...prev.behavior, [key]: value } }))
    }

    const updateRules = (key: string, value: any) => {
        setConfig(prev => ({ ...prev, rules: { ...prev.rules, [key]: value } }))
    }

    const updateStep = (index: number, updates: Partial<AgentFlowStep>) => {
        setConfig(prev => {
            const steps = [...prev.steps]
            steps[index] = { ...steps[index], ...updates }
            return { ...prev, steps }
        })
    }

    const addStep = () => {
        const newStep: AgentFlowStep = {
            id: `step_${Date.now()}`,
            label: 'Novo Passo',
            type: 'text',
            instruction: '',
        }
        setConfig(prev => ({ ...prev, steps: [...prev.steps, newStep] }))
    }

    const removeStep = (index: number) => {
        setConfig(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }))
    }

    const moveStep = (from: number, to: number) => {
        if (to < 0 || to >= config.steps.length) return
        setConfig(prev => {
            const steps = [...prev.steps]
            const [item] = steps.splice(from, 1)
            steps.splice(to, 0, item)
            return { ...prev, steps }
        })
    }

    const applyPreset = (key: string) => {
        const preset = PRESETS[key]
        if (preset) {
            setConfig(prev => ({ ...prev, steps: preset.steps.map(s => ({ ...s })) }))
            setFeedback({ type: 'success', text: `✅ Preset "${preset.label}" aplicado!` })
        }
    }

    const toggleSection = (section: string) => {
        setExpandedSection(prev => prev === section ? null : section)
    }

    if (loading) return <AdminLoadingState message="Carregando configurações..." minHeight="400px" />

    const generatedPrompt = buildAgentPrompt(config, 'Corretor')

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', margin: 0 }}>
                        <Brain size={26} style={{ color: 'var(--gold)' }} /> Fluxo de Atendimento IA
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                        Configure como o agente atende — personalidade, fluxo de qualificação e comportamento humano
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowPreview(!showPreview)}
                        style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: showPreview ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)', color: showPreview ? '#818cf8' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, fontSize: '0.85rem' }}>
                        <Eye size={16} /> Preview
                    </button>
                    <button onClick={saveConfig} disabled={saving}
                        style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, var(--gold), #b8860b)', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', opacity: saving ? 0.6 : 1 }}>
                        {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                        {saving ? 'Salvando...' : 'Salvar Fluxo'}
                    </button>
                </div>
            </div>

            {/* Feedback */}
            {feedback && (
                <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem', background: feedback.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: feedback.type === 'success' ? '#22c55e' : '#ef4444', border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                    {feedback.text}
                </div>
            )}

            {/* ═══ SECTION 1: PERSONALIDADE ═══ */}
            <SectionCard title="🎭 Personalidade do Agente" subtitle="Defina como o agente fala" section="personality" expanded={expandedSection} onToggle={toggleSection}>
                {/* Tone */}
                <Label text="Tom de Comunicação" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                    {TONE_OPTIONS.map(t => (
                        <div key={t.value} onClick={() => updatePersonality('tone', t.value)}
                            style={{ padding: '12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${config.personality.tone === t.value ? 'var(--gold)' : 'var(--border)'}`, background: config.personality.tone === t.value ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: config.personality.tone === t.value ? 'var(--gold)' : 'var(--text-primary)' }}>{t.label}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.desc}</div>
                        </div>
                    ))}
                </div>

                {/* Emoji Level */}
                <Label text="Nível de Emojis" />
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {EMOJI_OPTIONS.map(e => (
                        <button key={e.value} onClick={() => updatePersonality('emojiLevel', e.value)}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${config.personality.emojiLevel === e.value ? 'var(--gold)' : 'var(--border)'}`, background: config.personality.emojiLevel === e.value ? 'rgba(201,169,110,0.12)' : 'transparent', color: config.personality.emojiLevel === e.value ? 'var(--gold)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 }}>
                            {e.label} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({e.desc})</span>
                        </button>
                    ))}
                </div>

                {/* Message Length */}
                <Label text="Tamanho das Mensagens" />
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {LENGTH_OPTIONS.map(l => (
                        <button key={l.value} onClick={() => updatePersonality('messageLength', l.value)}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${config.personality.messageLength === l.value ? 'var(--gold)' : 'var(--border)'}`, background: config.personality.messageLength === l.value ? 'rgba(201,169,110,0.12)' : 'transparent', color: config.personality.messageLength === l.value ? 'var(--gold)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 }}>
                            {l.label} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({l.desc})</span>
                        </button>
                    ))}
                </div>

                {/* Toggles */}
                <div style={{ display: 'grid', gap: '8px' }}>
                    <ToggleRow label="Evitar frases genéricas de IA" desc='"Como posso ajudá-lo?", "Estou aqui para ajudar!"' checked={config.personality.avoidAIPhrases} onChange={() => updatePersonality('avoidAIPhrases', !config.personality.avoidAIPhrases)} />
                    <ToggleRow label="Usar abreviações de WhatsApp" desc='"vc", "pq", "blz", "tb" — mais natural' checked={config.personality.abbreviations} onChange={() => updatePersonality('abbreviations', !config.personality.abbreviations)} />
                </div>
            </SectionCard>

            {/* ═══ SECTION 2: FLUXO DE QUALIFICAÇÃO ═══ */}
            <SectionCard title="📋 Fluxo de Qualificação" subtitle="Monte a sequência de perguntas do agente" section="flow" expanded={expandedSection} onToggle={toggleSection}>
                {/* Presets */}
                <Label text="Presets — Começar com um modelo" />
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {Object.entries(PRESETS).map(([key, preset]) => (
                        <button key={key} onClick={() => applyPreset(key)}
                            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={12} style={{ color: 'var(--gold)' }} />
                            {preset.label}
                        </button>
                    ))}
                </div>

                {/* Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {config.steps.map((step, idx) => (
                        <StepCard key={step.id} step={step} index={idx} total={config.steps.length}
                            onUpdate={(updates) => updateStep(idx, updates)}
                            onRemove={() => removeStep(idx)}
                            onMoveUp={() => moveStep(idx, idx - 1)}
                            onMoveDown={() => moveStep(idx, idx + 1)} />
                    ))}
                </div>

                <button onClick={addStep}
                    style={{ marginTop: '12px', padding: '12px 20px', borderRadius: '10px', border: '2px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 500 }}>
                    <Plus size={16} /> Adicionar Passo
                </button>
            </SectionCard>

            {/* ═══ SECTION 3: COMPORTAMENTO HUMANO ═══ */}
            <SectionCard title="⏱️ Comportamento Humano" subtitle="Faça o agente parecer uma pessoa real" section="behavior" expanded={expandedSection} onToggle={toggleSection}>
                <Label text="Velocidade de Resposta" />
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {[
                        { value: 'fast', label: '⚡ Rápido', desc: '3-8s' },
                        { value: 'normal', label: '👤 Normal', desc: '8-15s' },
                        { value: 'relaxed', label: '☕ Relaxado', desc: '15-30s' },
                    ].map(d => (
                        <button key={d.value} onClick={() => updateBehavior('responseDelay', d.value)}
                            style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${config.behavior.responseDelay === d.value ? 'var(--gold)' : 'var(--border)'}`, background: config.behavior.responseDelay === d.value ? 'rgba(201,169,110,0.12)' : 'transparent', color: config.behavior.responseDelay === d.value ? 'var(--gold)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                            {d.label} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>({d.desc})</span>
                        </button>
                    ))}
                </div>

                {/* Audio Chance */}
                <Label text={`Chance de responder com áudio: ${config.behavior.audioChance}%`} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Volume2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input type="range" min={0} max={50} step={5} value={config.behavior.audioChance}
                        onChange={e => updateBehavior('audioChance', parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--gold)' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 600, minWidth: '35px' }}>{config.behavior.audioChance}%</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    💡 Responder com áudio aleatoriamente torna o agente mais humano. Recomendação: 10-20%
                </div>

                {/* Working Hours */}
                <ToggleRow label="Horário de Atendimento" desc="Definir horário de funcionamento"
                    checked={config.behavior.workingHours.enabled}
                    onChange={() => updateBehavior('workingHours', { ...config.behavior.workingHours, enabled: !config.behavior.workingHours.enabled })} />
                {config.behavior.workingHours.enabled && (
                    <div style={{ marginTop: '8px', padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'grid', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Início</label>
                                <input type="time" value={config.behavior.workingHours.start}
                                    onChange={e => updateBehavior('workingHours', { ...config.behavior.workingHours, start: e.target.value })}
                                    style={{ display: 'block', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fim</label>
                                <input type="time" value={config.behavior.workingHours.end}
                                    onChange={e => updateBehavior('workingHours', { ...config.behavior.workingHours, end: e.target.value })}
                                    style={{ display: 'block', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mensagem fora do horário</label>
                            <textarea value={config.behavior.workingHours.offMessage}
                                onChange={e => updateBehavior('workingHours', { ...config.behavior.workingHours, offMessage: e.target.value })}
                                rows={2} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                )}
            </SectionCard>

            {/* ═══ SECTION 4: REGRAS ═══ */}
            <SectionCard title="🚫 Regras e Limites" subtitle="O que o agente pode e não pode fazer" section="rules" expanded={expandedSection} onToggle={toggleSection}>
                {/* Never Mention */}
                <Label text="Nunca falar sobre" />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {config.rules.neverMention.map(tag => (
                        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '0.8rem' }}>
                            {tag}
                            <button onClick={() => updateRules('neverMention', config.rules.neverMention.filter(t => t !== tag))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}>×</button>
                        </span>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                    <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Ex: comissão, desconto..."
                        onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { updateRules('neverMention', [...config.rules.neverMention, newTag.trim()]); setNewTag('') } }}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }} />
                    <button onClick={() => { if (newTag.trim()) { updateRules('neverMention', [...config.rules.neverMention, newTag.trim()]); setNewTag('') } }}
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>+ Adicionar</button>
                </div>

                {/* Always Mention */}
                <Label text="Sempre mencionar (quando pertinente)" />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {config.rules.alwaysMention.map(tag => (
                        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: '0.8rem' }}>
                            {tag}
                            <button onClick={() => updateRules('alwaysMention', config.rules.alwaysMention.filter(t => t !== tag))} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}>×</button>
                        </span>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                    <input value={newMentionTag} onChange={e => setNewMentionTag(e.target.value)} placeholder="Ex: exclusividade Pilger, vista mar..."
                        onKeyDown={e => { if (e.key === 'Enter' && newMentionTag.trim()) { updateRules('alwaysMention', [...config.rules.alwaysMention, newMentionTag.trim()]); setNewMentionTag('') } }}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }} />
                    <button onClick={() => { if (newMentionTag.trim()) { updateRules('alwaysMention', [...config.rules.alwaysMention, newMentionTag.trim()]); setNewMentionTag('') } }}
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', cursor: 'pointer', fontSize: '0.8rem' }}>+ Adicionar</button>
                </div>

                {/* Max messages */}
                <Label text={`Máximo de mensagens antes de transferir: ${config.rules.maxMessagesBeforeTransfer}`} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <input type="range" min={3} max={20} value={config.rules.maxMessagesBeforeTransfer}
                        onChange={e => updateRules('maxMessagesBeforeTransfer', parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--gold)' }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--gold)', fontWeight: 600, minWidth: '25px' }}>{config.rules.maxMessagesBeforeTransfer}</span>
                </div>

                {/* Auto transfer conditions */}
                <Label text="Transferir automaticamente quando" />
                <div style={{ display: 'grid', gap: '8px' }}>
                    <ToggleRow label="Coletou todos os dados (nome + interesse + orçamento + região)" desc="" checked={config.rules.autoTransferConditions.allDataCollected} onChange={() => updateRules('autoTransferConditions', { ...config.rules.autoTransferConditions, allDataCollected: !config.rules.autoTransferConditions.allDataCollected })} />
                    <ToggleRow label="Cliente pediu para falar com humano" desc="" checked={config.rules.autoTransferConditions.clientRequestsHuman} onChange={() => updateRules('autoTransferConditions', { ...config.rules.autoTransferConditions, clientRequestsHuman: !config.rules.autoTransferConditions.clientRequestsHuman })} />
                    <ToggleRow label="Cliente demonstrou irritação" desc="" checked={config.rules.autoTransferConditions.clientImpatient} onChange={() => updateRules('autoTransferConditions', { ...config.rules.autoTransferConditions, clientImpatient: !config.rules.autoTransferConditions.clientImpatient })} />
                </div>
            </SectionCard>

            {/* ═══ SECTION 5: PREVIEW ═══ */}
            {showPreview && (
                <div style={{ marginTop: '20px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {/* Chat Header */}
                    <div style={{ padding: '14px 20px', background: '#075e54', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MessageSquare size={18} color="white" />
                        </div>
                        <div>
                            <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>Preview do Fluxo</div>
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>Simulação baseada nas suas configurações</div>
                        </div>
                    </div>
                    {/* Chat Body */}
                    <div style={{ padding: '16px 20px', background: '#0b141a', minHeight: '200px' }}>
                        {/* Lead first message */}
                        <ChatBubble side="left" text="Oi, vi um imóvel no site de vocês, queria saber mais" />
                        {/* Agent responses based on steps */}
                        {config.steps.map((step, idx) => (
                            <div key={step.id}>
                                {idx === 0 && step.type === 'text' && (
                                    <ChatBubble side="right" text={
                                        config.personality.tone === 'formal' ? 'Bom dia! Obrigado pelo seu interesse. Poderia me dizer seu nome e qual tipo de imóvel procura?' :
                                            config.personality.tone === 'casual' ? 'E aí! Beleza? Me conta, o que vc tá procurando?' :
                                                config.personality.tone === 'premium' ? 'Seja muito bem-vindo! Qual experiência imobiliária posso lhe proporcionar?' :
                                                    'Oi! Que bom que se interessou! Me conta, o que você está procurando?'
                                    } />
                                )}
                                {step.type === 'buttons' && step.buttonOptions && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                        <div style={{ maxWidth: '280px' }}>
                                            <div style={{ padding: '10px 14px', borderRadius: '10px 10px 0 0', background: '#005c4b', color: 'white', fontSize: '0.85rem' }}>
                                                {step.instruction || 'Escolha uma opção'}
                                            </div>
                                            {step.buttonOptions.map(opt => (
                                                <div key={opt} style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', background: '#005c4b', color: '#53bdeb', fontSize: '0.85rem', textAlign: 'center', fontWeight: 500 }}>
                                                    {opt}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {step.type === 'list' && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                        <div style={{ maxWidth: '280px', padding: '10px 14px', borderRadius: '10px', background: '#005c4b' }}>
                                            <div style={{ color: 'white', fontSize: '0.85rem', marginBottom: '8px' }}>{step.instruction}</div>
                                            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', color: '#53bdeb', fontSize: '0.82rem', textAlign: 'center', fontWeight: 500 }}>
                                                📋 {step.listButtonText || 'Ver opções'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {step.type === 'transfer' && (
                                    <ChatBubble side="right" text={step.transferMessage || 'Vou te passar pro corretor! Um momento...'} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Generated Prompt Toggle */}
            <div style={{ marginTop: '20px' }}>
                <button onClick={() => setShowPrompt(!showPrompt)}
                    style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <Zap size={14} style={{ color: 'var(--gold)' }} />
                    {showPrompt ? 'Esconder' : 'Ver'} Prompt Gerado (técnico)
                    {showPrompt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showPrompt && (
                    <pre style={{ marginTop: '8px', padding: '16px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '400px', overflow: 'auto', fontFamily: 'monospace' }}>
                        {generatedPrompt}
                    </pre>
                )}
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                .spin { animation: spin 1.2s linear infinite; }
            `}</style>
        </div>
    )
}

// ═══════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════

function SectionCard({ title, subtitle, section, expanded, onToggle, children }: {
    title: string; subtitle: string; section: string; expanded: string | null; onToggle: (s: string) => void; children: React.ReactNode
}) {
    const isOpen = expanded === section
    return (
        <div style={{ marginBottom: '12px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <button onClick={() => onToggle(section)}
                style={{ width: '100%', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {isOpen && <div style={{ padding: '0 20px 20px' }}>{children}</div>}
        </div>
    )
}

function Label({ text }: { text: string }) {
    return <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px' }}>{text}</div>
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void }) {
    return (
        <div onClick={onChange} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
                {desc && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>}
            </div>
            <div style={{ width: '40px', height: '22px', borderRadius: '11px', background: checked ? '#22c55e' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: checked ? '21px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
        </div>
    )
}

function ChatBubble({ side, text }: { side: 'left' | 'right'; text: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: side === 'right' ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
            <div style={{ maxWidth: '280px', padding: '8px 12px', borderRadius: '10px', background: side === 'right' ? '#005c4b' : '#202c33', color: 'white', fontSize: '0.85rem', lineHeight: 1.4 }}>
                {text}
            </div>
        </div>
    )
}

function StepCard({ step, index, total, onUpdate, onRemove, onMoveUp, onMoveDown }: {
    step: AgentFlowStep; index: number; total: number
    onUpdate: (u: Partial<AgentFlowStep>) => void; onRemove: () => void
    onMoveUp: () => void; onMoveDown: () => void
}) {
    const [expanded, setExpanded] = useState(false)
    const typeInfo = STEP_TYPES.find(t => t.value === step.type)

    return (
        <div style={{ borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
            {/* Step Header */}
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); onMoveUp() }} disabled={index === 0}
                        style={{ padding: '2px', background: 'none', border: 'none', color: index === 0 ? 'var(--border)' : 'var(--text-muted)', cursor: index === 0 ? 'default' : 'pointer', fontSize: '0.6rem' }}>▲</button>
                    <button onClick={e => { e.stopPropagation(); onMoveDown() }} disabled={index === total - 1}
                        style={{ padding: '2px', background: 'none', border: 'none', color: index === total - 1 ? 'var(--border)' : 'var(--text-muted)', cursor: index === total - 1 ? 'default' : 'pointer', fontSize: '0.6rem' }}>▼</button>
                </div>
                <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(201,169,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold)', flexShrink: 0 }}>
                    {index + 1}
                </span>
                <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{step.label}</span>
                <span style={{ padding: '3px 8px', borderRadius: '5px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontSize: '0.7rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {typeInfo?.icon} {typeInfo?.label}
                </span>
                <button onClick={e => { e.stopPropagation(); onRemove() }}
                    style={{ padding: '4px', borderRadius: '4px', background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Step Details */}
            {expanded && (
                <div style={{ padding: '0 14px 14px', display: 'grid', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Nome do Passo</label>
                            <input value={step.label} onChange={e => onUpdate({ label: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tipo</label>
                            <select value={step.type} onChange={e => onUpdate({ type: e.target.value as any })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                                {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Instrução para a IA</label>
                        <textarea value={step.instruction} onChange={e => onUpdate({ instruction: e.target.value })} rows={2}
                            placeholder="O que o agente deve fazer neste passo..."
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    {/* Type-specific fields */}
                    {step.type === 'buttons' && (
                        <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                            <label style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 600 }}>Título do Botão</label>
                            <input value={step.buttonTitle || ''} onChange={e => onUpdate({ buttonTitle: e.target.value })}
                                placeholder="Ex: O que te traria aqui?"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.2)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.82rem', marginBottom: '8px', outline: 'none', boxSizing: 'border-box' }} />
                            <label style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 600 }}>Opções (máx 3, separadas por Enter)</label>
                            <textarea value={(step.buttonOptions || []).join('\n')} rows={3}
                                onChange={e => onUpdate({ buttonOptions: e.target.value.split('\n').filter(s => s.trim()) })}
                                placeholder="Morar&#10;Investir&#10;Ambos"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.2)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    )}

                    {step.type === 'list' && (
                        <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
                            <label style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600 }}>Texto do Botão</label>
                            <input value={step.listButtonText || ''} onChange={e => onUpdate({ listButtonText: e.target.value })}
                                placeholder="Ex: Ver regiões"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.2)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.82rem', marginBottom: '8px', outline: 'none', boxSizing: 'border-box' }} />
                            <label style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600 }}>Seções e Itens (formato: Seção: Item1, Item2)</label>
                            <textarea value={(step.listSections || []).map(s => `${s.title}: ${s.items.map(i => i.name).join(', ')}`).join('\n')} rows={4}
                                onChange={e => {
                                    const sections = e.target.value.split('\n').filter(l => l.trim()).map(line => {
                                        const [title, ...rest] = line.split(':')
                                        const items = rest.join(':').split(',').filter(s => s.trim()).map(name => ({ name: name.trim() }))
                                        return { title: title.trim(), items }
                                    })
                                    onUpdate({ listSections: sections })
                                }}
                                placeholder="Litoral: Balneário Camboriú, Itapema&#10;Interior: Blumenau, Joinville"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.2)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    )}

                    {step.type === 'poll' && (
                        <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                            <label style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>Pergunta da Enquete</label>
                            <input value={step.pollQuestion || ''} onChange={e => onUpdate({ pollQuestion: e.target.value })}
                                placeholder="Ex: O que é mais importante pra você?"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(251,191,36,0.2)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.82rem', marginBottom: '8px', outline: 'none', boxSizing: 'border-box' }} />
                            <label style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>Opções (uma por linha)</label>
                            <textarea value={(step.pollOptions || []).join('\n')} rows={4}
                                onChange={e => onUpdate({ pollOptions: e.target.value.split('\n').filter(s => s.trim()) })}
                                placeholder="Localização&#10;Preço&#10;Acabamento&#10;Lazer"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(251,191,36,0.2)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    )}

                    {step.type === 'transfer' && (
                        <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.15)' }}>
                            <label style={{ fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 600 }}>Mensagem de Transferência</label>
                            <textarea value={step.transferMessage || ''} onChange={e => onUpdate({ transferMessage: e.target.value })} rows={2}
                                placeholder="Ex: Show! Vou te passar pro corretor que cuida dessa região!"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(201,169,110,0.2)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
