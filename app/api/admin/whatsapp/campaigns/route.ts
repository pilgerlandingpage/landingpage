import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    sendSimpleCampaign,
    sendAdvancedCampaign,
    manageCampaign,
    listCampaigns,
} from '@/lib/uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET — Listar campanhas de uma instância
export async function GET(request: NextRequest) {
    try {
        const instanceId = request.nextUrl.searchParams.get('instance_id')
        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instance_id obrigatório' }, { status: 400 })
        }

        const supabase = getSupabase()
        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('instance_token, instance_name')
            .eq('id', instanceId)
            .single()

        if (!instance?.instance_token) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        const campaigns = await listCampaigns(instance.instance_token)
        return NextResponse.json({ success: true, campaigns })
    } catch (error) {
        console.error('[Campaigns GET]', error)
        return NextResponse.json({ success: false, message: 'Erro ao listar campanhas' }, { status: 500 })
    }
}

// POST — Criar/enviar campanha ou gerenciar campanha existente
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { action, instanceId, ...campaignData } = body

        if (!instanceId) {
            return NextResponse.json({ success: false, message: 'instanceId obrigatório' }, { status: 400 })
        }

        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('instance_token, instance_name')
            .eq('id', instanceId)
            .single()

        if (!instance?.instance_token) {
            return NextResponse.json({ success: false, message: 'Instância não encontrada' }, { status: 404 })
        }

        // Manage existing campaign (pause/continue/delete)
        if (action === 'manage') {
            const { folderId, manageAction } = campaignData
            const result = await manageCampaign(folderId, manageAction, instance.instance_token)
            return NextResponse.json({ success: true, result })
        }

        // Create new simple campaign
        if (action === 'simple') {
            const { numbers, type, text, file, folder, delayMin, delayMax, scheduled_for } = campaignData

            if (!numbers || numbers.length === 0) {
                return NextResponse.json({ success: false, message: 'Lista de números é obrigatória' }, { status: 400 })
            }

            // Convert numbers to JID format
            const jids = numbers.map((n: string) => {
                const clean = n.replace(/\D/g, '')
                return clean.includes('@') ? clean : `${clean}@s.whatsapp.net`
            })

            const result = await sendSimpleCampaign({
                numbers: jids,
                type: type || 'text',
                text,
                file,
                folder: folder || `campanha_${Date.now()}`,
                delayMin: delayMin || 10,
                delayMax: delayMax || 30,
                scheduled_for,
            }, instance.instance_token)

            // Log the campaign in Supabase
            await supabase.from('app_config').insert({
                key: `_campaign_${Date.now()}`,
                value: JSON.stringify({
                    instanceId,
                    instanceName: instance.instance_name,
                    type,
                    recipientCount: jids.length,
                    folder: folder || `campanha_${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    status: scheduled_for ? 'scheduled' : 'sending',
                }),
                updated_at: new Date().toISOString(),
            })

            return NextResponse.json({
                success: true,
                result,
                message: `Campanha enviada para ${jids.length} contatos`,
            })
        }

        // Create advanced campaign (per-recipient messages)
        if (action === 'advanced') {
            const { messages, delayMin, delayMax, info, scheduled_for } = campaignData
            const result = await sendAdvancedCampaign({
                messages,
                delayMin: delayMin || 10,
                delayMax: delayMax || 30,
                info,
                scheduled_for,
            }, instance.instance_token)

            return NextResponse.json({ success: true, result })
        }

        return NextResponse.json({ success: false, message: 'action inválida (use: simple, advanced, manage)' }, { status: 400 })
    } catch (error) {
        console.error('[Campaigns POST]', error)
        return NextResponse.json({
            success: false,
            message: `Erro: ${error instanceof Error ? error.message : String(error)}`,
        }, { status: 500 })
    }
}
