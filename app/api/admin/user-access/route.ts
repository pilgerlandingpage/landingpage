import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { extractTrackingData } from '@/lib/tracking'

const ACCESS_EVENT_TYPES = new Set([
    'login_success',
    'login_failed',
    'logout',
    'page_view',
    'session_ping',
])

function cleanText(value: unknown, maxLength = 500) {
    const text = String(value || '').trim()
    return text ? text.slice(0, maxLength) : null
}

function isDiretoriaSector(sectorName: unknown) {
    return String(sectorName || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes('diretoria')
}

async function getCurrentAdminUser() {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { user: null, adminUser: null, sectors: [] as any[] }

    const admin = createAdminClient()
    const { data: adminUser } = await admin
        .from('admin_users')
        .select('id, auth_user_id, name, email, is_master, is_active')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (!adminUser) return { user, adminUser: null, sectors: [] as any[] }

    const { data: userSectors } = await admin
        .from('admin_user_sectors')
        .select('admin_sectors(id, name)')
        .eq('user_id', adminUser.id)

    const sectors = (userSectors || [])
        .map((row: any) => row.admin_sectors)
        .filter(Boolean)

    return { user, adminUser, sectors }
}

async function canViewAccessLogs() {
    const context = await getCurrentAdminUser()
    if (!context.adminUser?.is_active) return { allowed: false, ...context }

    const isMaster = Boolean(context.adminUser.is_master)
    const isDiretoria = context.sectors.some((sector: any) => isDiretoriaSector(sector?.name))

    return { allowed: isMaster || isDiretoria, ...context }
}

function trackingPayload(request: NextRequest, body: any) {
    const searchParams = new URLSearchParams(String(body?.search_params || ''))
    const referrer = cleanText(body?.referrer, 1000) || undefined
    const tracking = extractTrackingData(request.headers, searchParams, referrer)

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

function normalizeAdminUser(row: any) {
    const relation = row?.admin_users
    if (Array.isArray(relation)) return relation[0] || null
    return relation || null
}

export async function GET(request: NextRequest) {
    try {
        const access = await canViewAccessLogs()
        if (!access.allowed) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const admin = createAdminClient()
        const params = request.nextUrl.searchParams
        const limit = Math.min(Math.max(Number(params.get('limit') || 200), 25), 500)
        const userId = cleanText(params.get('user_id'), 80)
        const eventType = cleanText(params.get('event_type'), 40)
        const q = cleanText(params.get('q'), 120)

        const days = Math.min(Math.max(Number(params.get('days') || 7), 1), 90)
        const since = new Date()
        since.setDate(since.getDate() - days)

        let query = admin
            .from('user_access_logs')
            .select(`
                id,
                admin_user_id,
                auth_user_id,
                event_type,
                path,
                attempted_email,
                ip_address,
                device_type,
                browser,
                os,
                country,
                city,
                region,
                referrer,
                metadata,
                created_at,
                admin_users(id, name, email, is_master)
            `)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(limit)

        if (userId) query = query.eq('admin_user_id', userId)
        if (eventType && ACCESS_EVENT_TYPES.has(eventType)) query = query.eq('event_type', eventType)

        const { data, error } = await query
        if (error) throw error

        const filtered = (data || []).filter((row: any) => {
            if (!q) return true
            const adminUser = normalizeAdminUser(row)
            const haystack = [
                adminUser?.name,
                adminUser?.email,
                row.attempted_email,
                row.ip_address,
                row.city,
                row.region,
                row.country,
                row.browser,
                row.os,
                row.path,
            ].join(' ').toLowerCase()
            return haystack.includes(q.toLowerCase())
        })

        const userMap = new Map<string, any>()
        const ipSet = new Set<string>()
        const topUsers = new Map<string, { id: string | null, name: string, email: string | null, events: number, last_access_at: string }>()

        for (const row of filtered as any[]) {
            const adminUser = normalizeAdminUser(row)
            if (row.admin_user_id) userMap.set(row.admin_user_id, adminUser || { id: row.admin_user_id })
            if (row.ip_address) ipSet.add(row.ip_address)

            const key = row.admin_user_id || row.attempted_email || 'unknown'
            const previous = topUsers.get(key)
            topUsers.set(key, {
                id: row.admin_user_id || null,
                name: adminUser?.name || row.attempted_email || 'Nao identificado',
                email: adminUser?.email || row.attempted_email || null,
                events: (previous?.events || 0) + 1,
                last_access_at: previous?.last_access_at || row.created_at,
            })
        }

        const logs = filtered.map((row: any) => ({
            ...row,
            admin_user: normalizeAdminUser(row),
            admin_users: undefined,
        }))

        const stats = {
            total_events: filtered.length,
            unique_users: userMap.size,
            unique_ips: ipSet.size,
            login_success: filtered.filter((row: any) => row.event_type === 'login_success').length,
            login_failed: filtered.filter((row: any) => row.event_type === 'login_failed').length,
            page_views: filtered.filter((row: any) => row.event_type === 'page_view').length,
            logout: filtered.filter((row: any) => row.event_type === 'logout').length,
            top_users: [...topUsers.values()]
                .sort((a, b) => b.events - a.events)
                .slice(0, 8),
        }

        return NextResponse.json({
            success: true,
            access: {
                is_master: Boolean(access.adminUser?.is_master),
                is_diretoria: access.sectors.some((sector: any) => isDiretoriaSector(sector?.name)),
            },
            stats,
            logs,
        })
    } catch (err: any) {
        console.error('[User Access API GET]', err)
        return NextResponse.json({ error: err.message || 'Erro ao consultar acessos' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const eventType = cleanText(body?.event_type, 40) || 'page_view'
        if (!ACCESS_EVENT_TYPES.has(eventType)) {
            return NextResponse.json({ error: 'Tipo de evento invalido' }, { status: 400 })
        }

        const admin = createAdminClient()
        const tracking = trackingPayload(request, body)
        const metadata = body?.metadata && typeof body.metadata === 'object' ? body.metadata : {}

        if (eventType === 'login_failed') {
            const attemptedEmail = cleanText(body?.attempted_email, 320)
            await admin.from('user_access_logs').insert({
                event_type: eventType,
                attempted_email: attemptedEmail,
                path: cleanText(body?.path, 1000) || '/login',
                method: request.method,
                ...tracking,
                metadata,
            })

            return NextResponse.json({ success: true })
        }

        const { user, adminUser } = await getCurrentAdminUser()
        if (!user || !adminUser?.is_active) {
            return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
        }

        await admin.from('user_access_logs').insert({
            admin_user_id: adminUser.id,
            auth_user_id: user.id,
            event_type: eventType,
            path: cleanText(body?.path, 1000),
            method: request.method,
            ...tracking,
            metadata,
        })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[User Access API POST]', err)
        return NextResponse.json({ error: err.message || 'Erro ao registrar acesso' }, { status: 500 })
    }
}
