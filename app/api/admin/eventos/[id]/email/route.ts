import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import {
    cleanString,
    interpolateEventTemplate,
    registrationMatchesSegment,
    segmentLabel,
    type AutomationSegment,
} from '@/lib/events/utils'
import { sendBrevoEmail } from '@/lib/email/brevo'

export const dynamic = 'force-dynamic'

type EmailBody = {
    segment?: AutomationSegment | string
    subject?: string
    htmlContent?: string
    textContent?: string
    testRecipient?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: unknown) {
    return EMAIL_RE.test(String(value || '').trim())
}

function buildTextFromHtml(html: string) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function publicEventUrl(request: NextRequest, event: any) {
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || ''
    if (!origin || !event?.slug) return ''
    return `${origin.replace(/\/$/, '')}/eventos/${event.slug}`
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { id } = await params
        const body = await request.json() as EmailBody
        const segment = body.segment || 'all'
        const subjectTemplate = cleanString(body.subject, 220)
        const htmlTemplate = cleanString(body.htmlContent, 12000)
        const textTemplate = cleanString(body.textContent, 12000)
        const testRecipient = cleanString(body.testRecipient, 220)
        const isTest = Boolean(testRecipient)

        if (!subjectTemplate) return NextResponse.json({ error: 'Informe o assunto do e-mail.' }, { status: 400 })
        if (!htmlTemplate) return NextResponse.json({ error: 'Informe o conteudo HTML do e-mail.' }, { status: 400 })
        if (isTest && !isValidEmail(testRecipient)) return NextResponse.json({ error: 'Informe um e-mail de teste valido.' }, { status: 400 })

        const [{ data: event, error: eventError }, { data: registrations, error: registrationsError }] = await Promise.all([
            ctx.admin.from('event_events').select('*').eq('id', id).maybeSingle(),
            ctx.admin
                .from('event_registrations')
                .select('*')
                .eq('event_id', id)
                .order('created_at', { ascending: true })
                .range(0, 4999),
        ])

        if (eventError) throw eventError
        if (!event) return NextResponse.json({ error: 'Evento nao encontrado.' }, { status: 404 })
        if (registrationsError) throw registrationsError

        const matchingRegistrations = (registrations || [])
            .filter((row: any) => row.status !== 'cancelled')
            .filter((row: any) => registrationMatchesSegment(row, segment))

        const recipients = isTest
            ? [matchingRegistrations[0] || { full_name: 'Teste', email: testRecipient }]
            : matchingRegistrations.filter((row: any) => isValidEmail(row.email))

        if (!recipients.length) {
            return NextResponse.json({ error: 'Nenhum destinatario com e-mail valido para este segmento.' }, { status: 400 })
        }

        const publicUrl = publicEventUrl(request, event)
        const result = {
            sent: 0,
            failed: 0,
            skipped: isTest ? 0 : matchingRegistrations.length - recipients.length,
            errors: [] as Array<{ email: string; message: string }>,
        }

        for (const registration of recipients) {
            const toEmail = isTest ? testRecipient : String(registration.email || '').trim()
            const subject = interpolateEventTemplate(subjectTemplate, { event, registration, publicUrl })
            const htmlContent = interpolateEventTemplate(htmlTemplate, { event, registration, publicUrl })
            const textContent = interpolateEventTemplate(textTemplate || buildTextFromHtml(htmlTemplate), { event, registration, publicUrl })

            try {
                await sendBrevoEmail({
                    to: [{ email: toEmail, name: registration.full_name || undefined }],
                    subject,
                    htmlContent,
                    textContent,
                })
                result.sent += 1
            } catch (err: any) {
                result.failed += 1
                result.errors.push({
                    email: toEmail,
                    message: err?.message || 'Erro ao enviar e-mail.',
                })
            }
        }

        await ctx.admin.from('event_agent_logs').insert({
            event_id: id,
            action: isTest ? 'event_email_test_sent' : 'event_email_campaign_sent',
            message: isTest
                ? `E-mail de teste enviado para ${testRecipient}.`
                : `E-mail enviado para ${result.sent} inscrito(s) do segmento ${segmentLabel(segment)}.`,
            metadata: {
                segment,
                subject: subjectTemplate,
                test_recipient: isTest ? testRecipient : null,
                sent: result.sent,
                failed: result.failed,
                skipped: result.skipped,
                errors: result.errors.slice(0, 10),
            },
        })

        return NextResponse.json({ success: result.failed === 0, ...result })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao enviar e-mail do evento.' }, { status: 500 })
    }
}
