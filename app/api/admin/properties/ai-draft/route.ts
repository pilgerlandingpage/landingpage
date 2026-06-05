import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { generatePropertyAiDraft } from '@/lib/properties/ai-registration'
import { recordAgentCentralSignal } from '@/lib/intelligence/agent-runtime'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const context = String(body?.context || '').trim()
        const images = Array.isArray(body?.images) ? body.images.map(String).filter(Boolean) : []
        const videos = Array.isArray(body?.videos) ? body.videos.map(String).filter(Boolean) : []
        const documents = Array.isArray(body?.documents) ? body.documents.map(String).filter(Boolean) : []

        if (!context && images.length === 0 && videos.length === 0 && documents.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Envie contexto, fotos, videos ou documentos para a IA criar o cadastro.' },
                { status: 400 }
            )
        }

        await recordAgentCentralSignal({
            agentId: 'property-triage',
            eventType: 'property_triage_checked',
            entityType: 'property_ai_briefing',
            entityId: user.id,
            source: 'property-triage-agent',
            label: 'Marina triou briefing para cadastro de imovel',
            importanceScore: images.length >= 3 || context.length > 300 ? 58 : 44,
            metadata: {
                admin_user_id: user.id,
                context_preview: context.slice(0, 700),
                media: {
                    images: images.length,
                    videos: videos.length,
                    documents: documents.length,
                },
                enough_to_generate: Boolean(context || images.length || videos.length || documents.length),
            },
            handoffTargets: ['property-register', 'creative-strategy-agent', 'blog-intelligence'],
        }).catch((error: any) => {
            console.warn('[Property Triage] central signal failed:', error?.message || error)
        })

        const draft = await generatePropertyAiDraft({ context, images, videos, documents })

        return NextResponse.json({ success: true, draft })
    } catch (error: any) {
        console.error('[Property AI Draft] failed:', error)
        return NextResponse.json(
            { success: false, error: error?.message || 'Erro ao gerar cadastro com IA' },
            { status: 500 }
        )
    }
}
