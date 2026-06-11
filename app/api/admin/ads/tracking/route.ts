import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_KEYS = [
    'meta_pixel_id',
    'google_ads_conversion_id',
    'google_analytics_measurement_id',
] as const

type TrackingKey = typeof ALLOWED_KEYS[number]

const ALLOWED_KEY_SET = new Set<string>(ALLOWED_KEYS)

async function requireAdsAccess() {
    const authClient = await createServerSupabase()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
        return { ok: false as const, status: 401, message: 'Unauthorized' }
    }

    const admin = createAdminClient()
    const { data: adminUser } = await admin
        .from('admin_users')
        .select('id, is_master, is_active')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (!adminUser || adminUser.is_active === false) {
        return { ok: false as const, status: 403, message: 'Acesso negado.' }
    }

    if (adminUser.is_master) {
        return { ok: true as const, admin }
    }

    const { data: userSectors } = await admin
        .from('admin_user_sectors')
        .select('sector_id')
        .eq('user_id', adminUser.id)

    const sectorIds = (userSectors || []).map((row: any) => row.sector_id).filter(Boolean)
    if (sectorIds.length === 0) {
        return { ok: false as const, status: 403, message: 'Acesso negado.' }
    }

    const { data: sectorPerms } = await admin
        .from('admin_sector_permissions')
        .select('admin_permissions(module_key)')
        .in('sector_id', sectorIds)

    const hasAdsAccess = (sectorPerms || []).some((row: any) => row.admin_permissions?.module_key === 'ads')
    if (!hasAdsAccess) {
        return { ok: false as const, status: 403, message: 'Acesso negado.' }
    }

    return { ok: true as const, admin }
}

function normalizeTrackingValue(key: TrackingKey, value: unknown) {
    const raw = String(value || '').trim()
    if (!raw) return ''

    if (key === 'meta_pixel_id') {
        const normalized = raw.replace(/\s+/g, '')
        if (!/^\d{5,30}$/.test(normalized)) {
            throw new Error('Meta Pixel ID invalido.')
        }
        return normalized
    }

    if (key === 'google_ads_conversion_id') {
        const compact = raw.replace(/\s+/g, '').toUpperCase()
        const normalized = /^\d{6,20}$/.test(compact) ? `AW-${compact}` : compact
        if (!/^AW-\d{6,20}$/.test(normalized)) {
            throw new Error('Google Ads Conversion ID invalido. Use AW-000000000.')
        }
        return normalized
    }

    if (key === 'google_analytics_measurement_id') {
        const normalized = raw.replace(/\s+/g, '').toUpperCase()
        if (!/^G-[A-Z0-9]{4,20}$/.test(normalized)) {
            throw new Error('GA4 Measurement ID invalido. Use G-XXXXXXXXXX.')
        }
        return normalized
    }

    return raw
}

export async function GET() {
    try {
        const access = await requireAdsAccess()
        if (!access.ok) {
            return NextResponse.json({ success: false, message: access.message }, { status: access.status })
        }

        const { data, error } = await access.admin
            .from('app_config')
            .select('key, value, updated_at')
            .in('key', ALLOWED_KEYS)

        if (error) throw error

        const configs: Record<string, string> = {}
        const updatedAt: Record<string, string> = {}

        for (const row of data || []) {
            if (!row?.key || !ALLOWED_KEY_SET.has(row.key)) continue
            configs[row.key] = String(row.value || '')
            if (row.updated_at) updatedAt[row.key] = String(row.updated_at)
        }

        return NextResponse.json({ success: true, configs, updatedAt })
    } catch (error) {
        console.error('[ads-tracking] config load error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao carregar tracking.' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await requireAdsAccess()
        if (!access.ok) {
            return NextResponse.json({ success: false, message: access.message }, { status: access.status })
        }

        const body = await request.json().catch(() => ({}))
        const configs = body?.configs && typeof body.configs === 'object' ? body.configs : {}
        const rows = Object.entries(configs)
            .filter(([key]) => ALLOWED_KEY_SET.has(key))
            .map(([key, value]) => ({
                key,
                value: normalizeTrackingValue(key as TrackingKey, value),
                updated_at: new Date().toISOString(),
            }))

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Nenhuma configuracao valida enviada.' }, { status: 400 })
        }

        const { error } = await access.admin
            .from('app_config')
            .upsert(rows, { onConflict: 'key' })

        if (error) throw error

        return NextResponse.json({
            success: true,
            message: 'Tracking salvo com sucesso.',
            configs: Object.fromEntries(rows.map(row => [row.key, row.value])),
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao salvar tracking.'
        console.error('[ads-tracking] config save error:', error)
        return NextResponse.json({ success: false, message }, { status: 400 })
    }
}
