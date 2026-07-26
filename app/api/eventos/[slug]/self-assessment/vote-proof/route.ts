import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveProfileAssessmentEventSlug } from '@/lib/events/profile-assessment'
import { cleanString, normalizePhone } from '@/lib/events/utils'
import { analyzeVoteProofImage } from '@/lib/events/vote-proof-validation'
import { corretorNota8ProfileAssessmentOffer } from '@/lib/products/corretor-nota-8-content'

export const dynamic = 'force-dynamic'

type RouteContext = {
    params: Promise<{ slug: string }>
}

const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const CHECKOUT_URL = `${corretorNota8ProfileAssessmentOffer.checkoutUrl}?origem=whatsapp-perfil-corretor&oferta=${corretorNota8ProfileAssessmentOffer.source}`
const LANDING_URL = `${corretorNota8ProfileAssessmentOffer.landingUrl}&origem=whatsapp-perfil-corretor`

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function publicCheckoutUrl(request: NextRequest) {
    const configuredHost = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
    if (configuredHost) {
        const normalized = configuredHost.startsWith('http') ? configuredHost : `https://${configuredHost}`
        return `${normalized.replace(/\/$/, '')}${CHECKOUT_URL}`
    }
    return new URL(CHECKOUT_URL, request.url).toString()
}

function publicLandingUrl(request: NextRequest) {
    const configuredHost = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
    if (configuredHost) {
        const normalized = configuredHost.startsWith('http') ? configuredHost : `https://${configuredHost}`
        return `${normalized.replace(/\/$/, '')}${LANDING_URL}`
    }
    return new URL(LANDING_URL, request.url).toString()
}

async function fileToBuffer(file: File) {
    const arrayBuffer = await file.arrayBuffer()
    return Buffer.from(arrayBuffer)
}

export async function POST(request: NextRequest, { params }: RouteContext) {
    try {
        const { slug } = await params
        const eventSlug = resolveProfileAssessmentEventSlug(slug)
        const formData = await request.formData()
        const file = formData.get('proof')

        if (!(file instanceof File)) {
            return NextResponse.json({ success: false, message: 'Envie o print da confirmacao do voto.' }, { status: 400 })
        }

        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json({ success: false, message: 'Envie uma imagem PNG, JPG ou WEBP.' }, { status: 400 })
        }

        if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ success: false, message: 'O print precisa ter ate 8MB.' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const now = new Date().toISOString()
        const registrationId = cleanString(formData.get('registration_id'), 120)
        const email = cleanString(formData.get('email'), 180).toLowerCase()
        const phone = normalizePhone(formData.get('phone'))

        const { data: event, error: eventError } = await supabase
            .from('event_events')
            .select('*')
            .eq('slug', eventSlug)
            .eq('status', 'published')
            .maybeSingle()

        if (eventError) throw eventError
        if (!event) return NextResponse.json({ success: false, message: 'Evento nao encontrado ou indisponivel.' }, { status: 404 })

        let registrationQuery = supabase
            .from('event_registrations')
            .select('*')
            .eq('event_id', event.id)

        if (registrationId) {
            registrationQuery = registrationQuery.eq('id', registrationId)
        } else if (phone) {
            registrationQuery = registrationQuery.eq('phone', phone)
        } else if (email) {
            registrationQuery = registrationQuery.eq('email', email)
        } else {
            return NextResponse.json({ success: false, message: 'Nao foi possivel identificar seu cadastro da avaliacao.' }, { status: 400 })
        }

        const { data: registration, error: registrationError } = await registrationQuery.maybeSingle()
        if (registrationError) throw registrationError
        if (!registration) {
            return NextResponse.json({ success: false, message: 'Cadastro da autoavaliacao nao encontrado.' }, { status: 404 })
        }

        const buffer = await fileToBuffer(file)
        const fileHash = createHash('sha256').update(buffer).digest('hex')
        const analysis = await analyzeVoteProofImage(buffer, file.type)
        const approved = analysis.status === 'approved'
        const existingMetadata = asRecord(registration.metadata)
        const voteProof = {
            status: analysis.status,
            discount_unlocked: approved,
            promotional_offer_slug: approved ? 'corretor-nota-8-perfil-corretor-ideal' : null,
            checkout_url: approved ? publicCheckoutUrl(request) : null,
            landing_url: approved ? publicLandingUrl(request) : null,
            analyzed_at: now,
            file: {
                name: cleanString(file.name, 220) || 'print-voto',
                size: file.size,
                mime_type: file.type,
                sha256: fileHash,
            },
            analysis,
        }

        const { error: updateError } = await supabase
            .from('event_registrations')
            .update({
                metadata: {
                    ...existingMetadata,
                    self_assessment_vote_proof: voteProof,
                    event_lead_profile: {
                        ...asRecord(existingMetadata.event_lead_profile),
                        vote_proof_status: analysis.status,
                        vote_proof_checked_at: now,
                        discount_unlocked: approved,
                        promotional_offer_slug: approved ? 'corretor-nota-8-perfil-corretor-ideal' : null,
                    },
                },
                updated_at: now,
            })
            .eq('id', registration.id)

        if (updateError) throw updateError

        await supabase.from('event_agent_logs').insert({
            event_id: event.id,
            registration_id: registration.id,
            action: `self_assessment_vote_proof_${analysis.status}`,
            message: approved
                ? `Print de voto aprovado para ${registration.full_name}. Oferta promocional liberada.`
                : `Print de voto nao aprovado automaticamente para ${registration.full_name}: ${analysis.reason}`,
            metadata: {
                source: 'perfil_corretor_ideal_vote_proof',
                vote_proof: voteProof,
            },
        }).catch((error: unknown) => {
            console.warn('[Vote Proof] log insert failed:', error)
        })

        const message = approved
            ? 'Print validado. Sua oferta especial foi liberada.'
            : analysis.status === 'review'
                ? 'Nao conseguimos validar com seguranca. Envie um print mais claro da tela final de confirmacao.'
                : analysis.reason || 'Esse print nao comprova a confirmacao do voto. Envie a tela final de confirmacao.'

        return NextResponse.json({
            success: true,
            status: analysis.status,
            discount_unlocked: approved,
            promotional_offer_slug: approved ? 'corretor-nota-8-perfil-corretor-ideal' : null,
            checkout_url: approved ? publicCheckoutUrl(request) : null,
            landing_url: approved ? publicLandingUrl(request) : null,
            message,
            analysis,
        })
    } catch (error) {
        console.error('[Vote Proof] failed:', error)
        return NextResponse.json({
            success: false,
            message: error instanceof Error ? error.message : 'Erro ao validar o print.',
        }, { status: 500 })
    }
}
