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

export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const date = request.nextUrl.searchParams.get('date')
        const instanceId = request.nextUrl.searchParams.get('instance_id')

        let reportsQuery = supabase
            .from('broker_attendance_reports')
            .select('*')
            .order('generated_at', { ascending: false })
            .limit(50)
        if (date) reportsQuery = reportsQuery.eq('report_date', date)
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

        const reportIds = (reportsRes.data || []).map((report: any) => report.id)
        let scores: any[] = []
        if (reportIds.length > 0) {
            const scoresRes = await supabase
                .from('broker_attendance_conversation_scores')
                .select('*')
                .in('report_id', reportIds)
                .order('score', { ascending: true })
            if (scoresRes.error) throw scoresRes.error
            scores = scoresRes.data || []
        }

        return NextResponse.json({
            success: true,
            reports: reportsRes.data || [],
            conversation_scores: scores,
            instances: enrichedInstances,
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
        const force = body?.force !== false
        const includeHistorySync = body?.include_history_sync !== false

        if (action === 'sync') {
            const result = await syncAttendanceForConnectedInstances({ instanceId, force, includeHistorySync })
            return NextResponse.json(result)
        }

        if (action === 'report') {
            const result = await generateAttendanceReports({ instanceId, date, force })
            return NextResponse.json(result)
        }

        const result = await syncAndGenerateAttendanceReports({
            instanceId,
            date,
            force,
            includeHistorySync,
        })
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[attendance-reports POST]', error)
        return NextResponse.json({ success: false, error: error?.message || 'Erro ao executar monitor de atendimento' }, { status: 500 })
    }
}
