'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
    ArrowLeft,
    CalendarDays,
    ChartPie,
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    Loader2,
    Mail,
    MessageSquare,
    RefreshCw,
    Save,
    Send,
    ShieldCheck,
    Presentation,
    Trash2,
    Users,
    X,
} from 'lucide-react'
import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
    DEFAULT_CONFIRMATION_TEMPLATE,
    DEFAULT_EVENT_HERO,
    DEFAULT_REMINDER_TEMPLATE,
    formatPhoneDisplay,
    formatShortDate,
    registrationMatchesSegment,
    segmentLabel,
} from '@/lib/events/utils'
import { buildProfileAssessmentPath, buildProfileAssessmentPresentationPath, isProfileAssessmentEvent } from '@/lib/events/profile-assessment'

type Props = { eventId: string }
type EventRow = Record<string, any>
type RegistrationRow = Record<string, any>
type MessageRow = Record<string, any>
type PieDatum = { label: string; value: number; color: string }
type ChartMode = 'pie' | 'bar'
type EmailSegment = 'all' | 'autonomos' | 'imobiliarias' | 'creci_pending' | 'creci_verified'

const PIE_COLORS = ['#c99f4a', '#22c55e', '#60a5fa', '#f59e0b', '#f472b6', '#8b5cf6', '#14b8a6', '#ef4444']
const EMAIL_SEGMENTS: EmailSegment[] = ['all', 'autonomos', 'imobiliarias', 'creci_pending', 'creci_verified']
const DEFAULT_EVENT_EMAIL_HTML = String.raw`<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Lembrete do Evento</title>
</head>
<body style="margin:0;padding:0;background-color:#f0ede8;font-family:Georgia,serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;color:#f0ede8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Seu evento está chegando. Confira horário, transmissão online e tire qualquer dúvida pelo WhatsApp.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f0ede8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;">
          <tr>
            <td style="background-color:#1a1a1a;border-radius:4px 4px 0 0;overflow:hidden;text-align:center;">
              <img src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png" alt="Guilherme Pilger" width="640" style="display:block;width:100%;max-width:640px;height:auto;border:0;margin:0 auto;" />
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1a1a;padding:34px 48px 28px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom:20px;">
                <tr>
                  <td style="width:60px;height:1px;background-color:#b8973a;"></td>
                  <td style="padding:0 12px;"><span style="display:inline-block;width:6px;height:6px;background-color:#b8973a;transform:rotate(45deg);"></span></td>
                  <td style="width:60px;height:1px;background-color:#b8973a;"></td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;color:#b8973a;text-transform:uppercase;">Guilherme Pilger</p>
              <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#ffffff;letter-spacing:1px;line-height:1.3;">Seu evento está<br />chegando</h1>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:44px 48px 40px;">
              <p style="margin:0 0 28px;font-family:Georgia,serif;font-size:17px;color:#2c2c2c;line-height:1.7;">Olá, <strong style="color:#1a1a1a;">{nome}</strong>,</p>

              <p style="margin:0 0 28px;font-family:Georgia,serif;font-size:16px;color:#444444;line-height:1.8;">
                Queremos lembrar que o <strong style="color:#1a1a1a;">{evento}</strong> está se aproximando. Reserve este momento na sua agenda. Será uma experiência pensada para profissionais do mercado imobiliário que buscam crescimento real.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9f7f4;border-left:3px solid #b8973a;margin-bottom:32px;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#b8973a;">Detalhes do Evento</p>

                    <p style="margin:18px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888888;letter-spacing:1px;text-transform:uppercase;">Data</p>
                    <p style="margin:2px 0 0;font-family:Georgia,serif;font-size:15px;color:#1a1a1a;font-weight:bold;">{data_evento}</p>

                    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888888;letter-spacing:1px;text-transform:uppercase;">Horário</p>
                    <p style="margin:2px 0 0;font-family:Georgia,serif;font-size:15px;color:#1a1a1a;font-weight:bold;">{hora_evento}</p>

                    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888888;letter-spacing:1px;text-transform:uppercase;">Local</p>
                    <p style="margin:2px 0 0;font-family:Georgia,serif;font-size:15px;color:#1a1a1a;font-weight:bold;">{local_evento}</p>

                    <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888888;letter-spacing:1px;text-transform:uppercase;">Transmissão</p>
                    <p style="margin:2px 0 0;font-family:Georgia,serif;font-size:15px;color:#1a1a1a;">Também disponível <strong>online</strong>. <a href="{link_evento}" style="color:#b8973a;text-decoration:none;">Acesse os detalhes aqui</a>.</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:36px;">
                <tr>
                  <td style="background-color:#1a1a1a;padding:18px 32px;text-align:center;border-radius:3px;">
                    <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#b8973a;">Seu código de check-in</p>
                    <p style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:6px;">{checkin_code}</p>
                    <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#888888;">Apresente este código na entrada</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;font-family:Georgia,serif;font-size:16px;color:#444444;line-height:1.8;">
                Se tiver qualquer dúvida sobre horário, local, acesso online ou confirmação de presença, nossa equipe está pronta para atender diretamente pelo WhatsApp.
              </p>
              <p style="margin:0 0 32px;font-family:Georgia,serif;font-size:16px;color:#444444;line-height:1.8;">
                É só clicar no botão abaixo.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 40px;">
                <tr>
                  <td style="background-color:#1a8c3e;border-radius:3px;">
                    <a href="{link_whatsapp_evento}" style="display:inline-block;padding:16px 36px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">
                      Tirar dúvida no WhatsApp
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #eeebe6;padding-top:28px;margin-top:4px;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;color:#2c2c2c;">Com expectativa por esse encontro,</p>
                    <p style="margin:0;font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1a1a1a;">Equipe Guilherme Pilger</p>
                    <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#b8973a;letter-spacing:1px;">Marketing Imobiliário Premium</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#1a1a1a;padding:28px 48px;text-align:center;border-radius:0 0 4px 4px;">
              <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#888888;">Siga nas redes</p>
              <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;">
                <a href="https://www.instagram.com/guilhermepilger" style="color:#b8973a;text-decoration:none;letter-spacing:1px;">Instagram</a>
                <span style="color:#555555;"> &nbsp;|&nbsp; </span>
                <a href="https://www.facebook.com/guilherme.pilger/" style="color:#b8973a;text-decoration:none;letter-spacing:1px;">Facebook</a>
                <span style="color:#555555;"> &nbsp;|&nbsp; </span>
                <a href="https://www.youtube.com/@guilhermepilger" style="color:#b8973a;text-decoration:none;letter-spacing:1px;">YouTube</a>
                <span style="color:#555555;"> &nbsp;|&nbsp; </span>
                <a href="https://www.tiktok.com/@guilhermepilgeroficial" style="color:#b8973a;text-decoration:none;letter-spacing:1px;">TikTok</a>
              </p>

              <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;color:#666666;line-height:1.6;">
                Você está recebendo este e-mail porque se inscreveu em um evento da Guilherme Pilger.
              </p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#555555;">
                <a href="https://guilhermepilger.ai" style="color:#888888;text-decoration:underline;">guilhermepilger.ai</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
const DEFAULT_EVENT_EMAIL_TEXT = [
    'Olá {nome},',
    '',
    'Estamos passando para lembrar do evento {evento}.',
    '',
    'Data: {data_evento}',
    'Horário: {hora_evento}',
    'Local: {local_evento}',
    'Transmissão online: {link_evento}',
    'Código de check-in: {checkin_code}',
    '',
    'Se tiver qualquer dúvida sobre horário, local, acesso online ou confirmação de presença, fale com a nossa equipe pelo WhatsApp:',
    '{link_whatsapp_evento}',
    '',
    'Equipe Guilherme Pilger',
].join('\n')

const monthlyLeadLabels: Record<string, string> = {
    ate_20: 'Ate 20',
    '21_50': '21 a 50',
    '51_100': '51 a 100',
    '100_plus': 'Mais de 100',
    '20_100': '20 a 100',
    '100_300': '100 a 300',
    '300_plus': 'Mais de 300',
}

function messageTime(row: MessageRow) {
    const time = new Date(String(row.scheduled_for || '')).getTime()
    return Number.isFinite(time) ? time : 0
}

function isMessageDue(row: MessageRow) {
    return messageTime(row) <= Date.now() + 30_000
}

function isReopenedForResend(row: MessageRow) {
    return String(row.error_message || '').toLowerCase().includes('reaberta para reenvio')
}

function toDateTimeLocal(value: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getTop3Intent(row: RegistrationRow) {
    const intent = row?.metadata?.top3_intent && typeof row.metadata.top3_intent === 'object'
        ? row.metadata.top3_intent
        : {}
    const answers = intent.answers && typeof intent.answers === 'object' ? intent.answers : {}
    const score = Number(intent.score || 0)
    const level = ['quente', 'morno', 'frio'].includes(String(intent.level)) ? String(intent.level) : 'frio'
    const levelLabel = String(intent.level_label || (level === 'quente' ? 'Lead quente' : level === 'morno' ? 'Lead morno' : 'Lead frio'))

    return {
        score,
        level,
        levelLabel,
        challenge: String(answers.main_challenge_label || 'Desafio não informado'),
        timeline: String(answers.improvement_timeline_label || 'Prazo não informado'),
        investment: String(answers.monthly_investment_label || 'Investimento não informado'),
        tool: String(answers.current_tool_label || 'Ferramenta não informada'),
    }
}

function compactLabel(value: unknown, fallback = 'Não informado') {
    const label = String(value || '').trim()
    return label || fallback
}

function monthlyLeadLabel(value: unknown) {
    const key = String(value || '').trim()
    return monthlyLeadLabels[key] || compactLabel(key, 'Leads não informados')
}

function brokerTypeLabel(row: RegistrationRow) {
    return row.broker_type === 'imobiliaria' ? 'Imobiliária' : 'Autônomo'
}

function getIntentAnswers(row: RegistrationRow) {
    const intent = row?.metadata?.top3_intent && typeof row.metadata.top3_intent === 'object'
        ? row.metadata.top3_intent
        : {}
    return intent.answers && typeof intent.answers === 'object' ? intent.answers as Record<string, any> : {}
}

function getRegistrationFormDetails(row: RegistrationRow) {
    const intent = getTop3Intent(row)
    const answers = getIntentAnswers(row)

    return [
        { label: 'Perfil', value: [brokerTypeLabel(row), row.real_estate_name].filter(Boolean).join(' - ') },
        { label: 'Cidade de atuação', value: row.city || 'Não informado' },
        { label: 'CRECI', value: [row.creci_state, row.creci].filter(Boolean).join(' ') || 'Não informado' },
        { label: 'Leads por mês', value: monthlyLeadLabel(row.monthly_leads) },
        { label: 'Principal desafio', value: intent.challenge },
        { label: 'Organização atual', value: intent.tool },
        { label: 'Prazo para melhorar', value: intent.timeline },
        { label: 'Investimento mensal', value: intent.investment },
        { label: 'Desejo de automação', value: compactLabel(answers.automation_wish, 'Não informado') },
        { label: 'Score de intenção', value: `${intent.levelLabel} - ${intent.score} pts` },
    ]
}

function buildPieData(rows: RegistrationRow[], accessor: (row: RegistrationRow) => string): PieDatum[] {
    const counts = new Map<string, number>()

    rows.forEach(row => {
        const label = compactLabel(accessor(row))
        counts.set(label, (counts.get(label) || 0) + 1)
    })

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
        .map(([label, value], index) => ({
            label,
            value,
            color: PIE_COLORS[index % PIE_COLORS.length],
        }))
}

function top3IntentStyle(level: string): CSSProperties {
    if (level === 'quente') {
        return { borderColor: 'rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.13)', color: '#86efac' }
    }
    if (level === 'morno') {
        return { borderColor: 'rgba(242,198,65,0.36)', background: 'rgba(242,198,65,0.14)', color: '#fde68a' }
    }
    return { borderColor: 'rgba(148,163,184,0.28)', background: 'rgba(148,163,184,0.1)', color: '#cbd5e1' }
}

export default function EventDetailClient({ eventId }: Props) {
    const [event, setEvent] = useState<EventRow | null>(null)
    const [eventForm, setEventForm] = useState<Record<string, any>>({})
    const [registrations, setRegistrations] = useState<RegistrationRow[]>([])
    const [messages, setMessages] = useState<MessageRow[]>([])
    const [answerChartMode, setAnswerChartMode] = useState<ChartMode>('pie')
    const [selectedRegistration, setSelectedRegistration] = useState<RegistrationRow | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [deletingRegistrationId, setDeletingRegistrationId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [emailForm, setEmailForm] = useState({
        segment: 'all' as EmailSegment,
        subject: 'Lembrete: {evento} está chegando',
        htmlContent: DEFAULT_EVENT_EMAIL_HTML,
        textContent: DEFAULT_EVENT_EMAIL_TEXT,
        testRecipient: '',
    })
    const [emailSending, setEmailSending] = useState(false)
    const [emailTesting, setEmailTesting] = useState(false)
    const [emailResult, setEmailResult] = useState<string | null>(null)

    const assessmentEvent = useMemo(() => {
        return event ? isProfileAssessmentEvent(event) : false
    }, [event])

    const publicPath = useMemo(() => {
        if (!event?.slug) return ''
        return assessmentEvent ? buildProfileAssessmentPath(event.slug) : `/eventos/${event.slug}`
    }, [assessmentEvent, event?.slug])

    const presentationPath = useMemo(() => {
        if (!event?.slug || !assessmentEvent) return ''
        return buildProfileAssessmentPresentationPath(event.slug)
    }, [assessmentEvent, event?.slug])

    const publicUrl = useMemo(() => {
        if (typeof window === 'undefined' || !publicPath) return ''
        return `${window.location.origin}${publicPath}`
    }, [publicPath])

    const messageBuckets = useMemo(() => {
        const pending = messages.filter(row => row.status === 'pending')
        const pendingDue = pending.filter(isMessageDue)
        const pendingFuture = pending.filter(row => !isMessageDue(row))
        const reopened = pending.filter(isReopenedForResend)

        return {
            pending,
            pendingDue,
            pendingFuture,
            reopened,
            sent: messages.filter(row => row.status === 'sent'),
            failed: messages.filter(row => row.status === 'failed'),
        }
    }, [messages])

    const queuesByRegistration = useMemo(() => {
        const map: Record<string, { due?: MessageRow; future?: MessageRow; failed?: MessageRow; sent?: MessageRow }> = {}
        const ordered = [...messages].sort((a, b) => messageTime(a) - messageTime(b))

        ordered.forEach(row => {
            const registrationId = String(row.registration_id || '')
            if (!registrationId) return
            map[registrationId] ||= {}

            if (row.status === 'pending' && isMessageDue(row) && !map[registrationId].due) {
                map[registrationId].due = row
            } else if (row.status === 'pending' && !isMessageDue(row) && !map[registrationId].future) {
                map[registrationId].future = row
            } else if (row.status === 'failed' && !map[registrationId].failed) {
                map[registrationId].failed = row
            } else if (row.status === 'sent') {
                map[registrationId].sent = row
            }
        })

        return map
    }, [messages])

    const stats = useMemo(() => {
        const active = registrations.filter(row => row.status !== 'cancelled')
        return {
            total: active.length,
            checkedIn: registrations.filter(row => row.status === 'checked_in').length,
            creciVerified: registrations.filter(row => row.creci_status === 'manually_verified').length,
            hotIntent: registrations.filter(row => getTop3Intent(row).level === 'quente').length,
            pendingMessages: messageBuckets.pendingDue.length,
        }
    }, [registrations, messageBuckets.pendingDue.length])

    const emailRecipientsCount = useMemo(() => {
        return registrations
            .filter(row => row.status !== 'cancelled')
            .filter(row => registrationMatchesSegment(row, emailForm.segment))
            .filter(row => String(row.email || '').trim())
            .length
    }, [registrations, emailForm.segment])

    const answerCharts = useMemo(() => {
        const activeRows = registrations.filter(row => row.status !== 'cancelled')

        return [
            {
                id: 'temperature',
                title: 'Temperatura',
                data: buildPieData(activeRows, row => getTop3Intent(row).levelLabel),
            },
            {
                id: 'profile',
                title: 'Perfil',
                data: buildPieData(activeRows, brokerTypeLabel),
            },
            {
                id: 'monthly_leads',
                title: 'Leads por mês',
                data: buildPieData(activeRows, row => monthlyLeadLabel(row.monthly_leads)),
            },
            {
                id: 'challenge',
                title: 'Principal desafio',
                data: buildPieData(activeRows, row => getTop3Intent(row).challenge),
            },
            {
                id: 'timeline',
                title: 'Prazo de melhoria',
                data: buildPieData(activeRows, row => getTop3Intent(row).timeline),
            },
            {
                id: 'investment',
                title: 'Investimento mensal',
                data: buildPieData(activeRows, row => getTop3Intent(row).investment),
            },
        ]
    }, [registrations])

    const load = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/admin/eventos/${eventId}`, { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao carregar evento.')
            setEvent(data.event)
            setEventForm({
                ...data.event,
                event_date: toDateTimeLocal(data.event.event_date),
                end_date: toDateTimeLocal(data.event.end_date),
                capacity: data.event.capacity || '',
            })
            setRegistrations(data.registrations || [])
            setMessages(data.messages || [])
        } catch (err: any) {
            setError(err?.message || 'Erro ao carregar evento.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [eventId])

    const updateEventField = (field: string, value: string) => {
        setEventForm(prev => ({ ...prev, [field]: value }))
    }

    const saveEvent = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setSaving(true)
        setError(null)
        try {
            const response = await fetch(`/api/admin/eventos/${eventId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...eventForm,
                    capacity: eventForm.capacity ? Number(eventForm.capacity) : null,
                    confirmation_message_template: eventForm.confirmation_message_template || DEFAULT_CONFIRMATION_TEMPLATE,
                    reminder_message_template: eventForm.reminder_message_template || DEFAULT_REMINDER_TEMPLATE,
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao salvar evento.')
            await load()
        } catch (err: any) {
            setError(err?.message || 'Erro ao salvar evento.')
        } finally {
            setSaving(false)
        }
    }

    const patchRegistration = async (registrationId: string, patch: Record<string, any>) => {
        const response = await fetch(`/api/admin/eventos/registrations/${registrationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        })
        const data = await response.json()
        if (!response.ok) {
            setError(data.error || 'Erro ao atualizar inscrito.')
            return
        }
        await load()
    }

    const sendNextMessage = async (registrationId: string, queueId?: string) => {
        const response = await fetch(`/api/admin/eventos/registrations/${registrationId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_next_message', queueId }),
        })
        const data = await response.json()
        if (!response.ok) {
            setError(data.error || 'Erro ao enviar mensagem.')
            return
        }
        await load()
    }

    const deleteRegistration = async (registration: RegistrationRow) => {
        const confirmed = window.confirm(`Apagar o cadastro de ${registration.full_name}? Isso também remove a fila de mensagens desse inscrito.`)
        if (!confirmed) return

        setDeletingRegistrationId(registration.id)
        setError(null)
        try {
            const response = await fetch(`/api/admin/eventos/registrations/${registration.id}`, {
                method: 'DELETE',
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao apagar inscrito.')
            await load()
        } catch (err: any) {
            setError(err?.message || 'Erro ao apagar inscrito.')
        } finally {
            setDeletingRegistrationId(null)
        }
    }

    const processQueue = async () => {
        setProcessing(true)
        setError(null)
        try {
            const response = await fetch('/api/admin/eventos/process-queue', { method: 'POST' })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao processar fila.')
            await load()
        } catch (err: any) {
            setError(err?.message || 'Erro ao processar fila.')
        } finally {
            setProcessing(false)
        }
    }

    const copyPublicUrl = async () => {
        if (!publicUrl) return
        await navigator.clipboard.writeText(publicUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
    }

    const downloadContacts = () => {
        window.location.href = `/api/admin/eventos/export-contacts?eventId=${encodeURIComponent(eventId)}`
    }

    const updateEmailField = (field: keyof typeof emailForm, value: string) => {
        setEmailForm(prev => ({ ...prev, [field]: value }))
    }

    const sendEventEmail = async (testOnly: boolean) => {
        if (testOnly && !emailForm.testRecipient.trim()) {
            setError('Informe um e-mail para enviar o teste.')
            return
        }

        if (!testOnly) {
            const confirmed = window.confirm(`Enviar este e-mail para ${emailRecipientsCount} inscrito(s) do segmento ${segmentLabel(emailForm.segment)}?`)
            if (!confirmed) return
        }

        setError(null)
        setEmailResult(null)
        testOnly ? setEmailTesting(true) : setEmailSending(true)

        try {
            const response = await fetch(`/api/admin/eventos/${eventId}/email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segment: emailForm.segment,
                    subject: emailForm.subject,
                    htmlContent: emailForm.htmlContent,
                    textContent: emailForm.textContent,
                    testRecipient: testOnly ? emailForm.testRecipient : '',
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erro ao enviar e-mail.')
            setEmailResult(testOnly
                ? `Teste enviado para ${emailForm.testRecipient}.`
                : `Envio concluido: ${data.sent || 0} enviado(s), ${data.failed || 0} falha(s), ${data.skipped || 0} ignorado(s).`
            )
            await load()
        } catch (err: any) {
            setError(err?.message || 'Erro ao enviar e-mail.')
        } finally {
            setEmailTesting(false)
            setEmailSending(false)
        }
    }

    if (loading) {
        return (
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 className="spin" size={30} style={{ margin: '0 auto 12px' }} />
                Carregando evento...
            </div>
        )
    }

    if (!event) {
        return (
            <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
                <Link href="/admin/eventos" className="btn btn-outline btn-sm"><ArrowLeft size={14} /> Voltar</Link>
                <div className="chart-card" style={{ padding: 36, marginTop: 18 }}>Evento não encontrado.</div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 8px 56px' }}>
            <div className="admin-header">
                <div>
                    <Link href="/admin/eventos" className="btn btn-outline btn-sm" style={{ marginBottom: 12 }}>
                        <ArrowLeft size={14} />
                        Eventos
                    </Link>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <CalendarDays className="text-gold" size={28} /> {event.title}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                        {formatShortDate(event.event_date)} · {event.location_name || 'Local a confirmar'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-outline" onClick={downloadContacts}>
                        <Download size={16} />
                        Baixar contatos
                    </button>
                    <button className="btn btn-outline" onClick={copyPublicUrl}>
                        {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        {copied ? 'Copiado' : 'Copiar link'}
                    </button>
                    <Link href={publicPath || `/eventos/${event.slug}`} className="btn btn-outline" target="_blank">
                        <ExternalLink size={16} />
                        {assessmentEvent ? 'Abrir autoavaliação' : 'Abrir página'}
                    </Link>
                    {presentationPath && (
                        <Link href={presentationPath} className="btn btn-outline" target="_blank">
                            <Presentation size={16} />
                            Apresentação
                        </Link>
                    )}
                    <button className="btn btn-primary" onClick={processQueue} disabled={processing}>
                        {processing ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                        Processar fila
                    </button>
                </div>
            </div>

            {error && (
                <div className="chart-card" style={{ padding: 16, marginBottom: 18, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
                <Stat icon={<Users size={18} />} label="Inscritos" value={stats.total} />
                <Stat icon={<CheckCircle2 size={18} />} label="Leads quentes" value={stats.hotIntent} />
                <Stat icon={<ShieldCheck size={18} />} label="CRECI verificado" value={stats.creciVerified} />
                <Stat icon={<CheckCircle2 size={18} />} label="Check-ins" value={stats.checkedIn} />
                <Stat icon={<MessageSquare size={18} />} label="Para enviar agora" value={stats.pendingMessages} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: 18, alignItems: 'start' }}>
                <form onSubmit={saveEvent} className="chart-card" style={{ padding: 22 }}>
                    <SectionTitle title="Configuracao do evento" icon={<Save size={18} />} />
                    <div
                        style={{
                            height: 170,
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55)), url("${eventForm.hero_image_url || DEFAULT_EVENT_HERO}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            marginBottom: 16,
                        }}
                    />
                    <label style={labelStyle}>Título<input style={adminLightInputStyle} value={eventForm.title || ''} onChange={e => updateEventField('title', e.target.value)} /></label>
                    <label style={labelStyle}>Slug<input style={adminLightInputStyle} value={eventForm.slug || ''} onChange={e => updateEventField('slug', e.target.value)} /></label>
                    <label style={labelStyle}>Subtítulo<input style={adminLightInputStyle} value={eventForm.subtitle || ''} onChange={e => updateEventField('subtitle', e.target.value)} /></label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.62fr', gap: 12 }}>
                        <label style={labelStyle}>Data e horário<input type="datetime-local" style={adminLightInputStyle} value={eventForm.event_date || ''} onChange={e => updateEventField('event_date', e.target.value)} /></label>
                        <label style={labelStyle}>Status<select style={adminLightInputStyle} value={eventForm.status || 'draft'} onChange={e => updateEventField('status', e.target.value)}>
                            <option value="draft">Rascunho</option>
                            <option value="published">Publicado</option>
                            <option value="archived">Arquivado</option>
                        </select></label>
                    </div>
                    <label style={labelStyle}>Local<input style={adminLightInputStyle} value={eventForm.location_name || ''} onChange={e => updateEventField('location_name', e.target.value)} /></label>
                    <label style={labelStyle}>Endereço<input style={adminLightInputStyle} value={eventForm.location_address || ''} onChange={e => updateEventField('location_address', e.target.value)} /></label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.5fr', gap: 12 }}>
                        <label style={labelStyle}>Imagem de capa<input style={adminLightInputStyle} value={eventForm.hero_image_url || ''} onChange={e => updateEventField('hero_image_url', e.target.value)} /></label>
                        <label style={labelStyle}>Vagas<input type="number" min="0" style={adminLightInputStyle} value={eventForm.capacity || ''} onChange={e => updateEventField('capacity', e.target.value)} /></label>
                    </div>
                    <label style={labelStyle}>Descrição curta<textarea style={adminLightTextareaStyle} value={eventForm.description || ''} onChange={e => updateEventField('description', e.target.value)} /></label>
                    <label style={labelStyle}>Conteúdo editorial<textarea style={{ ...adminLightTextareaStyle, minHeight: 150 }} value={eventForm.content || ''} onChange={e => updateEventField('content', e.target.value)} /></label>
                    <label style={labelStyle}>Mensagem padrão de confirmação<textarea style={{ ...adminLightTextareaStyle, minHeight: 130 }} value={eventForm.confirmation_message_template || ''} onChange={e => updateEventField('confirmation_message_template', e.target.value)} /></label>
                    <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 16 }}>
                        {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                        Salvar evento
                    </button>
                </form>

                <div style={{ display: 'grid', gap: 18 }}>
                    <div className="chart-card" style={{ padding: 22 }}>
                        <div style={answerChartsHeaderStyle}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: '1rem', margin: 0 }}>
                                <ChartPie size={18} />
                                Graficos das respostas
                            </h2>
                            <div style={chartModeSwitchStyle} aria-label="Tipo de grafico">
                                <button
                                    type="button"
                                    style={answerChartMode === 'pie' ? chartModeButtonActiveStyle : chartModeButtonStyle}
                                    onClick={() => setAnswerChartMode('pie')}
                                >
                                    Pizza
                                </button>
                                <button
                                    type="button"
                                    style={answerChartMode === 'bar' ? chartModeButtonActiveStyle : chartModeButtonStyle}
                                    onClick={() => setAnswerChartMode('bar')}
                                >
                                    Barras
                                </button>
                            </div>
                        </div>
                        <div style={answerChartGridStyle}>
                            {answerCharts.map(chart => (
                                <AnswerPieCard key={chart.id} title={chart.title} data={chart.data} mode={answerChartMode} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="chart-card" style={{ padding: 22, marginTop: 18 }}>
                <SectionTitle title="E-mails do evento" icon={<Mail size={18} />} />
                <div style={emailEditorGridStyle}>
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.65fr) minmax(0, 1fr)', gap: 12 }}>
                            <label style={labelStyle}>Segmento
                                <select
                                    style={emailInputStyle}
                                    value={emailForm.segment}
                                    onChange={e => updateEmailField('segment', e.target.value)}
                                >
                                    {EMAIL_SEGMENTS.map(segment => (
                                        <option key={segment} value={segment}>{segmentLabel(segment)}</option>
                                    ))}
                                </select>
                            </label>
                            <label style={labelStyle}>E-mail de teste
                                <input
                                    style={emailInputStyle}
                                    value={emailForm.testRecipient}
                                    onChange={e => updateEmailField('testRecipient', e.target.value)}
                                    placeholder="você@empresa.com"
                                />
                            </label>
                        </div>
                        <label style={labelStyle}>Assunto
                            <input
                                style={emailInputStyle}
                                value={emailForm.subject}
                                onChange={e => updateEmailField('subject', e.target.value)}
                            />
                        </label>
                        <label style={labelStyle}>HTML do e-mail
                            <textarea
                                style={{ ...emailTextareaStyle, minHeight: 210, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.78rem' }}
                                value={emailForm.htmlContent}
                                onChange={e => updateEmailField('htmlContent', e.target.value)}
                            />
                        </label>
                        <label style={labelStyle}>Texto simples
                            <textarea
                                style={{ ...emailTextareaStyle, minHeight: 130 }}
                                value={emailForm.textContent}
                                onChange={e => updateEmailField('textContent', e.target.value)}
                            />
                        </label>
                    </div>
                    <div style={emailSidePanelStyle}>
                        <div style={{ display: 'grid', gap: 4 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Destinatarios</span>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '2rem', lineHeight: 1 }}>{emailRecipientsCount}</strong>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                Inscritos ativos com e-mail em {segmentLabel(emailForm.segment)}.
                            </span>
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            <button className="btn btn-outline" type="button" onClick={() => sendEventEmail(true)} disabled={emailTesting || emailSending}>
                                {emailTesting ? <Loader2 className="spin" size={16} /> : <Mail size={16} />}
                                Enviar teste
                            </button>
                            <button className="btn btn-primary" type="button" onClick={() => sendEventEmail(false)} disabled={emailSending || emailTesting || emailRecipientsCount === 0}>
                                {emailSending ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                                Enviar para inscritos
                            </button>
                        </div>
                        {emailResult && (
                            <div style={emailResultStyle}>
                                <CheckCircle2 size={16} />
                                {emailResult}
                            </div>
                        )}
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.55 }}>
                            Campos aceitos: {'{nome}'}, {'{email}'}, {'{evento}'}, {'{data_evento}'}, {'{local_evento}'}, {'{link_evento}'}, {'{checkin_code}'}.
                        </div>
                    </div>
                </div>
            </div>

            <div className="chart-card" style={{ padding: 22, marginTop: 18 }}>
                <SectionTitle title="Inscritos" icon={<Users size={18} />} />
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120 }}>
                        <thead>
                            <tr style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                <th style={thStyle}>Nome</th>
                                <th style={thStyle}>Contato</th>
                                <th style={thStyle}>Perfil</th>
                                <th style={thStyle}>Intenção</th>
                                <th style={thStyle}>CRECI</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registrations.map(row => {
                                const top3Intent = getTop3Intent(row)
                                const queueState = queuesByRegistration[row.id] || {}
                                const dueQueue = queueState.due
                                const futureQueue = queueState.future
                                const failedQueue = queueState.failed
                                const hasReopenedQueue = Boolean(dueQueue && isReopenedForResend(dueQueue))
                                return (
                                    <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td style={tdStyle}>
                                            <button
                                                type="button"
                                                style={leadNameButtonStyle}
                                                onClick={() => setSelectedRegistration(row)}
                                                title="Ver respostas do formulario"
                                            >
                                                {row.full_name}
                                            </button>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{row.city || 'Cidade não informada'}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div>{formatPhoneDisplay(row.phone)}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{row.email}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            {row.broker_type === 'imobiliaria' ? 'Imobiliária' : 'Autônomo'}
                                            {row.real_estate_name && <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{row.real_estate_name}</div>}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ ...intentBadgeStyle, ...top3IntentStyle(top3Intent.level) }}>
                                                {top3Intent.levelLabel} · {top3Intent.score} pts
                                            </span>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', lineHeight: 1.45, marginTop: 8 }}>
                                                {top3Intent.challenge}<br />
                                                {top3Intent.timeline} · {top3Intent.investment}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div>{row.creci_state || '--'} {row.creci || ''}</div>
                                            <select style={miniSelectStyle} value={row.creci_status} onChange={e => patchRegistration(row.id, { creci_status: e.target.value })}>
                                                <option value="pending">Não verificado</option>
                                                <option value="manually_verified">Verificado</option>
                                                <option value="rejected">Rejeitado</option>
                                            </select>
                                        </td>
                                        <td style={tdStyle}>
                                            <select style={miniSelectStyle} value={row.status} onChange={e => patchRegistration(row.id, { status: e.target.value })}>
                                                <option value="confirmed">Confirmado</option>
                                                <option value="waitlisted">Lista de espera</option>
                                                <option value="checked_in">Check-in</option>
                                                <option value="cancelled">Cancelado</option>
                                            </select>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 4 }}>Cod. {row.checkin_code}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {dueQueue ? (
                                                    <button className="btn btn-outline btn-sm" onClick={() => sendNextMessage(row.id, dueQueue.id)}>
                                                        <Send size={13} />
                                                        {hasReopenedQueue ? 'Reenviar agora' : 'Enviar agora'}
                                                    </button>
                                                ) : futureQueue ? (
                                                    <span style={queueBadgeStyle}>
                                                        Agendado {formatShortDate(futureQueue.scheduled_for)}
                                                    </span>
                                                ) : failedQueue ? (
                                                    <span style={{ ...queueBadgeStyle, borderColor: 'rgba(239,68,68,0.32)', color: '#dc2626' }}>
                                                        Falhou
                                                    </span>
                                                ) : (
                                                    <span style={queueBadgeStyle}>Sem pendencia</span>
                                                )}
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => deleteRegistration(row)}
                                                    disabled={deletingRegistrationId === row.id}
                                                    style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#dc2626' }}
                                                >
                                                    {deletingRegistrationId === row.id ? <Loader2 className="spin" size={13} /> : <Trash2 size={13} />}
                                                    Apagar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {registrations.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: 36 }}>
                                        Nenhum inscrito ainda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {selectedRegistration && (
                <RegistrationAnswersModal
                    registration={selectedRegistration}
                    onClose={() => setSelectedRegistration(null)}
                />
            )}
        </div>
    )
}

function SectionTitle({ title, icon }: { title: string; icon: ReactNode }) {
    return (
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: '1rem', margin: '0 0 16px' }}>
            {icon}
            {title}
        </h2>
    )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
    return (
        <div className="chart-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 8 }}>{icon}{label}</div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '1.7rem' }}>{value}</strong>
        </div>
    )
}

function AnswerPieCard({ title, data, mode }: { title: string; data: PieDatum[]; mode: ChartMode }) {
    const total = data.reduce((sum, item) => sum + item.value, 0)
    const topItems = data.slice(0, 5)

    return (
        <div style={answerPieCardStyle}>
            <div style={answerPieHeaderStyle}>
                <strong>{title}</strong>
                <span>{total}</span>
            </div>
            {total === 0 ? (
                <div style={answerPieEmptyStyle}>Sem respostas</div>
            ) : mode === 'bar' ? (
                <div style={answerBarListStyle}>
                    {data.map(item => {
                        const percent = total > 0 ? Math.round((item.value / total) * 100) : 0
                        return (
                            <div key={`${title}-bar-${item.label}`} style={answerBarRowStyle}>
                                <div style={answerBarMetaStyle}>
                                    <span>{item.label}</span>
                                    <b>{item.value} · {percent}%</b>
                                </div>
                                <div style={answerBarTrackStyle}>
                                    <span style={{ ...answerBarFillStyle, width: `${Math.max(percent, 2)}%`, background: item.color }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <>
                    <div style={{ width: '100%', height: 154 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                                <Pie
                                    data={data}
                                    dataKey="value"
                                    nameKey="label"
                                    innerRadius={38}
                                    outerRadius={66}
                                    paddingAngle={2}
                                    stroke="rgba(255,255,255,0.9)"
                                    strokeWidth={2}
                                    isAnimationActive
                                >
                                    {data.map(item => (
                                        <Cell key={`${title}-${item.label}`} fill={item.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value?: number | string, name?: string) => {
                                        const count = Number(value || 0)
                                        const percent = total > 0 ? Math.round((count / total) * 100) : 0
                                        return [`${count} (${percent}%)`, name || 'Resposta']
                                    }}
                                    contentStyle={{
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)',
                                        boxShadow: '0 12px 30px rgba(15,23,42,0.18)',
                                    }}
                                />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={answerLegendStyle}>
                        {topItems.map(item => {
                            const percent = total > 0 ? Math.round((item.value / total) * 100) : 0
                            return (
                                <div key={`${title}-legend-${item.label}`} style={answerLegendItemStyle}>
                                    <span style={{ ...answerLegendDotStyle, background: item.color }} />
                                    <span style={answerLegendLabelStyle}>{item.label}</span>
                                    <b>{percent}%</b>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}

function RegistrationAnswersModal({ registration, onClose }: { registration: RegistrationRow; onClose: () => void }) {
    const intent = getTop3Intent(registration)
    const detailRows = getRegistrationFormDetails(registration)

    return (
        <div style={modalBackdropStyle} role="dialog" aria-modal="true" onClick={onClose}>
            <div style={modalCardStyle} onClick={event => event.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <div>
                        <span style={modalEyebrowStyle}>Resposta do formulario</span>
                        <h2 style={{ margin: '4px 0 0', color: 'var(--text-primary)', fontSize: '1.45rem' }}>
                            {registration.full_name}
                        </h2>
                    </div>
                    <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                        <X size={14} />
                        Fechar
                    </button>
                </div>

                <div style={modalSummaryGridStyle}>
                    <div style={modalSummaryItemStyle}>
                        <span style={modalAnswerLabelStyle}>WhatsApp</span>
                        <strong style={modalAnswerValueStyle}>{formatPhoneDisplay(registration.phone)}</strong>
                    </div>
                    <div style={modalSummaryItemStyle}>
                        <span style={modalAnswerLabelStyle}>E-mail</span>
                        <strong style={modalAnswerValueStyle}>{registration.email || 'Não informado'}</strong>
                    </div>
                    <div style={modalSummaryItemStyle}>
                        <span style={modalAnswerLabelStyle}>Intenção</span>
                        <strong style={modalAnswerValueStyle}>{intent.levelLabel} · {intent.score} pts</strong>
                    </div>
                </div>

                <div style={modalAnswerGridStyle}>
                    {detailRows.map(item => (
                        <div key={item.label} style={modalAnswerItemStyle}>
                            <span style={modalAnswerLabelStyle}>{item.label}</span>
                            <strong style={modalAnswerValueStyle}>{item.value}</strong>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const labelStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    color: 'var(--text-secondary)',
    fontSize: '0.74rem',
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginTop: 12,
}

const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: 40,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'rgba(15, 23, 42, 0.55)',
    color: 'var(--text-primary)',
    padding: '0 11px',
    outline: 'none',
}

const textareaStyle: CSSProperties = {
    width: '100%',
    minHeight: 86,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'rgba(15, 23, 42, 0.55)',
    color: 'var(--text-primary)',
    padding: 11,
    outline: 'none',
    resize: 'vertical',
}

const adminLightInputStyle: CSSProperties = {
    ...inputStyle,
    border: '1px solid rgba(148, 163, 184, 0.34)',
    background: '#ffffff',
    color: '#111827',
    boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.05)',
}

const adminLightTextareaStyle: CSSProperties = {
    ...textareaStyle,
    border: '1px solid rgba(148, 163, 184, 0.34)',
    background: '#ffffff',
    color: '#111827',
    boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.05)',
    lineHeight: 1.45,
}

const emailEditorGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
    gap: 18,
    alignItems: 'start',
}

const emailSidePanelStyle: CSSProperties = {
    display: 'grid',
    gap: 16,
    padding: 14,
    border: '1px solid rgba(148, 163, 184, 0.24)',
    borderRadius: 8,
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 10px 26px rgba(15, 23, 42, 0.06)',
}

const emailInputStyle: CSSProperties = {
    ...inputStyle,
    border: '1px solid rgba(148, 163, 184, 0.34)',
    background: '#ffffff',
    color: '#111827',
    boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.05)',
}

const emailTextareaStyle: CSSProperties = {
    ...textareaStyle,
    border: '1px solid rgba(148, 163, 184, 0.34)',
    background: '#ffffff',
    color: '#111827',
    boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.05)',
    lineHeight: 1.45,
}

const emailResultStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 8,
    border: '1px solid rgba(34, 197, 94, 0.28)',
    background: 'rgba(34, 197, 94, 0.1)',
    color: '#86efac',
    fontSize: '0.8rem',
    lineHeight: 1.4,
}

const modalBackdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    background: 'rgba(15, 23, 42, 0.48)',
    backdropFilter: 'blur(8px)',
}

const modalCardStyle: CSSProperties = {
    width: 'min(760px, 100%)',
    maxHeight: 'min(760px, calc(100vh - 40px))',
    overflow: 'auto',
    padding: 22,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    boxShadow: '0 26px 70px rgba(15, 23, 42, 0.28)',
}

const modalHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 16,
}

const modalEyebrowStyle: CSSProperties = {
    color: 'var(--gold)',
    fontSize: '0.72rem',
    fontWeight: 900,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
}

const modalSummaryGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 10,
    marginBottom: 14,
}

const modalSummaryItemStyle: CSSProperties = {
    display: 'grid',
    gap: 5,
    minWidth: 0,
    padding: 12,
    border: '1px solid rgba(201, 159, 74, 0.24)',
    borderRadius: 8,
    background: 'rgba(201, 159, 74, 0.08)',
}

const modalAnswerGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
}

const modalAnswerItemStyle: CSSProperties = {
    display: 'grid',
    gap: 5,
    minWidth: 0,
    padding: 12,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.04)',
}

const modalAnswerLabelStyle: CSSProperties = {
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    fontWeight: 850,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
}

const modalAnswerValueStyle: CSSProperties = {
    minWidth: 0,
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
}

const answerChartsHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
}

const chartModeSwitchStyle: CSSProperties = {
    display: 'inline-grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    padding: 4,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.05)',
}

const chartModeButtonStyle: CSSProperties = {
    minHeight: 30,
    padding: '0 11px',
    border: 0,
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: 800,
    cursor: 'pointer',
}

const chartModeButtonActiveStyle: CSSProperties = {
    ...chartModeButtonStyle,
    background: 'var(--gold)',
    color: '#151008',
}

const answerChartGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
}

const answerPieCardStyle: CSSProperties = {
    minWidth: 0,
    padding: 14,
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'rgba(15, 23, 42, 0.035)',
}

const answerPieHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
    marginBottom: 8,
}

const answerPieEmptyStyle: CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    height: 154,
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
}

const answerBarListStyle: CSSProperties = {
    display: 'grid',
    alignContent: 'center',
    gap: 10,
    minHeight: 220,
    padding: '8px 0',
}

const answerBarRowStyle: CSSProperties = {
    display: 'grid',
    gap: 5,
}

const answerBarMetaStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 8,
    alignItems: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.72rem',
}

const answerBarTrackStyle: CSSProperties = {
    position: 'relative',
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
    background: 'rgba(148, 163, 184, 0.14)',
}

const answerBarFillStyle: CSSProperties = {
    display: 'block',
    height: '100%',
    minWidth: 4,
    borderRadius: 99,
}

const answerLegendStyle: CSSProperties = {
    display: 'grid',
    gap: 7,
}

const answerLegendItemStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 7,
    color: 'var(--text-secondary)',
    fontSize: '0.72rem',
}

const answerLegendDotStyle: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 99,
}

const answerLegendLabelStyle: CSSProperties = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
}

const queueBadgeStyle: CSSProperties = {
    minHeight: 35,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: 700,
    lineHeight: 1.2,
}

const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '0 12px 10px',
    fontWeight: 800,
}

const tdStyle: CSSProperties = {
    padding: '13px 12px',
    color: 'var(--text-secondary)',
    fontSize: '0.84rem',
    verticalAlign: 'top',
}

const leadNameButtonStyle: CSSProperties = {
    display: 'inline',
    padding: 0,
    border: 0,
    background: 'transparent',
    color: 'var(--text-primary)',
    font: 'inherit',
    fontWeight: 850,
    textAlign: 'left',
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: 'rgba(201, 159, 74, 0.45)',
    textUnderlineOffset: 3,
}

const intentBadgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 28,
    padding: '0 9px',
    border: '1px solid',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 850,
    whiteSpace: 'nowrap',
}

const miniSelectStyle: CSSProperties = {
    marginTop: 6,
    minHeight: 30,
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'rgba(15, 23, 42, 0.75)',
    color: 'var(--text-primary)',
    padding: '0 8px',
}
