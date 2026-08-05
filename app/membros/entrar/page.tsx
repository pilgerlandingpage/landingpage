'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function MemberLoginPage() {
  return (
    <Suspense fallback={<div className="member-login-shell" />}>
      <MemberLoginContent />
    </Suspense>
  )
}

function MemberLoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryPhone, setRecoveryPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showRecovery, setShowRecovery] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [passwordFlowLoading, setPasswordFlowLoading] = useState(false)
  const [passwordFlowReady, setPasswordFlowReady] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const searchParams = useSearchParams()

  const modeType = String(searchParams.get('type') || '').toLowerCase()
  const nextParam = searchParams.get('next')
  const safeNextPath = nextParam && nextParam.startsWith('/membros') ? nextParam : '/membros'
  const passwordUpdated = searchParams.get('password_updated') === '1'
  const isPasswordSetupMode =
    searchParams.get('first_access') === '1' ||
    searchParams.get('password_reset') === '1' ||
    modeType === 'invite' ||
    modeType === 'recovery'

  const getAuthHashParams = () => {
    if (typeof window === 'undefined') return new URLSearchParams()
    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash
    return new URLSearchParams(rawHash)
  }

  const friendlyAuthError = (params: URLSearchParams) => {
    const code = params.get('error_code') || params.get('error')
    const description = params.get('error_description') || params.get('error') || ''
    if (code === 'otp_expired' || /expired|invalid/i.test(description)) {
      return 'Link expirado ou já utilizado. Solicite um novo acesso.'
    }
    return String(description || 'Não foi possível validar o link de acesso.').replace(/\+/g, ' ')
  }

  useEffect(() => {
    if (passwordUpdated && !isPasswordSetupMode) {
      setMessage('Senha criada com sucesso. Entre com seu e-mail e a nova senha.')
    }
  }, [passwordUpdated, isPasswordSetupMode])

  useEffect(() => {
    if (!isPasswordSetupMode) return
    let cancelled = false

    const preparePasswordSetup = async () => {
      setPasswordFlowLoading(true)
      setPasswordFlowReady(false)
      setError(null)
      setMessage(null)

      try {
        const code = searchParams.get('code')
        const tokenHash = searchParams.get('token_hash')
        const hashParams = getAuthHashParams()
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const hashError = hashParams.get('error_description') || hashParams.get('error')

        if (hashError) throw new Error(friendlyAuthError(hashParams))

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
        if (!session?.user) {
          throw new Error('Não foi possível validar o link. Solicite um novo acesso.')
        }

        setPasswordFlowReady(true)
        setMessage('Acesso validado. Crie sua senha para entrar na biblioteca.')
      } catch (flowErr: any) {
        if (cancelled) return
        setPasswordFlowReady(false)
        setError(flowErr?.message || 'Link inválido ou expirado.')
      } finally {
        if (!cancelled) setPasswordFlowLoading(false)
      }
    }

    preparePasswordSetup()

    return () => {
      cancelled = true
    }
  }, [isPasswordSetupMode, modeType, searchParams, supabase])

  const passwordUpdatedPath = `/membros/entrar?password_updated=1&next=${encodeURIComponent(safeNextPath)}`

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (loginError) {
        setError(loginError.message || 'Não foi possível entrar com esses dados.')
        return
      }

      router.replace(safeNextPath)
      router.refresh()
    } catch {
      setError('Ocorreu um erro ao tentar entrar.')
    } finally {
      setLoading(false)
    }
  }

  const handleSetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    if (newPassword !== confirmNewPassword) {
      setError('As senhas não coincidem.')
      setLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setError(updateError.message)
        return
      }

      setMessage('Senha criada. Redirecionando para entrada da biblioteca...')
      setTimeout(() => {
        supabase.auth.signOut().finally(() => {
          router.replace(passwordUpdatedPath)
          router.refresh()
        })
      }, 700)
    } catch {
      setError('Ocorreu um erro ao criar sua senha.')
    } finally {
      setLoading(false)
    }
  }

  const handleRecovery = async (event: React.FormEvent) => {
    event.preventDefault()
    setRecoveryLoading(true)
    setError(null)
    setMessage(null)

    const normalizedEmail = recoveryEmail.trim().toLowerCase()
    const normalizedPhone = recoveryPhone.trim()
    if (!normalizedEmail || !normalizedPhone) {
      setError('Informe o e-mail e o WhatsApp usados na compra.')
      setRecoveryLoading(false)
      return
    }

    try {
      const response = await fetch('/api/members/password-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          phone: normalizedPhone,
          next: safeNextPath,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || 'Nao foi possivel enviar o link agora.')
      }
      setMessage(payload?.message || 'Se os dados conferirem, enviaremos um link seguro pelo WhatsApp cadastrado.')
      setShowRecovery(false)
    } catch (recoveryErr: any) {
      setError(recoveryErr?.message || 'Não foi possível enviar o link agora.')
    } finally {
      setRecoveryLoading(false)
    }
  }

  const formTitle = isPasswordSetupMode
    ? 'Criar senha'
    : showRecovery
      ? 'Recuperar acesso'
      : 'Entrar na minha conta'

  return (
    <main className="member-login-shell">
      <Link href="/membros" className="member-login-back">
        <ArrowLeft size={16} />
        Catálogo
      </Link>

      <section className="member-login-layout">
        <div className="member-login-preview">
          <div className="member-login-brand">
            <BookOpen size={22} />
            <span>Pilger Play</span>
          </div>
          <span className="member-login-kicker">
            <Sparkles size={15} />
            Área de membros
          </span>
          <h1>Sua biblioteca digital.</h1>
          <p>Entre com o e-mail usado na compra para acessar seus produtos liberados.</p>
          <div className="member-login-cover">
            <img src="/images/products/corretor-nota-8-cover.webp" alt="Corretor Nota 8" />
          </div>
        </div>

        <div className="member-login-panel">
          <div className="member-login-panel-head">
            <ShieldCheck size={22} />
            <div>
              <span>Acesso seguro</span>
              <h2>{formTitle}</h2>
            </div>
          </div>

          {error && (
            <div className="member-login-alert is-error">
              <Lock size={16} />
              {error}
            </div>
          )}

          {message && (
            <div className="member-login-alert is-success">
              <CheckCircle2 size={16} />
              {message}
            </div>
          )}

          {isPasswordSetupMode ? (
            <form onSubmit={handleSetPassword} className="member-login-form">
              <label>
                <span>Nova senha</span>
                <div>
                  <Lock size={18} />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    disabled={!passwordFlowReady || passwordFlowLoading}
                    required
                  />
                </div>
              </label>
              <label>
                <span>Confirmar senha</span>
                <div>
                  <Lock size={18} />
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder="Repita a senha"
                    disabled={!passwordFlowReady || passwordFlowLoading}
                    required
                  />
                </div>
              </label>
              <button type="submit" disabled={loading || !passwordFlowReady || passwordFlowLoading}>
                {loading || passwordFlowLoading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                {passwordFlowLoading ? 'Validando link...' : loading ? 'Salvando...' : 'Criar senha'}
              </button>
            </form>
          ) : showRecovery ? (
            <form onSubmit={handleRecovery} className="member-login-form">
              <label>
                <span>E-mail usado na compra</span>
                <div>
                  <Mail size={18} />
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(event) => setRecoveryEmail(event.target.value)}
                    placeholder="seuemail@exemplo.com"
                    required
                  />
                </div>
              </label>
              <label>
                <span>WhatsApp usado na compra</span>
                <div>
                  <Phone size={18} />
                  <input
                    type="tel"
                    value={recoveryPhone}
                    onChange={(event) => setRecoveryPhone(event.target.value)}
                    placeholder="(47) 99999-9999"
                    autoComplete="tel"
                    required
                  />
                </div>
              </label>
              <button type="submit" disabled={recoveryLoading}>
                {recoveryLoading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                {recoveryLoading ? 'Enviando...' : 'Enviar pelo WhatsApp'}
              </button>
              <button
                type="button"
                className="is-secondary"
                onClick={() => {
                  setShowRecovery(false)
                  setError(null)
                  setMessage(null)
                }}
              >
                Voltar para entrar
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="member-login-form">
              <label>
                <span>E-mail de acesso</span>
                <div>
                  <Mail size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seuemail@exemplo.com"
                    required
                  />
                </div>
              </label>
              <label>
                <span>Senha</span>
                <div>
                  <Lock size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Sua senha"
                    required
                  />
                </div>
              </label>
              <button type="submit" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <button
                type="button"
                className="is-text"
                onClick={() => {
                  setShowRecovery(true)
                  setRecoveryEmail(email)
                  setError(null)
                  setMessage(null)
                }}
              >
                Esqueci minha senha
              </button>
            </form>
          )}
        </div>
      </section>

      <style>{`
        .member-login-shell {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          padding: 28px;
          color: #fff;
          font-family: Inter, Arial, sans-serif;
          background:
            linear-gradient(90deg, rgba(2, 6, 7, 0.98), rgba(2, 6, 7, 0.76), rgba(2, 6, 7, 0.96)),
            url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") center / cover no-repeat;
        }

        .member-login-back,
        .member-login-brand,
        .member-login-kicker,
        .member-login-panel-head,
        .member-login-alert,
        .member-login-form label div,
        .member-login-form button {
          display: inline-flex;
          align-items: center;
        }

        .member-login-back {
          position: relative;
          z-index: 2;
          gap: 8px;
          min-height: 38px;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.78rem;
          font-weight: 900;
          text-decoration: none;
          text-transform: uppercase;
        }

        .member-login-layout {
          width: min(100%, 1080px);
          min-height: calc(100vh - 112px);
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 430px);
          align-items: center;
          gap: clamp(30px, 6vw, 74px);
          margin: 0 auto;
        }

        .member-login-preview {
          min-width: 0;
        }

        .member-login-brand {
          gap: 10px;
          margin-bottom: 26px;
          color: #f3c45e;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.22rem;
          font-weight: 850;
        }

        .member-login-kicker {
          gap: 8px;
          width: fit-content;
          margin-bottom: 16px;
          padding: 7px 10px;
          border: 1px solid rgba(232, 176, 73, 0.44);
          border-radius: 8px;
          color: #f3c45e;
          font-size: 0.72rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .member-login-preview h1 {
          max-width: 620px;
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(3rem, 7vw, 6.4rem);
          line-height: 0.92;
          letter-spacing: 0;
        }

        .member-login-preview p {
          max-width: 520px;
          margin: 18px 0 0;
          color: rgba(255, 255, 255, 0.76);
          font-size: clamp(1rem, 1.35vw, 1.15rem);
          line-height: 1.68;
        }

        .member-login-cover {
          width: 136px;
          aspect-ratio: 3 / 4;
          margin-top: 30px;
          overflow: hidden;
          border: 1px solid rgba(232, 176, 73, 0.34);
          border-radius: 8px;
          background: rgba(232, 176, 73, 0.08);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.36);
        }

        .member-login-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .member-login-panel {
          width: 100%;
          padding: 26px;
          border: 1px solid rgba(232, 176, 73, 0.22);
          border-radius: 8px;
          background: rgba(3, 13, 14, 0.84);
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42);
          backdrop-filter: blur(18px);
        }

        .member-login-panel-head {
          gap: 12px;
          margin-bottom: 18px;
        }

        .member-login-panel-head svg {
          color: #e8b049;
        }

        .member-login-panel-head span {
          color: #e8b049;
          font-size: 0.72rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .member-login-panel-head h2 {
          margin: 4px 0 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 2rem;
          line-height: 1;
          letter-spacing: 0;
        }

        .member-login-alert {
          width: 100%;
          gap: 8px;
          margin-bottom: 12px;
          padding: 11px 12px;
          border-radius: 7px;
          font-size: 0.86rem;
          line-height: 1.4;
        }

        .member-login-alert.is-error {
          color: #fecaca;
          border: 1px solid rgba(239, 68, 68, 0.32);
          background: rgba(239, 68, 68, 0.08);
        }

        .member-login-alert.is-success {
          color: #d9ffe7;
          border: 1px solid rgba(121, 224, 166, 0.28);
          background: rgba(121, 224, 166, 0.1);
        }

        .member-login-form {
          display: grid;
          gap: 14px;
        }

        .member-login-form label {
          display: grid;
          gap: 7px;
        }

        .member-login-form label > span {
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.82rem;
          font-weight: 850;
        }

        .member-login-form label div {
          gap: 10px;
          min-height: 48px;
          padding: 0 13px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 7px;
          color: rgba(255, 255, 255, 0.56);
          background: rgba(255, 255, 255, 0.055);
        }

        .member-login-form input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          color: #fff;
          background: transparent;
          font: inherit;
          font-size: 0.95rem;
          font-weight: 500;
        }

        .member-login-form input::placeholder {
          color: rgba(255, 255, 255, 0.42);
        }

        .member-login-form input:disabled {
          opacity: 0.58;
        }

        .member-login-form button {
          width: 100%;
          min-height: 46px;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 7px;
          padding: 0 15px;
          color: #061014;
          background: #e8b049;
          font-size: 0.82rem;
          font-weight: 950;
          text-transform: uppercase;
          cursor: pointer;
        }

        .member-login-form button:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        .member-login-form button.is-secondary {
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.06);
        }

        .member-login-form button.is-text {
          min-height: 34px;
          color: #f3c45e;
          background: transparent;
          font-size: 0.76rem;
          text-decoration: underline;
        }

        @media (max-width: 860px) {
          .member-login-shell {
            padding: 18px 16px 28px;
          }

          .member-login-layout {
            grid-template-columns: 1fr;
            min-height: auto;
            gap: 26px;
            padding-top: 30px;
          }

          .member-login-preview h1 {
            font-size: clamp(3rem, 15vw, 4.5rem);
          }

          .member-login-cover {
            display: none;
          }

          .member-login-panel {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  )
}
