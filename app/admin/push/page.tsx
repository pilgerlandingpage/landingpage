'use client'

import { useState, useEffect } from 'react'
import { Bell, Send, Users, CheckCircle, AlertCircle } from 'lucide-react'

export default function PushAdminPage() {
    const [stats, setStats] = useState({ total: 0, active: 0 })
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        title: '',
        message: '',
        url: 'https://',
        target: 'broadcast'
    })
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/push/stats')
            const data = await res.json()
            setStats({ total: data.total || 0, active: data.active || 0 })
        } catch (err) {
            console.error('[Push Admin] Failed to fetch stats:', err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setStatus(null)

        try {
            const res = await fetch('/api/admin/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })

            const data = await res.json()

            if (res.ok) {
                setStatus({ type: 'success', message: `Notificação enviada com sucesso! (${data.sent} enviados, ${data.failed} falhas)` })
                setForm(prev => ({ ...prev, title: '', message: '' }))
            } else {
                throw new Error(data.error || 'Erro ao enviar')
            }
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="push-page">
            <div className="admin-header push-header">
                <div>
                    <h1>Notificações Push</h1>
                    <p className="push-header-subtitle">Envie avisos rápidos para leads inscritos.</p>
                </div>
            </div>

            <div className="push-stats-grid">
                {/* Stats Card */}
                <div className="chart-card push-stat-card">
                    <div className="push-stat-icon">
                        <Users size={24} />
                    </div>
                    <div>
                        <p>Inscritos ativos</p>
                        <strong>{stats.active}</strong>
                    </div>
                </div>
            </div>

            <div className="push-layout-grid">
                {/* Send Form */}
                <div className="chart-card push-panel">
                    <h2 className="push-panel-title">
                        <Send size={20} className="text-[#c9a96e]" />
                        Nova notificação
                    </h2>

                    <form onSubmit={handleSubmit} className="push-form">
                        <div>
                            <label>Título</label>
                            <input
                                type="text"
                                className="form-input w-full"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="Ex: Oportunidade Exclusiva"
                                required
                            />
                        </div>

                        <div>
                            <label>Mensagem</label>
                            <textarea
                                className="form-textarea w-full h-32"
                                value={form.message}
                                onChange={e => setForm({ ...form, message: e.target.value })}
                                placeholder="Digite sua mensagem aqui..."
                                required
                            />
                        </div>

                        <div>
                            <label>Link de destino</label>
                            <input
                                type="url"
                                className="form-input w-full"
                                value={form.url}
                                onChange={e => setForm({ ...form, url: e.target.value })}
                                placeholder="https://seusite.com.br/promocao"
                            />
                            <p className="push-field-help">
                                O endereço completo para onde o usuário será levado ao clicar na notificação.
                            </p>
                        </div>

                        {status && (
                            <div className={`push-status ${status.type === 'success' ? 'success' : 'error'
                                }`}>
                                {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                {status.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || stats.active === 0}
                            className="btn btn-primary w-full justify-center"
                        >
                            {loading ? 'Enviando...' : `Enviar para ${stats.active} inscritos`}
                        </button>
                    </form>
                </div>

                {/* Preview Section */}
                <div className="chart-card push-panel push-preview-panel">
                    <h2 className="push-panel-title">
                        <Bell size={20} className="text-[#c9a96e]" />
                        Pré-visualização
                    </h2>

                    <div className="push-preview-stage">

                        {/* Windows 11 Style Notification Toast (Light Mode) */}
                        <div className="push-preview-toast">
                            {/* Header */}
                            <div className="push-preview-toast-header">
                                <div>
                                    <div className="push-preview-app-icon">
                                        <Bell size={10} className="text-white" />
                                    </div>
                                    <span>Pilger Landing Page</span>
                                    <small>Agora</small>
                                </div>
                                <button aria-label="Fechar preview">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            {/* Body */}
                            <div className="push-preview-toast-body">
                                <div>
                                    <h4>
                                        {form.title || 'Título da notificação'}
                                    </h4>
                                    <p>
                                        {form.message || 'Sua mensagem aparecerá aqui. Digite algo no formulário ao lado para ver como ficará para o usuário.'}
                                    </p>

                                    {/* Action / Domain */}
                                    <div className="push-preview-domain">
                                        <div>
                                            <span></span>
                                            {(() => {
                                                try {
                                                    return new URL(form.url).hostname.replace('www.', '')
                                                } catch {
                                                    return 'pilger.com.br'
                                                }
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Image Placeholder (if we had one, but we use Logo for now) */}
                                <div className="push-preview-image">
                                    <Users size={24} />
                                </div>
                            </div>
                        </div>

                        {/* Mobile Android Style Preview (Optional secondary or just stick to one good one) */}
                        <div className="push-preview-note">
                            * A aparência pode variar dependendo do sistema operacional (Windows, macOS, Android, iOS).
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
