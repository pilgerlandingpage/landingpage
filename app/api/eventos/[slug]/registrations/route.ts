import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { getPublicAppUrl } from '@/lib/app-url'
import { enqueueRegistrationMessages, logEventAgent } from '@/lib/events/messages'
import { cleanString, normalizePhone } from '@/lib/events/utils'
import { buildEventWhatsAppCta, resolveEventWhatsAppCtaPhone } from '@/lib/events/whatsapp-cta'
import { syncLeadEmailFromEventRegistration } from '@/lib/events/lead-email-sync'

export const dynamic = 'force-dynamic'

const intentLabels: Record<string, Record<string, string>> = {
    commercial_role: {
        autonomo: 'Corretor autonomo',
        corretor_imobiliaria: 'Corretor de imobiliaria',
        gestor_imobiliaria: 'Gestor ou dono de imobiliaria',
        equipe_comercial: 'Equipe comercial',
    },
    main_challenge: {
        captar_leads: 'Captar leads qualificados',
        responder_rapido: 'Responder leads com velocidade',
        organizar_followup: 'Organizar follow-up',
        gerar_conteudo: 'Gerar conteudo',
        converter_visitas: 'Converter atendimentos em visitas',
        alto_ticket: 'Vender imoveis de maior ticket',
    },
    current_tool: {
        nao_uso: 'Nao usa ferramenta',
        planilha_whatsapp: 'Planilha ou WhatsApp manual',
        crm_simples: 'CRM simples',
        crm_automacao: 'CRM com automacao',
        sistema_proprio: 'Equipe ou sistema proprio',
    },
    improvement_timeline: {
        imediato: 'Imediatamente',
        '30_dias': 'Nos proximos 30 dias',
        '3_meses': 'Nos proximos 3 meses',
        estudando: 'Ainda estudando',
    },
    monthly_investment: {
        nao_invisto: 'Nao investe',
        ate_500: 'Ate R$ 500',
        '500_1500': 'R$ 500 a R$ 1.500',
        '1500_5000': 'R$ 1.500 a R$ 5.000',
        '5000_plus': 'Acima de R$ 5.000',
    },
    desired_result: {
        mais_leads: 'Mais leads qualificados',
        whatsapp_automatico: 'Atendimento automatico no WhatsApp',
        organizar_contatos: 'Organizar contatos',
        conteudo_pronto: 'Conteudo pronto para redes sociais',
        recuperar_leads: 'Recuperar leads antigos',
        aumentar_conversao: 'Aumentar conversao em vendas',
    },
}

function labelIntentAnswer(group: string, value: string) {
    return intentLabels[group]?.[value] || value || 'Nao informado'
}

function inferDesiredResultFromChallenge(challenge: string) {
    return ({
        captar_leads: 'mais_leads',
        responder_rapido: 'whatsapp_automatico',
        organizar_followup: 'organizar_contatos',
        gerar_conteudo: 'conteudo_pronto',
        converter_visitas: 'aumentar_conversao',
        alto_ticket: 'aumentar_conversao',
    } as Record<string, string>)[challenge] || 'aumentar_conversao'
}

function calculateTop3Intent(input: Record<string, string>) {
    let score = 0

    score += ({
        autonomo: 8,
        corretor_imobiliaria: 10,
        equipe_comercial: 14,
        gestor_imobiliaria: 18,
    } as Record<string, number>)[input.commercial_role] || 0

    score += ({
        ate_20: 2,
        '21_50': 8,
        '51_100': 14,
        '100_plus': 20,
        '20_100': 12,
        '100_300': 18,
        '300_plus': 22,
    } as Record<string, number>)[input.monthly_leads] || 0

    score += ({
        nao_uso: 4,
        planilha_whatsapp: 12,
        crm_simples: 14,
        crm_automacao: 10,
        sistema_proprio: 8,
    } as Record<string, number>)[input.current_tool] || 0

    score += ({
        imediato: 24,
        '30_dias': 18,
        '3_meses': 8,
        estudando: 2,
    } as Record<string, number>)[input.improvement_timeline] || 0

    score += ({
        nao_invisto: 0,
        ate_500: 5,
        '500_1500': 12,
        '1500_5000': 20,
        '5000_plus': 24,
    } as Record<string, number>)[input.monthly_investment] || 0

    score += ({
        captar_leads: 9,
        responder_rapido: 12,
        organizar_followup: 13,
        gerar_conteudo: 6,
        converter_visitas: 14,
        alto_ticket: 12,
    } as Record<string, number>)[input.main_challenge] || 0

    score += ({
        mais_leads: 8,
        whatsapp_automatico: 13,
        organizar_contatos: 11,
        conteudo_pronto: 6,
        recuperar_leads: 11,
        aumentar_conversao: 14,
    } as Record<string, number>)[input.desired_result] || 0

    if (input.automation_wish && input.automation_wish.length > 20) score += 4

    const level = score >= 72 ? 'quente' : score >= 42 ? 'morno' : 'frio'
    const levelLabel = level === 'quente' ? 'Lead quente' : level === 'morno' ? 'Lead morno' : 'Lead frio'

    return {
        score,
        level,
        level_label: levelLabel,
        answers: {
            commercial_role: input.commercial_role,
            commercial_role_label: labelIntentAnswer('commercial_role', input.commercial_role),
            main_challenge: input.main_challenge,
            main_challenge_label: labelIntentAnswer('main_challenge', input.main_challenge),
            current_tool: input.current_tool,
            current_tool_label: labelIntentAnswer('current_tool', input.current_tool),
            improvement_timeline: input.improvement_timeline,
            improvement_timeline_label: labelIntentAnswer('improvement_timeline', input.improvement_timeline),
            monthly_investment: input.monthly_investment,
            monthly_investment_label: labelIntentAnswer('monthly_investment', input.monthly_investment),
            desired_result: input.desired_result,
            desired_result_label: labelIntentAnswer('desired_result', input.desired_result),
            automation_wish: input.automation_wish,
        },
        summary: `${levelLabel} (${score} pts): ${labelIntentAnswer('main_challenge', input.main_challenge)}; ${labelIntentAnswer('improvement_timeline', input.improvement_timeline)}; ${labelIntentAnswer('monthly_investment', input.monthly_investment)}.`,
    }
}

function parseRegistration(body: any) {
    const fullName = cleanString(body.full_name || body.name, 180)
    const phone = normalizePhone(body.phone)
    const email = cleanString(body.email, 180)
    const creci = cleanString(body.creci, 80)
    const creciState = cleanString(body.creci_state, 2).toUpperCase()
    const brokerType = body.broker_type === 'imobiliaria' ? 'imobiliaria' : 'autonomo'
    const intentInput = {
        commercial_role: cleanString(body.commercial_role, 80),
        main_challenge: cleanString(body.main_challenge, 80),
        current_tool: cleanString(body.current_tool, 80),
        improvement_timeline: cleanString(body.improvement_timeline, 80),
        monthly_investment: cleanString(body.monthly_investment, 80),
        desired_result: cleanString(body.desired_result, 80),
        automation_wish: cleanString(body.automation_wish, 500),
        monthly_leads: cleanString(body.monthly_leads, 80),
    }

    if (!fullName) throw new Error('Informe seu nome completo.')
    if (!phone || phone.length < 12) throw new Error('Informe um WhatsApp valido.')
    if (!email || !email.includes('@')) throw new Error('Informe um e-mail valido.')
    if (!creci) throw new Error('Informe seu CRECI.')
    if (!creciState || creciState.length !== 2) throw new Error('Informe a UF do CRECI.')
    if (!intentInput.commercial_role) throw new Error('Informe como voce atua hoje.')
    if (!intentInput.main_challenge) throw new Error('Informe seu principal desafio comercial.')
    if (!intentInput.current_tool) throw new Error('Informe como voce organiza seus atendimentos hoje.')
    if (!intentInput.improvement_timeline) throw new Error('Informe quando voce quer melhorar seu processo comercial.')
    if (!intentInput.monthly_investment) throw new Error('Informe seu investimento mensal atual.')
    if (!intentInput.desired_result) intentInput.desired_result = inferDesiredResultFromChallenge(intentInput.main_challenge)
    if (body.consent_whatsapp !== true) throw new Error('Confirme o aceite para receber comunicacoes do evento pelo WhatsApp.')

    const baseMetadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}
    const top3Intent = calculateTop3Intent(intentInput)

    return {
        full_name: fullName,
        email,
        phone,
        broker_type: brokerType,
        real_estate_name: brokerType === 'imobiliaria' ? cleanString(body.real_estate_name, 180) || null : null,
        creci,
        creci_state: creciState,
        city: cleanString(body.city, 120) || null,
        market_focus: cleanString(body.market_focus, 160) || null,
        monthly_leads: cleanString(body.monthly_leads, 80) || null,
        consent_whatsapp: true,
        source: cleanString(body.source, 120) || 'event_page',
        metadata: {
            ...baseMetadata,
            top3_intent: top3Intent,
        },
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params
        const body = await request.json()
        const payload = parseRegistration(body)
        const supabase = createAdminClient()

        const { data: event, error: eventError } = await supabase
            .from('event_events')
            .select('*')
            .eq('slug', slug)
            .eq('status', 'published')
            .maybeSingle()

        if (eventError) throw eventError
        if (!event) return NextResponse.json({ error: 'Evento nao encontrado ou indisponivel.' }, { status: 404 })

        const { data: existing } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('event_id', event.id)
            .eq('phone', payload.phone)
            .maybeSingle()

        if (existing) {
            const { data: updatedExisting } = await supabase
                .from('event_registrations')
                .update({
                    ...payload,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select('*')
                .single()
            const existingRegistration = updatedExisting || { ...existing, ...payload }
            await syncLeadEmailFromEventRegistration(supabase, existingRegistration).catch((err) => {
                console.warn('[Event Registration] lead email sync failed:', err)
            })
            const ctaPhone = await resolveEventWhatsAppCtaPhone(supabase)

            return NextResponse.json({
                success: true,
                already_registered: true,
                registration: existingRegistration,
                whatsapp_cta: buildEventWhatsAppCta({ phone: ctaPhone, event, registration: existingRegistration }),
                message: 'Voce ja esta inscrito neste evento.',
            })
        }

        let status = 'confirmed'
        if (event.capacity) {
            const { count } = await supabase
                .from('event_registrations')
                .select('id', { head: true, count: 'exact' })
                .eq('event_id', event.id)
                .in('status', ['confirmed', 'checked_in'])

            if ((count || 0) >= Number(event.capacity)) status = 'waitlisted'
        }

        const { data: registration, error } = await supabase
            .from('event_registrations')
            .insert({
                ...payload,
                event_id: event.id,
                status,
            })
            .select('*')
            .single()

        if (error) throw error

        await syncLeadEmailFromEventRegistration(supabase, registration).catch((err) => {
            console.warn('[Event Registration] lead email sync failed:', err)
        })

        await supabase.from('event_agent_logs').insert({
            event_id: event.id,
            registration_id: registration.id,
            action: 'registration_created',
            message: `Novo inscrito: ${registration.full_name}.`,
            metadata: {
                broker_type: registration.broker_type,
                city: registration.city,
                status,
                top3_intent: registration.metadata?.top3_intent || null,
            },
        })

        try {
            const { data: rules, error: rulesError } = await supabase
                .from('event_automation_rules')
                .select('*')
                .eq('event_id', event.id)
                .eq('is_active', true)

            if (rulesError) throw rulesError

            const queued = await enqueueRegistrationMessages(supabase, {
                event,
                registration,
                rules: rules || [],
                publicUrl: `${getPublicAppUrl()}/eventos/${event.slug}`,
                leadInitiatedFirst: true,
            })

            if (queued.length > 0) {
                await logEventAgent(supabase, {
                    event_id: event.id,
                    registration_id: registration.id,
                    action: 'registration_queue_processed_inline',
                    message: 'Cadastro criou a fila de automacoes e aguardara contato iniciado pelo lead no WhatsApp.',
                    metadata: {
                        queued: queued.length,
                        processed: 0,
                        lead_initiated_first: true,
                        skipped_first_outbound: queued.filter((row: any) => row.status === 'skipped').length,
                    },
                })
            }
        } catch (queueError) {
            await logEventAgent(supabase, {
                event_id: event.id,
                registration_id: registration.id,
                level: 'warning',
                action: 'registration_inline_queue_failed',
                message: queueError instanceof Error ? queueError.message : String(queueError),
            })
        }

        await inngest.send({
            name: 'event/registration-created',
            data: {
                event_id: event.id,
                registration_id: registration.id,
                reason: 'new_registration',
                lead_initiated_first: true,
            },
        }).catch(async (err) => {
            await supabase.from('event_agent_logs').insert({
                event_id: event.id,
                registration_id: registration.id,
                level: 'warning',
                action: 'inngest_trigger_failed',
                message: err instanceof Error ? err.message : String(err),
            })
        })

        return NextResponse.json({
            success: true,
            registration,
            waitlisted: status === 'waitlisted',
            whatsapp_cta: buildEventWhatsAppCta({
                phone: await resolveEventWhatsAppCtaPhone(supabase),
                event,
                registration,
            }),
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao confirmar presenca.' }, { status: 400 })
    }
}
