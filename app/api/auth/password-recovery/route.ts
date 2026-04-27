import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/uazapi'
import { getLoginRedirectUrl } from '@/lib/app-url'

const MATCHED_RECOVERY_MESSAGE =
    'Dados confirmados. Verifique seu WhatsApp ou seu email para continuar a recuperacao.'
const NOT_FOUND_RECOVERY_MESSAGE =
    'Email ou telefone nao encontrados.'

function getPasswordResetRedirectUrl(request: NextRequest) {
    return getLoginRedirectUrl('/login?password_reset=1', request.nextUrl.origin)
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
        const { data: adminUsers, error: adminUserError } = await admin
            .from('admin_users')
            .select('id, name, email, phone, is_master, is_active')
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
                .select('id, name, email, phone, is_master, is_active')
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
            return NextResponse.json({ success: false, message: NOT_FOUND_RECOVERY_MESSAGE })
        }

        const resetRedirectUrl = getPasswordResetRedirectUrl(request)
        const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email: normalizedEmail,
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

        const resetLink = linkData.properties?.action_link
        if (!resetLink) {
            console.error('[password-recovery] missing reset link for email:', normalizedEmail)
            return NextResponse.json(
                { error: 'Dados confirmados, mas nao foi possivel gerar o link de redefinicao agora.' },
                { status: 500 }
            )
        }

        let whatsappSent = false
        try {
            const instanceToken = await resolveGlobalAgentInstanceToken(admin)
            if (instanceToken) {
                const safeName = String(adminUser.name || '').trim()
                const greeting = safeName ? `Ola ${safeName}!` : 'Ola!'
                const message = `${greeting}

Recebemos um pedido de redefinicao de senha do painel Pilger.
Para criar uma nova senha com seguranca, use este link:
${resetLink}

Se voce nao solicitou esta alteracao, ignore esta mensagem.`

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
            const { error: emailError } = await admin.auth.resetPasswordForEmail(normalizedEmail, {
                redirectTo: resetRedirectUrl,
            })
            if (!emailError) emailSent = true
            else console.error('[password-recovery] email send failed:', emailError)
        } catch (emailErr) {
            console.error('[password-recovery] email send failed:', emailErr)
        }

        if (!whatsappSent && !emailSent) {
            return NextResponse.json(
                { error: 'Dados confirmados, mas nao foi possivel enviar o link agora. Tente novamente em instantes.' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, message: MATCHED_RECOVERY_MESSAGE })
    } catch (err: any) {
        console.error('[password-recovery] unexpected error:', err)
        return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
    }
}
