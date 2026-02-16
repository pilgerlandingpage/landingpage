'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Mail, Lock, User, CheckCircle, AlertCircle, Loader2, ArrowLeft, Phone, Briefcase, BadgeCheck } from 'lucide-react'
import Link from 'next/link'

export default function NewUserPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        role: 'broker',
        creci: ''
    })
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setStatus(null)

        // Basic validation
        if (formData.password !== formData.confirmPassword) {
            setStatus({ type: 'error', message: 'As senhas não coincidem.' })
            return
        }

        if (formData.password.length < 6) {
            setStatus({ type: 'error', message: 'A senha deve ter pelo menos 6 caracteres.' })
            return
        }

        setLoading(true)

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    phone: formData.phone,
                    role: formData.role,
                    creci: formData.creci
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Falha ao criar usuário')
            }

            setStatus({ type: 'success', message: 'Usuário criado com sucesso!' })
            // Clear form
            setFormData({ name: '', email: '', password: '', confirmPassword: '', phone: '', role: 'broker', creci: '' })

        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || 'Ocorreu um erro.' })
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let value = e.target.value

        // Phone Mask
        if (e.target.name === 'phone') {
            value = value.replace(/\D/g, '') // Remove non-digits
            if (value.length > 11) value = value.slice(0, 11) // Limit to 11 digits

            if (value.length > 2) {
                value = `(${value.slice(0, 2)}) ${value.slice(2)}`
            }
            if (value.length > 9) {
                value = `${value.slice(0, 10)}-${value.slice(10)}`
            }
        }

        setFormData(prev => ({ ...prev, [e.target.name]: value }))
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin" className="p-2 hover:bg-[#1a1a1a] rounded-full transition-colors text-gray-400 hover:text-white">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2 font-display">
                        <UserPlus className="text-[#b8945f]" />
                        Novo Usuário
                    </h1>
                    <p className="text-gray-400 text-sm">Adicione um novo administrador ao sistema</p>
                </div>
            </div>

            <div className="login-card">
                {status && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${status.type === 'success'
                        ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                        : 'bg-red-500/10 border border-red-500/20 text-red-500'
                        }`}>
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span>{status.message}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Name Field */}
                    <div className="login-form-group">
                        <label className="login-label">Nome Completo</label>
                        <div className="login-input-wrapper">
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="login-input"
                                placeholder="Ex: Ana Silva"
                                required
                            />
                            <User className="login-input-icon" size={20} />
                        </div>
                    </div>

                    {/* Email Field */}
                    <div className="login-form-group">
                        <label className="login-label">Login / Email</label>
                        <div className="login-input-wrapper">
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="login-input"
                                placeholder="Ex: admin@pilger.com.br"
                                required
                            />
                            <Mail className="login-input-icon" size={20} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Phone Field */}
                        <div className="login-form-group">
                            <label className="login-label">Telefone</label>
                            <div className="login-input-wrapper">
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="login-input"
                                    placeholder="(11) 99999-9999"
                                    maxLength={15}
                                />
                                <Phone className="login-input-icon" size={20} />
                            </div>
                        </div>

                        {/* Role Field */}
                        <div className="login-form-group">
                            <label className="login-label">Função</label>
                            <div className="login-input-wrapper">
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="login-input appearance-none"
                                    required
                                >
                                    <option value="broker">Corretor</option>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                                <Briefcase className="login-input-icon" size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Conditional CRECI Field */}
                    {formData.role === 'broker' && (
                        <div className="login-form-group animate-fade-in">
                            <label className="login-label">CRECI</label>
                            <div className="login-input-wrapper">
                                <input
                                    type="text"
                                    name="creci"
                                    value={formData.creci}
                                    onChange={handleChange}
                                    className="login-input"
                                    placeholder="Ex: 12345-F"
                                    required={formData.role === 'broker'}
                                />
                                <BadgeCheck className="login-input-icon" size={20} />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Password Field */}
                        <div className="login-form-group">
                            <label className="login-label">Senha</label>
                            <div className="login-input-wrapper">
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="login-input"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                                <Lock className="login-input-icon" size={20} />
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div className="login-form-group">
                            <label className="login-label">Confirmar Senha</label>
                            <div className="login-input-wrapper">
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="login-input"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                                <Lock className="login-input-icon" size={20} />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-login"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Criando usuário...</span>
                                </>
                            ) : (
                                <>
                                    <UserPlus size={20} />
                                    <span>Criar Usuário no Sistema</span>
                                </>
                            )}
                        </button>
                        <p className="text-center text-gray-400 text-xs mt-4">
                            O novo usuário terá acesso completo ao painel administrativo imediatamente.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    )
}
