'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'

interface ConfigItem {
    key: string
    value: string
    description: string | null
}

const CONFIG_KEYS = [
    { key: 'realtor_phone', label: 'Telefone do Corretor (Alertas VIP)', placeholder: '5511999999999', group: 'WhatsApp' },
    { key: 'welcome_message_template', label: 'Template Mensagem de Boas-Vindas', placeholder: 'Olá {{name}}!...', group: 'Mensagens' },
]

export default function SettingsPage() {
    const [configs, setConfigs] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase.from('app_config').select('*')
            const configMap: Record<string, string> = {}
            data?.forEach((item: ConfigItem) => {
                configMap[item.key] = item.value
            })
            setConfigs(configMap)
            setLoading(false)
        }
        fetch()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        for (const [key, value] of Object.entries(configs)) {
            await supabase
                .from('app_config')
                .upsert({ key, value, description: CONFIG_KEYS.find(c => c.key === key)?.label || '' })
        }
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    const groups = [...new Set(CONFIG_KEYS.map(c => c.group))]

    if (loading) {
        return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Carregando...</div>
    }

    return (
        <div>
            <div className="admin-header">
                <h1>Configurações</h1>
                <div className="admin-header-actions">
                    {saved && <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>✓ Salvo com sucesso!</span>}
                    <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
                        <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Tudo'}
                    </button>
                </div>
            </div>

            {groups.map(group => (
                <div key={group} className="chart-card" style={{ marginBottom: '24px' }}>
                    <div className="chart-title">{group}</div>
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {CONFIG_KEYS.filter(c => c.group === group).map(config => (
                            <div key={config.key} className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">{config.label}</label>
                                {config.key === 'welcome_message_template' ? (
                                    <textarea
                                        className="form-textarea"
                                        value={configs[config.key] || ''}
                                        onChange={e => setConfigs({ ...configs, [config.key]: e.target.value })}
                                        placeholder={config.placeholder}
                                    />
                                ) : (
                                    <input
                                        className="form-input"
                                        type={config.key.includes('key') || config.key.includes('api') ? 'password' : 'text'}
                                        value={configs[config.key] || ''}
                                        onChange={e => setConfigs({ ...configs, [config.key]: e.target.value })}
                                        placeholder={config.placeholder}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="chart-card">
                <div className="chart-title">ℹ️ Variáveis de Template</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
                    <code style={{ background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px' }}>{'{{name}}'}</code> — Nome do lead<br />
                    <code style={{ background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px' }}>{'{{property}}'}</code> — Nome do imóvel<br />
                    <code style={{ background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px' }}>{'{{phone}}'}</code> — Telefone do lead<br />
                    <code style={{ background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px' }}>{'{{email}}'}</code> — Email do lead
                </div>
            </div>
        </div>
    )
}
