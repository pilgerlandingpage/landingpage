'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock, Mail, User, ArrowRight, Loader2, ShieldCheck, ArrowLeft, Phone, Briefcase, BadgeCheck } from 'lucide-react'
import Link from 'next/link'

export default function SignupPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'owner', // Default content
        creci: '',
        password: '',
        confirmPassword: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const formatPhoneNumber = (value: string) => {
        const numbers = value.replace(/\D/g, '')
        const limited = numbers.substring(0, 11)

        if (limited.length === 0) return ''
        if (limited.length <= 2) return `(${limited}`
        if (limited.length <= 7) return `(${limited.substring(0, 2)}) ${limited.substring(2)}`
        return `(${limited.substring(0, 2)}) ${limited.substring(2, 7)}-${limited.substring(7)}`
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let value = e.target.value
        if (e.target.name === 'phone') {
            value = formatPhoneNumber(value)
        }
        setFormData(prev => ({ ...prev, [e.target.name]: value }))
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (formData.password !== formData.confirmPassword) {
            setError('As senhas não coincidem.')
            setLoading(false)
            return
        }

        if (formData.password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.')
            setLoading(false)
            return
        }

        if (formData.role === 'broker' && !formData.creci) {
            setError('O CRECI é obrigatório para corretores.')
            setLoading(false)
            return
        }

        try {
            const cleanPhone = formData.phone.replace(/\D/g, '')
            const formattedPhone = cleanPhone ? `55${cleanPhone}` : ''

            const { error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.name,
                        phone: formattedPhone,
                        role: formData.role,
                        creci: formData.role === 'broker' ? formData.creci : null
                    },
                },
            })

            if (signUpError) {
                setError(signUpError.message)
            } else {
                setError('Cadastro realizado! Se o login não for automático, verifique seu email.')

                setTimeout(() => {
                    router.push('/admin')
                }, 2000)
            }
        } catch (err) {
            setError('Ocorreu um erro ao tentar cadastrar.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-container">
            {/* Background Effects */}
            <div className="login-bg-glow top" />
            <div className="login-bg-glow bottom" />

            <div className="login-content">
                {/* Header */}
                <div className="login-header">

                    <Link href="/login" className="absolute left-0 top-0 text-white/50 hover:text-[#b8945f] transition-colors p-2">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="login-title">Criar Conta</h1>
                    <p className="login-subtitle">Junte-se ao painel administrativo da Pilger</p>
                </div>

                {/* Signup Card */}
                <div className="login-card">
                    <form onSubmit={handleSignup}>
                        {error && (
                            <div className={`login-error ${error.includes('realizado') ? 'border-green-500/20 bg-green-500/10 text-green-500' : ''}`}>
                                <ShieldCheck size={18} />
                                {error}
                            </div>
                        )}

                        <div className="login-form-group">
                            <label className="login-label">Nome Completo</label>
                            <div className="login-input-wrapper">
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="login-input"
                                    placeholder="Seu Nome"
                                    required
                                />
                                <User className="login-input-icon" size={20} />
                            </div>
                        </div>

                        <div className="login-form-group">
                            <label className="login-label">Email</label>
                            <div className="login-input-wrapper">
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="login-input"
                                    placeholder="seu@email.com"
                                    required
                                />
                                <Mail className="login-input-icon" size={20} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="login-form-group">
                                <label className="login-label">Telefone</label>
                                <div className="login-input-wrapper">
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="login-input"
                                        placeholder="(00) 00000-0000"
                                        required
                                    />
                                    <Phone className="login-input-icon" size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Hidden Role (Defaults to Owner) */}
                        <input type="hidden" name="role" value="owner" />

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
                                />
                                <Lock className="login-input-icon" size={20} />
                            </div>
                        </div>

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
                                />
                                <Lock className="login-input-icon" size={20} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-login"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Criando conta...</span>
                                </>
                            ) : (
                                <>
                                    <span>Cadastrar</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <div className="mt-6 text-center">
                            <Link href="/login" className="login-link text-sm">
                                Já tem uma conta? Faça login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
