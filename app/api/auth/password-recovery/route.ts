import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/uazapi'
import { getLoginRedirectUrl, sanitizeAuthActionLink } from '@/lib/app-url'
import { buildPasswordResetWhatsAppMessage } from '@/lib/user-whatsapp-messages'
import { extractTrackingData } from '@/lib/tracking'

const MATCHED_RECOVERY_MESSAGE =
    'Dados confirmados. Verifique seu WhatsApp ou seu email para continuar a recuperacao.'
const NOT_FOUND_RECOVERY_MESSAGE =
    'Email ou telefone nao encontrados.'

function getPasswordResetRedirectUrl(request: NextRequest) {
    return getLoginRedirectUrl('/login?password_reset=1', request.nextUrl.origin)
}

function trackingPayload(request: NextRequest) {
    const tracking = extractTrackingData(request.headers, new URLSearchParams(), request.headers.get('referer') || undefined)

    return {
        ip_address: tracking.ip_address,
        user_agent: tracking.user_agent,
        device_type: tracking.device_type,
        browser: tracking.browser,
        os: tracking.os,
        country: tracking.country,
        city: tracking.city,
        region: tracking.region,
        referrer: tracking.referrer,
    }
}

async function logPasswordRecoveryEvent(admin: any, request: NextRequest, params: {
    event_type: string
    attempted_email?: string
    admin_user_id?: string | null
    auth_user_id?: string | null
    metadata?: Record<string, any>
}) {
    try {
        await admin.from('user_access_logs').insert({
            admin_user_id: params.admin_user_id || null,
            auth_user_id: params.auth_user_id || null,
            event_type: params.event_type,
            attempted_email: params.attempted_email || null,
            path: '/login',
            method: request.method,
            ...trackingPayload(request),
            metadata: params.metadata || {},
        })
    } catch (auditErr) {
        console.error('[password-recovery] audit log failed:', auditErr)
    }
}

async function resolveGlobalAgentInstanceToken(admin: any) {
    const { data: configRow, error: configError } = await admin
        .from('app_config')
        .select('value')
        .eq('key', 'agent_default_instance_id')
        .maybeSingle()

    if (configError) throw configError

    const defaultInstanceId = String(configRow?.value || '').trim()
    if (!defaultInstanceId) return null

    const { data: instance, error: instanceError } = await admin
        .from('whatsapp_instances')
        .select('instance_token, status')
        .eq('id', defaultInstanceId)
        .maybeSingle()

    if (instanceError) throw instanceError
    if (!instance?.instance_token) return null
    if (instance.status !== 'connected') return null

    return instance.instance_token
}

function onlyDigits(value: string) {
    return String(value || '').replace(/\D/g, '')
}

function buildPhoneVariants(raw: string) {
    const digits = onlyDigits(raw)
    if (!digits) return new Set<string>()

    const variants = new Set<string>()
    const add = (value: string) => {
        const cleaned = onlyDigits(value)
        if (!cleaned) return

        variants.add(cleaned)

        const noLeadingZero = cleaned.replace(/^0+/, '')
        if (noLeadingZero) variants.add(noLeadingZero)

        if (cleaned.startsWith('55') && cleaned.length > 2) {
            variants.add(cleaned.slice(2))
        }

        if (!cleaned.startsWith('55') && (cleaned.length === 10 || cleaned.length === 11)) {
            variants.add(`55${cleaned}`)
        }
    }

    add(digits)

    // Regra BR legada: equivalencia com e sem o 9o digito apos o DDD.
    for (const candidate of [...variants]) {
        if (candidate.startsWith('55')) {
            const local = candidate.slice(2) // DDD + numero
            if (local.length === 11 && local[2] === '9') {
                add(`55${local.slice(0, 2)}${local.slice(3)}`) // remove 9o digito
            }
            if (local.length === 10) {
                add(`55${local.slice(0, 2)}9${local.slice(2)}`) // adiciona 9o digito
            }
        } else {
            if (candidate.length === 11 && candidate[2] === '9') {
                add(`${candidate.slice(0, 2)}${candidate.slice(3)}`) // remove 9o digito
            }
            if (candidate.length === 10) {
                add(`${candidate.slice(0, 2)}9${candidate.slice(2)}`) // adiciona 9o digito
            }
        }
    }

    return variants
}

function phoneMatches(inputPhone: string, registeredPhone: string) {
    const inputVariants = buildPhoneVariants(inputPhone)
    const registeredVariants = buildPhoneVariants(registeredPhone)
    if (inputVariants.size === 0 || registeredVariants.size === 0) return false

    for (const phone of inputVariants) {
        if (registeredVariants.has(phone)) return true
    }
    return false
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const normalizedEmail = String(body?.email || '').trim().toLowerCase()
        const normalizedPhone = String(body?.phone || '').trim()

        if (!normalizedEmail || !normalizedPhone) {
            return NextResponse.json({ error: 'Email e telefone sao obrigatorios.' }, { status: 400 })
        }

        const admin = createAdminClient()

        await logPasswordRecoveryEvent(admin, request, {
            event_type: 'password_recovery_requested',
            attempted_email: normalizedEmail,
            metadata: {
                phone_last4: onlyDigits(normalizedPhone).slice(-4) || null,
            },
        })

        const { data: adminUsers, error: adminUserError } = await admin
            .from('admin_users')
            .select('id, auth_user_id, name, email, phone, is_master, is_active')
            .eq('email', normalizedEmail)
            .order('is_master', { ascending: false })
            .order('updated_at', { ascending: false })
            .limit(10)

        if (adminUserError) throw adminUserError

        let adminUser = (adminUsers || []).find((user: any) =>
            user?.is_active &&
            user?.phone &&
            phoneMatches(normalizedPhone, String(user.phone || ''))
        )

        if (!adminUser) {
            const { data: phoneUsers, error: phoneUsersError } = await admin
                .from('admin_users')
                .select('id, auth_user_id, name, email, phone, is_master, is_active')
                .eq('is_active', true)
                .not('phone', 'is', null)
                .order('is_master', { ascending: false })
                .order('updated_at', { ascending: false })
                .limit(200)

            if (phoneUsersError) throw phoneUsersError

            const phoneMatchesOnly = (phoneUsers || []).filter((user: any) =>
                user?.phone && phoneMatches(normalizedPhone, String(user.phone || ''))
            )

            if (phoneMatchesOnly.length === 1) {
                adminUser = phoneMatchesOnly[0]
            }
        }

        // Nao expor qual campo falhou.
        if (!adminUser) {
            await logPasswordRecoveryEvent(admin, request, {
                event_type: 'password_recovery_not_found',
                attempted_email: normalizedEmail,
                metadata: {
                    phone_last4: onlyDigits(normalizedPhone).slice(-4) || null,
                },
            })
            return NextResponse.json({ success: false, message: NOT_FOUND_RECOVERY_MESSAGE })
        }

        await logPasswordRecoveryEvent(admin, request, {
            event_type: 'password_recovery_matched',
            attempted_email: normalizedEmail,
            admin_user_id: adminUser.id,
            auth_user_id: adminUser.auth_user_id,
            metadata: {
                phone_last4: onlyDigits(normalizedPhone).slice(-4) || null,
            },
        })

        const resetRedirectUrl = getPasswordResetRedirectUrl(request)
        const targetEmail = String(adminUser.email || normalizedEmail).trim().toLowerCase()
        const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email: targetEmail,
            options: {
                redirectTo: resetRedirectUrl,
            },
        })

        if (linkError) {
            console.error('[password-recovery] generateLink failed:', linkError)
            return NextResponse.json(
                { error: 'Dados confirmados, mas nao foi possivel gerar o link de redefinicao agora.' },
                { status: 500 }
            )
        }

        const rawResetLink = linkData.properties?.action_link
        const resetLink = rawResetLink
            ? sanitizeAuthActionLink(rawResetLink, '/login?password_reset=1', request.nextUrl.origin)
            : null
        if (!resetLink) {
            console.error('[password-recovery] missing reset link for email:', targetEmail)
            return NextResponse.json(
                { error: 'Dados confirmados, mas nao foi possivel gerar o link de redefinicao agora.' },
                { status: 500 }
            )
        }

        let whatsappSent = false
        try {
            const instanceToken = await resolveGlobalAgentInstanceToken(admin)
            if (instanceToken) {
                const message = await buildPasswordResetWhatsAppMessage(admin, {
                    name: adminUser.name,
                    email: targetEmail,
                    phone: adminUser.phone,
                    link: resetLink,
                })

                await sendWhatsAppMessage({
                    phone: String(adminUser.phone || ''),
                    message,
                    instanceToken,
                })
                whatsappSent = true
            }
        } catch (whatsappErr) {
            console.error('[password-recovery] whatsapp send failed:', whatsappErr)
        }

        let emailSent = false
        try {
            const { error: emailError } = await admin.auth.resetPasswordForEmail(targetEmail, {
                redirectTo: resetRedirectUrl,
            })
            if (!emailError) emailSent = true
            else console.error('[password-recovery] email send failed:', emailError)
        } catch (emailErr) {
            console.error('[password-recovery] email send failed:', emailErr)
        }

        if (!whatsappSent && !emailSent) {
            await logPasswordRecoveryEvent(admin, request, {
                event_type: 'password_recovery_link_failed',
                attempted_email: targetEmail,
                admin_user_id: adminUser.id,
                auth_user_id: adminUser.auth_user_id,
                metadata: {
                    whatsapp_sent: whatsappSent,
                    email_sent: emailSent,
                },
            })
            return NextResponse.json(
                { error: 'Dados confirmados, mas nao foi possivel enviar o link agora. Tente novamente em instantes.' },
                { status: 500 }
            )
        }

        await logPasswordRecoveryEvent(admin, request, {
            event_type: 'password_recovery_link_sent',
            attempted_email: targetEmail,
            admin_user_id: adminUser.id,
            auth_user_id: adminUser.auth_user_id,
            metadata: {
                whatsapp_sent: whatsappSent,
                email_sent: emailSent,
            },
        })

        return NextResponse.json({ success: true, message: MATCHED_RECOVERY_MESSAGE })
    } catch (err: any) {
        console.error('[password-recovery] unexpected error:', err)
        return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
    }
}
