import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminClient } from '@/lib/supabase/server'
import { deleteInstance as deleteUazapiInstance, sendMenuMessage, sendWhatsAppMessage } from '@/lib/uazapi'
import { buildAuthActionBridgeLink, getLoginRedirectUrl } from '@/lib/app-url'
import {
    buildFirstAccessWhatsAppMessage,
    buildPasswordResetWhatsAppMessage,
    type UserAccessWhatsAppPayload,
} from '@/lib/user-whatsapp-messages'
import { extractTrackingData } from '@/lib/tracking'
import { recordAgentCentralSignal } from '@/lib/intelligence/agent-runtime'

const USERS_SETTINGS_PERMISSION_KEYS = new Set([
    'settings_users',
    'gestao_de_usuarios',
    'usuarios',
    'users',
])

const ADMIN_USERS_LIST_COLUMNS = [
    'id',
    'auth_user_id',
    'name',
    'email',
    'phone',
    'is_master',
    'is_active',
    'created_at',
    'updated_at',
    'shadow_agent_prompt',
    'shadow_agent_enabled',
    'available_from',
    'available_until',
    'transfer_message',
    'whatsapp_instance_id',
].join(', ')

async function verifyUserManagerAccess() {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const admin = createAdminClient()
    const { data: adminUser } = await admin
        .from('admin_users')
        .select('id, is_master, is_active')
        .eq('auth_user_id', user.id)
        .single()

    if (!adminUser?.is_active) return null

    if (adminUser.is_master) {
        return {
            ...adminUser,
            can_grant_master: true,
            can_create_users: true,
            is_diretoria: false,
        }
    }

    const { data: userSectors } = await admin
        .from('admin_user_sectors')
        .select('sector_id, admin_sectors(name)')
        .eq('user_id', adminUser.id)

    const sectorIds = (userSectors || []).map((row: any) => row.sector_id)
    if (sectorIds.length === 0) return null

    const isDiretoria = (userSectors || []).some((row: any) =>
        String(row?.admin_sectors?.name || '').toLowerCase().includes('diretoria')
    )

    const { data: sectorPerms } = await admin
        .from('admin_sector_permissions')
        .select('admin_permissions(module_key)')
        .in('sector_id', sectorIds)

    const hasUsersPermission = (sectorPerms || []).some((row: any) =>
        USERS_SETTINGS_PERMISSION_KEYS.has(row.admin_permissions?.module_key)
    )

    if (!hasUsersPermission) return null

    return {
        ...adminUser,
        can_grant_master: false,
        can_create_users: isDiretoria,
        is_diretoria: isDiretoria,
    }
}

function normalizeSectorIds(raw: unknown): string[] {
    if (!Array.isArray(raw)) return []

    return [
        ...new Set(
            raw
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        ),
    ]
}

async function ensureValidSectorIds(admin: any, sectorIds: string[]) {
    if (sectorIds.length === 0) return

    const { data: sectors, error } = await admin
        .from('admin_sectors')
        .select('id')
        .in('id', sectorIds)

    if (error) throw error

    const foundIds = new Set((sectors || []).map((row: any) => row.id))
    const invalidIds = sectorIds.filter((id) => !foundIds.has(id))

    if (invalidIds.length > 0) {
        throw new Error('Setor informado e invalido.')
    }
}

async function ensureNotRemovingLastActiveMaster(admin: any, targetUser: any, payload: any) {
    if (!targetUser?.is_master) return

    const removingMasterRole = payload?.is_master === false
    const deactivatingMaster = targetUser.is_active && payload?.is_active === false

    if (!removingMasterRole && !deactivatingMaster) return

    const { count, error } = await admin
        .from('admin_users')
        .select('id', { head: true, count: 'exact' })
        .eq('is_master', true)
        .eq('is_active', true)

    if (error) throw error

    if ((count || 0) <= 1) {
        throw new Error('Nao e permitido remover o ultimo admin master ativo.')
    }
}

function getFirstAccessRedirectUrl(request: NextRequest) {
    return getLoginRedirectUrl('/login?first_access=1', request.nextUrl.origin)
}

function getPasswordResetRedirectUrl(request: NextRequest) {
    return getLoginRedirectUrl('/login?password_reset=1', request.nextUrl.origin)
}

function auditTrackingPayload(request: NextRequest) {
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

async function logUserAccessEvent(admin: any, request: NextRequest, params: {
    event_type: string
    target_admin_user_id?: string | null
    target_auth_user_id?: string | null
    target_email?: string | null
    actor_admin_user_id?: string | null
    metadata?: Record<string, any>
}) {
    try {
        await admin.from('user_access_logs').insert({
            admin_user_id: params.target_admin_user_id || null,
            auth_user_id: params.target_auth_user_id || null,
            event_type: params.event_type,
            attempted_email: params.target_email || null,
            path: request.nextUrl.pathname,
            method: request.method,
            ...auditTrackingPayload(request),
            metadata: {
                ...(params.metadata || {}),
                actor_admin_user_id: params.actor_admin_user_id || null,
            },
        })
    } catch (auditErr) {
        console.error('[users] audit log failed:', auditErr)
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

async function sendUserAccessWhatsAppPayload(phone: string, payload: UserAccessWhatsAppPayload, instanceToken: string) {
    if (payload.buttons.length > 0) {
        try {
            const response = await sendMenuMessage({
                phone,
                text: payload.text || 'Acesse pelo botao abaixo:',
                type: 'button',
                choices: payload.buttons.map(button => `${button.text}|url:${button.url}`),
                instanceToken,
            })

            return { response, delivery_mode: 'button' as const }
        } catch (menuError) {
            const safeErrorMessage = menuError instanceof Error
                ? menuError.message.replace(/https?:\/\/\S+/g, '[link-redacted]')
                : 'unknown error'
            console.warn('[users] access link button send failed, falling back to text:', safeErrorMessage)

            const linkText = payload.buttons
                .map(button => `${button.text}: ${button.url}`)
                .join('\n')

            const response = await sendWhatsAppMessage({
                phone,
                message: [payload.text, linkText].filter(Boolean).join('\n\n'),
                instanceToken,
            })

            return { response, delivery_mode: 'text_fallback' as const }
        }
    }

    const response = await sendWhatsAppMessage({
        phone,
        message: payload.text,
        instanceToken,
    })

    return { response, delivery_mode: 'text' as const }
}

async function sendFirstAccessWhatsAppMessage(admin: any, params: { phone: string, name: string, firstAccessLink: string }) {
    const { phone, name, firstAccessLink } = params
    if (!phone || !firstAccessLink) return { sent: false, reason: 'missing_phone_or_link' }

    const instanceToken = await resolveGlobalAgentInstanceToken(admin)
    if (!instanceToken) return { sent: false, reason: 'global_instance_not_available' }

    const payload = await buildFirstAccessWhatsAppMessage(admin, {
        name,
        phone,
        link: firstAccessLink,
    })

    const delivery = await sendUserAccessWhatsAppPayload(phone, payload, instanceToken)

    await recordAgentCentralSignal({
        supabase: admin,
        agentId: 'user-first-access-agent',
        eventType: 'user_first_access_whatsapp_sent',
        entityType: 'admin_user',
        entityId: phone,
        source: 'user-first-access-agent',
        label: `Sofia enviou primeiro acesso para ${name || phone}`,
        importanceScore: 52,
        metadata: {
            user_name: name || null,
            user_phone: phone,
            message_preview: payload.text.slice(0, 500),
            buttons_count: payload.buttons.length,
            delivery_mode: delivery.delivery_mode,
        },
        handoffTargets: ['internal-notifier', 'pilger-ai-core'],
    }).catch((error: any) => {
        console.warn('[Users] first access central signal failed:', error?.message || error)
    })

    return { sent: true, reason: null, delivery_mode: delivery.delivery_mode }
}

async function sendPasswordResetWhatsAppMessage(admin: any, params: { phone: string, name: string, resetLink: string }) {
    const { phone, name, resetLink } = params
    if (!phone || !resetLink) return { sent: false, reason: 'missing_phone_or_link' }

    const instanceToken = await resolveGlobalAgentInstanceToken(admin)
    if (!instanceToken) return { sent: false, reason: 'global_instance_not_available' }

    const payload = await buildPasswordResetWhatsAppMessage(admin, {
        name,
        phone,
        link: resetLink,
    })

    const delivery = await sendUserAccessWhatsAppPayload(phone, payload, instanceToken)

    await recordAgentCentralSignal({
        supabase: admin,
        agentId: 'user-password-reset-agent',
        eventType: 'user_password_reset_whatsapp_sent',
        entityType: 'admin_user',
        entityId: phone,
        source: 'user-password-reset-agent',
        label: `Bruno enviou reset de senha para ${name || phone}`,
        importanceScore: 58,
        metadata: {
            user_name: name || null,
            user_phone: phone,
            message_preview: payload.text.slice(0, 500),
            buttons_count: payload.buttons.length,
            delivery_mode: delivery.delivery_mode,
        },
        handoffTargets: ['internal-notifier', 'pilger-ai-rules'],
    }).catch((error: any) => {
        console.warn('[Users] password reset central signal failed:', error?.message || error)
    })

    return { sent: true, reason: null, delivery_mode: delivery.delivery_mode }
}

async function generateFirstAccessLinkForUser(admin: any, request: NextRequest, params: { email: string, name: string, phone: string }) {
    const firstAccessRedirectUrl = getFirstAccessRedirectUrl(request)
    let firstAccessLinkType: 'invite' | 'recovery' = 'invite'

    const { data: inviteLinkData, error: inviteLinkError } = await admin.auth.admin.generateLink({
        type: 'invite',
        email: params.email,
        options: {
            redirectTo: firstAccessRedirectUrl,
            data: {
                full_name: params.name || '',
                phone: params.phone || null,
            },
        },
    })

    let linkData = inviteLinkData

    if (inviteLinkError) {
        console.warn('[users] manual first access invite failed, falling back to recovery:', inviteLinkError)
        firstAccessLinkType = 'recovery'
        const resetRedirectUrl = getPasswordResetRedirectUrl(request)
        const { data: recoveryLinkData, error: recoveryLinkError } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email: params.email,
            options: {
                redirectTo: resetRedirectUrl,
            },
        })

        if (recoveryLinkError) throw recoveryLinkError
        linkData = recoveryLinkData
    }

    const rawFirstAccessLink = linkData?.properties?.action_link
    const firstAccessLink = rawFirstAccessLink
        ? buildAuthActionBridgeLink(
            rawFirstAccessLink,
            firstAccessLinkType === 'invite' ? 'first_access' : 'password_reset',
            request.nextUrl.origin
        )
        : null

    if (!firstAccessLink) throw new Error('Nao foi possivel gerar link de acesso.')

    return { firstAccessLink, firstAccessLinkType }
}

async function sendManualAccessLinkTextWhatsAppMessage(admin: any, params: {
    phone: string
    name: string
    accessLink: string
    linkType: 'invite' | 'recovery'
}) {
    const { phone, name, accessLink, linkType } = params
    if (!phone || !accessLink) return { sent: false, reason: 'missing_phone_or_link' }

    const instanceToken = await resolveGlobalAgentInstanceToken(admin)
    if (!instanceToken) return { sent: false, reason: 'global_instance_not_available' }

    const safeName = String(name || '').trim() || 'tudo bem'
    const actionLabel = linkType === 'invite'
        ? 'definir sua senha de primeiro acesso'
        : 'redefinir sua senha'

    await sendWhatsAppMessage({
        phone,
        instanceToken,
        message: `Ola ${safeName}!

Conforme solicitado pelo administrador, segue o link direto para ${actionLabel}:
${accessLink}

Se voce nao solicitou este acesso, ignore esta mensagem.`,
    })

    return { sent: true, reason: null }
}

async function syncAlertContacts(admin: any, userId: string, name: string, phone: string | null) {
    if (!phone) return

    const { data: userSectors, error: userSectorsError } = await admin
        .from('admin_user_sectors')
        .select('sector_id')
        .eq('user_id', userId)

    if (userSectorsError) throw userSectorsError

    const sectorIds = (userSectors || []).map((us: any) => us.sector_id)

    let hasAdsPermission = false
    if (sectorIds.length > 0) {
        const { data: perms, error: permsError } = await admin
            .from('admin_sector_permissions')
            .select('admin_permissions(module_key)')
            .in('sector_id', sectorIds)

        if (permsError) throw permsError

        hasAdsPermission = (perms || []).some(
            (p: any) => p.admin_permissions?.module_key === 'ads'
        )
    }

    if (hasAdsPermission) {
        const { data: existing, error: existingError } = await admin
            .from('admin_alert_contacts')
            .select('id')
            .eq('phone', phone)
            .single()

        if (existingError && existingError.code !== 'PGRST116') throw existingError

        if (existing) {
            const { error: updateError } = await admin
                .from('admin_alert_contacts')
                .update({ name, is_active: true })
                .eq('id', existing.id)

            if (updateError) throw updateError
        } else {
            const { error: insertError } = await admin.from('admin_alert_contacts').insert({
                name,
                phone,
                receive_traffic_alerts: true,
                receive_budget_alerts: true,
                receive_ai_actions: true,
                min_urgency: 'medium',
                is_active: true,
            })

            if (insertError) throw insertError
        }
    } else {
        const { error: deactivateError } = await admin
            .from('admin_alert_contacts')
            .update({ is_active: false })
            .eq('phone', phone)

        if (deactivateError) throw deactivateError
    }
}

export async function GET(request: NextRequest) {
    try {
        const access = await verifyUserManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const admin = createAdminClient()

        const { data: users, error } = await admin
            .from('admin_users')
            .select(ADMIN_USERS_LIST_COLUMNS)
            .order('created_at', { ascending: false })

        if (error) throw error

        const { data: userSectors, error: userSectorsError } = await admin
            .from('admin_user_sectors')
            .select('user_id, sector_id, admin_sectors(id, name, color, icon)')

        if (userSectorsError) throw userSectorsError

        const enriched = (users || []).map((u: any) => ({
            ...u,
            sectors: (userSectors || [])
                .filter((us: any) => us.user_id === u.id)
                .map((us: any) => us.admin_sectors)
                .filter(Boolean),
        }))

        const includeSectors = request.nextUrl.searchParams.get('include_sectors') === '1'
        if (includeSectors) {
            const { data: sectors, error: sectorsError } = await admin
                .from('admin_sectors')
                .select('id, name, color, icon')
                .order('name')

            if (sectorsError) throw sectorsError

            return NextResponse.json({
                users: enriched,
                sectors: sectors || [],
                access: {
                    can_grant_master: Boolean(access.can_grant_master),
                    can_create_users: Boolean(access.can_create_users),
                    is_diretoria: Boolean(access.is_diretoria),
                },
            })
        }

        return NextResponse.json(enriched)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await verifyUserManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const { email, name, phone, sector_ids, is_master: newIsMaster } = await request.json()

        const normalizedEmail = String(email || '').trim().toLowerCase()
        const normalizedName = String(name || '').trim()
        const normalizedPhone = String(phone || '').trim()
        const normalizedSectorIds = normalizeSectorIds(sector_ids)

        if (!access.can_grant_master && Boolean(newIsMaster)) {
            return NextResponse.json({ error: 'Somente super admin pode criar usuario master.' }, { status: 403 })
        }

        if (!access.can_grant_master && !access.can_create_users) {
            return NextResponse.json({ error: 'Somente master e diretoria podem cadastrar novos usuarios.' }, { status: 403 })
        }

        if (!normalizedEmail) {
            return NextResponse.json({ error: 'Email e obrigatorio.' }, { status: 400 })
        }
        if (!normalizedPhone) {
            return NextResponse.json({ error: 'Telefone e obrigatorio para envio do primeiro acesso.' }, { status: 400 })
        }

        const admin = createAdminClient()
        await ensureValidSectorIds(admin, normalizedSectorIds)

        const firstAccessRedirectUrl = getFirstAccessRedirectUrl(request)
        const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
            type: 'invite',
            email: normalizedEmail,
            options: {
                redirectTo: firstAccessRedirectUrl,
                data: {
                    full_name: normalizedName || '',
                    phone: normalizedPhone || null,
                },
            },
        })

        if (linkError) throw linkError

        const authUserId = linkData.user?.id
        const rawFirstAccessLink = linkData.properties?.action_link
        const firstAccessLink = rawFirstAccessLink
            ? buildAuthActionBridgeLink(rawFirstAccessLink, 'first_access', request.nextUrl.origin)
            : null
        if (!authUserId) throw new Error('Nao foi possivel criar usuario auth.')
        if (!firstAccessLink) throw new Error('Nao foi possivel gerar link de primeiro acesso.')

        const { data: adminUser, error: insertErr } = await admin
            .from('admin_users')
            .insert({
                auth_user_id: authUserId,
                name: normalizedName || normalizedEmail,
                email: normalizedEmail,
                phone: normalizedPhone || null,
                is_master: access.can_grant_master ? Boolean(newIsMaster) : false,
            })
            .select(ADMIN_USERS_LIST_COLUMNS)
            .single()

        if (insertErr) {
            await admin.auth.admin.deleteUser(authUserId)
            throw insertErr
        }

        if (normalizedSectorIds.length > 0) {
            const links = normalizedSectorIds.map((sid: string) => ({
                user_id: adminUser.id,
                sector_id: sid,
            }))

            const { error: insertLinksError } = await admin.from('admin_user_sectors').insert(links)

            if (insertLinksError) {
                await admin.from('admin_users').delete().eq('id', adminUser.id)
                await admin.auth.admin.deleteUser(authUserId)
                throw insertLinksError
            }

            try {
                await syncAlertContacts(admin, adminUser.id, adminUser.name, adminUser.phone)
            } catch (syncError) {
                console.error('[users][POST] syncAlertContacts failed:', syncError)
            }
        }

        let whatsappInviteSent = false
        let inviteWarning: string | null = null
        try {
            const sendResult = await sendFirstAccessWhatsAppMessage(admin, {
                phone: normalizedPhone,
                name: adminUser.name,
                firstAccessLink,
            })
            whatsappInviteSent = Boolean(sendResult.sent)

            if (!sendResult.sent && sendResult.reason === 'global_instance_not_available') {
                inviteWarning = 'Usuario criado, mas a instancia global do agente nao esta conectada para envio no WhatsApp.'
            }
            if (!sendResult.sent && sendResult.reason === 'missing_phone_or_link') {
                inviteWarning = 'Usuario criado, mas faltou telefone ou link para enviar o primeiro acesso.'
            }
        } catch (sendError) {
            console.error('[users][POST] first-access whatsapp failed:', sendError)
            inviteWarning = 'Usuario criado, mas houve falha ao enviar o link de primeiro acesso no WhatsApp.'
        }

        await logUserAccessEvent(admin, request, {
            event_type: 'first_access_link_sent',
            target_admin_user_id: adminUser.id,
            target_auth_user_id: authUserId,
            target_email: normalizedEmail,
            actor_admin_user_id: access.id,
            metadata: {
                whatsapp_sent: whatsappInviteSent,
                has_warning: Boolean(inviteWarning),
            },
        })

        return NextResponse.json(
            {
                message: whatsappInviteSent
                    ? 'Usuario criado com sucesso e link de primeiro acesso enviado no WhatsApp.'
                    : 'Usuario criado com sucesso.',
                user: adminUser,
                whatsapp_invite_sent: whatsappInviteSent,
                invite_warning: inviteWarning,
                ...(whatsappInviteSent ? {} : { first_access_link: firstAccessLink }),
            },
            { status: 201 }
        )
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const access = await verifyUserManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const {
            id,
            name,
            phone,
            is_active,
            is_master: newIsMaster,
            sector_ids,
            shadow_agent_prompt,
            shadow_agent_enabled,
            available_from,
            available_until,
            transfer_message,
        } = await request.json()

        if (!id) return NextResponse.json({ error: 'ID e obrigatorio' }, { status: 400 })

        const admin = createAdminClient()
        const { data: targetUser, error: targetUserError } = await admin
            .from('admin_users')
            .select('id, is_master, is_active')
            .eq('id', id)
            .single()

        if (targetUserError || !targetUser) {
            return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 })
        }

        if (!access.can_grant_master && targetUser.is_master) {
            return NextResponse.json({ error: 'Somente super admin pode editar um admin master.' }, { status: 403 })
        }

        if (!access.can_grant_master && newIsMaster !== undefined) {
            return NextResponse.json({ error: 'Somente super admin pode alterar perfil master.' }, { status: 403 })
        }

        if (access.can_grant_master) {
            await ensureNotRemovingLastActiveMaster(admin, targetUser, { is_master: newIsMaster, is_active })
        }

        const updateData: any = { updated_at: new Date().toISOString() }
        if (name !== undefined) updateData.name = name
        if (phone !== undefined) updateData.phone = phone
        if (is_active !== undefined) updateData.is_active = is_active
        if (newIsMaster !== undefined && access.can_grant_master) updateData.is_master = newIsMaster
        if (shadow_agent_prompt !== undefined) updateData.shadow_agent_prompt = shadow_agent_prompt
        if (shadow_agent_enabled !== undefined) updateData.shadow_agent_enabled = shadow_agent_enabled
        if (available_from !== undefined) updateData.available_from = available_from
        if (available_until !== undefined) updateData.available_until = available_until
        if (transfer_message !== undefined) updateData.transfer_message = transfer_message

        const { error } = await admin.from('admin_users').update(updateData).eq('id', id)
        if (error) throw error

        if (sector_ids !== undefined) {
            const normalizedSectorIds = normalizeSectorIds(sector_ids)
            await ensureValidSectorIds(admin, normalizedSectorIds)

            const { data: currentLinks, error: currentLinksError } = await admin
                .from('admin_user_sectors')
                .select('sector_id')
                .eq('user_id', id)

            if (currentLinksError) throw currentLinksError

            const currentSectorIds = new Set<string>(
                (currentLinks || []).map((row: any) => String(row.sector_id || '').trim()).filter(Boolean)
            )
            const nextSectorIds = new Set<string>(normalizedSectorIds)

            const toDelete = [...currentSectorIds].filter((sid) => !nextSectorIds.has(sid))
            const toInsert = [...nextSectorIds].filter((sid) => !currentSectorIds.has(sid))

            if (toDelete.length > 0) {
                const { error: deleteError } = await admin
                    .from('admin_user_sectors')
                    .delete()
                    .eq('user_id', id)
                    .in('sector_id', toDelete)

                if (deleteError) throw deleteError
            }

            if (toInsert.length > 0) {
                const links = toInsert.map((sid: string) => ({
                    user_id: id,
                    sector_id: sid,
                }))

                const { error: insertError } = await admin.from('admin_user_sectors').insert(links)
                if (insertError) throw insertError
            }
        }

        const { data: updatedUser } = await admin
            .from('admin_users')
            .select('id, name, phone')
            .eq('id', id)
            .single()

        if (updatedUser) {
            try {
                await syncAlertContacts(admin, id, updatedUser.name, updatedUser.phone)
            } catch (syncError) {
                console.error('[users][PUT] syncAlertContacts failed:', syncError)
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const access = await verifyUserManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

        const { action, id } = await request.json()
        if (!['send_password_reset', 'resend_first_access', 'send_access_link_text'].includes(action)) {
            return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
        }

        if (!access.can_grant_master && !access.can_create_users) {
            return NextResponse.json({ error: 'Somente master e diretoria podem enviar links de acesso.' }, { status: 403 })
        }

        if (!id) return NextResponse.json({ error: 'ID e obrigatorio.' }, { status: 400 })

        const admin = createAdminClient()
        const { data: targetUser, error: targetUserError } = await admin
            .from('admin_users')
            .select('id, auth_user_id, name, email, phone, is_master')
            .eq('id', id)
            .single()

        if (targetUserError || !targetUser) {
            return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 })
        }

        if (!access.can_grant_master && targetUser.is_master) {
            return NextResponse.json({ error: 'Somente admin master pode redefinir senha de outro master.' }, { status: 403 })
        }

        const normalizedEmail = String(targetUser.email || '').trim().toLowerCase()
        const normalizedPhone = String(targetUser.phone || '').trim()
        if (!normalizedEmail) {
            return NextResponse.json({ error: 'Usuario sem email cadastrado para redefinicao de senha.' }, { status: 400 })
        }
        if (!normalizedPhone) {
            return NextResponse.json({ error: 'Usuario sem telefone cadastrado para envio no WhatsApp.' }, { status: 400 })
        }

        if (action === 'send_access_link_text') {
            const { firstAccessLink, firstAccessLinkType } = await generateFirstAccessLinkForUser(admin, request, {
                email: normalizedEmail,
                name: targetUser.name,
                phone: normalizedPhone,
            })

            let whatsappLinkSent = false
            let linkWarning: string | null = null
            try {
                const sendResult = await sendManualAccessLinkTextWhatsAppMessage(admin, {
                    phone: normalizedPhone,
                    name: targetUser.name,
                    accessLink: firstAccessLink,
                    linkType: firstAccessLinkType,
                })
                whatsappLinkSent = Boolean(sendResult.sent)

                if (!sendResult.sent && sendResult.reason === 'global_instance_not_available') {
                    linkWarning = 'Link gerado, mas a instancia global do agente nao esta conectada para envio no WhatsApp.'
                }
                if (!sendResult.sent && sendResult.reason === 'missing_phone_or_link') {
                    linkWarning = 'Link gerado, mas faltou telefone ou link para enviar no WhatsApp.'
                }
            } catch (sendError) {
                console.error('[users][PATCH] manual text access link failed:', sendError)
                linkWarning = 'Link gerado, mas houve falha ao enviar o link direto no WhatsApp.'
            }

            await logUserAccessEvent(admin, request, {
                event_type: firstAccessLinkType === 'invite' ? 'first_access_link_sent' : 'password_reset_link_sent',
                target_admin_user_id: targetUser.id,
                target_auth_user_id: targetUser.auth_user_id,
                target_email: normalizedEmail,
                actor_admin_user_id: access.id,
                metadata: {
                    manual: true,
                    delivery_mode: 'manual_text_link',
                    link_type: firstAccessLinkType,
                    whatsapp_sent: whatsappLinkSent,
                    has_warning: Boolean(linkWarning),
                },
            })

            return NextResponse.json({
                success: true,
                message: whatsappLinkSent
                    ? 'Link direto enviado no WhatsApp com sucesso.'
                    : 'Link direto gerado com sucesso.',
                whatsapp_link_sent: whatsappLinkSent,
                link_warning: linkWarning,
                ...(whatsappLinkSent ? {} : { access_link: firstAccessLink }),
            })
        }

        if (action === 'resend_first_access') {
            const firstAccessRedirectUrl = getFirstAccessRedirectUrl(request)
            let firstAccessLinkType: 'invite' | 'recovery' = 'invite'
            let linkData: any = null

            const { data: inviteLinkData, error: inviteLinkError } = await admin.auth.admin.generateLink({
                type: 'invite',
                email: normalizedEmail,
                options: {
                    redirectTo: firstAccessRedirectUrl,
                    data: {
                        full_name: targetUser.name || '',
                        phone: normalizedPhone || null,
                    },
                },
            })

            if (inviteLinkError) {
                console.warn('[users][PATCH] invite resend failed, falling back to recovery:', inviteLinkError)
                firstAccessLinkType = 'recovery'
                const resetRedirectUrl = getPasswordResetRedirectUrl(request)
                const { data: recoveryLinkData, error: recoveryLinkError } = await admin.auth.admin.generateLink({
                    type: 'recovery',
                    email: normalizedEmail,
                    options: {
                        redirectTo: resetRedirectUrl,
                    },
                })

                if (recoveryLinkError) throw recoveryLinkError
                linkData = recoveryLinkData
            } else {
                linkData = inviteLinkData
            }

            const rawFirstAccessLink = linkData?.properties?.action_link
            const firstAccessLink = rawFirstAccessLink
                ? buildAuthActionBridgeLink(
                    rawFirstAccessLink,
                    firstAccessLinkType === 'invite' ? 'first_access' : 'password_reset',
                    request.nextUrl.origin
                )
                : null
            if (!firstAccessLink) throw new Error('Nao foi possivel gerar link de primeiro acesso.')

            let whatsappInviteSent = false
            let inviteWarning: string | null = null
            try {
                const sendResult = await sendFirstAccessWhatsAppMessage(admin, {
                    phone: normalizedPhone,
                    name: targetUser.name,
                    firstAccessLink,
                })
                whatsappInviteSent = Boolean(sendResult.sent)

                if (!sendResult.sent && sendResult.reason === 'global_instance_not_available') {
                    inviteWarning = 'Link gerado, mas a instancia global do agente nao esta conectada para envio no WhatsApp.'
                }
                if (!sendResult.sent && sendResult.reason === 'missing_phone_or_link') {
                    inviteWarning = 'Link gerado, mas faltou telefone ou link para enviar no WhatsApp.'
                }
            } catch (sendError) {
                console.error('[users][PATCH] first-access resend whatsapp failed:', sendError)
                inviteWarning = 'Link gerado, mas houve falha ao enviar no WhatsApp.'
            }

            await logUserAccessEvent(admin, request, {
                event_type: 'first_access_link_sent',
                target_admin_user_id: targetUser.id,
                target_auth_user_id: targetUser.auth_user_id,
                target_email: normalizedEmail,
                actor_admin_user_id: access.id,
                metadata: {
                    resent: true,
                    link_type: firstAccessLinkType,
                    whatsapp_sent: whatsappInviteSent,
                    has_warning: Boolean(inviteWarning),
                },
            })

            return NextResponse.json({
                success: true,
                message: whatsappInviteSent
                    ? 'Link de primeiro acesso reenviado no WhatsApp com sucesso.'
                    : 'Link de primeiro acesso gerado com sucesso.',
                whatsapp_invite_sent: whatsappInviteSent,
                invite_warning: inviteWarning,
                ...(whatsappInviteSent ? {} : { first_access_link: firstAccessLink }),
            })
        }

        const resetRedirectUrl = getPasswordResetRedirectUrl(request)
        const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email: normalizedEmail,
            options: {
                redirectTo: resetRedirectUrl,
            },
        })

        if (linkError) throw linkError

        const rawResetLink = linkData.properties?.action_link
        const resetLink = rawResetLink
            ? buildAuthActionBridgeLink(rawResetLink, 'password_reset', request.nextUrl.origin)
            : null
        if (!resetLink) throw new Error('Nao foi possivel gerar link de redefinicao.')

        let whatsappResetSent = false
        let resetWarning: string | null = null
        try {
            const sendResult = await sendPasswordResetWhatsAppMessage(admin, {
                phone: normalizedPhone,
                name: targetUser.name,
                resetLink,
            })
            whatsappResetSent = Boolean(sendResult.sent)

            if (!sendResult.sent && sendResult.reason === 'global_instance_not_available') {
                resetWarning = 'Link gerado, mas a instancia global do agente nao esta conectada para envio no WhatsApp.'
            }
            if (!sendResult.sent && sendResult.reason === 'missing_phone_or_link') {
                resetWarning = 'Link gerado, mas faltou telefone ou link para enviar no WhatsApp.'
            }
        } catch (sendError) {
            console.error('[users][PATCH] password reset whatsapp failed:', sendError)
            resetWarning = 'Link gerado, mas houve falha ao enviar no WhatsApp.'
        }

        await logUserAccessEvent(admin, request, {
            event_type: 'password_reset_link_sent',
            target_admin_user_id: targetUser.id,
            target_auth_user_id: targetUser.auth_user_id,
            target_email: normalizedEmail,
            actor_admin_user_id: access.id,
            metadata: {
                whatsapp_sent: whatsappResetSent,
                has_warning: Boolean(resetWarning),
            },
        })

        return NextResponse.json({
            success: true,
            message: whatsappResetSent
                ? 'Link de redefinicao enviado no WhatsApp com sucesso.'
                : 'Link de redefinicao gerado com sucesso.',
            whatsapp_reset_sent: whatsappResetSent,
            reset_warning: resetWarning,
            ...(whatsappResetSent ? {} : { reset_link: resetLink }),
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const access = await verifyUserManagerAccess()
        if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        if (!access.can_grant_master) {
            return NextResponse.json({ error: 'Somente admin master pode excluir usuarios.' }, { status: 403 })
        }

        const { id } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID e obrigatorio.' }, { status: 400 })
        if (id === access.id) {
            return NextResponse.json({ error: 'Nao e permitido excluir o proprio usuario.' }, { status: 400 })
        }

        const admin = createAdminClient()
        const { data: targetUser, error: targetUserError } = await admin
            .from('admin_users')
            .select('id, auth_user_id, is_master, is_active')
            .eq('id', id)
            .single()

        if (targetUserError || !targetUser) {
            return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 })
        }

        await ensureNotRemovingLastActiveMaster(admin, targetUser, {
            is_master: false,
            is_active: false,
        })

        // Remove vinculacoes operacionais para evitar bloqueio por FK.
        const { error: deleteSectorsLinksError } = await admin
            .from('admin_user_sectors')
            .delete()
            .eq('user_id', id)
        if (deleteSectorsLinksError) throw deleteSectorsLinksError

        const { data: userInstances, error: userInstancesError } = await admin
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token')
            .eq('admin_user_id', id)
        if (userInstancesError) throw userInstancesError

        for (const instance of userInstances || []) {
            const token = String(instance.instance_token || '').trim()
            if (!token) {
                return NextResponse.json({
                    error: `A instancia "${instance.instance_name || instance.id}" nao possui token local. Ela nao foi removida para evitar deixar dados inconsistentes.`,
                }, { status: 409 })
            }

            try {
                await deleteUazapiInstance(token, instance.instance_name || undefined)
            } catch (deleteErr) {
                return NextResponse.json({
                    error: `Nao foi possivel excluir a instancia "${instance.instance_name || instance.id}" no servidor da UAZAPI. O usuario nao foi removido.`,
                    details: deleteErr instanceof Error ? deleteErr.message : String(deleteErr),
                }, { status: 502 })
            }
        }

        const { error: deleteWhatsappLinksError } = await admin
            .from('whatsapp_instances')
            .delete()
            .eq('admin_user_id', id)
        if (deleteWhatsappLinksError) throw deleteWhatsappLinksError

        const { error: deleteUserError } = await admin.from('admin_users').delete().eq('id', id)
        if (deleteUserError) throw deleteUserError

        let authDeletionWarning: string | null = null
        const authUserId = String(targetUser.auth_user_id || '').trim()
        if (authUserId) {
            const { error: authDeleteError } = await admin.auth.admin.deleteUser(authUserId)
            if (authDeleteError) {
                authDeletionWarning = 'Usuario removido da base interna, mas houve falha ao remover do Auth.'
            }
        }

        return NextResponse.json({
            success: true,
            message: authDeletionWarning
                ? 'Usuario excluido com ressalvas.'
                : 'Usuario excluido com sucesso.',
            warning: authDeletionWarning,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

