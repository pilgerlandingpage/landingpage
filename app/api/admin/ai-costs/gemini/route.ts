import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { loadGeminiUsageSummary, syncGeminiUsageToFinance } from '@/lib/ai/gemini-costs'

export const dynamic = 'force-dynamic'

async function getCurrentAdminUser() {
    const supabase = await createServerSupabase()
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData?.user) {
        return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
    }

    const admin = createAdminClient()
    const { data: adminUser, error: adminError } = await admin
        .from('admin_users')
        .select('id, is_master, is_active')
        .eq('auth_user_id', authData.user.id)
        .single()

    if (adminError || !adminUser) {
        return { error: NextResponse.json({ success: false, error: 'Usuario admin nao encontrado' }, { status: 403 }) }
    }

    if (!adminUser.is_active) {
        return { error: NextResponse.json({ success: false, error: 'Usuario desativado' }, { status: 403 }) }
    }

    return { adminUser, admin }
}

function getMonth(request: NextRequest) {
    const month = String(request.nextUrl.searchParams.get('month') || '').trim()
    return /^\d{4}-\d{2}$/.test(month) ? month : undefined
}

export async function GET(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const summary = await loadGeminiUsageSummary({
            admin: access.admin,
            month: getMonth(request),
            refreshOfficial: request.nextUrl.searchParams.get('refresh_official') === '1',
        })

        return NextResponse.json({ success: true, summary })
    } catch (err: any) {
        console.error('[admin/ai-costs/gemini GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao carregar custos Gemini' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json().catch(() => ({}))
        const month = typeof body?.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)
            ? body.month
            : undefined

        const result = await syncGeminiUsageToFinance(access.admin, { month })
        return NextResponse.json(result)
    } catch (err: any) {
        console.error('[admin/ai-costs/gemini POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao sincronizar Gemini no financeiro' }, { status: 500 })
    }
}
