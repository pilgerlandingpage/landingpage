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
                        <p className="text-sm text-[#888]">Inscritos Ativos</p>
                        <p className="text-2xl font-bold text-[#f5f5f5]">{stats.active}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Send Form */}
                <div className="chart-card">
                    <h2 className="text-lg font-bold text-[#f5f5f5] mb-6 flex items-center gap-2">
                        <Send size={20} className="text-[#c9a96e]" />
                        Nova Notificação
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm text-[#888] mb-2">Título</label>
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
                            <label className="block text-sm text-[#888] mb-2">Mensagem</label>
                            <textarea
                                className="form-textarea w-full h-32"
                                value={form.message}
                                onChange={e => setForm({ ...form, message: e.target.value })}
                                placeholder="Digite sua mensagem aqui..."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[#888] mb-2">Link de Destino</label>
                            <input
                                type="url"
                                className="form-input w-full"
                                value={form.url}
                                onChange={e => setForm({ ...form, url: e.target.value })}
                                placeholder="https://seusite.com.br/promocao"
                            />
                            <p className="text-xs text-[#666] mt-1">
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

                {/* Preview */}
                <div className="chart-card bg-[#111] border-dashed border-[#333]">
                    <h2 className="text-lg font-bold text-[#f5f5f5] mb-6 flex items-center gap-2">
                        <Bell size={20} className="text-[#c9a96e]" />
                        Pré-visualização
                    </h2>

                    <div className="flex items-center justify-center h-64">
                        <div className="bg-[#222] p-4 rounded-xl shadow-2xl max-w-sm w-full border border-[#333] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-[#c9a96e]"></div>
                            <div className="flex gap-4">
                                <div className="h-10 w-10 rounded bg-[#333] flex-shrink-0 flex items-center justify-center">
                                    <span className="text-lg">Logo</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-[#f5f5f5] font-bold text-sm truncate">{form.title || 'Título da Notificação'}</h4>
                                    <p className="text-[#888] text-xs mt-1 line-clamp-2">{form.message || 'Sua mensagem aparecerá aqui...'}</p>
                                    <p className="text-[#666] text-[10px] mt-2">
                                        {(() => {
                                            try {
                                                return new URL(form.url).hostname
                                            } catch {
                                                return ''
                                            }
                                        })()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
