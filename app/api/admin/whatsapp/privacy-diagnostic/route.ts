import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPrivacy } from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET /api/admin/whatsapp/privacy-diagnostic?instance_id=xxx
export async function GET(req: NextRequest) {
    try {
        const instanceId = req.nextUrl.searchParams.get('instance_id')
        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instance_id é obrigatório' }, { status: 400 })
        }

        const supabase = getSupabase()
        const { data: instance, error } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token, status, config')
            .eq('id', instanceId)
            .single()

        if (error || !instance) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        if (!instance.instance_token) {
            return NextResponse.json({ success: false, message: 'Instância sem token' }, { status: 400 })
        }

        const providerPrivacy = await getPrivacy(instance.instance_token)
        const cfg = (instance.config as Record<string, any>) || {}
        const expected = {
            online: cfg.always_online === false ? 'match_last_seen' : 'all',
            readreceipts: cfg.mark_as_read === false ? 'none' : 'all',
        }

        const actual = {
            online: providerPrivacy?.online ?? null,
            readreceipts: providerPrivacy?.readreceipts ?? null,
            last: providerPrivacy?.last ?? null,
            status: providerPrivacy?.status ?? null,
            profile: providerPrivacy?.profile ?? null,
            groupadd: providerPrivacy?.groupadd ?? null,
            calladd: providerPrivacy?.calladd ?? null,
        }

        return NextResponse.json({
            success: true,
            instance: {
                id: instance.id,
                instance_name: instance.instance_name,
                status: instance.status,
            },
            expected,
            actual,
            matches: {
                online: actual.online === expected.online,
                readreceipts: actual.readreceipts === expected.readreceipts,
            },
            raw: providerPrivacy,
        })
    } catch (error) {
        console.error('[Privacy Diagnostic GET]', error)
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

