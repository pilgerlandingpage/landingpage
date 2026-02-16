'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                setError(error.message)
            } else {
                router.push('/admin')
                router.refresh()
            }
        } catch (err) {
            setError('Ocorreu um erro ao tentar fazer login.')
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
                {/* Logo Section */}
                <div className="login-header">

                    <h1 className="login-title">Bem-vindo de volta</h1>
                    <p className="login-subtitle">Acesse o painel administrativo da Pilger</p>
                </div>

                {/* Login Card */}
                <div className="login-card">
                    <form onSubmit={handleLogin}>
                        {error && (
                            <div className="login-error">
                                <ShieldCheck size={18} />
                                {error}
                            </div>
                        )}

                        <div className="login-form-group">
                            <label className="login-label">Email</label>
                            <div className="login-input-wrapper">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="login-input"
                                    placeholder="admin@pilger.com.br"
                                    required
                                />
                                <Mail className="login-input-icon" size={20} />
                            </div>
                        </div>

                        <div className="login-form-group">
                            <label className="login-label">Senha</label>
                            <div className="login-input-wrapper">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
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
                                    <span>Autenticando...</span>
                                </>
                            ) : (
                                <>
                                    <span>Entrar no Sistema</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <div className="mt-6 text-center">
                            <span className="text-gray-500 text-sm">Não tem uma conta? </span>
                            <Link href="/signup" className="login-link text-sm">
                                Cadastre-se
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
