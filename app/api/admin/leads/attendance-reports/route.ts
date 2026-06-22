import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
    generateAttendanceReports,
    syncAndGenerateAttendanceReports,
    syncAttendanceForConnectedInstances,
} from '@/lib/whatsapp/attendance-monitor'
import { getContactAvatar } from '@/lib/uazapi'

function extractAvatarUrl(payload: any): string | null {
    return payload?.url ||
        payload?.profilePictureUrl ||
        payload?.profilePicUrl ||
        payload?.imgUrl ||
        payload?.avatar ||
        payload?.data?.url ||
        payload?.data?.profilePictureUrl ||
        payload?.data?.profilePicUrl ||
        null
}

function normalizeDateValue(value: unknown) {
    const text = String(value || '').trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function normalizeDateRange(startValue: unknown, endValue: unknown, fallbackValue?: unknown) {
    let startDate = normalizeDateValue(startValue) || normalizeDateValue(fallbackValue)
    let endDate = normalizeDateValue(endValue) || normalizeDateValue(fallbackValue) || startDate

    if (!startDate && endDate) {
        startDate = endDate
    }

    if (startDate && endDate && startDate > endDate) {
        const previousStart = startDate
        startDate = endDate
        endDate = previousStart
    }

    return { startDate, endDate }
}

function listDatesInRange(startDate: string | null, endDate: string | null) {
    if (!startDate) return []
    const dates: string[] = []
    const end = endDate || startDate
    const cursor = new Date(`${startDate}T12:00:00.000Z`)
    const endTime = new Date(`${end}T12:00:00.000Z`).getTime()

    for (let guard = 0; guard < 45 && cursor.getTime() <= endTime; guard += 1) {
        dates.push(cursor.toISOString().slice(0, 10))
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    return dates
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(max, Math.max(min, Math.round(parsed)))
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const date = request.nextUrl.searchParams.get('date')
        const { startDate, endDate } = normalizeDateRange(
            request.nextUrl.searchParams.get('start_date'),
            request.nextUrl.searchParams.get('end_date'),
            date
        )
        const instanceId = request.nextUrl.searchParams.get('instance_id')
        const reportId = request.nextUrl.searchParams.get('report_id')
        const scoreFilter = String(request.nextUrl.searchParams.get('filtro') || request.nextUrl.searchParams.get('filter') || 'todos')

        let reportsQuery = supabase
            .from('broker_attendance_reports')
            .select('*')
            .order('generated_at', { ascending: false })
            .limit(50)
        if (reportId) reportsQuery = reportsQuery.eq('id', reportId).limit(1)
        else if (startDate && endDate) reportsQuery = reportsQuery.gte('report_date', startDate).lte('report_date', endDate)
        else if (startDate) reportsQuery = reportsQuery.eq('report_date', startDate)
        if (instanceId) reportsQuery = reportsQuery.eq('instance_id', instanceId)

        const [reportsRes, instancesRes, jobsRes] = await Promise.all([
            reportsQuery,
            supabase
                .from('whatsapp_instances')
                .select('id, instance_name, instance_token, phone_number, broker_id, admin_user_id, status, config')
                .order('created_at', { ascending: false }),
            supabase
                .from('whatsapp_import_jobs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10),
        ])

        if (reportsRes.error) throw reportsRes.error
        if (instancesRes.error) throw instancesRes.error
        if (jobsRes.error) throw jobsRes.error

        let recentReportsQuery = supabase
            .from('broker_attendance_reports')
            .select('id, instance_id, report_date, score, coverage, generated_at')
            .order('report_date', { ascending: false })
            .order('generated_at', { ascending: false })
            .limit(120)
        if (instanceId) recentReportsQuery = recentReportsQuery.eq('instance_id', instanceId)

        const recentReportsRes = await recentReportsQuery
        if (recentReportsRes.error) throw recentReportsRes.error

        const recentReportsWithMessages = (recentReportsRes.data || []).filter((report: any) =>
            Number(report?.coverage?.messages_analyzed || 0) > 0
        )

        const instances = instancesRes.data || []
        const brokerIds = Array.from(new Set(instances.map((instance: any) => instance.broker_id).filter(Boolean)))
        const adminUserIds = Array.from(new Set(instances.map((instance: any) => instance.admin_user_id).filter(Boolean)))
        const brokerMap = new Map<string, any>()
        const adminUserMap = new Map<string, any>()

        if (brokerIds.length > 0) {
            const { data: brokers, error: brokersError } = await supabase
                .from('virtual_brokers')
                .select('id, name, creci, phone, photo_url')
                .in('id', brokerIds)

            if (brokersError) {
                console.warn('[attendance-reports GET] Falha ao carregar corretores', brokersError.message)
            } else {
                const brokerRows = brokers || []
                brokerRows.forEach((broker: any) => brokerMap.set(broker.id, broker))
            }
        }

        if (adminUserIds.length > 0) {
            const { data: adminUsers, error: adminUsersError } = await supabase
                .from('admin_users')
                .select('id, name, email, phone')
                .in('id', adminUserIds)

            if (adminUsersError) {
                console.warn('[attendance-reports GET] Falha ao carregar usuarios donos', adminUsersError.message)
            } else {
                const adminUserRows = adminUsers || []
                adminUserRows.forEach((adminUser: any) => adminUserMap.set(adminUser.id, adminUser))
            }
        }

        const enrichedInstances = await Promise.all(instances.map(async (instance: any) => {
            const broker = instance.broker_id ? brokerMap.get(instance.broker_id) : null
            const adminUser = instance.admin_user_id ? adminUserMap.get(instance.admin_user_id) : null
            const ownerName = broker?.name || adminUser?.name || null
            const ownerSubtitle = broker?.creci ? `CRECI: ${broker.creci}` : (adminUser?.email || null)
            const ownerPhone = instance.phone_number || broker?.phone || adminUser?.phone || null
            let ownerPhotoUrl = broker?.photo_url || null

            if (!ownerPhotoUrl && instance.status === 'connected' && instance.instance_token && ownerPhone) {
                try {
                    const avatarData = await getContactAvatar(ownerPhone, instance.instance_token)
                    ownerPhotoUrl = extractAvatarUrl(avatarData)
                } catch {
                    ownerPhotoUrl = null
                }
            }

            return {
                id: instance.id,
                instance_name: instance.instance_name,
                phone_number: instance.phone_number,
                broker_id: instance.broker_id,
                admin_user_id: instance.admin_user_id,
                status: instance.status,
                config: instance.config,
                owner_name: ownerName,
                owner_type: broker ? 'agent' : (adminUser ? 'user' : 'instance'),
                owner_subtitle: ownerSubtitle,
                owner_phone: ownerPhone,
                owner_photo_url: ownerPhotoUrl,
            }
        }))

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const messageActivityByInstance = new Map<string, any>()
        await Promise.all(enrichedInstances.map(async (instance: any) => {
            const [totalMessages, recentMessages, latestMessages] = await Promise.all([
                supabase
                    .from('whatsapp_message_history')
                    .select('id', { count: 'exact', head: true })
                    .eq('instance_id', instance.id),
                supabase
                    .from('whatsapp_message_history')
                    .select('id', { count: 'exact', head: true })
                    .eq('instance_id', instance.id)
                    .gte('message_timestamp', sevenDaysAgo),
                supabase
                    .from('whatsapp_message_history')
                    .select('message_timestamp, direction, from_me, source')
                    .eq('instance_id', instance.id)
                    .order('message_timestamp', { ascending: false })
                    .limit(1),
            ])

            messageActivityByInstance.set(instance.id, {
                total_messages: totalMessages.count || 0,
                last_7_days_messages: recentMessages.count || 0,
                latest_message_at: latestMessages.data?.[0]?.message_timestamp || null,
                latest_message_direction: latestMessages.data?.[0]?.direction || null,
                latest_message_source: latestMessages.data?.[0]?.source || null,
            })
        }))

        const instancesWithActivity = enrichedInstances.map((instance: any) => ({
            ...instance,
            message_activity: messageActivityByInstance.get(instance.id) || {
                total_messages: 0,
                last_7_days_messages: 0,
                latest_message_at: null,
                latest_message_direction: null,
                latest_message_source: null,
            },
        }))

        const reportIds = (reportsRes.data || []).map((report: any) => report.id)
        let scores: any[] = []
        if (reportIds.length > 0) {
            let scoresQuery = supabase
                .from('broker_attendance_conversation_scores')
                .select('*')
                .in('report_id', reportIds)
                .order('score', { ascending: true })

            if (scoreFilter === 'critica') scoresQuery = scoresQuery.or('unanswered.eq.true,score.lt.60')
            else if (scoreFilter === 'sem-resposta') scoresQuery = scoresQuery.eq('unanswered', true)
            else if (scoreFilter === 'quentes') scoresQuery = scoresQuery.eq('lead_potential', 'hot')
            else if (scoreFilter === 'mornos') scoresQuery = scoresQuery.eq('lead_potential', 'warm')
            else if (scoreFilter === 'frios') scoresQuery = scoresQuery.eq('lead_potential', 'cold')
            else if (scoreFilter === 'ruins') scoresQuery = scoresQuery.lt('score', 60)
            else if (scoreFilter === 'bons') scoresQuery = scoresQuery.gte('score', 80)

            const scoresRes = await scoresQuery
            if (scoresRes.error) throw scoresRes.error
            scores = scoresRes.data || []
        }

        return NextResponse.json({
            success: true,
            reports: reportsRes.data || [],
            recent_reports_with_messages: recentReportsWithMessages,
            conversation_scores: scores,
            instances: instancesWithActivity,
            jobs: jobsRes.data || [],
        })
    } catch (error: any) {
        console.error('[attendance-reports GET]', error)
        return NextResponse.json({ success: false, error: error?.message || 'Erro ao carregar relatorios' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const action = String(body?.action || 'sync_and_report')
        const instanceId = body?.instance_id || null
        const date = body?.date || null
        const { startDate, endDate } = normalizeDateRange(body?.start_date, body?.end_date, date)
        const reportDates = listDatesInRange(startDate, endDate)
        const singleDate = reportDates[0] || date
        const force = body?.force !== false
        const includeHistorySync = body?.include_history_sync !== false
        const syncOptions = {
            instanceId,
            force,
            includeHistorySync,
            maxChats: boundedNumber(body?.max_chats, 300, 50, 500),
            messagesPerChat: boundedNumber(body?.messages_per_chat, 120, 20, 300),
            maxContacts: boundedNumber(body?.max_contacts, 5000, 200, 10000),
        }

        if (action === 'sync') {
            const result = await syncAttendanceForConnectedInstances(syncOptions)
            return NextResponse.json(result)
        }

        if (action === 'report') {
            if (reportDates.length <= 1) {
                const result = await generateAttendanceReports({ instanceId, date: singleDate, force })
                return NextResponse.json(result)
            }

            const reportRuns = []
            for (const reportDate of reportDates) {
                reportRuns.push(await generateAttendanceReports({ instanceId, date: reportDate, force }))
            }
            return NextResponse.json({
                success: true,
                dates: reportDates,
                report_runs: reportRuns,
                reports: reportRuns.flatMap((run) => run.reports || []),
            })
        }

        if (reportDates.length <= 1) {
            const result = await syncAndGenerateAttendanceReports({
                ...syncOptions,
                date: singleDate,
            })
            return NextResponse.json(result)
        }

        const sync = await syncAttendanceForConnectedInstances(syncOptions)
        const reportRuns = []
        for (const reportDate of reportDates) {
            reportRuns.push(await generateAttendanceReports({ instanceId, date: reportDate, force }))
        }
        return NextResponse.json({
            success: true,
            dates: reportDates,
            sync,
            report_runs: reportRuns,
            reports: reportRuns.flatMap((run) => run.reports || []),
        })
    } catch (error: any) {
        console.error('[attendance-reports POST]', error)
        return NextResponse.json({ success: false, error: error?.message || 'Erro ao executar monitor de atendimento' }, { status: 500 })
    }
}
