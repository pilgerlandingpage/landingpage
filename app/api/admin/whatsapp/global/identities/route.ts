import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recordEcosystemEvent } from '@/lib/intelligence/ecosystem'
import { verifyPilgerGlobalManagerAccess } from '@/lib/whatsapp/pilger-admin-access'
import {
    normalizeGlobalPhone,
    type WhatsAppGlobalIdentityType,
} from '@/lib/whatsapp/global-identity'

export const dynamic = 'force-dynamic'

const IDENTITY_TYPES = new Set<WhatsAppGlobalIdentityType>([
    'admin_user',
    'broker_user',
    'broker_authorized',
    'property_owner',
    'lead',
    'blocked',
])

const PERMISSION_KEYS = new Set([
    'master_all',
    'ads',
    'blog',
    'news',
    'finance',
    'dashboard',
    'properties',
    'leads',
    'crm',
    'agenda',
    'send_messages',
    'owner_properties',
])

function cleanText(value: unknown, max = 500) {
    const text = String(value || '').trim()
    return text.length > max ? text.slice(0, max) : text
}

function maskPhone(value: unknown) {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.length <= 6) return `${digits.slice(0, 2)}***`
    return `${digits.slice(0, 2)}***${digits.slice(-4)}`
}

function normalizePermissions(value: unknown) {
    if (!Array.isArray(value)) return []
    return Array.from(new Set(
        value
            .map(item => String(item || '').trim())
            .filter(item => PERMISSION_KEYS.has(item)),
    ))
}

function normalizeIdentityType(value: unknown): WhatsAppGlobalIdentityType {
    const type = String(value || '').trim() as WhatsAppGlobalIdentityType
    return IDENTITY_TYPES.has(type) ? type : 'lead'
}

function serializeOverride(row: any) {
    return {
        id: row.id,
        phone: row.phone,
        phone_masked: maskPhone(row.phone),
        identity_type: row.identity_type || 'lead',
        identity_id: row.identity_id || null,
        display_name: row.display_name || '',
        permission_keys: Array.isArray(row.permission_keys) ? row.permission_keys : [],
        notes: row.notes || '',
        is_active: row.is_active !== false,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
    }
}

async function readOverride(admin: any, id: string) {
    const { data, error } = await admin
        .from('whatsapp_global_identity_overrides')
        .select('*')
        .eq('id', id)
        .maybeSingle()
    if (error) throw error
    return data || null
}

export async function GET() {
    try {
        const access = await verifyPilgerGlobalManagerAccess()
        if (!access) return NextResponse.json({ success: false, error: 'Acesso negado.' }, { status: 403 })

        const admin = createAdminClient()
        const { data, error } = await admin
            .from('whatsapp_global_identity_overrides')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(80)

        if (error) throw error

        return NextResponse.json({
            success: true,
            identities: (data || []).map(serializeOverride),
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await verifyPilgerGlobalManagerAccess()
        if (!access) return NextResponse.json({ success: false, error: 'Acesso negado.' }, { status: 403 })

        const body = await request.json().catch(() => ({}))
        const phone = normalizeGlobalPhone(body?.phone)
        const displayName = cleanText(body?.display_name, 160)
        const identityType = normalizeIdentityType(body?.identity_type)
        const permissionKeys = normalizePermissions(body?.permission_keys)

        if (!phone || phone.length < 8) {
            return NextResponse.json({ success: false, error: 'Informe um telefone valido.' }, { status: 400 })
        }
        if (!displayName && identityType !== 'blocked') {
            return NextResponse.json({ success: false, error: 'Informe o nome ou rotulo do contato.' }, { status: 400 })
        }

        const admin = createAdminClient()
        const payload = {
            phone,
            identity_type: identityType,
            identity_id: cleanText(body?.identity_id, 120) || null,
            display_name: displayName || 'Contato bloqueado',
            permission_keys: identityType === 'blocked' ? [] : permissionKeys,
            notes: cleanText(body?.notes, 1000) || null,
            is_active: body?.is_active !== false,
            created_by: access.id,
            updated_at: new Date().toISOString(),
        }

        const { data, error } = await admin
            .from('whatsapp_global_identity_overrides')
            .upsert(payload, { onConflict: 'phone' })
            .select('*')
            .single()

        if (error) throw error

        await recordEcosystemEvent({
            supabase: admin,
            eventType: 'whatsapp_global_identity_override_upserted',
            actorType: 'human',
            entityType: 'whatsapp_global_identity_override',
            entityId: data.id,
            source: 'admin-whatsapp-global-identities',
            label: `Acesso do Pilger atualizado para ${payload.display_name}`,
            importanceScore: 66,
            metadata: {
                phone_masked: maskPhone(phone),
                identity_type: identityType,
                permission_keys: payload.permission_keys,
                actor_admin_user_id: access.id,
            },
        }).catch(() => null)

        return NextResponse.json({
            success: true,
            identity: serializeOverride(data),
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const access = await verifyPilgerGlobalManagerAccess()
        if (!access) return NextResponse.json({ success: false, error: 'Acesso negado.' }, { status: 403 })

        const body = await request.json().catch(() => ({}))
        const id = cleanText(body?.id, 120)
        if (!id) return NextResponse.json({ success: false, error: 'ID obrigatorio.' }, { status: 400 })

        const admin = createAdminClient()
        const existing = await readOverride(admin, id)
        if (!existing?.id) return NextResponse.json({ success: false, error: 'Identidade nao encontrada.' }, { status: 404 })

        const patch: Record<string, any> = {
            updated_at: new Date().toISOString(),
        }

        if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
            const phone = normalizeGlobalPhone(body.phone)
            if (!phone || phone.length < 8) {
                return NextResponse.json({ success: false, error: 'Informe um telefone valido.' }, { status: 400 })
            }
            patch.phone = phone
        }
        if (Object.prototype.hasOwnProperty.call(body, 'identity_type')) {
            patch.identity_type = normalizeIdentityType(body.identity_type)
        }
        if (Object.prototype.hasOwnProperty.call(body, 'identity_id')) {
            patch.identity_id = cleanText(body.identity_id, 120) || null
        }
        if (Object.prototype.hasOwnProperty.call(body, 'display_name')) {
            patch.display_name = cleanText(body.display_name, 160)
        }
        if (Object.prototype.hasOwnProperty.call(body, 'permission_keys')) {
            patch.permission_keys = normalizePermissions(body.permission_keys)
        }
        if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
            patch.notes = cleanText(body.notes, 1000) || null
        }
        if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
            patch.is_active = body.is_active !== false
        }
        if ((patch.identity_type || existing.identity_type) === 'blocked') {
            patch.permission_keys = []
        }

        const { data, error } = await admin
            .from('whatsapp_global_identity_overrides')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single()

        if (error) throw error

        await recordEcosystemEvent({
            supabase: admin,
            eventType: 'whatsapp_global_identity_override_updated',
            actorType: 'human',
            entityType: 'whatsapp_global_identity_override',
            entityId: id,
            source: 'admin-whatsapp-global-identities',
            label: `Acesso do Pilger editado para ${data.display_name || data.phone}`,
            importanceScore: patch.is_active === false ? 72 : 64,
            metadata: {
                phone_masked: maskPhone(data.phone),
                identity_type: data.identity_type,
                permission_keys: data.permission_keys,
                is_active: data.is_active,
                actor_admin_user_id: access.id,
            },
        }).catch(() => null)

        return NextResponse.json({
            success: true,
            identity: serializeOverride(data),
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}
