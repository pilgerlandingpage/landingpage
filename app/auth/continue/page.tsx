'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

function isAllowedSupabaseLink(value: string) {
    try {
        const url = new URL(value)
        return (
            url.protocol === 'https:' &&
            url.hostname.endsWith('.supabase.co') &&
            url.pathname.startsWith('/auth/v1/verify')
        )
    } catch {
        return false
    }
}

function ContinueAuthContent() {
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)
    const actionLink = searchParams.get('link') || ''
    const rawFlow = searchParams.get('flow')
    const flow = rawFlow === 'first_access' || rawFlow === 'maintenance_login'
        ? rawFlow
        : 'password_reset'
    const errorCode = searchParams.get('error_code') || searchParams.get('error')

    const isValidLink = useMemo(() => isAllowedSupabaseLink(actionLink), [actionLink])
    const isExpiredLink = errorCode === 'otp_expired'
    const title = flow === 'first_access'
        ? 'Criar senha de acesso'
        : flow === 'maintenance_login'
            ? 'Acesso de manutencao'
            : 'Redefinir senha'
    const description = flow === 'first_access'
        ? 'Clique no botao abaixo para validar seu convite e criar sua senha.'
        : flow === 'maintenance_login'
            ? 'Clique no botao abaixo para entrar no painel do usuario selecionado.'
            : 'Clique no botao abaixo para validar o pedido e criar uma nova senha.'
    const invalidMessage = isExpiredLink
        ? 'Link expirado ou ja utilizado. Solicite um novo link ao administrador.'
        : 'Este link nao parece valido. Solicite um novo link de acesso ao administrador.'

    const continueToSupabase = () => {
        if (!isValidLink || loading) return
        setLoading(true)
        window.location.assign(actionLink)
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'radial-gradient(circle at top, rgba(201,169,110,0.12), transparent 34%), #080808',
            color: '#f8fafc'
        }}>
            <div style={{
                width: '100%',
                maxWidth: 460,
                border: '1px solid rgba(201,169,110,0.22)',
                background: 'rgba(20,20,20,0.92)',
                borderRadius: 14,
                padding: 28,
                boxShadow: '0 24px 80px rgba(0,0,0,0.35)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    {isValidLink ? (
                        <ShieldCheck size={24} style={{ color: '#c9a96e' }} />
                    ) : (
                        <AlertCircle size={24} style={{ color: '#f87171' }} />
                    )}
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{title}</h1>
                </div>

                <p style={{ margin: '0 0 22px', color: '#a3a3a3', lineHeight: 1.6, fontSize: '0.95rem' }}>
                    {isValidLink
                        ? description
                        : invalidMessage}
                </p>

                <button
                    type="button"
                    onClick={continueToSupabase}
                    disabled={!isValidLink || loading}
                    style={{
                        width: '100%',
                        minHeight: 48,
                        border: 'none',
                        borderRadius: 10,
                        background: isValidLink ? 'linear-gradient(135deg, #c9a96e, #9b7b3f)' : '#333',
                        color: '#111',
                        fontWeight: 800,
                        cursor: isValidLink && !loading ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        opacity: loading ? 0.8 : 1
                    }}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    {loading ? 'Abrindo link seguro...' : 'Continuar'}
                </button>
            </div>
        </div>
    )
}

export default function ContinueAuthPage() {
    return (
        <Suspense fallback={<div />}>
            <ContinueAuthContent />
        </Suspense>
    )
}
