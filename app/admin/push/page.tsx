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
        <div className="space-y-8">
            <div className="admin-header">
                <h1>Notificações Push</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Card */}
                <div className="chart-card flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-[#c9a96e]/20 flex items-center justify-center text-[#c9a96e]">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Inscritos Ativos</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Send Form */}
                <div className="chart-card">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Send size={20} className="text-[#c9a96e]" />
                        Nova Notificação
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm text-gray-500 mb-2">Título</label>
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
                            <label className="block text-sm text-gray-500 mb-2">Mensagem</label>
                            <textarea
                                className="form-textarea w-full h-32"
                                value={form.message}
                                onChange={e => setForm({ ...form, message: e.target.value })}
                                placeholder="Digite sua mensagem aqui..."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-500 mb-2">Link de Destino</label>
                            <input
                                type="url"
                                className="form-input w-full"
                                value={form.url}
                                onChange={e => setForm({ ...form, url: e.target.value })}
                                placeholder="https://seusite.com.br/promocao"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                O endereço completo para onde o usuário será levado ao clicar na notificação.
                            </p>
                        </div>

                        {status && (
                            <div className={`p-4 rounded-lg flex items-center gap-2 text-sm ${status.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-900/50' : 'bg-red-900/20 text-red-400 border border-red-900/50'
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
                <div className="chart-card flex flex-col">
                    <h2 className="text-lg font-bold text-gray-900 mb-8 flex items-center gap-2">
                        <Bell size={20} className="text-[#c9a96e]" />
                        Pré-visualização
                    </h2>

                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[url('/grid.svg')] bg-center bg-opacity-5 rounded-lg bg-gray-50 border border-gray-100">

                        {/* Windows 11 Style Notification Toast (Light Mode) */}
                        <div className="w-full max-w-[360px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden transform transition-all hover:scale-[1.02] duration-300">
                            {/* Header */}
                            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-[#c9a96e] flex items-center justify-center">
                                        <Bell size={10} className="text-white" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700">Pilger Landing Page</span>
                                    <span className="text-[10px] text-gray-400">• Agora</span>
                                </div>
                                <button className="text-gray-400 hover:text-gray-700">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-4 flex gap-4">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-gray-900 font-semibold text-sm leading-tight mb-1">
                                        {form.title || 'Título da Notificação'}
                                    </h4>
                                    <p className="text-gray-600 text-xs leading-relaxed line-clamp-3">
                                        {form.message || 'Sua mensagem aparecerá aqui. Digite algo no formulário ao lado para ver como ficará para o usuário.'}
                                    </p>

                                    {/* Action / Domain */}
                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="px-2 py-1 rounded bg-gray-100 text-[10px] text-gray-500 flex items-center gap-1 max-w-full truncate">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#c9a96e]"></div>
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
                                <div className="w-16 h-16 bg-gray-50 rounded-md flex items-center justify-center border border-gray-200 flex-shrink-0">
                                    <div className="text-[#c9a96e] opacity-50">
                                        <Users size={24} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Android Style Preview (Optional secondary or just stick to one good one) */}
                        <div className="mt-8 opacity-60 text-xs text-gray-500 text-center w-full px-8">
                            * A aparência pode variar dependendo do sistema operacional (Windows, macOS, Android, iOS).
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
