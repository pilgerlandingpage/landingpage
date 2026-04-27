'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Mail, Phone, ArrowRight, Loader2, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="login-container" />}>
            <LoginPageContent />
        </Suspense>
    )
}

function LoginPageContent() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [recoveryEmail, setRecoveryEmail] = useState('')
    const [recoveryPhone, setRecoveryPhone] = useState('')
    const [showRecoveryForm, setShowRecoveryForm] = useState(false)
    const [recoveringPassword, setRecoveringPassword] = useState(false)
    const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
    const [recoveryMessageType, setRecoveryMessageType] = useState<'success' | 'warning'>('success')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [passwordFlowLoading, setPasswordFlowLoading] = useState(false)
    const [passwordFlowReady, setPasswordFlowReady] = useState(false)
    const [passwordFlowMessage, setPasswordFlowMessage] = useState<string | null>(null)

    const router = useRouter()
    const searchParams = useSearchParams()
    const [supabase] = useState(() => createClient())

    const modeType = String(searchParams.get('type') || '').toLowerCase()
    const passwordUpdated = searchParams.get('password_updated') === '1'
    const authError = searchParams.get('auth_error')
    const isPasswordSetupMode =
        searchParams.get('first_access') === '1' ||
        searchParams.get('password_reset') === '1' ||
        modeType === 'invite' ||
        modeType === 'recovery'
    const isRecoveryMode = !isPasswordSetupMode && showRecoveryForm

    const getAuthHashParams = () => {
        if (typeof window === 'undefined') return new URLSearchParams()
        const rawHash = window.location.hash.startsWith('#')
            ? window.location.hash.slice(1)
            : window.location.hash
        return new URLSearchParams(rawHash)
    }

    const getFriendlyAuthError = (params: URLSearchParams) => {
        const code = params.get('error_code') || params.get('error')
        const description = params.get('error_description') || params.get('error')

        if (code === 'otp_expired' || /expired|invalid/i.test(description || '')) {
            return 'Link expirado ou ja utilizado. Solicite um novo link ao administrador.'
        }

        return String(description || 'Nao foi possivel validar o link. Solicite um novo link ao administrador.')
            .replace(/\+/g, ' ')
    }

    useEffect(() => {
        if (passwordUpdated && !isPasswordSetupMode) {
            setRecoveryMessageType('success')
            setRecoveryMessage('Senha definida com sucesso. Entre com seu email e nova senha.')
        }
    }, [passwordUpdated, isPasswordSetupMode])

    useEffect(() => {
        if (!authError || isPasswordSetupMode) return

        if (authError === 'otp_expired') {
            setError('Link expirado ou ja utilizado. Solicite um novo link ao administrador.')
            return
        }

        setError('Nao foi possivel validar o link. Solicite um novo link ao administrador.')
    }, [authError, isPasswordSetupMode])

    useEffect(() => {
        if (!isPasswordSetupMode) return

        let cancelled = false

        const preparePasswordSetup = async () => {
            setPasswordFlowLoading(true)
            setPasswordFlowMessage(null)
            setError(null)

            try {
                const code = searchParams.get('code')
                const tokenHash = searchParams.get('token_hash')
                const hashParams = getAuthHashParams()
                const accessToken = hashParams.get('access_token')
                const refreshToken = hashParams.get('refresh_token')
                const hashError = hashParams.get('error_description') || hashParams.get('error')

                if (hashError) {
                    throw new Error(getFriendlyAuthError(hashParams))
                }

                if (code) {
                    const { error: codeError } = await supabase.auth.exchangeCodeForSession(code)
                    if (codeError) throw codeError
                } else if (accessToken && refreshToken) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    })
                    if (sessionError) throw sessionError
                } else if (tokenHash && (modeType === 'invite' || modeType === 'recovery')) {
                    const { error: verifyError } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: modeType as 'invite' | 'recovery',
                    })
                    if (verifyError) throw verifyError
                }

                const {
                    data: { session },
                } = await supabase.auth.getSession()

                if (cancelled) return

                if (session?.user) {
                    setPasswordFlowReady(true)
                    setPasswordFlowMessage('Sessao validada. Defina sua nova senha.')
                } else {
                    setPasswordFlowReady(false)
                    setPasswordFlowMessage('Nao foi possivel validar o link. Solicite um novo link de acesso.')
                }
            } catch (flowErr: any) {
                if (cancelled) return
                setPasswordFlowReady(false)
                setPasswordFlowMessage(flowErr?.message || 'Link invalido ou expirado. Solicite um novo link.')
            } finally {
                if (!cancelled) setPasswordFlowLoading(false)
            }
        }

        preparePasswordSetup()

        return () => {
            cancelled = true
        }
    }, [isPasswordSetupMode, modeType, searchParams, supabase])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (loginError) {
                fetch('/api/admin/user-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event_type: 'login_failed',
                        attempted_email: email.trim().toLowerCase(),
                        path: '/login',
                        referrer: document.referrer,
                        search_params: window.location.search,
                        metadata: { reason: loginError.message },
                    }),
                }).catch(() => {})
                setError(loginError.message)
            } else {
                await fetch('/api/admin/user-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event_type: 'login_success',
                        path: '/login',
                        referrer: document.referrer,
                        search_params: window.location.search,
                    }),
                }).catch(() => {})
                router.push('/admin')
                router.refresh()
            }
        } catch {
            setError('Ocorreu um erro ao tentar fazer login.')
        } finally {
            setLoading(false)
        }
    }

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (newPassword.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.')
            setLoading(false)
            return
        }

        if (newPassword !== confirmNewPassword) {
            setError('As senhas nao coincidem.')
            setLoading(false)
            return
        }

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
            if (updateError) {
                setError(updateError.message)
                return
            }

            await fetch('/api/admin/user-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: modeType === 'invite' || searchParams.get('first_access') === '1'
                        ? 'first_access_password_set'
                        : 'password_reset_completed',
                    path: '/login',
                    referrer: document.referrer,
                    search_params: window.location.search,
                    metadata: {
                        flow: modeType || (searchParams.get('first_access') === '1' ? 'first_access' : 'password_reset'),
                    },
                }),
            }).catch(() => {})

            setPasswordFlowMessage('Senha definida com sucesso. Redirecionando para o login...')
            setTimeout(() => {
                supabase.auth.signOut().finally(() => {
                    router.replace('/login?password_updated=1')
                    router.refresh()
                })
            }, 800)
        } catch {
            setError('Ocorreu um erro ao definir a nova senha.')
        } finally {
            setLoading(false)
        }
    }

    const handleSendRecoveryLink = async () => {
        setError(null)
        setRecoveryMessage(null)
        setRecoveryMessageType('success')

        const normalizedEmail = recoveryEmail.trim().toLowerCase()
        const normalizedPhone = recoveryPhone.trim()
        if (!normalizedEmail || !normalizedPhone) {
            setError('Informe email e telefone para recuperar a senha.')
            return
        }

        setRecoveringPassword(true)
        try {
            const res = await fetch('/api/auth/password-recovery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail, phone: normalizedPhone }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Nao foi possivel solicitar redefinicao.')

            const responseMessage = data?.message || 'Solicitacao processada.'
            if (data?.success === false) {
                setRecoveryMessageType('warning')
                setRecoveryMessage(responseMessage)
                return
            }

            setRecoveryMessageType('success')
            setRecoveryMessage(responseMessage)
            setShowRecoveryForm(false)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setRecoveringPassword(false)
        }
    }

    return (
        <div className="login-container">
            <div className="login-bg-glow top" />
            <div className="login-bg-glow bottom" />

            <div className="login-content">
                <div className="login-header">
                    <h1 className="login-title">Bem-vindo de volta</h1>
                    <p className="login-subtitle">Acesse o painel administrativo da Pilger</p>
                </div>

                <div className="login-card">
                    <form
                        onSubmit={(event) => {
                            if (isPasswordSetupMode) {
                                handleSetPassword(event)
                                return
                            }
                            if (isRecoveryMode) {
                                event.preventDefault()
                                handleSendRecoveryLink()
                                return
                            }
                            handleLogin(event)
                        }}
                    >
                        {error && (
                            <div className="login-error">
                                <ShieldCheck size={18} />
                                {error}
                            </div>
                        )}

                        {isPasswordSetupMode && (
                            <div className="login-form-group" style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    {passwordFlowLoading ? 'Validando link de acesso...' : passwordFlowMessage}
                                </div>
                            </div>
                        )}

                        {!isPasswordSetupMode && !showRecoveryForm && (
                            <>
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
                                            placeholder="********"
                                            required
                                        />
                                        <Lock className="login-input-icon" size={20} />
                                    </div>
                                </div>

                                <div style={{ marginTop: -8, marginBottom: 12, textAlign: 'right' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowRecoveryForm((prev) => !prev)
                                            setRecoveryEmail(email || '')
                                            setRecoveryPhone('')
                                            setError(null)
                                            setRecoveryMessage(null)
                                            setRecoveryMessageType('success')
                                        }}
                                        style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--gold)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        Esqueci minha senha
                                    </button>
                                </div>

                                {recoveryMessage && (
                                    <div className="login-form-group" style={{ marginBottom: 14 }}>
                                        <div
                                            style={{
                                                fontSize: '0.85rem',
                                                color: recoveryMessageType === 'warning' ? '#f5d29a' : '#c8f5c8'
                                            }}
                                        >
                                            {recoveryMessage}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {isRecoveryMode && (
                            <>
                                <div className="login-form-group" style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                        Informe o email e o telefone cadastrados para receber o link de redefinicao no WhatsApp.
                                    </div>
                                </div>

                                <div className="login-form-group">
                                    <label className="login-label">Email para recuperacao</label>
                                    <div className="login-input-wrapper">
                                        <input
                                            type="email"
                                            value={recoveryEmail}
                                            onChange={(e) => setRecoveryEmail(e.target.value)}
                                            className="login-input"
                                            placeholder="admin@pilger.com.br"
                                            required
                                        />
                                        <Mail className="login-input-icon" size={20} />
                                    </div>
                                </div>

                                <div className="login-form-group">
                                    <label className="login-label">Telefone cadastrado</label>
                                    <div className="login-input-wrapper">
                                        <input
                                            type="tel"
                                            value={recoveryPhone}
                                            onChange={(e) => setRecoveryPhone(e.target.value)}
                                            className="login-input"
                                            placeholder="5547999999999"
                                            required
                                        />
                                        <Phone className="login-input-icon" size={20} />
                                    </div>
                                </div>

                                {recoveryMessage && (
                                    <div className="login-form-group" style={{ marginBottom: 14 }}>
                                        <div
                                            style={{
                                                fontSize: '0.85rem',
                                                color: recoveryMessageType === 'warning' ? '#f5d29a' : '#c8f5c8'
                                            }}
                                        >
                                            {recoveryMessage}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowRecoveryForm(false)
                                            setError(null)
                                            setRecoveryMessage(null)
                                            setRecoveryEmail('')
                                            setRecoveryPhone('')
                                        }}
                                        className="btn-login"
                                        style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                                    >
                                        Voltar para o login
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={recoveringPassword}
                                        className="btn-login"
                                    >
                                        {recoveringPassword ? (
                                            <>
                                                <Loader2 className="animate-spin" size={20} />
                                                <span>Enviando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Enviar Link</span>
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}

                        {isPasswordSetupMode && (
                            <>
                                <div className="login-form-group">
                                    <label className="login-label">Nova Senha</label>
                                    <div className="login-input-wrapper">
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="login-input"
                                            placeholder="Minimo 6 caracteres"
                                            required
                                            disabled={!passwordFlowReady || passwordFlowLoading}
                                        />
                                        <Lock className="login-input-icon" size={20} />
                                    </div>
                                </div>

                                <div className="login-form-group">
                                    <label className="login-label">Confirmar Nova Senha</label>
                                    <div className="login-input-wrapper">
                                        <input
                                            type="password"
                                            value={confirmNewPassword}
                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                            className="login-input"
                                            placeholder="Repita a nova senha"
                                            required
                                            disabled={!passwordFlowReady || passwordFlowLoading}
                                        />
                                        <Lock className="login-input-icon" size={20} />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        supabase.auth.signOut().finally(() => {
                                            router.replace('/login')
                                            router.refresh()
                                        })
                                    }}
                                    style={{
                                        width: '100%',
                                        marginBottom: 12,
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        border: '1px solid var(--border-color)',
                                        background: 'transparent',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    Voltar para o login
                                </button>
                            </>
                        )}

                        {!isRecoveryMode && (
                            <button
                                type="submit"
                                disabled={loading || (isPasswordSetupMode && (!passwordFlowReady || passwordFlowLoading))}
                                className="btn-login"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>{isPasswordSetupMode ? 'Salvando senha...' : 'Autenticando...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{isPasswordSetupMode ? 'Definir Nova Senha' : 'Entrar no Sistema'}</span>
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        )}

                    </form>
                </div>
            </div>
        </div>
    )
}
