import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { PDFDocument } from 'pdf-lib'
import {
    sendWhatsAppMessage,
    sendAudioMessage,
    sendMenuMessage,
    sendCarousel,
    sendPixButton,
    setPresenceTyping,
    setPresenceRecording,
    setPresenceAvailable,
    markAsRead,
    downloadMedia
} from '../uazapi'
import {
    appendLeadConversationLog,
    ensureWhatsAppLead,
    normalizeWhatsAppPhone,
    phoneCandidates,
    syncWhatsAppLeadSnapshot,
} from '../whatsapp/lead-sync'
import { getPublicAppUrl } from '../app-url'
import { buildTrackedWhatsAppLink } from '../tracking/whatsapp-links'
import { recordGeminiUsage } from '../ai/gemini-costs'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function getSaoPauloTimeContext() {
    const spNow = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
    )
    const hour = spNow.getHours()
    const greeting = hour < 12 ? 'bom dia' : hour < 18 ? 'boa tarde' : 'boa noite'
    const date = spNow.toLocaleDateString('pt-BR')
    const isoDate = toDateKey(spNow)
    const weekday = spNow.toLocaleDateString('pt-BR', { weekday: 'long' })
    const tomorrow = addDays(spNow, 1)
    const tomorrowDate = tomorrow.toLocaleDateString('pt-BR')
    const tomorrowIsoDate = toDateKey(tomorrow)
    const tomorrowWeekday = tomorrow.toLocaleDateString('pt-BR', { weekday: 'long' })
    const time = spNow.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    })
    return { hour, greeting, date, isoDate, weekday, tomorrowDate, tomorrowIsoDate, tomorrowWeekday, time }
}

function parseHourMinuteToMinutes(raw: string | null | undefined): number | null {
    if (!raw) return null
    const m = String(raw).match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hh = parseInt(m[1], 10)
    const mm = parseInt(m[2], 10)
    if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
    return hh * 60 + mm
}

function getNowInTimezone(timezone: string): Date {
    const safeTz = timezone || 'America/Sao_Paulo'
    return new Date(new Date().toLocaleString('en-US', { timeZone: safeTz }))
}

function isWithinAISchedule(configs: Record<string, string>) {
    const enabled = configs['whatsapp_ai_schedule_enabled'] === 'true'
    if (!enabled) return { enabled: false, within: true, reason: 'schedule_disabled' as const }

    const startRaw = configs['whatsapp_ai_schedule_start'] || '18:00'
    const endRaw = configs['whatsapp_ai_schedule_end'] || '08:00'
    const timezone = configs['whatsapp_ai_schedule_timezone'] || 'America/Sao_Paulo'
    const startMin = parseHourMinuteToMinutes(startRaw)
    const endMin = parseHourMinuteToMinutes(endRaw)
    if (startMin == null || endMin == null) {
        return { enabled: true, within: true, reason: 'invalid_schedule_values' as const }
    }

    const now = getNowInTimezone(timezone)
    const nowMin = now.getHours() * 60 + now.getMinutes()

    // Same start/end means 24h window.
    if (startMin === endMin) {
        return { enabled: true, within: true, reason: '24h_window' as const, nowMin, startMin, endMin, timezone }
    }

    const within = startMin < endMin
        ? nowMin >= startMin && nowMin < endMin
        : nowMin >= startMin || nowMin < endMin

    return { enabled: true, within, reason: 'ok' as const, nowMin, startMin, endMin, timezone }
}

type BrokerAgendaSlot = {
    label: string
    iso: string
    date: string
    time: string
    durationMinutes: number
}

type AppointmentMarker = {
    iso: string
    durationMinutes: number
    title: string | null
}

export type DetectedAppointment = {
    date: string
    time: string
    contextText: string
}

function minutesToTime(total: number): string {
    const hh = Math.floor(total / 60).toString().padStart(2, '0')
    const mm = (total % 60).toString().padStart(2, '0')
    return `${hh}:${mm}`
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
}

function toDateKey(date: Date): string {
    return date.toISOString().split('T')[0]
}

function weekdayPt(date: Date): string {
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

export function getSaoPauloDate(): Date {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
}

function parseAppointmentMarkers(text: string): { cleanedText: string; markers: AppointmentMarker[] } {
    const markers: AppointmentMarker[] = []
    const cleanedText = String(text || '').replace(
        /\[AGENDAR_VISITA:([^\]|\s]+)(?:\|(\d{1,3}))?(?:\|([^\]]+))?\]/gi,
        (_match, iso, duration, title) => {
            markers.push({
                iso: String(iso || '').trim(),
                durationMinutes: Number(duration || 60) || 60,
                title: title ? String(title).trim() : null,
            })
            return ''
        }
    ).trim()
    return { cleanedText, markers }
}

function buildCurrentDatePrompt(spTime: ReturnType<typeof getSaoPauloTimeContext>) {
    return [
        'CONTEXTO ATUAL OBRIGATORIO (America/Sao_Paulo):',
        `- Hoje e ${spTime.weekday}, ${spTime.date} (${spTime.isoDate}).`,
        `- Agora sao ${spTime.time}. Saudacao correta neste momento: "${spTime.greeting}".`,
        `- Amanha e ${spTime.tomorrowWeekday}, ${spTime.tomorrowDate} (${spTime.tomorrowIsoDate}).`,
        '- Quando o lead disser hoje, amanha, depois de amanha, sexta, semana que vem ou outro termo relativo, converta mentalmente para data real antes de responder ou marcar agenda.',
        '- Para registrar visita, use data absoluta e horario concreto. Se faltar horario, pergunte. Se faltar confirmacao, nao registre.',
        '- Nunca marque visita em data no passado.',
    ].join('\n')
}

export function resolveRelativeAppointmentDate(text: string, baseDate = getSaoPauloDate()): string | null {
    const normalized = normalizeForSearch(text)
    const relativeDaysMatch = normalized.match(/\bdaqui(?:\s+a)?\s+(\d{1,3})\s+dias?\b/)
    if (relativeDaysMatch) {
        const days = Number(relativeDaysMatch[1])
        if (!Number.isNaN(days) && days >= 0 && days <= 365) {
            return toDateKey(addDays(baseDate, days))
        }
    }

    const dateMatch = normalized.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/)
    if (dateMatch) {
        const day = Number(dateMatch[1])
        const month = Number(dateMatch[2])
        let year = dateMatch[3] ? Number(dateMatch[3]) : baseDate.getFullYear()
        if (year < 100) year += 2000
        const candidate = new Date(year, month - 1, day, 12, 0, 0, 0)
        if (!Number.isNaN(candidate.getTime())) {
            if (!dateMatch[3] && candidate < new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0)) {
                candidate.setFullYear(candidate.getFullYear() + 1)
            }
            return toDateKey(candidate)
        }
    }

    const monthNames: Record<string, number> = {
        janeiro: 1,
        fevereiro: 2,
        marco: 3,
        abril: 4,
        maio: 5,
        junho: 6,
        julho: 7,
        agosto: 8,
        setembro: 9,
        outubro: 10,
        novembro: 11,
        dezembro: 12,
    }
    const monthDateMatch = normalized.match(/\b(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{2,4}))?\b/)
    if (monthDateMatch) {
        const day = Number(monthDateMatch[1])
        const month = monthNames[monthDateMatch[2]]
        let year = monthDateMatch[3] ? Number(monthDateMatch[3]) : baseDate.getFullYear()
        if (year < 100) year += 2000
        const candidate = new Date(year, month - 1, day, 12, 0, 0, 0)
        if (!Number.isNaN(candidate.getTime())) {
            if (!monthDateMatch[3] && candidate < new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0)) {
                candidate.setFullYear(candidate.getFullYear() + 1)
            }
            return toDateKey(candidate)
        }
    }

    if (/\b(depois de amanha|depois da amanha)\b/.test(normalized)) return toDateKey(addDays(baseDate, 2))
    if (/\bamanha\b/.test(normalized)) return toDateKey(addDays(baseDate, 1))
    if (/\bhoje\b/.test(normalized)) return toDateKey(baseDate)

    const weekdays = [
        ['domingo', 'dom'],
        ['segunda', 'seg'],
        ['terca', 'ter'],
        ['quarta', 'qua'],
        ['quinta', 'qui'],
        ['sexta', 'sex'],
        ['sabado', 'sab'],
    ]
    for (let target = 0; target < weekdays.length; target++) {
        const aliases = weekdays[target]
        if (!aliases.some(alias => new RegExp(`\\b${alias}\\b`).test(normalized))) continue
        let diff = (target - baseDate.getDay() + 7) % 7
        if (diff === 0 || /\b(proxim[ao]|semana que vem)\b/.test(normalized)) diff += 7
        return toDateKey(addDays(baseDate, diff))
    }

    return null
}

export function extractAppointmentTimeFromText(text: string): string | null {
    const normalized = normalizeForSearch(text)
    const hourMatch = normalized.match(/\b(?:as|a|para|por volta das|umas|uns)\s+(\d{1,2})(?:(?:h|:)(\d{2}))?\s*(?:da\s*)?(manha|tarde|noite)?\b/)
        || normalized.match(/\b(\d{1,2})(?:h|:)(\d{2})?\s*(?:da\s*)?(manha|tarde|noite)?\b/)
        || normalized.match(/\b(\d{1,2})\s*(?:da\s*)?(manha|tarde|noite)\b/)
        || normalized.match(/\b(?:as|a|para|por volta das|umas|uns)\s+(\d{1,2})\s+horas?\s*(?:da\s*)?(manha|tarde|noite)?\b/)
        || normalized.match(/\b(\d{1,2})\s+horas?\s*(?:da\s*)?(manha|tarde|noite)?\b/)
    if (!hourMatch) return null

    let hour = Number(hourMatch[1])
    const minuteText = hourMatch[2] && /^\d{2}$/.test(hourMatch[2]) ? hourMatch[2] : ''
    const minute = minuteText ? Number(minuteText) : 0
    const period = (hourMatch[3] || hourMatch[2] || '').match(/^(manha|tarde|noite)$/)?.[0] || ''
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null
    if (period === 'tarde' && hour < 12) hour += 12
    if (period === 'noite' && hour < 12) hour += 12
    if (period === 'manha' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatAppointmentSlotLabel(raw: string) {
    const normalized = normalizeForSearch(raw)
    if (normalized.includes('manha')) return 'Manha'
    if (normalized.includes('tarde')) return 'Tarde'
    if (normalized.includes('noite')) return 'Noite'
    return raw || 'Horario a confirmar'
}

function isAppointmentConfirmation(text: string): boolean {
    const normalized = normalizeForSearch(text)
    return /\b(sim|confirmo|confirma|confirmado|pode marcar|pode agendar|marca sim|agenda sim|fechado|combinado|perfeito|ok|beleza|isso|esse mesmo|e o melhor|melhor pra nos|melhor para nos)\b/.test(normalized)
}

function hasAppointmentContext(text: string): boolean {
    const normalized = normalizeForSearch(text)
    return /(agend|marc|visit|imobiliaria|horario|disponibilidade)/.test(normalized)
}

function findRecentSchedulingContext(messages: any[]): string {
    const safeMessages = Array.isArray(messages) ? messages : []
    for (let i = safeMessages.length - 1; i >= 0; i--) {
        const current = String(safeMessages[i]?.content || '')
        if (!current.trim() || !hasAppointmentContext(current)) continue

        const previous = i > 0 ? String(safeMessages[i - 1]?.content || '') : ''
        const next = i < safeMessages.length - 1 ? String(safeMessages[i + 1]?.content || '') : ''
        return [previous, current, next].filter(Boolean).join(' ')
    }
    return ''
}

export function detectConfirmedAppointment(messages: any[]): DetectedAppointment | null {
    const safeMessages = Array.isArray(messages) ? messages : []
    const last = safeMessages[safeMessages.length - 1]
    if (last?.role !== 'user' || !isAppointmentConfirmation(String(last?.content || ''))) return null

    const recentSchedulingContext = findRecentSchedulingContext(safeMessages.slice(0, -1))
    if (!recentSchedulingContext) return null

    const contextText = `${recentSchedulingContext} ${String(last.content || '')}`
    if (!hasAppointmentContext(contextText)) return null

    const date = resolveRelativeAppointmentDate(contextText, getSaoPauloDate())
    const time = extractAppointmentTimeFromText(contextText)
    if (!date || !time) return null

    return { date, time, contextText }
}

export async function saveDetectedAppointment(params: {
    supabase: ReturnType<typeof getSupabase>
    appointment: DetectedAppointment
    broker: any
    leadPhone: string
    senderName?: string | null
    propertyTitle?: string | null
    createdFrom: string
}): Promise<'created' | 'duplicate' | 'failed'> {
    const { supabase, appointment, broker, leadPhone, senderName, propertyTitle, createdFrom } = params
    const { data: existing } = await supabase
        .from('appointments')
        .select('id')
        .eq('lead_phone', leadPhone)
        .eq('appointment_date', appointment.date)
        .eq('appointment_time', appointment.time)
        .neq('status', 'cancelled')
        .limit(1)

    if (existing?.length) return 'duplicate'

    const scheduledStartAt = `${appointment.date}T${appointment.time}:00-03:00`
    const scheduledEndAt = (() => {
        const end = new Date(scheduledStartAt)
        end.setMinutes(end.getMinutes() + 60)
        return end.toISOString()
    })()

    const richPayload = {
        lead_phone: leadPhone,
        lead_name: senderName || null,
        broker_id: broker?.id || null,
        admin_user_id: broker?.admin_user_id || null,
        appointment_date: appointment.date,
        appointment_time: appointment.time,
        appointment_type: 'visita',
        property_title: propertyTitle || null,
        status: 'pending',
        source: 'ai_agent',
        scheduled_start_at: scheduledStartAt,
        scheduled_end_at: scheduledEndAt,
        metadata: {
            created_from: createdFrom,
            detection_text: appointment.contextText.slice(-800),
        },
    }

    const { error } = await supabase.from('appointments').insert([richPayload])
    if (!error) return 'created'

    const fallback = await supabase
        .from('appointments')
        .insert([{
            lead_phone: leadPhone,
            lead_name: senderName || null,
            broker_id: broker?.id || null,
            appointment_date: appointment.date,
            appointment_time: appointment.time,
            appointment_type: 'visita',
            property_title: propertyTitle || null,
            status: 'pending',
        }])

    if (fallback.error) {
        console.warn('[Appointment] Save detected appointment failed:', fallback.error.message)
        return 'failed'
    }
    return 'created'
}

export function buildAppointmentConfirmationText(appointment: DetectedAppointment) {
    const date = new Date(`${appointment.date}T12:00:00-03:00`)
    const dateLabel = date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
    return [
        `Perfeito, deixei esse horario pre-registrado na agenda para ${dateLabel}, as ${appointment.time}.`,
        'Estou confirmando a disponibilidade com o responsavel e te aviso por aqui assim que tiver a liberacao.',
        'Se precisar ajustar endereco, imovel ou horario, e so me avisar.'
    ].join('\n\n')
}

async function buildBrokerAgendaPrompt(brokerId: string | null | undefined): Promise<string> {
    if (!brokerId) return ''
    try {
        const supabase = getSupabase()
        const { data: availability } = await supabase
            .from('broker_weekly_availability')
            .select('weekday, start_time, end_time, slot_minutes, is_active')
            .eq('broker_id', brokerId)
            .eq('is_active', true)
            .order('weekday')

        const activeAvailability = (availability || []).filter((row: any) => row?.is_active)
        if (activeAvailability.length === 0) {
            return '\n\nCONTEXTO DE AGENDA:\n- A agenda real deste corretor ainda nao foi configurada. Se o cliente quiser marcar visita, combine uma preferencia de dia/periodo e diga que vai confirmar a disponibilidade.'
        }

        const today = getSaoPauloDate()
        const from = toDateKey(today)
        const to = toDateKey(addDays(today, 21))

        const [{ data: blocks }, { data: appointments }] = await Promise.all([
            supabase
                .from('broker_schedule_blocks')
                .select('block_date, start_time, end_time')
                .eq('broker_id', brokerId)
                .gte('block_date', from)
                .lte('block_date', to),
            supabase
                .from('appointments')
                .select('appointment_date, appointment_time, scheduled_start_at, status')
                .eq('broker_id', brokerId)
                .gte('appointment_date', from)
                .lte('appointment_date', to)
                .neq('status', 'cancelled'),
        ])

        const blockedByDate = new Map<string, any[]>()
        for (const block of blocks || []) {
            const key = String(block.block_date)
            if (!blockedByDate.has(key)) blockedByDate.set(key, [])
            blockedByDate.get(key)!.push(block)
        }

        const busy = new Set<string>()
        for (const appointment of appointments || []) {
            const date = String(appointment.appointment_date || '')
            const time = String(appointment.appointment_time || '').match(/\d{1,2}:\d{2}/)?.[0]
            if (date && time) busy.add(`${date} ${time.padStart(5, '0')}`)
            if (appointment.scheduled_start_at) {
                const d = new Date(appointment.scheduled_start_at)
                busy.add(`${toDateKey(d)} ${minutesToTime(d.getHours() * 60 + d.getMinutes())}`)
            }
        }

        const slots: BrokerAgendaSlot[] = []
        for (let dayOffset = 0; dayOffset <= 14 && slots.length < 8; dayOffset++) {
            const date = addDays(today, dayOffset)
            const dateKey = toDateKey(date)
            const weekday = date.getDay()
            const row = activeAvailability.find((item: any) => Number(item.weekday) === weekday)
            if (!row) continue

            const start = parseHourMinuteToMinutes(String(row.start_time || '').slice(0, 5))
            const end = parseHourMinuteToMinutes(String(row.end_time || '').slice(0, 5))
            const slotMinutes = Math.max(15, Number(row.slot_minutes || 60))
            if (start == null || end == null || end <= start) continue

            const dayBlocks = blockedByDate.get(dateKey) || []
            for (let minutes = start; minutes + slotMinutes <= end && slots.length < 8; minutes += slotMinutes) {
                const time = minutesToTime(minutes)
                if (dayOffset === 0) {
                    const nowMinutes = today.getHours() * 60 + today.getMinutes()
                    if (minutes <= nowMinutes + 90) continue
                }
                if (busy.has(`${dateKey} ${time}`)) continue

                const blocked = dayBlocks.some((block) => {
                    const blockStart = parseHourMinuteToMinutes(String(block.start_time || '').slice(0, 5))
                    const blockEnd = parseHourMinuteToMinutes(String(block.end_time || '').slice(0, 5))
                    if (blockStart == null || blockEnd == null) return true
                    return minutes < blockEnd && minutes + slotMinutes > blockStart
                })
                if (blocked) continue

                slots.push({
                    label: `${date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} as ${time}`,
                    iso: `${dateKey}T${time}:00-03:00`,
                    date: dateKey,
                    time,
                    durationMinutes: slotMinutes,
                })
            }
        }

        if (slots.length === 0) {
            return '\n\nCONTEXTO DE AGENDA:\n- A agenda real esta configurada, mas nao ha slots livres nos proximos dias. Se o cliente quiser visita, colete preferencia de dia/periodo e diga que vai confirmar com o corretor.'
        }

        return [
            '',
            'CONTEXTO DE AGENDA REAL DO CORRETOR (nao revele como sistema interno):',
            `- Hoje na agenda e ${today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}.`,
            `- Se o lead disser "amanha", considere ${addDays(today, 1).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}.`,
            '- Ofereca visita somente quando o cliente pedir, aceitar ou demonstrar forte intencao de conhecer o imovel.',
            '- Use estes horarios livres como referencia. Ofereca no maximo 2 opcoes por vez, com naturalidade.',
            ...slots.map((slot, index) => `- Slot ${index + 1}: ${slot.label} | marcador: [AGENDAR_VISITA:${slot.iso}|${slot.durationMinutes}|Visita ao imovel]`),
            '',
            'REGRA DE REGISTRO DE VISITA:',
            '- Quando o lead confirmar claramente um desses horarios, inclua o marcador exato no final da resposta.',
            '- Se o lead pedir "amanha" e houver slot livre amanha, use o slot exato de amanha. Nao marque hoje.',
            '- O marcador e interno e sera removido antes do envio ao cliente.',
            '- Nao use marcador se o cliente apenas perguntou disponibilidade ou ainda esta indeciso.',
        ].join('\n')
    } catch (err) {
        console.warn('[Agenda] Failed to build agenda prompt:', err)
        return ''
    }
}

async function saveAppointmentMarkers(params: {
    markers: AppointmentMarker[]
    broker: any
    leadPhone?: string
    senderName?: string
}) {
    const { markers, broker, leadPhone, senderName } = params
    if (!markers.length || !leadPhone || !broker?.id) return

    const supabase = getSupabase()
    for (const marker of markers.slice(0, 1)) {
        const date = marker.iso.split('T')[0]
        const timeMatch = marker.iso.match(/T(\d{2}:\d{2})/)
        const time = timeMatch?.[1] || ''
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time) continue

        const { data: existing } = await supabase
            .from('appointments')
            .select('id')
            .eq('lead_phone', leadPhone)
            .eq('broker_id', broker.id)
            .eq('appointment_date', date)
            .eq('appointment_time', time)
            .neq('status', 'cancelled')
            .limit(1)

        if (existing?.length) continue

        const scheduledStart = marker.iso
        const scheduledEnd = (() => {
            const d = new Date(marker.iso)
            d.setMinutes(d.getMinutes() + marker.durationMinutes)
            return d.toISOString()
        })()

        const richPayload = {
            lead_phone: leadPhone,
            lead_name: senderName || null,
            broker_id: broker.id,
            admin_user_id: broker.admin_user_id || null,
            appointment_date: date,
            appointment_time: time,
            appointment_type: 'visita',
            property_title: marker.title || null,
            status: 'pending',
            source: 'ai_agent',
            scheduled_start_at: scheduledStart,
            scheduled_end_at: scheduledEnd,
            metadata: { created_from: 'whatsapp_agent_marker' },
        }

        const { error } = await supabase.from('appointments').insert([richPayload])
        if (!error) continue

        const fallbackPayload = {
            lead_phone: leadPhone,
            lead_name: senderName || null,
            broker_id: broker.id,
            appointment_date: date,
            appointment_time: time,
            appointment_type: 'visita',
            property_title: marker.title || null,
            status: 'pending',
        }
        const fallback = await supabase.from('appointments').insert([fallbackPayload])
        if (fallback.error) {
            console.warn('[Agenda] Appointment marker insert failed:', fallback.error.message)
        }
    }
}

function buildHandoffSummary(leadPhone: string, messages: any[]): string {
    const safeMessages = Array.isArray(messages) ? messages : []
    const recent = safeMessages.slice(-10)
    const lines = recent.map((m: any) => {
        const who = m?.role === 'assistant' ? 'Atendente' : 'Lead'
        const txt = String(m?.content || '').replace(/\s+/g, ' ').trim()
        if (!txt) return ''
        return `- ${who}: ${txt.length > 180 ? `${txt.slice(0, 180)}...` : txt}`
    }).filter(Boolean)

    const body = lines.length
        ? lines.join('\n')
        : '- Conversa iniciada, sem conteúdo textual suficiente para resumir.'

    return `📋 *Passagem de Plantão (IA → Humano)*\n\n👤 Lead: ${leadPhone}\n\nResumo rápido da conversa:\n${body}\n\n✅ Atendimento humano assumido.`
}

function buildStructuredHandoffSummary(leadPhone: string, conversation: any): string {
    const extracted = conversation?.lead_data_extracted || {}
    const name = extracted?.name || 'Não informado'
    const interest = extracted?.interest || 'Não informado'
    const region = extracted?.region || 'Não informado'
    const budget = extracted?.budget || 'Não informado'
    const timeframe = extracted?.timeframe || 'Não informado'

    const recentMessages = Array.isArray(conversation?.messages) ? conversation.messages.slice(-8) : []
    const timeline = recentMessages.map((m: any) => {
        const who = m?.role === 'assistant' ? 'Atendente' : 'Lead'
        const txt = String(m?.content || '').replace(/\s+/g, ' ').trim()
        if (!txt) return ''
        return `- ${who}: ${txt.length > 140 ? `${txt.slice(0, 140)}...` : txt}`
    }).filter(Boolean).join('\n')

    const heuristicScore = (() => {
        let score = 0
        if (interest && interest !== 'Não informado') score += 25
        if (region && region !== 'Não informado') score += 20
        if (budget && budget !== 'Não informado') score += 25
        if (timeframe && timeframe !== 'Não informado') score += 15
        if (Array.isArray(conversation?.messages) && conversation.messages.length >= 6) score += 15
        return Math.min(100, score)
    })()
    const priority = heuristicScore >= 70 ? 'Quente' : heuristicScore >= 45 ? 'Morno' : 'Frio'

    return [
        '📋 *Passagem de Plantão (IA → Humano)*',
        '',
        `👤 Lead: ${name}`,
        `📱 Telefone: ${leadPhone}`,
        `🎯 Interesse: ${interest}`,
        `📍 Região: ${region}`,
        `💰 Orçamento: ${budget}`,
        `⏱️ Prazo: ${timeframe}`,
        `🔥 Prioridade: ${priority} (${heuristicScore}/100)`,
        '',
        'Resumo das últimas interações:',
        timeline || '- Sem conteúdo textual suficiente.',
        '',
        'Próximo passo sugerido:',
        '- Fazer contato humano imediato, confirmar critérios e avançar para visita/proposta.',
    ].join('\n')
}

async function sendHandoffSummaryIfNeeded(
    supabase: ReturnType<typeof getSupabase>,
    params: {
        conversation: any
        instanceId: string
        instanceToken: string
        recipientPhone: string
        markerSuffix: string
    }
) {
    const { conversation, instanceId, instanceToken, recipientPhone, markerSuffix } = params
    if (!conversation?.id || !conversation?.broker_id || !instanceToken) return false

    const markerKey = `_handoff_${conversation.id}_${markerSuffix}`
    const { data: existingMarker } = await supabase
        .from('app_config')
        .select('key')
        .eq('key', markerKey)
        .maybeSingle()
    if (existingMarker?.key) return false

    const handoffPhone = await resolveSummaryTargetPhone(
        supabase,
        conversation.broker_id,
        instanceId,
        recipientPhone
    )
    if (!handoffPhone || handoffPhone === recipientPhone) return false

    const summary = buildStructuredHandoffSummary(conversation.lead_phone || recipientPhone, conversation)
    await sendWhatsAppMessage({
        phone: handoffPhone,
        message: summary,
        instanceToken,
    }).catch((err) => {
        console.warn('[Handoff] Failed to send summary:', err)
    })

    try {
        await supabase.from('app_config').upsert({
            key: markerKey,
            value: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
    } catch {
        // best effort marker
    }

    return true
}

async function resolveSummaryTargetPhone(
    supabase: ReturnType<typeof getSupabase>,
    brokerId: string,
    instanceId: string,
    recipientPhone: string
): Promise<string> {
    const { data: broker } = await supabase
        .from('virtual_brokers')
        .select('phone, transfer_to_phone, summary_to_phone')
        .eq('id', brokerId)
        .maybeSingle()

    const { data: inst } = await supabase
        .from('whatsapp_instances')
        .select('phone_number')
        .eq('id', instanceId)
        .maybeSingle()

    const candidates = [
        broker?.summary_to_phone,
        inst?.phone_number,
        broker?.transfer_to_phone,
        broker?.phone,
    ].map(v => String(v || '').replace(/\D/g, '')).filter(Boolean)

    const recipient = String(recipientPhone || '').replace(/\D/g, '')
    const firstValid = candidates.find(c => c && c !== recipient)
    return firstValid || ''
}

function buildShiftConsolidatedSummary(conversations: any[], timezone: string): string {
    const safe = Array.isArray(conversations) ? conversations : []
    const header = `📊 *Resumo Consolidado do Plantão IA*\n🕒 Fuso: ${timezone}\n👥 Atendimentos: ${safe.length}\n`
    if (safe.length === 0) {
        return `${header}\nNenhum atendimento registrado neste turno.`
    }

    const lines: string[] = []
    for (const conv of safe.slice(0, 20)) {
        const d = conv?.lead_data_extracted || {}
        const leadName = d?.name || 'Lead sem nome'
        const leadPhone = conv?.lead_phone || 'sem telefone'
        const interest = d?.interest || 'não informado'
        const region = d?.region || 'não informada'
        const budget = d?.budget || 'não informado'
        const score = typeof conv?.qualification_score === 'number' ? conv.qualification_score : null
        const priority = score != null ? (score >= 70 ? 'quente' : score >= 45 ? 'morno' : 'frio') : 'indefinida'
        lines.push(`- ${leadName} (${leadPhone}) | ${interest} | ${region} | orçamento: ${budget} | prioridade: ${priority}`)
    }

    const truncated = safe.length > 20 ? `\n...e mais ${safe.length - 20} atendimento(s).` : ''
    return `${header}\n${lines.join('\n')}${truncated}\n\n✅ Recomendação: priorize contatos *quentes* primeiro.`
}

async function sendShiftConsolidatedSummaryIfNeeded(
    supabase: ReturnType<typeof getSupabase>,
    params: {
        brokerId: string
        instanceId: string
        instanceToken: string
        timezone: string
        markerSuffix: string
    }
) {
    const { brokerId, instanceId, instanceToken, timezone, markerSuffix } = params
    if (!brokerId || !instanceToken) return false

    const markerKey = `_handoff_shift_${instanceId}_${markerSuffix}`
    const { data: marker } = await supabase
        .from('app_config')
        .select('key')
        .eq('key', markerKey)
        .maybeSingle()
    if (marker?.key) return false

    // recipientPhone not relevant here; use empty to only avoid impossible self-recipient collision.
    const handoffPhone = await resolveSummaryTargetPhone(supabase, brokerId, instanceId, '')
    if (!handoffPhone) return false

    const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const { data: conversations } = await supabase
        .from('whatsapp_ai_conversations')
        .select('id, lead_phone, messages, updated_at')
        .eq('instance_id', instanceId)
        .eq('broker_id', brokerId)
        .gte('updated_at', windowStart)
        .order('updated_at', { ascending: false })
        .limit(50)

    const summary = buildShiftConsolidatedSummary(conversations || [], timezone)
    await sendWhatsAppMessage({
        phone: handoffPhone,
        message: summary,
        instanceToken,
    }).catch((err) => {
        console.warn('[Handoff Shift] Failed to send consolidated summary:', err)
    })

    try {
        await supabase.from('app_config').upsert({
            key: markerKey,
            value: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
    } catch {
        // best effort marker
    }

    return true
}

async function pickTransferTargetInstance(
    supabase: ReturnType<typeof getSupabase>,
    sourceInstanceId: string,
    transferConfig: Record<string, string>
) {
    const defaultInstanceId = transferConfig['agent_default_instance_id'] || ''
    const mode = (transferConfig['agent_transfer_mode'] || 'round_robin').toLowerCase()
    let targetIds: string[] = []
    try {
        const parsed = JSON.parse(transferConfig['agent_transfer_instance_ids'] || '[]')
        if (Array.isArray(parsed)) targetIds = parsed.filter(Boolean)
    } catch {
        targetIds = []
    }

    // Only default triage instance can distribute to queue.
    if (!defaultInstanceId || sourceInstanceId !== defaultInstanceId) return null
    if (targetIds.length === 0) return null

    const { data: candidates } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_token, phone_number, status, broker_id')
        .in('id', targetIds)

    const valid = (candidates || [])
        .filter((i: any) => i.id !== sourceInstanceId && i.status === 'connected' && i.instance_token && i.phone_number)
        .sort((a: any, b: any) => targetIds.indexOf(a.id) - targetIds.indexOf(b.id))

    if (valid.length === 0) return null
    if (mode === 'fixed') return valid[0]

    const rrKey = 'agent_transfer_rr_index'
    const { data: rr } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', rrKey)
        .maybeSingle()
    let idx = parseInt(rr?.value || transferConfig[rrKey] || '0', 10)
    if (!Number.isFinite(idx) || idx < 0) idx = 0
    const chosen = valid[idx % valid.length]
    const next = String((idx + 1) % valid.length)
    try {
        await supabase.from('app_config').upsert({
            key: rrKey,
            value: next,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
    } catch {}
    return chosen
}

function normalizeTextForMatch(value: string): string {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

async function pickTransferTargetByEmpreendimento(
    supabase: ReturnType<typeof getSupabase>,
    contextText: string
) {
    const normalized = normalizeTextForMatch(contextText)
    if (!normalized) return null

    const { data: empreendimentos } = await supabase
        .from('empreendimentos')
        .select('id, nome, slug, ativo')
        .eq('ativo', true)

    if (!empreendimentos || empreendimentos.length === 0) return null

    let matched: any = null
    for (const e of empreendimentos) {
        const nome = normalizeTextForMatch(String((e as any).nome || ''))
        const slug = normalizeTextForMatch(String((e as any).slug || ''))
        if ((nome && normalized.includes(nome)) || (slug && normalized.includes(slug))) {
            matched = e
            break
        }
    }
    if (!matched) return null

    const { data: links } = await supabase
        .from('broker_empreendimentos')
        .select('prioridade, broker_id')
        .eq('empreendimento_id', (matched as any).id)
        .eq('ativo', true)
        .order('prioridade', { ascending: true })
        .limit(10)

    if (!links || links.length === 0) return null

    const brokerIds = links.map((l: any) => l.broker_id).filter(Boolean)
    const { data: brokers } = await supabase
        .from('virtual_brokers')
        .select('id, name, is_active')
        .in('id', brokerIds)
        .eq('is_active', true)

    const activeBrokerMap = new Map((brokers || []).map((b: any) => [b.id, b]))
    const orderedActiveBrokerIds = brokerIds.filter((id: string) => activeBrokerMap.has(id))
    if (orderedActiveBrokerIds.length === 0) return null

    const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_token, phone_number, status, broker_id')
        .in('broker_id', orderedActiveBrokerIds)
        .eq('status', 'connected')

    if (!instances || instances.length === 0) return null

    // Keep priority order from broker_empreendimentos
    const first = orderedActiveBrokerIds.find((bid: string) => instances.some((i: any) => i.broker_id === bid))
    if (!first) return null
    const inst = instances.find((i: any) => i.broker_id === first)
    const broker = activeBrokerMap.get(first)
    if (!inst?.instance_token || !inst?.phone_number || !broker) return null

    return {
        source: 'empreendimento',
        empreendimento: matched,
        broker,
        instance: inst,
    }
}

async function appendConversationMessage(
    supabase: ReturnType<typeof getSupabase>,
    conversationId: string,
    message: { role: 'user' | 'assistant'; content: string; type?: string; source?: string }
) {
    const { data: conv } = await supabase
        .from('whatsapp_ai_conversations')
        .select('messages')
        .eq('id', conversationId)
        .maybeSingle()

    const current = Array.isArray(conv?.messages) ? conv.messages : []
    current.push({
        role: message.role,
        content: message.content,
        type: message.type || 'text',
        source: message.source || null,
        timestamp: new Date().toISOString(),
    })

    await supabase
        .from('whatsapp_ai_conversations')
        .update({ messages: current, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export async function loadAIConfigs(supabase: ReturnType<typeof getSupabase>, instanceId?: string) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'ai_provider', 'gemini_api_key', 'openai_api_key',
            'whatsapp_provider', 'gemini_whatsapp_model', 'openai_whatsapp_model',
            'whatsapp_audio_enabled', 'whatsapp_tts_provider', 'whatsapp_tts_voice',
            'elevenlabs_api_key',
            // Global fallback settings
            'whatsapp_always_online', 'whatsapp_mark_as_read',
            'whatsapp_transcription_enabled', 'whatsapp_human_intervention',
            'whatsapp_human_intervention_minutes', 'whatsapp_mirror_mode',
            'whatsapp_response_mode',
            'whatsapp_media_image_enabled', 'whatsapp_media_document_enabled', 'whatsapp_media_video_enabled',
            'whatsapp_media_batch_image_limit', 'whatsapp_media_batch_video_limit', 'whatsapp_media_batch_document_limit',
            'whatsapp_detect_human_request_enabled', 'whatsapp_detect_reschedule_cancel_enabled',
            'whatsapp_detect_property_capture_enabled', 'whatsapp_detect_location_enabled',
            'whatsapp_detect_opt_out_enabled', 'whatsapp_analyze_links_enabled',
            'whatsapp_quoted_reply_context_enabled', 'whatsapp_lead_file_storage_enabled',
            'whatsapp_agent_enabled', 'whatsapp_split_messages',
            'whatsapp_adaptive_rapport_enabled', 'whatsapp_adaptive_rapport_mode',
            'whatsapp_debounce_seconds',
            'whatsapp_smart_timing_enabled', 'whatsapp_timing_text_seconds', 'whatsapp_timing_text_burst_seconds',
            'whatsapp_timing_media_caption_seconds', 'whatsapp_timing_media_then_text_seconds', 'whatsapp_timing_media_only_seconds',
            'whatsapp_timing_audio_seconds', 'whatsapp_timing_audio_then_text_seconds',
            'whatsapp_timing_video_caption_seconds', 'whatsapp_timing_video_only_seconds',
            'whatsapp_timing_document_caption_seconds', 'whatsapp_timing_document_only_seconds',
            'whatsapp_timing_document_seconds', 'whatsapp_timing_video_document_seconds',
            'whatsapp_timing_button_delay_seconds',
            'whatsapp_ai_schedule_enabled', 'whatsapp_ai_schedule_start', 'whatsapp_ai_schedule_end', 'whatsapp_ai_schedule_timezone',
            // Agent operational settings from admin panel
            'agent_default_instance_id', 'agent_transfer_instance_ids', 'agent_transfer_mode', 'agent_transfer_rr_index',
            'agent_company_name', 'agent_company_creci', 'agent_company_phone', 'agent_company_description', 'agent_company_location_url',
            'agent_social_instagram', 'agent_social_facebook', 'agent_social_youtube',
            'agent_social_linkedin', 'agent_social_tiktok', 'agent_social_site', 'agent_link_buttons'
        ])

    const map: Record<string, string> = {}
    data?.forEach((c: any) => { map[c.key] = c.value })

    // Merge per-instance config (overrides global settings)
    if (instanceId) {
        try {
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('config')
                .eq('id', instanceId)
                .single()

            if (inst?.config && typeof inst.config === 'object') {
                const cfg = inst.config as Record<string, any>
                // Map instance config keys to global config keys
                const keyMap: Record<string, string> = {
                    agent_enabled: 'whatsapp_agent_enabled',
                    always_online: 'whatsapp_always_online',
                    mark_as_read: 'whatsapp_mark_as_read',
                    response_mode: 'whatsapp_response_mode',
                    media_image_enabled: 'whatsapp_media_image_enabled',
                    media_document_enabled: 'whatsapp_media_document_enabled',
                    media_video_enabled: 'whatsapp_media_video_enabled',
                    media_batch_image_limit: 'whatsapp_media_batch_image_limit',
                    media_batch_video_limit: 'whatsapp_media_batch_video_limit',
                    media_batch_document_limit: 'whatsapp_media_batch_document_limit',
                    detect_human_request_enabled: 'whatsapp_detect_human_request_enabled',
                    detect_reschedule_cancel_enabled: 'whatsapp_detect_reschedule_cancel_enabled',
                    detect_property_capture_enabled: 'whatsapp_detect_property_capture_enabled',
                    detect_location_enabled: 'whatsapp_detect_location_enabled',
                    detect_opt_out_enabled: 'whatsapp_detect_opt_out_enabled',
                    analyze_links_enabled: 'whatsapp_analyze_links_enabled',
                    quoted_reply_context_enabled: 'whatsapp_quoted_reply_context_enabled',
                    lead_file_storage_enabled: 'whatsapp_lead_file_storage_enabled',
                    split_messages: 'whatsapp_split_messages',
                    adaptive_rapport_enabled: 'whatsapp_adaptive_rapport_enabled',
                    adaptive_rapport_mode: 'whatsapp_adaptive_rapport_mode',
                    mirror_mode: 'whatsapp_mirror_mode',
                    audio_response: 'whatsapp_audio_enabled',
                    audio_transcription: 'whatsapp_transcription_enabled',
                    human_intervention: 'whatsapp_human_intervention',
                    debounce_seconds: 'whatsapp_debounce_seconds',
                    smart_timing_enabled: 'whatsapp_smart_timing_enabled',
                    timing_text_seconds: 'whatsapp_timing_text_seconds',
                    timing_text_burst_seconds: 'whatsapp_timing_text_burst_seconds',
                    timing_media_caption_seconds: 'whatsapp_timing_media_caption_seconds',
                    timing_media_then_text_seconds: 'whatsapp_timing_media_then_text_seconds',
                    timing_media_only_seconds: 'whatsapp_timing_media_only_seconds',
                    timing_audio_seconds: 'whatsapp_timing_audio_seconds',
                    timing_audio_then_text_seconds: 'whatsapp_timing_audio_then_text_seconds',
                    timing_video_caption_seconds: 'whatsapp_timing_video_caption_seconds',
                    timing_video_only_seconds: 'whatsapp_timing_video_only_seconds',
                    timing_document_caption_seconds: 'whatsapp_timing_document_caption_seconds',
                    timing_document_only_seconds: 'whatsapp_timing_document_only_seconds',
                    timing_document_seconds: 'whatsapp_timing_document_seconds',
                    timing_video_document_seconds: 'whatsapp_timing_video_document_seconds',
                    timing_button_delay_seconds: 'whatsapp_timing_button_delay_seconds',
                    human_intervention_minutes: 'whatsapp_human_intervention_minutes',
                    ai_schedule_enabled: 'whatsapp_ai_schedule_enabled',
                    ai_schedule_start: 'whatsapp_ai_schedule_start',
                    ai_schedule_end: 'whatsapp_ai_schedule_end',
                    ai_schedule_timezone: 'whatsapp_ai_schedule_timezone',
                }
                for (const [instKey, globalKey] of Object.entries(keyMap)) {
                    if (cfg[instKey] !== undefined) {
                        map[globalKey] = String(cfg[instKey])
                    }
                }
                console.log(`[WhatsApp Agent] Loaded per-instance config for ${instanceId}`)
            }
        } catch { /* instance config not available, use global */ }
    }

    return map
}

type PendingQueueMessage = {
    text: string
    type?: string
    mediaType?: string | null
    hasMedia?: boolean
    hasCaption?: boolean
    messageId?: string | null
    mediaUrl?: string | null
    mediaMimetype?: string | null
    mediaFilename?: string | null
    createdAt?: string | null
    updatedAt?: string | null
}

function parsePendingQueueValue(raw: any, updatedAt?: string | null): PendingQueueMessage {
    const fallbackText = String(raw || '').trim()
    if (!fallbackText) return { text: '', type: 'text', updatedAt: updatedAt || null }

    try {
        const parsed = JSON.parse(fallbackText)
        if (parsed && typeof parsed === 'object') {
            return {
                text: String(parsed.text || '').trim(),
                type: parsed.type ? String(parsed.type) : 'text',
                mediaType: parsed.mediaType ? String(parsed.mediaType) : null,
                hasMedia: Boolean(parsed.hasMedia),
                hasCaption: Boolean(parsed.hasCaption),
                messageId: parsed.messageId ? String(parsed.messageId) : null,
                mediaUrl: parsed.mediaUrl ? String(parsed.mediaUrl) : null,
                mediaMimetype: parsed.mediaMimetype ? String(parsed.mediaMimetype) : null,
                mediaFilename: parsed.mediaFilename ? String(parsed.mediaFilename) : null,
                createdAt: parsed.createdAt ? String(parsed.createdAt) : null,
                updatedAt: updatedAt || null,
            }
        }
    } catch {
        // Older queue entries are plain strings.
    }

    return { text: fallbackText, type: 'text', updatedAt: updatedAt || null }
}

function configNumber(configs: Record<string, string>, key: string, fallback: number, min = 1, max = 240): number {
    const raw = parseInt(configs[key] || '', 10)
    const value = Number.isFinite(raw) ? raw : fallback
    return Math.max(min, Math.min(max, value))
}

function configEnabled(configs: Record<string, string>, key: string, fallback = true): boolean {
    const raw = configs[key]
    if (raw === undefined || raw === null || raw === '') return fallback
    return raw !== 'false'
}

function agentLogErrorText(error: unknown): string | null {
    if (!error) return null
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    try {
        return JSON.stringify(error).slice(0, 1000)
    } catch {
        return String(error)
    }
}

function normalizeAgentLogPayload(payload?: Record<string, unknown> | null): Record<string, unknown> {
    if (!payload) return {}
    try {
        return JSON.parse(JSON.stringify(payload))
    } catch {
        return { serialization_error: true }
    }
}

async function recordAgentLog(
    supabase: ReturnType<typeof getSupabase>,
    params: {
        action: string
        instanceName?: string | null
        messageType?: string | null
        fromPhone?: string | null
        senderName?: string | null
        statusCode?: number
        payload?: Record<string, unknown> | null
        error?: unknown
    }
) {
    const createdAt = new Date().toISOString()
    const payload = normalizeAgentLogPayload(params.payload)
    const errorText = agentLogErrorText(params.error)
    const fallbackKey = `_agentlog_${createdAt.replace(/\D/g, '')}_${crypto.randomBytes(4).toString('hex')}`
    const fallbackEntry = {
        id: fallbackKey,
        created_at: createdAt,
        instance_name: params.instanceName || null,
        event_type: 'agent_runtime',
        message_type: params.messageType || null,
        action: params.action,
        status_code: params.statusCode || 200,
        from_phone: params.fromPhone || null,
        sender_name: params.senderName || null,
        payload,
        error: errorText,
    }

    try {
        await supabase.from('app_config').insert({
            key: fallbackKey,
            value: JSON.stringify(fallbackEntry),
            updated_at: createdAt,
        })
    } catch (e) {
        console.warn('[WhatsApp Agent][Audit] Failed to save app_config agent log:', e)
    }

    try {
        await supabase.from('whatsapp_webhook_audit_logs').insert({
            instance_name: params.instanceName || null,
            event_type: 'agent_runtime',
            message_type: params.messageType || null,
            action: params.action,
            status_code: params.statusCode || 200,
            is_from_me: false,
            from_phone: params.fromPhone || null,
            sender_name: params.senderName || null,
            payload,
            media: [],
            error: errorText,
        })
    } catch (e) {
        console.warn('[WhatsApp Agent][Audit] Failed to save agent log:', e)
    }
}

function detectControlledLeadIntent(text: string, configs: Record<string, string>): 'opt_out' | 'human_request' | null {
    const normalized = normalizeForSearch(text)
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (!normalized) return null

    if (configEnabled(configs, 'whatsapp_detect_opt_out_enabled')) {
        const optOutPatterns = [
            /\bnao me chama mais\b/,
            /\bnao me mande mais\b/,
            /\bpare de me chamar\b/,
            /\bpare de mandar\b/,
            /\bremove meu numero\b/,
            /\bremover meu numero\b/,
            /\bsair da lista\b/,
            /\bdescadastrar\b/,
            /\bcancelar recebimento\b/,
            /\bstop\b/,
            /\bunsubscribe\b/,
        ]
        if (optOutPatterns.some((pattern) => pattern.test(normalized))) return 'opt_out'
    }

    if (configEnabled(configs, 'whatsapp_detect_human_request_enabled')) {
        const humanPatterns = [
            /\bquero falar com (um |uma )?(humano|pessoa|atendente|corretor|consultor)\b/,
            /\bme passa (para|pra) (um |uma )?(humano|pessoa|atendente|corretor|consultor)\b/,
            /\btem alguem real\b/,
            /\bpessoa real\b/,
            /\bcorretor humano\b/,
            /\bnao quero falar com (robo|bot|ia)\b/,
            /\bvoce e (robo|bot|ia)\b/,
            /\bchama o corretor\b/,
        ]
        if (humanPatterns.some((pattern) => pattern.test(normalized))) return 'human_request'
    }

    return null
}

function buildSpecialLeadScenarioPrompt(configs: Record<string, string>): string {
    const rules: string[] = []

    if (configEnabled(configs, 'whatsapp_detect_human_request_enabled')) {
        rules.push('- Se o lead pedir uma pessoa real, atendente ou corretor humano, acolha sem discutir. Diga que vai acionar a equipe/corretor e mantenha a resposta curta.')
    }
    if (configEnabled(configs, 'whatsapp_detect_reschedule_cancel_enabled')) {
        rules.push('- Se o lead pedir para remarcar, cancelar ou mudar horario de visita, entenda a intencao pelo contexto. Confirme dia e horario com clareza e nao trate como conversa nova.')
    }
    if (configEnabled(configs, 'whatsapp_detect_property_capture_enabled')) {
        rules.push('- Se o lead quiser vender, anunciar, avaliar ou dar um imovel como parte de pagamento, mude para modo captacao: pergunte cidade/bairro, tipo, fotos, valor pretendido e se aceita avaliacao.')
    }
    if (configEnabled(configs, 'whatsapp_detect_location_enabled')) {
        rules.push('- Se o lead enviar localizacao ou falar que esta perto de uma regiao, use isso como contexto para sugerir imoveis, visitas ou deslocamento.')
    }
    if (configEnabled(configs, 'whatsapp_detect_opt_out_enabled')) {
        rules.push('- Se o lead pedir para parar contato, cancelar mensagens ou remover o numero, responda apenas confirmando que vai respeitar e nao tente vender.')
    }
    if (configEnabled(configs, 'whatsapp_analyze_links_enabled')) {
        rules.push('- Se o lead enviar link de imovel, site, anuncio ou rede social, trate como contexto. Compare com o que ele busca e pergunte o que chamou atencao se o link nao trouxer dados suficientes.')
    }
    if (configEnabled(configs, 'whatsapp_quoted_reply_context_enabled')) {
        rules.push('- Se a mensagem vier como resposta/citacao de uma mensagem anterior, considere a mensagem citada para entender "esse", "aquele", "sim", "pode" ou "quero".')
    }
    if (configEnabled(configs, 'whatsapp_lead_file_storage_enabled')) {
        rules.push('- Considere fotos, videos, audios e documentos enviados como parte do arquivo do lead. Use essas informacoes para continuidade futura, sem pedir tudo de novo.')
    }

    if (!rules.length) return ''
    return `\n\nCENARIOS ESPECIAIS CONTROLADOS PELO ADMIN:\n${rules.join('\n')}`
}

function isMeaningfulUserText(text?: string | null): boolean {
    const value = String(text || '').trim()
    if (!value) return false
    if (/^\[(audio|image|imagem|video|document|documento|midia|m[ií]dia)/i.test(value)) return false
    return true
}

function describePendingMediaBatch(items: PendingQueueMessage[]): string {
    const counts = { image: 0, video: 0, document: 0 }
    for (const item of items) {
        if (!item.hasMedia) continue
        const kind = normalizePendingMediaKind(item.mediaType || item.type || null)
        if (kind) counts[kind] += 1
    }

    const labels: string[] = []
    if (counts.image) labels.push(`${counts.image} ${counts.image === 1 ? 'imagem' : 'imagens'}`)
    if (counts.video) labels.push(`${counts.video} ${counts.video === 1 ? 'video' : 'videos'}`)
    if (counts.document) labels.push(`${counts.document} ${counts.document === 1 ? 'documento' : 'documentos'}`)
    return labels.join(', ')
}

function buildPendingInputText(items: PendingQueueMessage[], fallbackText?: string | null): string {
    const mediaLabel = describePendingMediaBatch(items)
    const captions = items
        .map(item => String(item.text || '').trim())
        .filter(text => isMeaningfulUserText(text))

    const parts: string[] = []
    if (mediaLabel) parts.push(`[O usuario enviou ${mediaLabel}]`)
    parts.push(...captions)

    if (parts.length > 0) return parts.join('\n')
    return String(fallbackText || '').trim()
}

function inferPendingHistoryType(items: PendingQueueMessage[], fallbackType?: string | null): string {
    const mediaKinds = Array.from(new Set(
        items
            .filter(item => item.hasMedia)
            .map(item => normalizePendingMediaKind(item.mediaType || item.type || null))
            .filter(Boolean) as string[]
    ))
    if (mediaKinds.length > 1) return 'media_batch'
    if (mediaKinds.length === 1) return mediaKinds[0]
    return String(fallbackType || 'text')
}

function selectInteractionTiming(configs: Record<string, string>, params: {
    isAudio: boolean
    isMediaMessage: boolean
    mediaType?: string | null
    currentText?: string | null
    pending: PendingQueueMessage[]
}): { seconds: number; scenario: string } {
    const fallback = configNumber(configs, 'whatsapp_debounce_seconds', 15, 1, 180)
    const smartEnabled = configs['whatsapp_smart_timing_enabled'] !== 'false'
    if (!smartEnabled) return { seconds: fallback, scenario: 'fallback' }

    const pendingTextCount = params.pending.filter(item => isMeaningfulUserText(item.text)).length
    const hasPendingText = pendingTextCount > 0
    const hasCaption = isMeaningfulUserText(params.currentText)
    const kind = String(params.mediaType || '').toLowerCase()

    if (params.isAudio) {
        if (hasPendingText) {
            return { seconds: configNumber(configs, 'whatsapp_timing_audio_then_text_seconds', 14, 3, 180), scenario: 'audio_then_text' }
        }
        return { seconds: configNumber(configs, 'whatsapp_timing_audio_seconds', 10, 3, 180), scenario: 'audio' }
    }

    if (params.isMediaMessage) {
        const legacyVideoDocument = configNumber(configs, 'whatsapp_timing_video_document_seconds', 18, 5, 240)
        if (kind === 'video') {
            if (hasCaption || hasPendingText) {
                return { seconds: configNumber(configs, 'whatsapp_timing_video_caption_seconds', legacyVideoDocument, 5, 240), scenario: 'video_with_text' }
            }
            return { seconds: configNumber(configs, 'whatsapp_timing_video_only_seconds', legacyVideoDocument, 5, 240), scenario: 'video_only' }
        }
        if (kind === 'document') {
            const legacyDocument = configNumber(configs, 'whatsapp_timing_document_seconds', legacyVideoDocument, 5, 240)
            if (hasCaption || hasPendingText) {
                return { seconds: configNumber(configs, 'whatsapp_timing_document_caption_seconds', legacyDocument, 5, 240), scenario: 'document_with_text' }
            }
            return { seconds: configNumber(configs, 'whatsapp_timing_document_only_seconds', legacyDocument, 5, 240), scenario: 'document_only' }
        }
        if (hasPendingText && !hasCaption) {
            return { seconds: configNumber(configs, 'whatsapp_timing_media_then_text_seconds', 14, 5, 180), scenario: 'media_then_text' }
        }
        if (hasCaption || hasPendingText) {
            return { seconds: configNumber(configs, 'whatsapp_timing_media_caption_seconds', 10, 5, 180), scenario: 'media_caption' }
        }
        return { seconds: configNumber(configs, 'whatsapp_timing_media_only_seconds', 16, 5, 180), scenario: 'media_only' }
    }

    if (pendingTextCount > 1) {
        return { seconds: configNumber(configs, 'whatsapp_timing_text_burst_seconds', 9, 2, 180), scenario: 'text_burst' }
    }

    return { seconds: configNumber(configs, 'whatsapp_timing_text_seconds', 6, 1, 120), scenario: 'text' }
}

// Split long text into human-like message chunks
export function splitIntoHumanChunks(text: string): string[] {
    // Don't split short messages
    if (text.length <= 90) return [text]

    // Split on sentence boundaries: . ! ? followed by space or newline
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter(s => s.trim())
    if (sentences.length <= 1) return [text]

    // Group sentences into compact WhatsApp-sized chunks.
    const chunks: string[] = []
    let current = ''

    for (const sentence of sentences) {
        if (current && (current.length + sentence.length + 1) > 95) {
            chunks.push(current.trim())
            current = sentence
        } else {
            current = current ? current + ' ' + sentence : sentence
        }
    }
    if (current.trim()) chunks.push(current.trim())

    // Limit to max 6 chunks to avoid spamming, but keep messages shorter.
    if (chunks.length > 6) {
        const merged: string[] = []
        const perGroup = Math.ceil(chunks.length / 6)
        for (let i = 0; i < chunks.length; i += perGroup) {
            merged.push(chunks.slice(i, i + perGroup).join(' '))
        }
        return merged
    }

    return chunks
}

function extractOutboundMessageId(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null
    const candidates = [
        payload?.id, payload?.messageId, payload?.key?.id,
        payload?.data?.id, payload?.data?.messageId, payload?.data?.key?.id,
        payload?.response?.id, payload?.response?.messageId, payload?.response?.key?.id,
    ]
    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return null
}

export async function trackBotMessageId(
    supabase: ReturnType<typeof getSupabase>,
    conversationId: string,
    currentIds: string[],
    sendResult: any
): Promise<string[]> {
    const outboundId = extractOutboundMessageId(sendResult)
    if (!outboundId || currentIds.includes(outboundId)) return currentIds
    const nextIds = [...currentIds, outboundId].slice(-150)
    await supabase
        .from('whatsapp_ai_conversations')
        .update({ bot_message_ids: nextIds, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    return nextIds
}

interface InteractiveElements {
    cleanText: string
    buttons?: { title: string; options: string[] }
    urlButtons?: { title: string; items: { text: string; url: string }[] }
    list?: { buttonText: string; sections: { title: string; rows: { title: string; id: string; description?: string }[] }[] }
    poll?: { question: string; options: string[]; multiSelect?: boolean }
    locationRequest?: boolean
    pix?: { pixKey: string; pixName: string; pixType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' }
    carousel?: { text: string; cards: { text: string; image?: string; buttons: { id: string; text: string; type: 'REPLY' | 'URL' | 'CALL' | 'COPY' }[] }[] }
}

function sanitizeInteractiveUrl(rawUrl: string): string {
    const url = String(rawUrl || '').trim()
    if (!url) return ''

    const propertyMatch = url.match(/^(https?:\/\/[^/\s]+)?\/imovel\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\?[^ \]]*)?/i)
    if (propertyMatch) {
        return `${propertyMatch[1] || getPublicAppUrl()}/imovel/${propertyMatch[2]}${propertyMatch[3] || ''}`
    }

    if (url.length > 500) return ''
    return url
}

function buildTrackedUrlButtonChoices(
    items: { text: string; url: string }[],
    leadPhone: string | undefined,
    title?: string
): string[] {
    return items.map(item => {
        const trackedUrl = buildTrackedWhatsAppLink({
            url: item.url,
            leadPhone,
            label: item.text,
            title,
        })
        return `${item.text}|url:${trackedUrl}`
    })
}

function buildTrackedUrlFallbackText(
    items: { text: string; url: string }[],
    leadPhone: string | undefined,
    title?: string
): string {
    return items.map(item => {
        const trackedUrl = buildTrackedWhatsAppLink({
            url: item.url,
            leadPhone,
            label: item.text,
            title,
        })
        return `${item.text}: ${trackedUrl}`
    }).join('\n')
}

function buildTrackedCarouselCards(cards: NonNullable<InteractiveElements['carousel']>['cards'], leadPhone: string | undefined) {
    return cards.map(card => ({
        ...card,
        buttons: card.buttons.map(button => {
            if (button.type !== 'URL' || !/^https?:\/\//i.test(button.id)) return button
            return {
                ...button,
                id: buildTrackedWhatsAppLink({
                    url: button.id,
                    leadPhone,
                    label: button.text,
                    title: 'Carrossel',
                    type: 'carousel',
                    campaign: 'carousel_button',
                }),
            }
        }),
    }))
}

export function parseInteractiveElements(text: string): InteractiveElements {
    let cleanText = text

    // ── Parse [BOTOES_URL:titulo|Texto=>https://url|Texto2=>https://url2] ──
    let urlButtons: InteractiveElements['urlButtons'] | undefined
    const urlButtonMatches = Array.from(cleanText.matchAll(/\[BOTOES_URL:([^\]]+)\]/gi))
    if (urlButtonMatches.length > 0) {
        const collectedItems: { text: string; url: string }[] = []
        let firstTitle = ''

        for (const match of urlButtonMatches) {
            const parts = match[1].split('|').map(s => s.trim()).filter(Boolean)
            const title = parts[0] || 'Abrir link'
            if (!firstTitle) firstTitle = title

            for (const part of parts.slice(1)) {
                const separatorIndex = part.indexOf('=>')
                const textPart = separatorIndex >= 0 ? part.slice(0, separatorIndex).trim() : ''
                const urlPart = separatorIndex >= 0 ? part.slice(separatorIndex + 2).trim() : part.trim()
                const url = sanitizeInteractiveUrl(urlPart || '')
                if (!url || !/^https?:\/\//i.test(url)) continue
                collectedItems.push({
                    text: (textPart || title || 'Abrir').substring(0, 20),
                    url,
                })
            }
        }

        const seen = new Set<string>()
        const uniqueItems = collectedItems.filter((item) => {
            const key = item.url
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        const items = uniqueItems
            .map((item, index) => {
                const repeated = uniqueItems.filter(other => other.text.toLowerCase() === item.text.toLowerCase()).length > 1
                return repeated
                    ? { ...item, text: `${item.text.substring(0, 17)} ${index + 1}`.substring(0, 20).trim() }
                    : item
            })
            .slice(0, 3)

        if (items.length > 0) {
            urlButtons = { title: items.length > 1 ? 'Ver opcoes' : (firstTitle || 'Abrir link'), items }
        }
        cleanText = cleanText.replace(/\[BOTOES_URL:[^\]]+\]/gi, '').trim()
    }

    // ── Parse [BOTOES:titulo|op1|op2|op3] ──
    const btnMatch = cleanText.match(/\[BOTOES:([^\]]+)\]/i)
    let buttons: InteractiveElements['buttons'] | undefined
    if (btnMatch) {
        const parts = btnMatch[1].split('|').map(s => s.trim())
        const title = parts[0] || 'Escolha uma opção'
        const options = parts.slice(1).filter(Boolean)
        if (options.length > 0) {
            buttons = { title, options }
        }
        cleanText = cleanText.replace(btnMatch[0], '').trim()
    }

    // ── Parse [LISTA:botao|[Seção]|item1|desc1|item2|desc2] ──
    const listMatch = cleanText.match(/\[LISTA:([^\]]+)\]/i)
    let list: InteractiveElements['list'] | undefined
    if (listMatch) {
        const parts = listMatch[1].split('|').map(s => s.trim())
        const buttonText = parts[0] || 'Ver opções'
        const sections: { title: string; rows: { title: string; id: string; description?: string }[] }[] = []
        let currentSection: { title: string; rows: { title: string; id: string; description?: string }[] } = { title: 'Opções', rows: [] }

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i]
            if (part.startsWith('[') && part.endsWith(']')) {
                // New section header
                if (currentSection.rows.length > 0) sections.push(currentSection)
                currentSection = { title: part.slice(1, -1), rows: [] }
            } else {
                // Row — check if next part is description
                const nextPart = parts[i + 1]
                const isNextASection = nextPart?.startsWith('[')
                const isNextARow = nextPart && !isNextASection

                // If current item has a description following it (not a section header)
                if (isNextARow && !parts[i + 2]?.startsWith('[') && currentSection.rows.length < parts.length) {
                    currentSection.rows.push({
                        title: part.substring(0, 24),
                        id: `row_${currentSection.rows.length}`,
                        description: nextPart.substring(0, 72),
                    })
                    i++ // skip description
                } else {
                    currentSection.rows.push({
                        title: part.substring(0, 24),
                        id: `row_${currentSection.rows.length}`,
                    })
                }
            }
        }
        if (currentSection.rows.length > 0) sections.push(currentSection)
        if (sections.length > 0) {
            list = { buttonText, sections }
        }
        cleanText = cleanText.replace(listMatch[0], '').trim()
    }

    // ── Parse [ENQUETE:pergunta|op1|op2|op3] ──
    const pollMatch = cleanText.match(/\[ENQUETE:([^\]]+)\]/i)
    let poll: InteractiveElements['poll'] | undefined
    if (pollMatch) {
        const parts = pollMatch[1].split('|').map(s => s.trim())
        const question = parts[0] || 'O que você prefere?'
        const options = parts.slice(1).filter(Boolean)
        if (options.length >= 2) {
            poll = { question, options, multiSelect: false }
        }
        cleanText = cleanText.replace(pollMatch[0], '').trim()
    }

    // ── Parse [LOCALIZACAO] ──
    const locMatch = cleanText.match(/\[LOCALIZACAO\]/i)
    let locationRequest = false
    if (locMatch) {
        locationRequest = true
        cleanText = cleanText.replace(locMatch[0], '').trim()
    }

    // ── Parse [PIX:pixKey|pixName|pixType] ──
    const pixMatch = cleanText.match(/\[PIX:([^\]]+)\]/i)
    let pix: InteractiveElements['pix'] | undefined
    if (pixMatch) {
        const [pixKeyRaw, pixNameRaw, pixTypeRaw] = pixMatch[1].split('|').map(s => s.trim())
        const pixType = ((pixTypeRaw || 'EVP').toUpperCase()) as 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'
        if (pixKeyRaw && ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'].includes(pixType)) {
            pix = {
                pixKey: pixKeyRaw,
                pixName: pixNameRaw || 'Pagamento',
                pixType,
            }
        }
        cleanText = cleanText.replace(pixMatch[0], '').trim()
    }

    // ── Parse [CAROUSEL_JSON:base64(json)] ──
    const carouselMatch = cleanText.match(/\[CAROUSEL_JSON:([A-Za-z0-9+/=_-]+)\]/i)
    let carousel: InteractiveElements['carousel'] | undefined
    if (carouselMatch) {
        try {
            const decoded = Buffer.from(carouselMatch[1], 'base64').toString('utf-8')
            const parsed = JSON.parse(decoded)
            if (parsed && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
                carousel = {
                    text: String(parsed.text || 'Confira as opções'),
                    cards: parsed.cards.slice(0, 10).map((c: any, idx: number) => ({
                        text: String(c?.text || `Card ${idx + 1}`).slice(0, 500),
                        image: c?.image ? String(c.image) : undefined,
                        buttons: Array.isArray(c?.buttons)
                            ? c.buttons.slice(0, 3).map((b: any, bIdx: number) => ({
                                id: String(b?.id || `btn_${idx}_${bIdx}`),
                                text: String(b?.text || 'Abrir').slice(0, 20),
                                type: (String(b?.type || 'URL').toUpperCase() as 'REPLY' | 'URL' | 'CALL' | 'COPY'),
                            }))
                            : [],
                    })),
                }
            }
        } catch {
            // ignore invalid payload
        }
        cleanText = cleanText.replace(carouselMatch[0], '').trim()
    }

    cleanText = cleanText
        .replace(/\[BOTOES_URL:[^\]]+\]/gi, '')
        .replace(/^\s*BOTAO:\s*$/gim, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    return { cleanText, buttons, urlButtons, list, poll, locationRequest, pix, carousel }
}

// Keep parseButtons as alias for backward compatibility
function parseButtons(text: string): { cleanText: string; buttons?: { title: string; options: string[] } } {
    const result = parseInteractiveElements(text)
    return { cleanText: result.cleanText, buttons: result.buttons }
}

function responseRequiresText(text: string): boolean {
    return /https?:\/\//.test(text) || /\[BOTOES_URL:/i.test(text) || /\[BOTOES:/i.test(text) || /\[LISTA:/i.test(text) || /\[ENQUETE:/i.test(text) || /\[LOCALIZACAO\]/i.test(text) || /\[PIX:/i.test(text) || /\[CAROUSEL_JSON:/i.test(text)
}

function isScheduleChoiceButtons(buttons?: { title: string; options: string[] }): boolean {
    if (!buttons || buttons.options.length < 2) return false
    const joined = normalizeForSearch([buttons.title, ...buttons.options].join(' '))
    const hasScheduleTitle = /\b(agend|visita|reuniao|horario)\b/i.test(joined)
    const hasScheduleSlots = buttons.options.some(option => /\b(manha|tarde|noite)\b/i.test(normalizeForSearch(option)))
    return hasScheduleTitle || hasScheduleSlots
}

function userAskedForScheduling(text: string): boolean {
    const normalized = normalizeForSearch(text)
    return /\b(agendar|agenda|marcar|marcamos|visita|visitar|conhecer pessoalmente|reuniao|ligacao|call|horario|quando posso|quero ver|posso ver|vamos marcar)\b/i.test(normalized)
}

export function resolveSocialQuickReply(choiceRaw: string | null | undefined, configs: Record<string, string>): string | null {
    const choice = normalizeForSearch(choiceRaw).trim()
    if (!choice) return null
    const asksForSocial = (platform: string, aliases: string[] = []) => {
        const terms = [platform, ...aliases].map(term => normalizeForSearch(term))
        const hasPlatform = terms.some(term => choice.includes(term))
        if (!hasPlatform) return false

        const exact = terms.some(term => choice === term || choice === `botao_${term}` || choice === `botao ${term}`)
        if (exact) return true

        const requestIntent = /\b(me manda|manda|envia|me envia|passa|me passa|pode passar|qual|tem|voce tem|voces tem|link|perfil|pagina|canal|rede social|redes sociais|seguir|acompanhar|oficial)\b/i.test(choice)
        if (!requestIntent) return false

        const onlySourceMention = /\b(vi|vim|cheguei|conheci|encontrei|anuncio|trafego|campanha|publicidade|ads?)\b/i.test(choice)
            && !/\b(me manda|manda|envia|passa|qual|tem|link|perfil|pagina|canal|seguir)\b/i.test(choice)
        return !onlySourceMention
    }
    const findCustomUrl = (needle: string): string => {
        try {
            const parsed = JSON.parse(configs['agent_link_buttons'] || '[]')
            if (!Array.isArray(parsed)) return ''
            const found = parsed.find((btn: any) =>
                String(btn?.type || 'URL').toUpperCase() === 'URL'
                && String(btn?.url || '').trim()
                && (
                    String(btn?.tag || '').toLowerCase().includes(needle)
                    || String(btn?.name || '').toLowerCase().includes(needle)
                )
            )
            return String(found?.url || '').trim()
        } catch {
            return ''
        }
    }
    const ig = configs['agent_social_instagram'] || ''
    const yt = configs['agent_social_youtube'] || ''
    const site = configs['agent_social_site'] || ''
    const fb = configs['agent_social_facebook'] || ''
    const li = configs['agent_social_linkedin'] || ''
    const tt = configs['agent_social_tiktok'] || ''
    const hasExplicitSocialRequest =
        asksForSocial('instagram')
        || asksForSocial('youtube', ['video', 'videos'])
        || asksForSocial('site')
        || asksForSocial('facebook')
        || asksForSocial('linkedin')
        || asksForSocial('tiktok', ['tik tok'])
    const mentionsSocialWithoutRequest =
        (choice.includes('instagram') || choice.includes('youtube') || choice.includes('video') || choice.includes('site') || choice.includes('facebook') || choice.includes('linkedin') || choice.includes('tiktok') || choice.includes('tik tok'))
        && !hasExplicitSocialRequest
    if (mentionsSocialWithoutRequest) return null

    if (asksForSocial('instagram')) {
        const url = ig || findCustomUrl('instagram')
        if (url) return `Perfeito! Nosso Instagram: [BOTOES_URL:Instagram|Instagram=>${url}]`
    }
    if (asksForSocial('youtube', ['video', 'videos']) && yt) return `Claro! Nosso YouTube: [BOTOES_URL:YouTube|YouTube=>${yt}]`
    if (asksForSocial('site') && site) return `Aqui esta nosso site oficial: [BOTOES_URL:Site|Abrir site=>${site}]`
    if (asksForSocial('facebook') && fb) return `Aqui esta nosso Facebook: [BOTOES_URL:Facebook|Facebook=>${fb}]`
    if (asksForSocial('linkedin') && li) return `Aqui esta nosso LinkedIn: [BOTOES_URL:LinkedIn|LinkedIn=>${li}]`
    if (asksForSocial('tiktok', ['tik tok']) && tt) return `Aqui esta nosso TikTok: [BOTOES_URL:TikTok|TikTok=>${tt}]`
    if (asksForSocial('site') && site) return `Aqui está nosso site oficial: ${site}`
    if (asksForSocial('facebook') && fb) return `Aqui está nosso Facebook: ${fb}`
    if (asksForSocial('linkedin') && li) return `Aqui está nosso LinkedIn: ${li}`
    if (asksForSocial('tiktok', ['tik tok']) && tt) return `Aqui está nosso TikTok: ${tt}`
    return null
}

function sanitizeLeadName(raw?: string | null): string {
    const name = String(raw || '').trim()
    if (!name) return ''
    const lower = name.toLowerCase()
    // Ignore provider/system-like names that look robotic or not a real lead name.
    if (
        lower.includes('connectyhub') ||
        lower.includes('uazapi') ||
        lower.includes('whatsapp') ||
        lower.includes('bot')
    ) return ''
    return name
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function limitNameMentions(text: string, rawName?: string | null): string {
    const name = String(rawName || '').trim()
    if (!name || name.length < 3) return text

    const isSafePersonName = !!sanitizeLeadName(name)
    const maxMentions = isSafePersonName ? 1 : 0
    let count = 0
    const nameRegex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi')

    return String(text || '')
        .replace(nameRegex, (match) => {
            count += 1
            return count <= maxMentions ? match : ''
        })
        .replace(/\s+([,.!?;:])/g, '$1')
        .replace(/(^|\n)\s*[,;:]\s*/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function normalizeGreetingByTime(text: string, userText: string, greeting: string): string {
    const clean = String(text || '')
    const user = String(userText || '').toLowerCase()
    const isGreetingInput = /\b(oi|ol[aá]|bom dia|boa tarde|boa noite|e ai|eai)\b/i.test(user)
    if (!isGreetingInput) return clean

    const expected = greeting.toLowerCase()
    return clean
        .replace(/\bbom dia\b/i, expected)
        .replace(/\bboa tarde\b/i, expected)
        .replace(/\bboa noite\b/i, expected)
}

function parseBudgetToNumber(value: unknown): number | null {
    if (!value) return null
    const raw = String(value).toLowerCase()
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) return null
    let n = parseInt(digits, 10)
    if (!Number.isFinite(n) || n <= 0) return null
    if (/(milh|milhao|milhoes|mi\b)/i.test(raw) && n < 1000) n *= 1000000
    else if (/(^|\s)(mil|k)(\s|$)/i.test(raw) && n < 10000) n *= 1000
    if (n < 10000) n *= 1000
    return n
}

function extractRequestedBudget(text: string): number | null {
    const normalized = String(text || '').toLowerCase()
    const match = normalized.match(/(r\$\s*)?(\d+(?:[.,]\d+)?|\d{1,3}(?:[.\s]\d{3})+)\s*(milh(?:a|ã|õ|o)?es|milhoes|milhão|milhao|mi|mil|k)?/)
    if (!match) return null
    if (!match[1] && !match[3]) return null
    return parseBudgetToNumber(`${match[2]} ${match[3] || ''}`.trim())
}

function extractLeadDataFromText(inputText: string, aiText: string, senderName?: string): Record<string, any> {
    const merged = `${inputText}\n${aiText}`
    const lower = merged.toLowerCase()
    const out: Record<string, any> = {}

    if (senderName) out.name = senderName

    const budgetMatch = merged.match(/(?:r\$\s*)?(\d{2,3}(?:[.\s]\d{3})+|\d{2,4})\s*(mil|mi|milh(?:ão|oes|ões))?/i)
    if (budgetMatch) {
        const rawBudget = `${budgetMatch[1]} ${budgetMatch[2] || ''}`.trim()
        out.budget = rawBudget
    }

    const regionMatch = merged.match(/\b(gramado|canela|nova petr[oó]polis|caxias do sul|bento gon[çc]alves|balne[aá]rio cambori[uú]|itapema|itaja[ií]|porto belo)\b/i)
    if (regionMatch) out.region = regionMatch[1]

    const bedroomsMatch = merged.match(/(\d+)\s*(?:quartos?|dormit[oó]rios?|su[ií]tes?)/i)
    if (bedroomsMatch) out.bedrooms = bedroomsMatch[1]

    if (/\b(casa|sobrado|apartamento|apto|terreno|cobertura|sala comercial|loja)\b/i.test(lower)) {
        const typeMatch = lower.match(/\b(casa|sobrado|apartamento|apto|terreno|cobertura|sala comercial|loja)\b/i)
        if (typeMatch) {
            out.property_type = typeMatch[1] === 'apto' ? 'apartamento' : typeMatch[1]
        }
    }

    if (/\b(invest|renda|aluguel)\b/i.test(lower)) out.interest = 'investir'
    if (/\b(morar|residir|mudar)\b/i.test(lower)) out.interest = out.interest || 'morar'

    if (/\b(urgente|imediat|agora)\b/i.test(lower)) out.timeframe = 'imediato'
    else if (/\b(30 dias|1 m[eê]s|2 meses|3 meses)\b/i.test(lower)) out.timeframe = 'até 3 meses'
    else if (/\b(6 meses|ano que vem|pr[oó]ximo ano)\b/i.test(lower)) out.timeframe = 'médio prazo'

    return out
}

function normalizeForSearch(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function formatBudgetForCrm(value: number | null): string | null {
    if (!value) return null
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    })
}

function extractRequestedBudgetV2(text: string): number | null {
    const matches = [...String(text || '').matchAll(/(r\$\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[,.]\d+)?)\s*(milhoes|milhao|milh(?:a|ã|õ|o)?es|mi|mil|k)?/gi)]
    for (const match of matches) {
        const hasCurrencyOrUnit = !!match[1] || !!match[3] || /[.\s]\d{3}/.test(match[2] || '')
        if (!hasCurrencyOrUnit) continue
        const value = parseBudgetToNumber(`${match[2]} ${match[3] || ''}`.trim())
        if (value && value >= 100000) return value
    }
    return extractRequestedBudget(text)
}

function extractLeadDataForCrm(inputText: string, aiText: string, senderName?: string): Record<string, any> {
    const legacy = extractLeadDataFromText(inputText, aiText, senderName)
    const merged = `${inputText}\n${aiText}`
    const lower = normalizeForSearch(merged)
    const userLower = normalizeForSearch(inputText)
    const out: Record<string, any> = { ...legacy }

    if (senderName) out.name = senderName

    const requestedBudget = extractRequestedBudgetV2(merged)
    if (requestedBudget) {
        out.budget = formatBudgetForCrm(requestedBudget)
        out.budget_number = requestedBudget
    }

    const regionMatch = merged.match(/\b(gramado|canela|nova petr[oó]polis|caxias do sul|bento gon[çc]alves|balne[aá]rio cambori[uú]|itapema|itaja[ií]|porto belo|praia brava|barra sul|barra norte|centro|meia praia)\b/i)
    if (regionMatch) out.region = regionMatch[1]

    const bedroomsMatch = merged.match(/(\d+)\s*(?:quartos?|dormit[oó]rios?|su[ií]tes?)/i)
    if (bedroomsMatch) out.bedrooms = bedroomsMatch[1]

    const typeMatch = lower.match(/\b(casa|sobrado|apartamento|apto|terreno|cobertura|sala comercial|loja|studio|duplex)\b/i)
    if (typeMatch) out.property_type = typeMatch[1] === 'apto' ? 'apartamento' : typeMatch[1]

    const wantsInvestment = /\b(invest|renda|aluguel|rentabilidade|valorizacao|patrimonio|revenda)\b/i.test(lower)
    const wantsHome = /\b(morar|residir|mudar|familia|casa propria|uso proprio)\b/i.test(lower)
    if (wantsInvestment && wantsHome) out.interest = 'investimento e moradia'
    else if (wantsInvestment) out.interest = 'investimento'
    else if (wantsHome) out.interest = 'moradia'
    if (out.interest) out.purpose = out.interest

    if (/\b(instagram|insta|ig)\b/i.test(userLower)) out.lead_source = 'Instagram'
    else if (/\b(facebook|face|fb)\b/i.test(userLower)) out.lead_source = 'Facebook'
    else if (/\b(google|pesquisa|busca)\b/i.test(userLower)) out.lead_source = 'Google'
    else if (/\b(youtube|yt)\b/i.test(userLower)) out.lead_source = 'YouTube'
    else if (/\b(tiktok|tik tok)\b/i.test(userLower)) out.lead_source = 'TikTok'
    else if (/\b(indicacao|indicaram|me indicou|amigo|conhecido|familia)\b/i.test(userLower)) out.lead_source = 'Indicacao'
    if (out.lead_source) out.self_reported_source = out.lead_source

    if (/\b(urgente|imediat|agora|essa semana|hoje|amanha|fechar rapido|quero sair da casa)\b/i.test(lower)) out.timeframe = 'imediato'
    else if (/\b(30 dias|1 mes|um mes|2 meses|3 meses|ate 3 meses|esse mes)\b/i.test(lower)) out.timeframe = 'ate 3 meses'
    else if (/\b(6 meses|sem pressa|medio prazo|ano que vem|proximo ano)\b/i.test(lower)) out.timeframe = 'medio prazo'
    else if (/\b(so pesquisando|apenas pesquisando|curiosidade|futuramente)\b/i.test(lower)) out.timeframe = 'pesquisa inicial'

    const objections: string[] = []
    if (/\b(caro|preco|valor alto|baixar|desconto|entrada)\b/i.test(lower)) objections.push('preco')
    if (/\b(financiamento|credito|documento|documentacao|aprovar)\b/i.test(lower)) objections.push('financiamento/documentacao')
    if (/\b(localizacao|regiao|bairro|distancia|longe)\b/i.test(lower)) objections.push('localizacao')
    if (/\b(seguranca|confio|confiavel|garantia|golpe|realmente existe)\b/i.test(lower)) objections.push('seguranca/confianca')
    if (objections.length) out.objections = objections

    const buyingSignal = /\b(quero comprar|fechar|visitar|proposta|reserva|sinal|entrada|manda detalhes|tenho interesse|pode chamar)\b/i.test(lower)
    if (buyingSignal && out.budget_number && out.timeframe && out.timeframe !== 'pesquisa inicial') out.classification = 'hot'
    if (buyingSignal && out.budget_number && out.budget_number >= 3000000) out.classification = 'vip'
    if (!out.classification && out.timeframe === 'pesquisa inicial') out.classification = 'cold'

    const summaryParts: string[] = []
    if (out.name) summaryParts.push(`Lead: ${out.name}`)
    if (out.interest) summaryParts.push(`finalidade: ${out.interest}`)
    if (out.budget) summaryParts.push(`orcamento: ${out.budget}`)
    if (out.region) summaryParts.push(`regiao: ${out.region}`)
    if (out.property_type) summaryParts.push(`tipo: ${out.property_type}`)
    if (out.bedrooms) summaryParts.push(`${out.bedrooms} quartos`)
    if (out.timeframe) summaryParts.push(`prazo: ${out.timeframe}`)
    if (objections.length) summaryParts.push(`objecoes: ${objections.join(', ')}`)
    if (summaryParts.length) out.summary = summaryParts.join('; ')

    return out
}

function computeLeadScore(lead: Record<string, unknown>): number {
    let score = 0
    if (lead.lead_name) score += 15
    if (lead.interest) score += 15
    if (lead.region) score += 15
    if (lead.budget_max) score += 20
    if (lead.bedrooms_wanted) score += 10
    if (lead.property_type) score += 10
    if (lead.timeline) score += 15
    return Math.min(score, 100)
}

// ═══════════════════════════════════════════════════════════════
// WhatsApp Media Decryption (E2EE)
// WhatsApp encrypts all media with AES-256-CBC
// The mediaKey from payload is used to derive decryption keys via HKDF
// ═══════════════════════════════════════════════════════════════

async function decryptWhatsAppMedia(
    encryptedUrl: string,
    mediaKeyBase64: string,
    mediaType: 'audio' | 'image' | 'video' | 'document' = 'audio'
): Promise<Buffer | null> {
    try {
        console.log(`[WA Decrypt] Downloading encrypted media from: ${encryptedUrl.substring(0, 80)}...`)
        
        const response = await fetch(encryptedUrl)
        if (!response.ok) {
            console.error(`[WA Decrypt] Download failed (${response.status})`)
            return null
        }
        
        const encData = Buffer.from(await response.arrayBuffer())
        console.log(`[WA Decrypt] Downloaded ${encData.length} bytes encrypted`)
        
        if (encData.length < 10) {
            console.error(`[WA Decrypt] Encrypted data too small`)
            return null
        }
        
        // WhatsApp media type info strings for HKDF
        const mediaTypeInfo: Record<string, string> = {
            audio: 'WhatsApp Audio Keys',
            image: 'WhatsApp Image Keys',
            video: 'WhatsApp Video Keys',
            document: 'WhatsApp Document Keys',
        }
        
        const mediaKey = Buffer.from(mediaKeyBase64, 'base64')
        const info = mediaTypeInfo[mediaType] || 'WhatsApp Audio Keys'
        
        // HKDF expand: derive 112 bytes from mediaKey
        const hkdfKey = hkdfExpand(mediaKey, Buffer.from(info, 'utf8'), 112)
        
        const iv = hkdfKey.subarray(0, 16)
        const cipherKey = hkdfKey.subarray(16, 48)
        
        // Remove last 10 bytes (MAC) from encrypted data
        const encFile = encData.subarray(0, encData.length - 10)
        
        // Decrypt with AES-256-CBC
        const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv)
        const decrypted = Buffer.concat([decipher.update(encFile), decipher.final()])
        
        console.log(`[WA Decrypt] ✅ Decrypted successfully: ${decrypted.length} bytes`)
        return decrypted
    } catch (e) {
        console.error(`[WA Decrypt] Decryption error:`, e)
        return null
    }
}

/** HKDF-Expand (SHA-256) — derives key material from input key */
function hkdfExpand(key: Buffer, info: Buffer, length: number): Buffer {
    // HKDF-Extract
    const prk = crypto.createHmac('sha256', Buffer.alloc(32, 0)).update(key).digest()
    
    // HKDF-Expand
    let t = Buffer.alloc(0)
    let okm = Buffer.alloc(0)
    let counter = 1
    
    while (okm.length < length) {
        const hmac = crypto.createHmac('sha256', prk)
        hmac.update(Buffer.concat([t, info, Buffer.from([counter])]))
        t = hmac.digest()
        okm = Buffer.concat([okm, t])
        counter++
    }
    
    return okm.subarray(0, length)
}

// ═══════════════════════════════════════════════════════════════
// AUDIO: STT
// ═══════════════════════════════════════════════════════════════

async function transcribeWithWhisper(audioUrl: string, apiKey: string): Promise<string> {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
        console.error(`[Whisper STT] Failed to download audio (${audioRes.status}): ${audioUrl.substring(0, 100)}`)
        return ''
    }
    const audioBuffer = await audioRes.arrayBuffer()
    if (audioBuffer.byteLength < 100) {
        console.error(`[Whisper STT] Audio too small (${audioBuffer.byteLength} bytes), likely invalid`)
        return ''
    }
    const blob = new Blob([audioBuffer], { type: 'audio/ogg' })
    const formData = new FormData()
    formData.append('file', blob, 'audio.ogg')
    formData.append('model', 'whisper-1')
    formData.append('language', 'pt')
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
    })
    if (!res.ok) {
        const errBody = await res.text()
        console.error(`[Whisper STT] API error (${res.status}):`, errBody.substring(0, 300))
        return ''
    }
    const data = await res.json()
    return data.text || ''
}

async function transcribeWithGemini(audioUrl: string, apiKey: string, model: string): Promise<string> {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
        console.error(`[Gemini STT] Failed to download audio (${audioRes.status}): ${audioUrl.substring(0, 100)}`)
        return ''
    }
    const audioBuffer = await audioRes.arrayBuffer()
    if (audioBuffer.byteLength < 100) {
        console.error(`[Gemini STT] Audio too small (${audioBuffer.byteLength} bytes), likely invalid`)
        return ''
    }
    const base64Audio = Buffer.from(audioBuffer).toString('base64')
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'audio/ogg', data: base64Audio } },
                    { text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicações.' }
                ]
            }]
        })
    })
    if (!res.ok) {
        const errBody = await res.text()
        console.error(`[Gemini STT] API error (${res.status}):`, errBody.substring(0, 300))
        return ''
    }
    const data = await res.json()
    await recordGeminiUsage({
        model: model || 'gemini-2.0-flash',
        feature: 'whatsapp_audio_transcription',
        usageMetadata: data.usageMetadata,
    })
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ═══════════════════════════════════════════════════════════════
// AUDIO: TTS
// ═══════════════════════════════════════════════════════════════

async function ttsElevenLabs(text: string, apiKey: string, voiceId: string): Promise<Buffer | null> {
    try {
        const spokenText = normalizeTextForTTS(text)
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
            body: JSON.stringify({
                text: spokenText, model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true }
            })
        })
        if (!res.ok) { console.error('[ElevenLabs TTS] Error:', res.status); return null }
        return Buffer.from(await res.arrayBuffer())
    } catch (e) { console.error('[ElevenLabs TTS] Error:', e); return null }
}

async function ttsOpenAI(text: string, apiKey: string, voice: string): Promise<Buffer | null> {
    try {
        const spokenText = normalizeTextForTTS(text)
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'tts-1', input: spokenText, voice: voice || 'onyx', response_format: 'opus' })
        })
        if (!res.ok) return null
        return Buffer.from(await res.arrayBuffer())
    } catch (e) { console.error('[OpenAI TTS] Error:', e); return null }
}

function numberUnderThousandToWordsPtBR(value: number): string {
    const units = ['', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
    const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

    if (value === 0) return 'zero'
    if (value === 100) return 'cem'
    if (value < 10) return units[value]
    if (value < 20) return teens[value - 10]
    if (value < 100) {
        const ten = Math.floor(value / 10)
        const unit = value % 10
        return unit ? `${tens[ten]} e ${units[unit]}` : tens[ten]
    }

    const hundred = Math.floor(value / 100)
    const rest = value % 100
    return rest ? `${hundreds[hundred]} e ${numberUnderThousandToWordsPtBR(rest)}` : hundreds[hundred]
}

function integerToWordsPtBR(value: number): string {
    if (!Number.isFinite(value)) return ''
    const number = Math.floor(Math.abs(value))
    if (number < 1000) return numberUnderThousandToWordsPtBR(number)

    const scales = [
        { value: 1_000_000_000, singular: 'bilhao', plural: 'bilhoes' },
        { value: 1_000_000, singular: 'milhao', plural: 'milhoes' },
        { value: 1_000, singular: 'mil', plural: 'mil' },
    ]

    for (const scale of scales) {
        if (number >= scale.value) {
            const major = Math.floor(number / scale.value)
            const rest = number % scale.value
            const majorText = scale.value === 1_000 && major === 1
                ? 'mil'
                : `${integerToWordsPtBR(major)} ${major === 1 ? scale.singular : scale.plural}`
            if (!rest) return majorText
            const glue = rest < 100 ? ' e ' : ', '
            return `${majorText}${glue}${integerToWordsPtBR(rest)}`
        }
    }

    return String(number)
}

function parseBrazilianMoney(value: string): { reais: number; cents: number } | null {
    const raw = value
        .replace(/R\$/gi, '')
        .replace(/\s+/g, '')
        .trim()
    if (!raw) return null

    let integerPart = raw
    let centsPart = ''
    if (raw.includes(',')) {
        const parts = raw.split(',')
        integerPart = parts[0] || ''
        centsPart = parts[1] || ''
    } else if (/^\d{1,3}\.\d{2}$/.test(raw)) {
        const parts = raw.split('.')
        integerPart = parts[0] || ''
        centsPart = parts[1] || ''
    } else if (/^\d{1,3}(?:\.\d{3})+\.\d{2}$/.test(raw)) {
        // Some LLM replies miss one zero in large BRL values: 22.000.00 -> 22.000.000.
        const parts = raw.split('.')
        integerPart = `${parts.slice(0, -1).join('')}${parts[parts.length - 1]}0`
    }

    const integerRaw = (integerPart || '').replace(/\D/g, '')
    if (!integerRaw) return null

    const reais = Number(integerRaw)
    const centsRaw = (centsPart || '').replace(/\D/g, '').slice(0, 2)
    const cents = centsRaw ? Number(centsRaw.padEnd(2, '0')) : 0

    if (!Number.isFinite(reais) || reais < 0) return null
    return { reais, cents: Number.isFinite(cents) ? cents : 0 }
}

function moneyToSpeechPtBR(value: string): string {
    const parsed = parseBrazilianMoney(value)
    if (!parsed) return value

    const reaisText = parsed.reais === 1
        ? 'um real'
        : `${integerToWordsPtBR(parsed.reais)} reais`
    if (!parsed.cents) return reaisText

    const centsText = parsed.cents === 1
        ? 'um centavo'
        : `${integerToWordsPtBR(parsed.cents)} centavos`
    return `${reaisText} e ${centsText}`
}

function parseScaledNumberPtBR(value: string): number | null {
    const raw = String(value || '').trim()
    if (!raw) return null

    let normalized = raw.replace(/\s+/g, '')
    if (normalized.includes(',')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.')
    }

    const number = Number(normalized)
    return Number.isFinite(number) ? number : null
}

function scaleWordToMultiplier(scale: string): number {
    const normalized = String(scale || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

    if (normalized.startsWith('bilh')) return 1_000_000_000
    if (normalized.startsWith('milh') || normalized === 'mi') return 1_000_000
    if (normalized === 'mil' || normalized === 'k') return 1_000
    return 1
}

function scaledMoneyToSpeechPtBR(value: string, scale: string): string {
    const number = parseScaledNumberPtBR(value)
    if (number === null) return `${value} ${scale}`
    const reais = Math.round(number * scaleWordToMultiplier(scale))
    return reais === 1 ? 'um real' : `${integerToWordsPtBR(reais)} reais`
}

function normalizeTextForTTS(text: string): string {
    const scalePattern = '(?:bilh(?:ao|oes|ão|ões)|milh(?:ao|oes|ão|ões)|milhao|milhoes|mi|mil|k)'
    return String(text || '')
        .replace(new RegExp(`R\\$\\s*(\\d+(?:[,.]\\d+)?)\\s*(${scalePattern})\\b(?:\\s+de\\s+reais)?`, 'gi'), (_, value, scale) => scaledMoneyToSpeechPtBR(value, scale))
        .replace(new RegExp(`\\b(\\d+(?:[,.]\\d+)?)\\s*(${scalePattern})\\s*(?:de\\s+)?reais\\b`, 'gi'), (_, value, scale) => scaledMoneyToSpeechPtBR(value, scale))
        .replace(/R\$\s*\d[\d.\s]*(?:,\d{1,2})?/gi, match => moneyToSpeechPtBR(match))
        .replace(/\b\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\b/g, match => {
            const parsed = parseBrazilianMoney(match)
            return parsed ? integerToWordsPtBR(parsed.reais) : match
        })
        .replace(/\b(\d{1,3})\s*(?:m2|m²)\b/gi, (_, value) => `${integerToWordsPtBR(Number(value))} metros quadrados`)
        .replace(/\b(\d{1,3})\s*%/g, (_, value) => `${integerToWordsPtBR(Number(value))} por cento`)
        .replace(new RegExp(`\\b(\\d{1,2})\\s*(${scalePattern})\\b`, 'gi'), (_, value, scale) => `${integerToWordsPtBR(Number(value))} ${String(scale).toLowerCase()}`)
        .replace(/\s+/g, ' ')
        .trim()
}

async function uploadAudioToR2(audioBuffer: Buffer, supabase: ReturnType<typeof getSupabase>): Promise<string | null> {
    try {
        const { data: configs } = await supabase
            .from('app_config').select('key, value')
            .in('key', ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name', 'r2_public_url'])
        const cfg: Record<string, string> = {}
        configs?.forEach((c: any) => { cfg[c.key] = c.value })

        if (!cfg.r2_account_id || !cfg.r2_access_key_id) {
            const fileName = `whatsapp-tts/${Date.now()}.opus`
            const { error } = await supabase.storage.from('audio').upload(fileName, audioBuffer, { contentType: 'audio/opus', upsert: true })
            if (error) { console.error('[Audio Upload] Error:', error); return null }
            const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName)
            return urlData?.publicUrl || null
        }

        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        const s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${cfg.r2_account_id}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId: cfg.r2_access_key_id, secretAccessKey: cfg.r2_secret_access_key }
        })
        const key = `whatsapp-tts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.opus`
        await s3.send(new PutObjectCommand({ Bucket: cfg.r2_bucket_name, Key: key, Body: audioBuffer, ContentType: 'audio/opus' }))
        return `${cfg.r2_public_url}/${key}`
    } catch (e) { console.error('[Audio Upload] Error:', e); return null }
}

async function sendMirrorAudioLeadIn(params: {
    text: string
    broker: any
    configs: Record<string, string>
    supabase: ReturnType<typeof getSupabase>
    cleanPhone: string
    instanceToken: string
}): Promise<any[]> {
    const spokenText = String(params.text || '').trim()
    if (!spokenText || spokenText.length < 3) return []

    const rawVoiceId = (params.broker as any)?.voice_id || params.configs['whatsapp_tts_voice'] || ''
    const isOpenAIVoice = rawVoiceId.startsWith('openai:')
    const voiceId = isOpenAIVoice ? rawVoiceId.replace('openai:', '') : rawVoiceId
    const audioChunks = ttsTextChunks(spokenText)
    const results: any[] = []

    try {
        for (let index = 0; index < audioChunks.length; index++) {
            const chunk = audioChunks[index]
            let audioBuffer: Buffer | null = null

            if (isOpenAIVoice && params.configs['openai_api_key']) {
                audioBuffer = await ttsOpenAI(chunk, params.configs['openai_api_key'], voiceId || 'onyx')
            } else if (!isOpenAIVoice && params.configs['elevenlabs_api_key'] && voiceId) {
                audioBuffer = await ttsElevenLabs(chunk, params.configs['elevenlabs_api_key'], voiceId)
            }
            if (!audioBuffer && params.configs['openai_api_key']) {
                audioBuffer = await ttsOpenAI(chunk, params.configs['openai_api_key'], params.configs['whatsapp_tts_voice'] || 'onyx')
            }
            if (!audioBuffer) continue

            const audioPublicUrl = await uploadAudioToR2(audioBuffer, params.supabase)
            if (!audioPublicUrl) continue

            const result = await sendAudioMessage({
                phone: params.cleanPhone,
                audioUrl: audioPublicUrl,
                ptt: true,
                instanceToken: params.instanceToken,
            })
            results.push(result)

            if (index < audioChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 900 + Math.min(chunk.length * 8, 1800)))
            }
        }

        return results
    } catch (e) {
        console.warn('[Mirror Audio Lead-in] Failed:', e)
        return results
    }
}

function ttsTextChunks(text: string): string[] {
    const spokenText = normalizeTextForTTS(text)
    const chunks = splitIntoHumanChunks(spokenText)
    if (chunks.length <= 1 && spokenText.length > 180) {
        return spokenText
            .split(/(?<=[,;:])\s+/)
            .map(chunk => chunk.trim())
            .filter(Boolean)
            .slice(0, 4)
    }
    return chunks.slice(0, 4)
}

function inferMimeType(kind: 'image' | 'video' | 'document', provided?: string | null): string {
    if (provided && provided.trim()) return provided.trim()
    if (kind === 'image') return 'image/jpeg'
    if (kind === 'video') return 'video/mp4'
    return 'application/pdf'
}

async function fetchMediaUrlToBuffer(url: string): Promise<Buffer | null> {
    try {
        if (!url || !/^https?:\/\//i.test(url)) return null
        const res = await fetch(url)
        if (!res.ok) {
            console.warn(`[WhatsApp Agent] Media URL fetch failed (${res.status}) for ${url.substring(0, 120)}`)
            return null
        }
        const buf = Buffer.from(await res.arrayBuffer())
        console.log(`[WhatsApp Agent] Media URL fetched: ${buf.length} bytes from ${url.substring(0, 120)}`)
        return buf.length > 64 ? buf : null
    } catch (e) {
        console.warn('[WhatsApp Agent] Media URL fetch error:', e)
        return null
    }
}

function waitMs(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function parseStoredMediaUrl(value?: string | null): { url: string; mime?: string | null } | null {
    if (!value) return null
    try {
        const parsed = JSON.parse(value)
        const url = String(parsed?.url || '').trim()
        if (!url) return null
        return { url, mime: parsed?.mime || null }
    } catch {
        const url = String(value || '').trim()
        return url ? { url } : null
    }
}

function isLikelyEncryptedWhatsAppMediaUrl(url?: string | null): boolean {
    const value = String(url || '').toLowerCase()
    return value.includes('mmg.whatsapp.net') || value.includes('.enc?') || value.endsWith('.enc')
}

function isLikelyUsableMediaBuffer(kind: 'image' | 'video' | 'document', mimeType: string, buffer: Buffer | null): boolean {
    if (!buffer || buffer.length < 64) return false

    const header4 = buffer.subarray(0, 4).toString('latin1')
    const header8 = buffer.subarray(0, 8).toString('latin1')
    const at4 = buffer.subarray(4, 8).toString('latin1')
    const mime = String(mimeType || '').toLowerCase()

    if (kind === 'image') {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
            || header8 === '\x89PNG\r\n\x1a\n'
            || (header4 === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP')
            || header4 === 'GIF8'
    }

    if (kind === 'video') {
        return at4 === 'ftyp'
            || (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3)
            || (header4 === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'AVI ')
    }

    if (mime.includes('pdf')) return header4 === '%PDF'
    if (mime.includes('zip') || mime.includes('word') || mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('presentation')) {
        return buffer[0] === 0x50 && buffer[1] === 0x4b
    }
    return header4 === '%PDF' || (buffer[0] === 0x50 && buffer[1] === 0x4b)
}

async function createPdfAnalysisPreview(
    pdfBuffer: Buffer,
    maxBytes = 8 * 1024 * 1024,
    preferredPages = 24
): Promise<{ buffer: Buffer; pageCount: number; includedPages: number } | null> {
    try {
        const source = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
        const pageCount = source.getPageCount()
        if (pageCount <= 0) return null

        let pagesToCopy = Math.min(pageCount, preferredPages)
        while (pagesToCopy > 0) {
            const preview = await PDFDocument.create()
            const copied = await preview.copyPages(
                source,
                Array.from({ length: pagesToCopy }, (_, index) => index)
            )
            copied.forEach((page) => preview.addPage(page))
            const bytes = await preview.save({ useObjectStreams: true })
            const buffer = Buffer.from(bytes)
            if (buffer.length <= maxBytes) {
                return { buffer, pageCount, includedPages: pagesToCopy }
            }
            pagesToCopy = Math.floor(pagesToCopy / 2)
        }
    } catch (error) {
        console.warn('[WhatsApp Agent] PDF preview generation failed:', error)
    }
    return null
}

async function analyzeMediaWithGemini(
    mediaBuffer: Buffer,
    mimeType: string,
    apiKey: string,
    model: string,
    kind: 'image' | 'video' | 'document',
    fileName?: string | null,
    userContext?: string | null
): Promise<string> {
    const contextText = String(userContext || '').trim()
    const contextLine = contextText
        ? `\nMensagem/legenda que veio junto da midia: ${contextText}\nUse essa mensagem apenas como contexto da pergunta do cliente.`
        : ''
    const videoInstruction = kind === 'video'
        ? `\nInstrucao especial para video: analise obrigatoriamente a parte visual do video, nao apenas audio, legenda ou transcricao. Identifique telas, cards de imoveis, nomes, cidades, precos, ambientes, fachadas, documentos, prints ou qualquer detalhe visual relevante. Se a fala/legenda citar uma coisa e a imagem mostrar outra, descreva a divergencia.`
        : ''
    const documentInstruction = kind === 'document'
        ? `\nInstrucao especial para documento: tente ler e extrair o conteudo principal do arquivo. Resuma dados importantes, nomes, valores, prazos, enderecos e pendencias. Se o texto nao estiver legivel ou o arquivo nao puder ser interpretado, diga claramente que nao foi possivel ler com seguranca.`
        : ''
    const prompt = `Analise esta mídia enviada por um cliente no WhatsApp de imobiliária.
Tipo: ${kind}
Arquivo: ${fileName || 'sem nome'}
${contextLine}${videoInstruction}${documentInstruction}

Responda em português (pt-BR), curto e prático com:
1) O que aparece/contém (resumo objetivo)
2) Perfil de imóvel/interesse provável do cliente
3) Características-chave (estilo, localização sugerida, padrão, quartos, área, lazer, etc. quando possível)
4) 3 perguntas curtas que o corretor deve fazer para qualificar melhor

Se não for possível analisar com confiança, diga isso claramente.`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: mediaBuffer.toString('base64') } },
                    { text: prompt }
                ]
            }]
        })
    })
    if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.warn(`[WhatsApp Agent] Gemini media analysis failed (${res.status}): ${errorText.substring(0, 500)}`)
        return ''
    }
    const data = await res.json()
    await recordGeminiUsage({
        model: model || 'gemini-2.0-flash',
        feature: `whatsapp_${kind}_analysis`,
        usageMetadata: data.usageMetadata,
        metadata: { kind, mimeType },
    })
    const parts = data?.candidates?.[0]?.content?.parts
    const text = Array.isArray(parts)
        ? parts.map((part: any) => part?.text || '').filter(Boolean).join('\n').trim()
        : ''
    if (!text) {
        console.warn(`[WhatsApp Agent] Gemini media analysis returned no text: ${JSON.stringify(data).substring(0, 500)}`)
    }
    return text
}

async function analyzeMediaWithOpenAIImage(
    mediaBuffer: Buffer,
    mimeType: string,
    apiKey: string,
    model: string,
    fileName?: string | null
): Promise<string> {
    const dataUrl = `data:${mimeType};base64,${mediaBuffer.toString('base64')}`
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: 'Você analisa mídia de clientes para uma imobiliária. Responda em pt-BR, de forma objetiva e útil para o corretor.'
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `Analise esta imagem (arquivo: ${fileName || 'sem nome'}) e traga: resumo, perfil de interesse e 3 perguntas de qualificação.` },
                        { type: 'image_url', image_url: { url: dataUrl } }
                    ]
                }
            ]
        })
    })
    if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.warn(`[WhatsApp Agent] OpenAI image analysis failed (${res.status}): ${errorText.substring(0, 500)}`)
        return ''
    }
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content || ''
    if (!text) {
        console.warn(`[WhatsApp Agent] OpenAI image analysis returned no text: ${JSON.stringify(data).substring(0, 500)}`)
    }
    return text
}

// ═══════════════════════════════════════════════════════════════
// AI RESPONSE
// ═══════════════════════════════════════════════════════════════

type IncomingMediaBatchItem = {
    kind: 'image' | 'video' | 'document'
    messageId?: string | null
    mediaUrl?: string | null
    mediaMimetype?: string | null
    mediaFilename?: string | null
    text?: string | null
}

type IncomingMediaAnalysisResult = {
    text: string
    reason: string
    kind: 'image' | 'video' | 'document' | 'batch'
    mimeType?: string
    size?: number
    analysisSize?: number
    analysisNote?: string
    fileName?: string | null
    messageId?: string | null
    results?: IncomingMediaAnalysisResult[]
    totals?: Record<string, number>
    skipped?: Record<string, number>
}

function normalizePendingMediaKind(value?: string | null): 'image' | 'video' | 'document' | null {
    const kind = String(value || '').toLowerCase()
    if (kind === 'image' || kind === 'video' || kind === 'document') return kind
    return null
}

function limitIncomingMediaBatch(items: IncomingMediaBatchItem[], configs: Record<string, string> = {}): {
    selected: IncomingMediaBatchItem[]
    totals: Record<string, number>
    skipped: Record<string, number>
} {
    const limits: Record<'image' | 'video' | 'document', number> = {
        image: configNumber(configs, 'whatsapp_media_batch_image_limit', 8, 1, 20),
        video: configNumber(configs, 'whatsapp_media_batch_video_limit', 2, 1, 5),
        document: configNumber(configs, 'whatsapp_media_batch_document_limit', 3, 1, 8),
    }
    const totals: Record<string, number> = { image: 0, video: 0, document: 0 }
    const selectedCounts: Record<string, number> = { image: 0, video: 0, document: 0 }
    const skipped: Record<string, number> = { image: 0, video: 0, document: 0 }
    const selected: IncomingMediaBatchItem[] = []

    for (const item of items) {
        totals[item.kind] = (totals[item.kind] || 0) + 1
        if (selectedCounts[item.kind] < limits[item.kind]) {
            selected.push(item)
            selectedCounts[item.kind] += 1
        } else {
            skipped[item.kind] = (skipped[item.kind] || 0) + 1
        }
    }

    return { selected, totals, skipped }
}

function buildMediaBatchLabel(totals: Record<string, number>): string {
    const labels: string[] = []
    if (totals.image) labels.push(`${totals.image} imagem(ns)`)
    if (totals.video) labels.push(`${totals.video} video(s)`)
    if (totals.document) labels.push(`${totals.document} documento(s)`)
    return labels.length ? labels.join(', ') : 'nenhuma midia'
}

async function analyzeIncomingMediaItem(params: {
    supabase: any
    configs: Record<string, string>
    instanceToken: string
    item: IncomingMediaBatchItem
    contextText?: string | null
}): Promise<IncomingMediaAnalysisResult> {
    const { supabase, configs, instanceToken, item, contextText } = params
    const { kind, messageId, mediaUrl, mediaMimetype, mediaFilename } = item
    const mediaImageEnabled = configs['whatsapp_media_image_enabled'] !== 'false'
    const mediaDocumentEnabled = configs['whatsapp_media_document_enabled'] !== 'false'
    const mediaVideoEnabled = configs['whatsapp_media_video_enabled'] !== 'false'
    const allowed = (kind === 'image' && mediaImageEnabled)
        || (kind === 'document' && mediaDocumentEnabled)
        || (kind === 'video' && mediaVideoEnabled)

    if (!allowed) {
        return { text: '', reason: `disabled_${kind}`, kind, fileName: mediaFilename || null, messageId: messageId || null }
    }

    let mediaBuffer: Buffer | null = null
    let storedMime: string | null = null

    const fetchStoredMedia = async () => {
        if (!messageId) return null
        const { data: storedMedia } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', `_wmedia_${messageId}`)
            .maybeSingle()
        return parseStoredMediaUrl(storedMedia?.value || null)
    }

    if (mediaUrl && !isLikelyEncryptedWhatsAppMediaUrl(mediaUrl)) {
        mediaBuffer = await fetchMediaUrlToBuffer(mediaUrl)
        const directMime = inferMimeType(kind, mediaMimetype || null)
        if (mediaBuffer && !isLikelyUsableMediaBuffer(kind, directMime, mediaBuffer)) {
            console.warn(`[WhatsApp Agent] Ignoring unusable direct media bytes for ${kind}; url=${mediaUrl.substring(0, 120)}`)
            mediaBuffer = null
        }
    } else if (mediaUrl) {
        console.log('[WhatsApp Agent] Skipping encrypted WhatsApp media URL; waiting for decoded media or UAZAPI download')
    }

    if (!mediaBuffer && messageId) {
        for (let attempt = 1; attempt <= 5 && !mediaBuffer; attempt++) {
            const stored = await fetchStoredMedia()
            if (stored?.url) {
                storedMime = stored.mime || null
                console.log(`[WhatsApp Agent] Stored media ready on attempt ${attempt}: ${stored.url.substring(0, 120)}`)
                mediaBuffer = await fetchMediaUrlToBuffer(stored.url)
                const storedMimeType = inferMimeType(kind, mediaMimetype || storedMime)
                if (mediaBuffer && !isLikelyUsableMediaBuffer(kind, storedMimeType, mediaBuffer)) {
                    console.warn(`[WhatsApp Agent] Stored media bytes are not usable for ${kind}; url=${stored.url.substring(0, 120)}`)
                    mediaBuffer = null
                }
            } else {
                console.log(`[WhatsApp Agent] Stored media not ready on attempt ${attempt} for message ${messageId}`)
            }

            if (!mediaBuffer && attempt < 5) {
                await waitMs(1500)
            }
        }
    }

    if (!mediaBuffer && messageId) {
        for (let attempt = 1; attempt <= 2 && !mediaBuffer; attempt++) {
            console.log(`[WhatsApp Agent] Trying direct media download attempt ${attempt} for message ${messageId}`)
            mediaBuffer = await downloadMedia(messageId, instanceToken)
            const downloadedMimeType = inferMimeType(kind, mediaMimetype || storedMime)
            if (mediaBuffer && !isLikelyUsableMediaBuffer(kind, downloadedMimeType, mediaBuffer)) {
                console.warn(`[WhatsApp Agent] Downloaded media bytes are not usable for ${kind}; message=${messageId}`)
                mediaBuffer = null
            }
            if (!mediaBuffer && attempt < 2) {
                await waitMs(1500)
            }
        }
    }

    if (!mediaBuffer && !messageId) {
        return { text: '', reason: 'missing_media_source', kind, fileName: mediaFilename || null, messageId: messageId || null }
    }

    if (!mediaBuffer || mediaBuffer.length < 64) {
        return { text: '', reason: 'download_failed', kind, fileName: mediaFilename || null, messageId: messageId || null }
    }

    const mimeType = inferMimeType(kind, mediaMimetype || storedMime)
    let analysisBuffer = mediaBuffer
    let analysisFileName = mediaFilename || null
    let analysisContext = contextText || item.text || null
    let analysisNote = ''

    const maxBytes = 12 * 1024 * 1024
    if (analysisBuffer.length > maxBytes) {
        if (kind === 'document' && mimeType.includes('pdf')) {
            const preview = await createPdfAnalysisPreview(analysisBuffer)
            if (!preview) {
                return { text: '', reason: `file_too_large_${analysisBuffer.length}`, kind, mimeType, size: mediaBuffer.length, fileName: mediaFilename || null, messageId: messageId || null }
            }
            analysisBuffer = preview.buffer
            analysisFileName = `preview-${analysisFileName || 'documento.pdf'}`
            analysisNote = `Documento PDF original com ${preview.pageCount} paginas e ${(mediaBuffer.length / 1024 / 1024).toFixed(1)} MB. Para manter a analise rapida, foi enviada uma previa com as primeiras ${preview.includedPages} paginas. Se a resposta depender de paginas posteriores, informe que pode precisar do arquivo completo ou de um trecho especifico.`
            analysisContext = [analysisContext, analysisNote].filter(Boolean).join('\n\n') || null
            console.log(`[WhatsApp Agent] PDF preview generated for analysis: original=${mediaBuffer.length} preview=${analysisBuffer.length} pages=${preview.includedPages}/${preview.pageCount}`)
        } else {
            return { text: '', reason: `file_too_large_${analysisBuffer.length}`, kind, mimeType, size: mediaBuffer.length, fileName: mediaFilename || null, messageId: messageId || null }
        }
    }

    const geminiKey = configs['gemini_api_key']
    const openaiKey = configs['openai_api_key']
    const geminiModel = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
    const openaiModel = configs['openai_whatsapp_model'] || 'gpt-4o-mini'
    const globalProvider = configs['ai_provider'] || 'gemini'
    const effectiveProvider = configs['whatsapp_provider'] || globalProvider

    let analysisText = ''

    if (effectiveProvider === 'openai') {
        if (kind === 'video') {
            return {
                text: '',
                reason: 'openai_video_not_supported',
                kind,
                mimeType,
                size: mediaBuffer.length,
                fileName: mediaFilename || null,
                messageId: messageId || null,
            }
        }

        if (openaiKey && kind === 'image' && mimeType.startsWith('image/')) {
            analysisText = await analyzeMediaWithOpenAIImage(
                analysisBuffer,
                mimeType,
                openaiKey,
                openaiModel,
                analysisFileName
            )
        }

        if (!analysisText && geminiKey && (kind === 'image' || kind === 'document' || kind === 'video')) {
            analysisText = await analyzeMediaWithGemini(
                analysisBuffer,
                mimeType,
                geminiKey,
                geminiModel,
                kind,
                analysisFileName,
                analysisContext
            )
        }
    } else {
        if (geminiKey) {
            analysisText = await analyzeMediaWithGemini(
                analysisBuffer,
                mimeType,
                geminiKey,
                geminiModel,
                kind,
                analysisFileName,
                analysisContext
            )
        }

        if (!analysisText && openaiKey && kind === 'image' && mimeType.startsWith('image/')) {
            analysisText = await analyzeMediaWithOpenAIImage(
                analysisBuffer,
                mimeType,
                openaiKey,
                openaiModel,
                analysisFileName
            )
        }
    }

    return {
        text: analysisText || '',
        reason: analysisText ? 'ok' : 'no_analysis',
        kind,
        mimeType,
        size: mediaBuffer.length,
        analysisSize: analysisBuffer.length,
        analysisNote,
        fileName: mediaFilename || null,
        messageId: messageId || null,
    }
}

function buildLeadPhoneOrFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
}

function readMetadataValue(source: any, path: string[]): string {
    let cursor = source
    for (const key of path) {
        if (!cursor || typeof cursor !== 'object') return ''
        cursor = cursor[key]
    }
    return cursor == null ? '' : String(cursor)
}

function buildSocialStrategyFromSource(source: string, social: Record<string, string>): string {
    const normalized = normalizeForSearch(source)
    if (normalized.includes('instagram')) {
        return 'O lead veio do Instagram. Nao convide para seguir Instagram como primeira opcao; use o Instagram apenas se ele pedir prova social. Priorize conversa, imoveis e proximidade.'
    }
    if (normalized.includes('youtube')) {
        return social.youtube
            ? 'O lead veio do YouTube. Ele tende a consumir prova em video; se fizer sentido, ofereca um unico botao do YouTube.'
            : 'O lead veio do YouTube. Use explicacoes visuais e objetivas, mas nao invente link se YouTube nao estiver configurado.'
    }
    if (normalized.includes('tiktok')) {
        return social.tiktok
            ? 'O lead veio do TikTok. Mantenha respostas curtas e dinamicas; se houver abertura, ofereca um unico botao do TikTok ou Instagram.'
            : 'O lead veio do TikTok. Mantenha respostas curtas e dinamicas; use Instagram como prova social apenas se fizer sentido.'
    }
    if (normalized.includes('google')) {
        return 'O lead veio do Google. Ele provavelmente esta comparando opcoes; construa autoridade, clareza e seguranca antes de chamar para rede social.'
    }
    if (normalized.includes('facebook')) {
        return social.facebook
            ? 'O lead veio do Facebook. Use linguagem proxima e prova social; se a conversa pedir, ofereca um unico botao do Facebook.'
            : 'O lead veio do Facebook. Use linguagem proxima e prova social, sem forcar rede social nao configurada.'
    }
    return 'Origem sem rede dominante. Se precisar gerar confianca, prefira Instagram como primeira prova social, sempre um link por vez.'
}

function inferBrazilRegionFromPhone(phoneRaw: string | undefined): string {
    const phone = normalizeWhatsAppPhone(phoneRaw)
    const local = phone.startsWith('55') ? phone.slice(2) : phone
    const ddd = local.slice(0, 2)
    if (!/^\d{2}$/.test(ddd)) return 'DDD nao identificado'

    const dddNum = Number(ddd)
    if (dddNum >= 11 && dddNum <= 19) return `DDD ${ddd}: Sao Paulo`
    if (dddNum >= 21 && dddNum <= 24) return `DDD ${ddd}: Rio de Janeiro/Espirito Santo`
    if (dddNum >= 27 && dddNum <= 28) return `DDD ${ddd}: Espirito Santo`
    if (dddNum >= 31 && dddNum <= 38) return `DDD ${ddd}: Minas Gerais`
    if (dddNum >= 41 && dddNum <= 46) return `DDD ${ddd}: Parana`
    if (dddNum >= 47 && dddNum <= 49) return `DDD ${ddd}: Santa Catarina`
    if (dddNum >= 51 && dddNum <= 55) return `DDD ${ddd}: Rio Grande do Sul`
    if (dddNum >= 61 && dddNum <= 69) return `DDD ${ddd}: Centro-Oeste/Norte`
    if (dddNum >= 71 && dddNum <= 79) return `DDD ${ddd}: Bahia/Sergipe`
    if (dddNum >= 81 && dddNum <= 89) return `DDD ${ddd}: Nordeste`
    if (dddNum >= 91 && dddNum <= 99) return `DDD ${ddd}: Norte`
    return `DDD ${ddd}: regiao brasileira nao mapeada`
}

function buildAdaptiveRapportPrompt(leadPhone: string | undefined, mode: 'soft' | 'strong'): string {
    const isStrong = mode === 'strong'
    return [
        '',
        `RAPPORT ADAPTATIVO ATIVADO (${isStrong ? 'FORTE' : 'SUAVE'}):`,
        `- Pista fraca pelo telefone: ${inferBrazilRegionFromPhone(leadPhone)}.`,
        '- Espelhe primeiro o jeito real que o lead escreve/fala: idioma, formalidade, energia, tamanho das mensagens e vocabulário.',
        '- Use DDD, localizacao e historico apenas como pistas secundarias. Nao conclua que a pessoa e daquela regiao so porque esta localizada ali.',
        '- Nao finja ser da mesma regiao do lead. Nao diga "sou baiano", "sou paulistano", "sou gaucho" ou parecido se isso nao for verdade.',
        isStrong
            ? '- Modo forte: pode usar regionalismo com mais presenca quando DDD/localizacao e o jeito do lead combinarem, mas ainda sem caricatura.'
            : '- Modo suave: regionalismo deve ser raro, leve e natural. Se o lead fala formal, responda formal mesmo que DDD/localizacao sugira outra regiao.',
        isStrong
            ? '- Se a regiao estiver clara e o lead for informal, use expressoes regionais de forma controlada em algumas respostas, nunca em todas.'
            : '- Se o lead usar expressoes regionais, voce pode acompanhar com moderacao. Exemplo: "massa", "show", "tranquilo", "meu rei", "bah", "tri", "mano", somente quando combinar com o jeito dele.',
        '- Evite caricatura, estereotipo, excesso de giria, piadas regionais ou imitacao forcada.',
        '- Para leads internacionais, responda no idioma/variante do lead quando evidente, mas mantenha tom consultivo e profissional.',
        '- O objetivo e gerar proximidade e fluidez, sem perder elegancia, autoridade e confianca.'
    ].join('\n')
}

async function buildLeadIntelligencePrompt(
    leadPhone: string | undefined,
    senderName: string | undefined,
    social: Record<string, string>
): Promise<string> {
    const candidates = phoneCandidates(leadPhone)
    if (!candidates.length) return ''

    try {
        const supabase = getSupabase()
        const { data: lead, error } = await supabase
            .from('leads')
            .select('id, name, email, phone, phone_e164, visitor_id, landing_page_id, city, state, country, metadata, acquired_via, funnel_stage, lead_purpose, lead_budget, lead_timeframe, lead_score, lead_classification, ai_summary, conversation_started_at, created_at, updated_at')
            .or(buildLeadPhoneOrFilter(candidates))
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error || !lead) {
            if (error) console.warn('[AI Lead Context] lead lookup failed:', error.message)
            return ''
        }

        let visitor: any = null
        if (lead.visitor_id) {
            const { data: visitorData, error: visitorError } = await supabase
                .from('visitors')
                .select('detected_source, device_type, browser, os, country, city, region, utm_source, utm_medium, utm_campaign, referrer, last_visit_at')
                .eq('id', lead.visitor_id)
                .maybeSingle()
            if (!visitorError) visitor = visitorData
        }

        let landingPage: any = null
        if (lead.landing_page_id) {
            const { data: landingData, error: landingError } = await supabase
                .from('landing_pages')
                .select('title, slug')
                .eq('id', lead.landing_page_id)
                .maybeSingle()
            if (!landingError) landingPage = landingData
        }

        const metadata = lead.metadata || {}
        const tracking = typeof metadata?.tracking === 'object' && metadata.tracking ? metadata.tracking : {}
        const source = visitor?.detected_source
            || readMetadataValue(tracking, ['detected_source'])
            || lead.acquired_via
            || 'Desconhecida'
        const hasKnownOrigin = !['desconhecida', 'direct', 'whatsapp'].includes(normalizeForSearch(source))
            || !!visitor?.utm_source
            || !!readMetadataValue(tracking, ['utm_source'])
            || !!lead.landing_page_id
            || !!lead.visitor_id
        const contextualLeadName = sanitizeLeadName(lead.name) || sanitizeLeadName(senderName) || ''

        const lines = [
            '',
            'CONTEXTO INTERNO DO LEAD (nao revele esses dados ao cliente):',
            `- Nome cadastrado: ${contextualLeadName || 'nao informado'}`,
            `- Telefone: ${lead.phone_e164 || lead.phone || leadPhone}`,
            `- Origem principal: ${source}`,
            `- UTM: source=${visitor?.utm_source || readMetadataValue(tracking, ['utm_source']) || '-'}; medium=${visitor?.utm_medium || readMetadataValue(tracking, ['utm_medium']) || '-'}; campaign=${visitor?.utm_campaign || readMetadataValue(tracking, ['utm_campaign']) || '-'}`,
            `- Landing page: ${landingPage?.title || landingPage?.slug || readMetadataValue(metadata, ['landing_page_slug']) || '-'}`,
            `- Dispositivo/localizacao: ${visitor?.device_type || readMetadataValue(tracking, ['device_type']) || '-'}; ${visitor?.city || lead.city || readMetadataValue(tracking, ['city']) || '-'} ${visitor?.region || lead.state || readMetadataValue(tracking, ['region']) || ''}`,
            `- Status atual: ${lead.funnel_stage || '-'}; classificacao=${lead.lead_classification || '-'}; score=${lead.lead_score ?? '-'}`,
            `- Dados ja conhecidos: finalidade=${lead.lead_purpose || '-'}; orcamento=${lead.lead_budget || '-'}; prazo=${lead.lead_timeframe || '-'}`,
            lead.ai_summary ? `- Resumo anterior: ${String(lead.ai_summary).slice(0, 450)}` : '',
            '',
            'COMO USAR ESSE CONTEXTO:',
            '- Nao pergunte de novo uma informacao que ja esta conhecida. Confirme com naturalidade se precisar.',
            '- Extraia aos poucos: finalidade (investimento/moradia), valor disponivel, prazo de compra, regiao, tipo de imovel, objecoes e nivel de urgencia.',
            '- Faca uma pergunta por vez. Nunca transforme a conversa em formulario.',
            '- Se o nome cadastrado estiver "nao informado", pergunte uma unica vez e de forma leve como pode chamar a pessoa. Exemplo: "A proposito, como posso te chamar?"',
            '- Se ja perguntou o nome antes ou o cliente ignorou, nao insista; siga ajudando normalmente.',
            hasKnownOrigin
                ? '- A origem do lead ja esta conhecida; nao pergunte como ele conheceu a Pilger, a menos que seja relevante para a conversa.'
                : '- A origem ainda nao esta clara. No decorrer da conversa, pergunte uma unica vez e de forma natural como ele conheceu a Pilger. Exemplo: "So para eu entender melhor, voce chegou ate a gente pelo Instagram, Google ou indicacao?"',
            '- Use autoridade, prova social, escassez e urgencia com sobriedade; a prioridade e confianca e qualificacao.',
            '- Detecte o idioma do cliente e responda no mesmo idioma.',
            `- Estrategia de rede social: ${buildSocialStrategyFromSource(source, social)}`,
        ].filter(Boolean)

        return lines.join('\n')
    } catch (err) {
        console.warn('[AI Lead Context] failed:', err)
        return ''
    }
}

export async function generateAIResponse(
    configs: Record<string, string>,
    broker: any,
    messages: any[],
    senderName?: string,
    leadPhone?: string
): Promise<{ text: string; shouldTransfer: boolean; extractedData?: any }> {
    const lastUserTextRaw = String(messages[messages.length - 1]?.content || '')
    const lastUserText = lastUserTextRaw.toLowerCase().trim()
    const globalProvider = configs['ai_provider'] || 'openai'
    const effectiveProvider = configs['whatsapp_provider'] || globalProvider
    const apiKey = effectiveProvider === 'openai' ? configs['openai_api_key'] : configs['gemini_api_key']

    if (!apiKey) {
        console.error('[AI Response] No API key for provider:', effectiveProvider)
        return { text: 'Desculpe, estou com um problema técnico. Por favor, tente novamente em breve.', shouldTransfer: false }
    }

    // Prompt único: broker.system_prompt com tags processadas, ou fallback natural
    const spTime = getSaoPauloTimeContext()
    const brokerName = broker.name || 'Corretor'
    const safeLeadName = sanitizeLeadName(senderName)
    const customPrompt = String(broker.system_prompt || '').trim()
    const hasCustomPrompt = customPrompt.length > 0
    const rawPrompt = hasCustomPrompt ? customPrompt : `Você é ${brokerName}, corretor de imóveis da Pilger Imóveis.
Converse naturalmente no WhatsApp, como uma pessoa real.
Seja simpático, use linguagem informal mas profissional.
Use frases curtas — é WhatsApp, não email.
NUNCA pareça robô ou siga roteiro engessado.

Colete naturalmente durante a conversa: nome, interesse (morar/investir), região, orçamento.
Quando o lead demonstrar interesse real e você tiver os dados, ofereça agendar uma visita com {agendamento}.
Quando tiver todas as informações, use {transferir} para passar ao corretor humano.
Use o nome do lead com moderacao quando souber: {nome_lead}. Nao chame pelo nome em toda resposta.

NUNCA revele que é IA. Nunca invente dados de imóveis. Nunca fale preço exato.`
    const promptUsesPropertyCatalog = /\{imoveis\}/i.test(rawPrompt)

    // ═══ Carregar configs dinâmicas do admin ═══
    const agentConfigs: Record<string, string> = {}
    try {
        const supabase = getSupabase()
        const { data: cfgRows } = await supabase
            .from('app_config')
            .select('key, value')
            .like('key', 'agent_%')
        if (cfgRows) {
            for (const row of cfgRows) agentConfigs[row.key] = row.value
        }
    } catch (err) {
        console.error('[AI Agent] Erro ao carregar agent configs:', err)
    }

    // Parsear configs JSON com fallback
    let regionsForList = 'Balneário Camboriú|Itapema|Itajaí|Porto Belo'
    try {
        const parsed = JSON.parse(agentConfigs['agent_regions'] || '[]')
        if (parsed.length > 0) regionsForList = parsed.join('|')
    } catch {}

    let docsForButtons = 'RG e CPF|Comprovante de Renda|Todos os Documentos'
    try {
        const parsed = JSON.parse(agentConfigs['agent_required_documents'] || '[]')
        if (parsed.length > 0) docsForButtons = parsed.join('|')
    } catch {}

    let hoursText = 'segunda a sexta, das 9h às 18h, e sábados das 9h às 13h'
    try {
        const h = JSON.parse(agentConfigs['agent_working_hours'] || '{}')
        if (h.seg_sex_inicio) {
            hoursText = `segunda a sexta, das ${h.seg_sex_inicio} às ${h.seg_sex_fim}`
            if (h.sab_inicio && h.sab_fim) hoursText += `, sábados das ${h.sab_inicio} às ${h.sab_fim}`
            if (h.dom && h.dom !== 'Fechado') hoursText += `, domingos ${h.dom}`
            else hoursText += ', domingos fechado'
        }
    } catch {}

    const companyName = agentConfigs['agent_company_name'] || 'Pilger Imóveis'
    const companyDesc = agentConfigs['agent_company_description'] || 'referência em imóveis de alto padrão em Balneário Camboriú e região'
    const companyLocationUrl = agentConfigs['agent_company_location_url'] || 'https://maps.app.goo.gl/javGAuakYTwsQrmLA'
    const socialInstagram = agentConfigs['agent_social_instagram'] || ''
    const socialFacebook = agentConfigs['agent_social_facebook'] || ''
    const socialYoutube = agentConfigs['agent_social_youtube'] || ''
    const socialLinkedin = agentConfigs['agent_social_linkedin'] || ''
    const socialTiktok = agentConfigs['agent_social_tiktok'] || ''
    const socialSite = agentConfigs['agent_social_site'] || ''
    const socialLinksList = [
        socialInstagram ? `Instagram: ${socialInstagram}` : '',
        socialYoutube ? `YouTube: ${socialYoutube}` : '',
        socialFacebook ? `Facebook: ${socialFacebook}` : '',
        socialLinkedin ? `LinkedIn: ${socialLinkedin}` : '',
        socialTiktok ? `TikTok: ${socialTiktok}` : '',
        socialSite ? `Site: ${socialSite}` : '',
    ].filter(Boolean).join(' | ')
    const socialUrlButtons = [
        socialInstagram ? `Instagram=>${socialInstagram}` : '',
        socialYoutube ? `YouTube=>${socialYoutube}` : '',
        socialSite ? `Site=>${socialSite}` : '',
        socialFacebook ? `Facebook=>${socialFacebook}` : '',
        socialLinkedin ? `LinkedIn=>${socialLinkedin}` : '',
        socialTiktok ? `TikTok=>${socialTiktok}` : '',
    ].filter(Boolean).slice(0, 4)
    let customLinkButtons: Array<{
        name: string
        tag: string
        type?: string
        url?: string
        title?: string
        options?: string[]
        listButton?: string
        listChoices?: string[]
        pixKey?: string
        pixName?: string
        pixType?: string
        carouselJson?: string
    }> = []
    try {
        const parsed = JSON.parse(agentConfigs['agent_link_buttons'] || '[]')
        if (Array.isArray(parsed)) customLinkButtons = parsed
    } catch {}
    // Processar tags no prompt
    let basePromptWithTags = rawPrompt
        .replace(/\{nome_corretor\}/g, brokerName)
        .replace(/\{nome_lead\}/g, safeLeadName || 'cliente')
        .replace(/\{agendamento\}/g, hasCustomPrompt ? '[BOTOES:Agendar visita|Manhã|Tarde|Noite]' : 'envie botões com [BOTOES:Agendar Visita|Manhã|Tarde|Noite] para o cliente escolher')
        .replace(/\{regioes\}/g, `[LISTA:Ver Regiões|${regionsForList}]`)
        .replace(/\{transferir\}/g, hasCustomPrompt ? '[TRANSFERIR]' : 'use [TRANSFERIR] para encaminhar ao corretor humano')
        .replace(/\{documentos\}/g, `[BOTOES:Enviar Documentos|${docsForButtons}]`)
        .replace(/\{horario\}/g, hasCustomPrompt ? hoursText : `informe que o atendimento é de ${hoursText}`)
        .replace(/\{empresa\}/g, hasCustomPrompt ? `${companyName} — ${companyDesc}` : `mencione que a ${companyName} é ${companyDesc}`)
        .replace(/\{localizacao_empresa\}/g, companyLocationUrl || 'localizacao nao configurada')
        .replace(/\{imoveis\}/g, 'use o catalogo de imoveis ativos abaixo como referencia; sugira somente opcoes que combinem com o que o cliente pediu')
        .replace(/\{instagram\}/g, socialInstagram || 'instagram não configurado')
        .replace(/\{facebook\}/g, socialFacebook || 'facebook não configurado')
        .replace(/\{youtube\}/g, socialYoutube || 'youtube não configurado')
        .replace(/\{linkedin\}/g, socialLinkedin || 'linkedin não configurado')
        .replace(/\{tiktok\}/g, socialTiktok || 'tiktok não configurado')
        .replace(/\{site\}/g, socialSite || 'site não configurado')
        .replace(/\{redes_sociais\}/g, socialUrlButtons.length
            ? `[BOTOES_URL:Redes sociais|${socialUrlButtons.join('|')}]`
            : (socialLinksList || 'redes sociais não configuradas'))

    basePromptWithTags = basePromptWithTags.replace(
        /\[BOTOES:Agendar visita\|[^\]]+\]|\[BOTOES:Agendar Visita\|[^\]]+\]/gi,
        'use o CONTEXTO DE AGENDA REAL DO CORRETOR abaixo; ofereca no maximo 2 horarios livres e registre a visita somente quando o cliente confirmar'
    )

    const hasCustomInstagramButton = customLinkButtons.some((btn) => String(btn?.tag || '').trim() === '{botao_instagram}')
    if (!hasCustomInstagramButton) {
        basePromptWithTags = basePromptWithTags.replace(
            /\{botao_instagram\}/g,
            socialInstagram ? `[BOTOES_URL:Instagram|Instagram=>${socialInstagram}]` : 'instagram nao configurado'
        )
    }

    const standardButtonTags: Array<[RegExp, string, string, string]> = [
        [/\{botao_facebook\}/g, 'Facebook', 'Facebook', socialFacebook],
        [/\{botao_youtube\}/g, 'YouTube', 'YouTube', socialYoutube],
        [/\{botao_tiktok\}/g, 'TikTok', 'TikTok', socialTiktok],
        [/\{botao_linkedin\}/g, 'LinkedIn', 'LinkedIn', socialLinkedin],
        [/\{botao_site\}/g, 'Site', 'Abrir site', socialSite],
        [/\{botao_localizacao\}/g, 'Localizacao', 'Como chegar', companyLocationUrl],
    ]
    for (const [pattern, title, label, url] of standardButtonTags) {
        basePromptWithTags = basePromptWithTags.replace(
            pattern,
            url ? `[BOTOES_URL:${title}|${label}=>${url}]` : `${label.toLowerCase()} nao configurado`
        )
    }

    // Dynamic URL button tags created by admin (e.g. {botao_instagram_vip})
    for (const btn of customLinkButtons) {
        const tag = String(btn?.tag || '').trim()
        const name = String(btn?.name || '').trim()
        const type = String(btn?.type || 'URL').toUpperCase()
        if (!tag || !name) continue
        const safeTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        let replacement = ''

        if (type === 'URL') {
            const url = String(btn?.url || '').trim()
            if (!url) continue
            replacement = `[BOTOES_URL:${name}|${name}=>${url}]`
        } else if (type === 'BUTTON') {
            const title = String(btn?.title || name).trim()
            const options = Array.isArray(btn?.options) ? btn.options.map((o: any) => String(o || '').trim()).filter(Boolean) : []
            if (!options.length) continue
            replacement = `[BOTOES:${title}|${options.join('|')}]`
        } else if (type === 'LIST') {
            const listButton = String(btn?.listButton || 'Ver opções').trim()
            const choices = Array.isArray(btn?.listChoices) ? btn.listChoices.map((o: any) => String(o || '').trim()).filter(Boolean) : []
            if (!choices.length) continue
            replacement = `[LISTA:${listButton}|${choices.join('|')}]`
        } else if (type === 'POLL') {
            const question = String(btn?.title || 'Qual opção você prefere?').trim()
            const options = Array.isArray(btn?.options) ? btn.options.map((o: any) => String(o || '').trim()).filter(Boolean) : []
            if (options.length < 2) continue
            replacement = `[ENQUETE:${question}|${options.join('|')}]`
        } else if (type === 'LOCATION') {
            replacement = '[LOCALIZACAO]'
        } else if (type === 'PIX') {
            const pixKey = String(btn?.pixKey || '').trim()
            if (!pixKey) continue
            const pixName = String(btn?.pixName || name || 'Pagamento').trim()
            const pixType = String(btn?.pixType || 'EVP').trim().toUpperCase()
            replacement = `[PIX:${pixKey}|${pixName}|${pixType}]`
        } else if (type === 'CAROUSEL') {
            const carouselRaw = String(btn?.carouselJson || '').trim()
            if (!carouselRaw) continue
            try {
                const parsed = JSON.parse(carouselRaw)
                const normalized = Array.isArray(parsed)
                    ? { text: name, cards: parsed }
                    : parsed
                const encoded = Buffer.from(JSON.stringify(normalized), 'utf-8').toString('base64')
                replacement = `[CAROUSEL_JSON:${encoded}]`
            } catch {
                continue
            }
        }

        if (!replacement) continue
        basePromptWithTags = basePromptWithTags.replace(new RegExp(safeTag, 'g'), replacement)
    }

    let systemPrompt = `${buildCurrentDatePrompt(spTime)}\n\n${basePromptWithTags}`
    if (!hasCustomPrompt) {
        systemPrompt += '\n\nIMPORTANTE: Nunca envie mais de 1 elemento interativo por mensagem. Use botões/listas SOMENTE quando fizer sentido na conversa — nunca como roteiro.'
        + `\n\nCONTEXTO DE TEMPO (America/Sao_Paulo): agora sao ${spTime.time} de ${spTime.date}. Saudacao correta neste momento: "${spTime.greeting}".`
        + '\nREGRAS DE SAUDACAO:'
        + '\n- Sempre valide a saudacao pelo horario atual antes de responder.'
        + '\n- Nao espelhe automaticamente a saudacao enviada pelo cliente.'
        + '\n- Se o cliente usar saudacao fora do horario, responda com a saudacao correta do horario atual.'
        + '\n- Nao diga que esta corrigindo o cliente; apenas responda de forma natural e humana.'
        + '\nREGRAS DE REDES SOCIAIS:'
        + '\n- Envie redes sociais somente quando fizer sentido (prova social, vídeos, portfólio, pedido do cliente).'
        + '\n- Se o cliente demonstrar preferência por vídeos, priorize YouTube quando configurado.'
        + '\n- Se enviar rede social, prefira compartilhar 1 link por vez para manter a conversa natural.'
    }

    // ═══ CATÁLOGO DE IMÓVEIS — Injetar imóveis reais no contexto do agente ═══
    const leadIntelligencePrompt = await buildLeadIntelligencePrompt(leadPhone, senderName, {
        instagram: socialInstagram,
        youtube: socialYoutube,
        facebook: socialFacebook,
        linkedin: socialLinkedin,
        tiktok: socialTiktok,
        site: socialSite,
    })
    if (leadIntelligencePrompt) {
        systemPrompt += `\n${leadIntelligencePrompt}`
    }
    const rapportModeRaw = String(configs['whatsapp_adaptive_rapport_mode'] || '').toLowerCase()
    const rapportMode: 'off' | 'soft' | 'strong' = rapportModeRaw === 'strong'
        ? 'strong'
        : (rapportModeRaw === 'soft' || configs['whatsapp_adaptive_rapport_enabled'] === 'true' ? 'soft' : 'off')
    if (rapportMode !== 'off') {
        systemPrompt += `\n${buildAdaptiveRapportPrompt(leadPhone, rapportMode)}`
    }

    const agendaPrompt = await buildBrokerAgendaPrompt(broker?.id)
    if (agendaPrompt) {
        systemPrompt += `\n${agendaPrompt}`
    }

    systemPrompt += '\n\nDIRETRIZES DE QUALIFICACAO:\n- O objetivo e filtrar e amadurecer o lead, nao apenas responder perguntas.\n- Conduza a conversa com naturalidade, como consultor imobiliario experiente no WhatsApp.\n- Descubra aos poucos se o cliente busca investimento, moradia ou os dois; qual valor disponivel; prazo de compra; regiao; tipo de imovel; e objecoes.\n- Se a origem do lead nao estiver clara, pergunte uma unica vez no decorrer da conversa como ele conheceu a Pilger, sem parecer pesquisa ou formulario.\n- Antes de falar de valor, reforce beneficio, posicionamento, seguranca e adequacao ao objetivo do cliente.\n- Quando houver intencao real, aproxime do corretor humano, visita ou imovel especifico.\n- Nunca envie todas as redes sociais juntas; escolha uma quando o contexto pedir.\n- Se o cliente mencionar Facebook, Instagram, Google, YouTube ou trafego como origem/desconfianca, trate a objecao primeiro; nao envie link automaticamente se ele nao pediu.\n- Use botao de agendamento somente quando o cliente pedir, aceitar ou demonstrar claramente que quer marcar visita/reuniao agora.\n- Nao envie botoes Manha/Tarde/Noite junto com uma explicacao de imovel, investimento ou curadoria se o cliente ainda nao pediu agendamento.\n\nNATURALIDADE NO USO DO NOME:\n- Use o nome do lead somente de vez em quando: abertura importante, retomada depois de pausa, fechamento ou momento de proximidade.\n- Nao comece toda resposta chamando pelo nome.\n- Nao repita o nome mais de uma vez na mesma resposta.\n- Se o nome cadastrado parecer nome de plataforma, empresa, sistema ou bot, nao use como nome da pessoa.\n\nREGRAS PARA AUDIO E VALORES:\n- Quando mencionar valores, metragem ou numeros importantes, escreva de forma falada e natural.\n- Prefira "vinte e dois milhoes de reais" em vez de "R$ 22.000.000" quando a resposta puder virar audio.\n- Para metragem, prefira "duzentos metros quadrados" em vez de "200m2".'

    systemPrompt += '\n\nRESPOSTAS QUANDO O CLIENTE ENVIA MIDIA:\n- Se o cliente enviar imagem, video ou documento, responda com blocos curtos, como conversa real de WhatsApp.\n- Ao reconhecer um imovel por imagem, cite apenas o essencial: nome, cidade/regiao e um ponto forte.\n- Se enviar botao de imovel, deixe a explicacao fora do card e use o card apenas como chamada curta, por exemplo "Ver imovel".\n- Nao envie textao junto com botao. Faca no maximo uma pergunta de continuacao.'

    systemPrompt += buildSpecialLeadScenarioPrompt(configs)

    if (!safeLeadName) {
        const alreadyAskedName = messages.some((m: any) =>
            m?.role === 'assistant'
            && /como posso te chamar|qual (e|é) seu nome|me fala seu nome|seu nome/i.test(String(m?.content || ''))
        )
        if (!alreadyAskedName) {
            systemPrompt += '\n\nNOME DO LEAD AINDA NAO CONFIAVEL:\n- Nao use o nome exibido pelo WhatsApp se ele parecer sistema/plataforma.\n- Em uma abertura natural, pergunte uma vez como pode chamar a pessoa.\n- Nao interrompa a ajuda principal so para perguntar o nome; encaixe no fim ou no inicio de forma leve.'
        }
    }

    if (!hasCustomPrompt || promptUsesPropertyCatalog) {
    try {
        const supabase = getSupabase()
        const requestedBudget = extractRequestedBudgetV2(
            messages
                .filter((m: any) => m?.role === 'user' && typeof m?.content === 'string')
                .slice(-4)
                .map((m: any) => m.content)
                .join(' ')
        )
        const appUrl = getPublicAppUrl()
        let propertiesQuery = supabase
            .from('properties')
            .select('id, title, city, state, price, property_type, bedrooms, bathrooms, area_m2, amenities, description, created_at')
            .eq('status', 'active')

        if (requestedBudget) {
            propertiesQuery = propertiesQuery
                .gte('price', requestedBudget * 0.5)
                .lte('price', requestedBudget * 2.0)
                .order('price', { ascending: false })
                .limit(100)
        } else {
            propertiesQuery = propertiesQuery
                .order('created_at', { ascending: false })
                .limit(80)
        }

        const { data: properties } = await propertiesQuery

        const { data: landingPages } = await supabase
            .from('landing_pages')
            .select('slug, property_id')
            .eq('status', 'published')

        const landingPageByPropertyId = new Map<string, string>()
        for (const lp of landingPages || []) {
            if (lp?.property_id && lp?.slug) landingPageByPropertyId.set(String(lp.property_id), String(lp.slug))
        }

        if (properties && properties.length > 0) {
            const rankedProperties = [...properties]
                .sort((a: any, b: any) => {
                    if (requestedBudget) {
                        const aPrice = Number(a.price || 0)
                        const bPrice = Number(b.price || 0)
                        if (aPrice && bPrice) return Math.abs(aPrice - requestedBudget) - Math.abs(bPrice - requestedBudget)
                        if (aPrice) return -1
                        if (bPrice) return 1
                    }
                    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                })
                .slice(0, requestedBudget ? 18 : 30)

            const catalog = rankedProperties.map((p: any, i: number) => {
                const parts: string[] = []
                parts.push(`${i + 1}. ${p.title}`)
                if (p.city) parts.push(`📍 ${p.city}${p.state ? '/' + p.state : ''}`)
                if (p.price) parts.push(`💰 R$ ${Number(p.price).toLocaleString('pt-BR')}`)
                if (p.property_type) parts.push(`🏠 ${p.property_type}`)
                const specs: string[] = []
                if (p.bedrooms) specs.push(`${p.bedrooms}q`)
                if (p.bathrooms) specs.push(`${p.bathrooms}b`)
                if (p.area_m2) specs.push(`${p.area_m2}m²`)
                if (specs.length) parts.push(`📐 ${specs.join(' | ')}`)
                if (p.amenities?.length) parts.push(`✨ ${p.amenities.slice(0, 4).join(', ')}`)
                if (p.description) parts.push(`ℹ️ ${p.description.substring(0, 100)}${p.description.length > 100 ? '...' : ''}`)
                const slug = landingPageByPropertyId.get(String(p.id))
                const path = slug ? `/${slug}` : `/imovel/${p.id}`
                const buttonLabel = `Ver ${String(p.title || 'imovel').replace(/\s+/g, ' ').trim()}`.substring(0, 20)
                parts.push(`BOTAO: [BOTOES_URL:${buttonLabel}|${buttonLabel}=>${appUrl}${path}]`)
                return parts.join(' | ')
            }).join('\n')

            systemPrompt += `\n\nCATALOGO DE IMOVEIS DISPONIVEIS\n${catalog}\n\nUSO DO CATALOGO:\n- Quando o cliente informar orcamento, tipo ou regiao, escolha o imovel mais proximo. Pode sugerir um pouco acima ou abaixo se fizer sentido.\n- Recomende no maximo 1 imovel por resposta, ou 2 somente se o cliente pedir comparacao.\n- Ao recomendar um imovel, copie exatamente o BOTAO do imovel escolhido para enviar o botao "Ver imovel" ao cliente.\n- Nao envie botao de imovel que nao foi recomendado na mesma resposta.\n- Nao liste todos de uma vez.\n- Diga "a partir de R$ X" em vez de tratar valor como promessa final.\n- Se nao tiver nada que combine, diga que tem opcoes sendo lancadas e pergunte se pode avisar quando sair.`
        }
    } catch (err) {
        console.error('[AI Agent] Erro ao carregar catálogo de imóveis:', err)
    }
    }

    const chatMessages = messages.map((m: any) => ({ role: m.role, content: m.content }))

    try {
        let responseText = ''
        if (effectiveProvider === 'openai') {
            const model = configs['openai_whatsapp_model'] || 'gpt-4o-mini'
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, ...chatMessages], max_tokens: 500, temperature: 0.8 })
            })
            const data = await res.json()
            responseText = data.choices?.[0]?.message?.content || ''
        } else {
            const model = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: chatMessages.map((m: any) => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    }))
                })
            })
            const data = await res.json()
            await recordGeminiUsage({
                model,
                feature: 'whatsapp_agent_response',
                usageMetadata: data.usageMetadata,
                metadata: {
                    broker_id: broker?.id || null,
                    lead_phone: leadPhone || null,
                },
            })
            responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        }

        const appointmentMarkerResult = parseAppointmentMarkers(responseText)
        const appointmentMarkerCount = appointmentMarkerResult.markers.length
        if (appointmentMarkerResult.markers.length > 0) {
            await saveAppointmentMarkers({
                markers: appointmentMarkerResult.markers,
                broker,
                leadPhone,
                senderName,
            })
            responseText = appointmentMarkerResult.cleanedText
        }

        const conversationText = messages
            .filter((m: any) => typeof m?.content === 'string' && m.content.trim())
            .map((m: any) => `${m.role === 'assistant' ? 'Agente' : 'Lead'}: ${m.content}`)
            .join('\n')
        const extractedData = extractLeadDataForCrm(
            conversationText || messages[messages.length - 1]?.content || '',
            responseText,
            senderName
        )
        if (appointmentMarkerCount > 0) {
            extractedData.appointment_created_from_marker = true
        }
        const shouldTransfer = /\[transferir\]/i.test(responseText) || /\[transfer\]/i.test(responseText)
        const cleanText = responseText.replace(/\[transferir\]/gi, '').replace(/\[transfer\]/gi, '').trim()
        if (!cleanText) {
            return {
                text: 'Desculpe, não consegui formular uma resposta agora. Pode repetir de outra forma?',
                shouldTransfer: false,
                extractedData
            }
        }
        const finalText = limitNameMentions(
            normalizeGreetingByTime(cleanText, lastUserText, spTime.greeting),
            senderName
        )
        return { text: finalText, shouldTransfer, extractedData }
    } catch (error) {
        console.error('[AI Response Error]', error)
        return { text: 'Desculpe, tive uma falha técnica momentânea. Pode enviar novamente?', shouldTransfer: false }
    }
}

// ═══════════════════════════════════════════════════════════════
// INNGEST FUNCTION: Process WhatsApp Message
// ═══════════════════════════════════════════════════════════════

export const processWhatsAppMessage = inngest.createFunction(
    {
        id: 'whatsapp-agent-process-message',
        name: 'WhatsApp Agent — Process Incoming Message',
        retries: 1,
        concurrency: [
            { limit: 5 },
            { limit: 1, key: 'event.data.cleanPhone' },  // serialize per phone
        ],
    },
    { event: 'whatsapp/message-received' },
    async ({ event, step }) => {
        const {
            cleanPhone, messageText, isAudio, audioUrl, audioMediaKey, audioDirectPath, messageId,
            messageType, mediaUrl, mediaMimetype, mediaFilename, mediaType,
            buttonResponseId, buttonResponseTitle, pollVotes,
            queuedMessageKey,
            instanceId, instanceToken, instanceName, brokerId, senderName
        } = event.data
        const isMediaMessage = !isAudio && !!mediaType && ['image', 'video', 'document'].includes(String(mediaType))

        const supabase = getSupabase()

        // ── Step 1: Load instance + broker ──
        const { instance, broker, configs } = await step.run('load-context', async () => {
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .single()

            if (!inst) throw new Error(`Instance not found: ${instanceId}`)

            const effectiveBrokerId = brokerId || inst.broker_id
            let brokerData = null
            if (effectiveBrokerId) {
                const { data } = await supabase
                    .from('virtual_brokers')
                    .select('*')
                    .eq('id', effectiveBrokerId)
                    .single()
                brokerData = data
            }

            const cfgs = await loadAIConfigs(supabase, instanceId)
            return { instance: inst, broker: brokerData, configs: cfgs }
        })

        if (!broker || !broker.is_active) {
            console.warn(`[WhatsApp Agent] No active broker found for instance ${instanceName}`)
            return { action: 'skipped', reason: 'no_active_broker' }
        }

        // ── Step 2: Find or create conversation ──
        const conversation = await step.run('find-or-create-conversation', async () => {
            await ensureWhatsAppLead(supabase, {
                phone: cleanPhone,
                senderName,
                instanceId,
                instanceName,
                brokerId: broker.id,
                acquiredVia: 'whatsapp',
            }).catch(() => null)
            const { data: existing } = await supabase
                .from('whatsapp_ai_conversations')
                .select('*')
                .eq('broker_id', broker.id)
                .eq('lead_phone', cleanPhone)
                .in('status', ['active', 'human_takeover', 'transferred'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (existing) {
                // Co-piloto ativo: conversas antigas marcadas como transferred
                // voltam para active para a IA global seguir atendendo normalmente.
                if (existing.status === 'transferred') {
                    await supabase
                        .from('whatsapp_ai_conversations')
                        .update({ status: 'active', updated_at: new Date().toISOString() })
                        .eq('id', existing.id)
                    return { ...existing, status: 'active' }
                }
                return existing
            }

            const { data: newConv } = await supabase
                .from('whatsapp_ai_conversations')
                .insert({
                    broker_id: broker.id,
                    instance_id: instanceId,
                    lead_phone: cleanPhone,
                    messages: [],
                    bot_message_ids: [],
                    status: 'active'
                })
                .select()
                .single()

            return newConv
        })

        if (!conversation) {
            return { action: 'error', reason: 'could_not_create_conversation' }
        }

        // Check if agent is enabled
        if (configs['whatsapp_agent_enabled'] === 'false') {
            if (messageText?.trim()) {
                await appendConversationMessage(supabase, conversation.id, {
                    role: 'user',
                    content: messageText.trim(),
                    type: isAudio ? 'audio' : 'text',
                    source: 'lead',
                }).catch(() => { })
            }
            console.log(`[WhatsApp Agent] Agent disabled, skipping`)
            return { action: 'skipped', reason: 'agent_disabled' }
        }

        const leadIsOptedOut = await step.run('check-lead-opt-out', async () => {
            if (!configEnabled(configs, 'whatsapp_detect_opt_out_enabled')) return false
            const { data: lead } = await supabase
                .from('lead_collected_data')
                .select('status, notes')
                .eq('lead_phone', cleanPhone)
                .maybeSingle()

            return lead?.status === 'lost' && /opt_out_whatsapp/i.test(String(lead?.notes || ''))
        })

        if (leadIsOptedOut && detectControlledLeadIntent(String(messageText || ''), configs) !== 'opt_out') {
            if (messageText?.trim()) {
                await appendConversationMessage(supabase, conversation.id, {
                    role: 'user',
                    content: messageText.trim(),
                    type: isAudio ? 'audio' : 'text',
                    source: 'lead',
                }).catch(() => { })
            }
            console.log(`[WhatsApp Agent] Lead ${cleanPhone} is opted out, skipping`)
            return { action: 'skipped', reason: 'lead_opted_out' }
        }

        // Check if current time is inside AI service schedule (when enabled)
        const scheduleStatus = isWithinAISchedule(configs)
        if (scheduleStatus.enabled && !scheduleStatus.within) {
            if (messageText?.trim()) {
                await appendConversationMessage(supabase, conversation.id, {
                    role: 'user',
                    content: messageText.trim(),
                    type: isAudio ? 'audio' : 'text',
                    source: 'lead',
                }).catch(() => { })
            }
            const tzNow = getNowInTimezone(scheduleStatus.timezone || 'America/Sao_Paulo')
            const cycleDate = `${tzNow.getFullYear()}${String(tzNow.getMonth() + 1).padStart(2, '0')}${String(tzNow.getDate()).padStart(2, '0')}`
            const startKey = String(configs['whatsapp_ai_schedule_start'] || '18:00').replace(':', '')
            const endKey = String(configs['whatsapp_ai_schedule_end'] || '08:00').replace(':', '')
            await sendHandoffSummaryIfNeeded(supabase, {
                conversation,
                instanceId,
                instanceToken,
                recipientPhone: cleanPhone,
                markerSuffix: `schedule_${cycleDate}_${startKey}_${endKey}`,
            }).catch(() => { })
            await sendShiftConsolidatedSummaryIfNeeded(supabase, {
                brokerId: broker.id,
                instanceId,
                instanceToken,
                timezone: scheduleStatus.timezone || 'America/Sao_Paulo',
                markerSuffix: `${cycleDate}_${startKey}_${endKey}`,
            }).catch(() => { })
            console.log(`[WhatsApp Agent] Outside AI schedule (${scheduleStatus.timezone}), skipping`)
            return { action: 'skipped', reason: 'outside_ai_schedule' }
        }

        // Check human_takeover
        const humanInterventionEnabled = configs['whatsapp_human_intervention'] !== 'false'
        if (humanInterventionEnabled && conversation.status === 'human_takeover') {
            // Check if auto-reactivation time has passed
            const interventionMinutes = parseInt(configs['whatsapp_human_intervention_minutes'] || '60')
            const takeoverAt = conversation.human_takeover_at
            if (takeoverAt && interventionMinutes > 0) {
                const elapsed = (Date.now() - new Date(takeoverAt).getTime()) / 60000
                if (elapsed >= interventionMinutes) {
                    const canReactivateNow = !scheduleStatus.enabled || scheduleStatus.within
                    if (canReactivateNow) {
                        console.log(`[WhatsApp Agent] Auto-reactivating after ${Math.floor(elapsed)}min`)
                        await supabase
                            .from('whatsapp_ai_conversations')
                            .update({ status: 'active', human_takeover_at: null, updated_at: new Date().toISOString() })
                            .eq('id', conversation.id)
                    } else {
                        console.log(`[WhatsApp Agent] Reactivation window reached, but outside AI schedule; keeping human takeover`)
                        return { action: 'skipped', reason: 'human_takeover_outside_schedule' }
                    }
                } else {
                    if (messageText?.trim()) {
                        await appendConversationMessage(supabase, conversation.id, {
                            role: 'user',
                            content: messageText.trim(),
                            type: isAudio ? 'audio' : 'text',
                            source: 'lead',
                        }).catch(() => { })
                    }
                    console.log(`[WhatsApp Agent] Conversation in human_takeover, skipping`)
                    return { action: 'skipped', reason: 'human_takeover' }
                }
            } else {
                if (messageText?.trim()) {
                    await appendConversationMessage(supabase, conversation.id, {
                        role: 'user',
                        content: messageText.trim(),
                        type: isAudio ? 'audio' : 'text',
                        source: 'lead',
                    }).catch(() => { })
                }
                console.log(`[WhatsApp Agent] Conversation in human_takeover, skipping`)
                return { action: 'skipped', reason: 'human_takeover' }
            }
        }

        // ── Manual Debounce: wait 15s to collect multiple messages ──
        // (Per-phone concurrency=1 ensures only one function runs at a time)

        // Quick check: if this event's queue item was already consumed by a
        // previous batch run, skip it even if newer messages exist for the lead.
        const queueWork = await step.run('check-queue', async () => {
            const queuePattern = `_pmq_${cleanPhone}_%`

            if (queuedMessageKey) {
                const { data: ownQueueItem, error: ownQueueError } = await supabase
                    .from('app_config')
                    .select('key')
                    .eq('key', queuedMessageKey)
                    .maybeSingle()

                if (ownQueueError) throw ownQueueError

                if (!ownQueueItem?.key) {
                    return {
                        hasWork: false,
                        reason: 'queued_key_already_consumed',
                        pendingCount: 0,
                        ownsQueue: false,
                    }
                }

                const { count, error: countError } = await supabase
                    .from('app_config')
                    .select('key', { count: 'exact', head: true })
                    .like('key', queuePattern)

                if (countError) throw countError

                return {
                    hasWork: true,
                    reason: 'owns_queue',
                    pendingCount: count || 1,
                    ownsQueue: true,
                }
            }

            const { data } = await supabase
                .from('app_config')
                .select('key')
                .like('key', queuePattern)
                .limit(1)
            const pendingCount = data?.length || 0
            const hasWork = pendingCount > 0 || isAudio || isMediaMessage
            return {
                hasWork,
                reason: pendingCount > 0
                    ? 'legacy_pending_queue'
                    : isAudio
                        ? 'audio_fallback'
                        : isMediaMessage
                            ? 'media_fallback_without_queue_key'
                            : 'empty_queue',
                pendingCount,
                ownsQueue: false,
            }
        })

        if (!queueWork.hasWork) {
            console.log(`[WhatsApp Agent] Queue empty for ${cleanPhone}, skipping (${queueWork.reason})`)
            await step.run('log-no-queue-work', async () => {
                await recordAgentLog(supabase, {
                    action: queueWork.reason === 'queued_key_already_consumed'
                        ? 'agent_skip_stale_queue'
                        : 'agent_no_queue_work',
                    instanceName,
                    messageType,
                    fromPhone: cleanPhone,
                    senderName,
                    payload: {
                        reason: queueWork.reason,
                        messageId: messageId || null,
                        queuedMessageKey: queuedMessageKey || null,
                        isAudio,
                        isMediaMessage,
                        pendingCount: queueWork.pendingCount,
                    },
                })
            })
            return { action: 'skipped', reason: queueWork.reason }
        }

        // Sliding debounce: timer resets whenever a new message arrives.
        // Smart timing chooses a different quiet window for text, media, audio, and mixed interactions.
        let fastResponseMode = false
        const smartTimingEnabled = configs['whatsapp_smart_timing_enabled'] !== 'false'
        const fallbackDebounceSeconds = configNumber(configs, 'whatsapp_debounce_seconds', 15, 1, 180)

        if (!isAudio && !isMediaMessage) {
            fastResponseMode = !smartTimingEnabled
                && fallbackDebounceSeconds <= 5
                && configs['whatsapp_ai_schedule_enabled'] !== 'true'
        }

        if (fastResponseMode) {
            console.log(`[WhatsApp Agent] Fast response mode for ${cleanPhone}; skipping Inngest debounce sleep`)
        } else {
            const preview = await step.run('preview-pending-messages', async () => {
                const { data: queuedMsgs } = await supabase
                    .from('app_config')
                    .select('key, value, updated_at')
                    .like('key', `_pmq_${cleanPhone}_%`)
                    .order('updated_at', { ascending: true })

                return (queuedMsgs || []).map((m: any) => ({
                    ...parsePendingQueueValue(m.value, m.updated_at),
                    key: m.key,
                }))
            })

            let timing = selectInteractionTiming(configs, {
                isAudio,
                isMediaMessage,
                mediaType,
                currentText: messageText,
                pending: preview,
            })
            let waitSeconds = timing.seconds
            const maxCycles = 12 // safety cap to avoid endless loops on extremely chatty threads

            console.log(`[WhatsApp Agent] Smart timing for ${cleanPhone}: ${timing.scenario} (${timing.seconds}s)`)

            for (let cycle = 0; cycle < maxCycles; cycle++) {
                await step.sleep(`debounce-collect-${cycle}`, `${Math.max(1, Math.ceil(waitSeconds))}s`)

                const peek = await step.run(`peek-latest-pending-${cycle}`, async () => {
                    const { data: queuedMsgs } = await supabase
                        .from('app_config')
                        .select('key, value, updated_at')
                        .like('key', `_pmq_${cleanPhone}_%`)
                        .order('updated_at', { ascending: true })

                    const parsed = (queuedMsgs || []).map((m: any) => ({
                        ...parsePendingQueueValue(m.value, m.updated_at),
                        key: m.key,
                    }))
                    const latestAt = parsed.length > 0
                        ? parsed.reduce((latest: string | null, item: any) => {
                            if (!item.updatedAt) return latest
                            if (!latest || new Date(item.updatedAt).getTime() > new Date(latest).getTime()) return item.updatedAt
                            return latest
                        }, null)
                        : null

                    return { latestAt, pending: parsed }
                })

                // Queue vanished (handled by another run) or no data: proceed and let next step decide.
                if (!peek?.latestAt) break

                timing = selectInteractionTiming(configs, {
                    isAudio,
                    isMediaMessage,
                    mediaType,
                    currentText: messageText,
                    pending: peek.pending || [],
                })

                const ageSeconds = (Date.now() - new Date(peek.latestAt).getTime()) / 1000
                if (ageSeconds >= timing.seconds) {
                    // Quiet period reached.
                    break
                }

                waitSeconds = Math.max(1, Math.ceil(timing.seconds - ageSeconds))
                console.log(`[WhatsApp Agent] Debounce reset for ${cleanPhone}; scenario=${timing.scenario}, latest message age=${ageSeconds.toFixed(2)}s, waiting ${waitSeconds}s`)
            }
        }

        // Read queued messages from debounce window (atomic INSERTs in app_config)
        const pendingItems = await step.run('read-pending-messages', async () => {
            const { data: queuedMsgs } = await supabase
                .from('app_config')
                .select('key, value, updated_at')
                .like('key', `_pmq_${cleanPhone}_%`)
                .order('updated_at', { ascending: true })

            if (!queuedMsgs || queuedMsgs.length === 0) return [] as PendingQueueMessage[]

            if (queuedMessageKey && !queuedMsgs.some(m => m.key === queuedMessageKey)) {
                await recordAgentLog(supabase, {
                    action: 'agent_skip_stale_queue',
                    instanceName,
                    messageType,
                    fromPhone: cleanPhone,
                    senderName,
                    payload: {
                        reason: 'queued_key_missing_at_read',
                        messageId: messageId || null,
                        queuedMessageKey,
                        availableKeys: queuedMsgs.map(m => m.key),
                        queueReason: queueWork.reason,
                    },
                })
                return [] as PendingQueueMessage[]
            }

            // Delete processed entries
            const keys = queuedMsgs.map(m => m.key)
            await supabase
                .from('app_config')
                .delete()
                .in('key', keys)

            console.log(`[WhatsApp Agent] 📨 Read ${queuedMsgs.length} queued messages: ${queuedMsgs.map(m => m.value).join(' | ')}`)
            const parsed = queuedMsgs.map((m: any) => parsePendingQueueValue(m.value, m.updated_at))
            console.log(`[WhatsApp Agent] Read ${parsed.length} queued messages: ${parsed.map(m => `${m.type || 'text'}:${m.text}`).join(' | ')}`)
            await recordAgentLog(supabase, {
                action: 'agent_batch_read',
                instanceName,
                messageType,
                fromPhone: cleanPhone,
                senderName,
                payload: {
                    count: parsed.length,
                    keys,
                    queuedMessageKey: queuedMessageKey || null,
                    queueReason: queueWork.reason,
                    mediaCount: parsed.filter((item: PendingQueueMessage) => item.hasMedia).length,
                    types: parsed.map((item: PendingQueueMessage) => item.mediaType || item.type || 'text'),
                },
            })
            return parsed
        })

        const pendingHasWork = pendingItems.some(item => Boolean(String(item.text || '').trim()) || item.hasMedia)

        // If queue was emptied by another function and not audio, skip
        if (!pendingHasWork && !isAudio && (!isMediaMessage || queuedMessageKey)) {
            console.log(`[WhatsApp Agent] No messages after debounce for ${cleanPhone}, skipping`)
            await step.run('log-no-pending-after-debounce', async () => {
                await recordAgentLog(supabase, {
                    action: 'agent_no_pending_after_debounce',
                    instanceName,
                    messageType,
                    fromPhone: cleanPhone,
                    senderName,
                    payload: {
                        messageId: messageId || null,
                        queuedMessageKey: queuedMessageKey || null,
                        queueReason: queueWork.reason,
                        pendingItems: pendingItems.length,
                    },
                })
            })
            return { action: 'skipped', reason: 'already_processed_after_sleep' }
        }

        // Combine all queued messages into one input (they form a single thought)
        const allMessages = pendingHasWork
            ? buildPendingInputText(pendingItems, messageText)
            : String(messageText || '').trim()
        const queuedHistoryType = inferPendingHistoryType(pendingItems, mediaType || messageType || 'text')

        let botMessageIds: string[] = Array.isArray(conversation.bot_message_ids)
            ? conversation.bot_message_ids : []

        const controlledIntent = detectControlledLeadIntent(allMessages || '', configs)
        if (controlledIntent) {
            const handled = await step.run(`handle-controlled-intent-${controlledIntent}`, async () => {
                const now = new Date().toISOString()
                const inputText = String(allMessages || messageText || '').trim()
                const responseText = controlledIntent === 'opt_out'
                    ? 'Combinado, vou parar por aqui e respeitar seu pedido para nao chamar novamente por este canal.'
                    : 'Claro. Vou acionar uma pessoa da equipe para seguir contigo por aqui.'

                const historyMessages = (Array.isArray(conversation.messages) ? conversation.messages : [])
                    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')

                const updatedMessages = [
                    ...historyMessages,
                    {
                        role: 'user',
                        content: inputText,
                        type: isAudio ? 'audio' : queuedHistoryType,
                        source: 'lead',
                        message_id: messageId || null,
                        instance_id: instanceId,
                        broker_id: broker.id,
                        timestamp: now,
                    },
                    {
                        role: 'assistant',
                        content: responseText,
                        type: 'text',
                        source: 'agent_controlled_intent',
                        instance_id: instanceId,
                        broker_id: broker.id,
                        timestamp: now,
                    },
                ]

                await supabase
                    .from('whatsapp_ai_conversations')
                    .update({
                        messages: updatedMessages,
                        status: 'human_takeover',
                        human_takeover_at: now,
                        updated_at: now,
                    })
                    .eq('id', conversation.id)

                if (controlledIntent === 'opt_out') {
                    const { data: existingLead } = await supabase
                        .from('lead_collected_data')
                        .select('notes')
                        .eq('lead_phone', cleanPhone)
                        .maybeSingle()
                    const priorNotes = String(existingLead?.notes || '').trim()
                    const optOutNote = `opt_out_whatsapp: pedido recebido em ${now}`
                    await supabase
                        .from('lead_collected_data')
                        .upsert({
                            lead_phone: cleanPhone,
                            lead_name: senderName || undefined,
                            status: 'lost',
                            notes: priorNotes ? `${priorNotes}\n${optOutNote}` : optOutNote,
                            updated_at: now,
                        }, { onConflict: 'lead_phone' })
                } else if (controlledIntent === 'human_request') {
                    await sendHandoffSummaryIfNeeded(supabase, {
                        conversation: { ...conversation, messages: updatedMessages, lead_phone: cleanPhone },
                        instanceId,
                        instanceToken,
                        recipientPhone: cleanPhone,
                        markerSuffix: 'human_request',
                    }).catch(() => null)
                }

                if (configs['whatsapp_mark_as_read'] !== 'false') {
                    await markAsRead(cleanPhone, instanceToken, messageId).catch(() => null)
                }

                const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: responseText, instanceToken })
                botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)

                return {
                    action: 'controlled_intent',
                    intent: controlledIntent,
                    responseLength: responseText.length,
                }
            })

            return handled
        }

        if (fastResponseMode && !isAudio && !isMediaMessage) {
            const inputText = allMessages?.trim()
            if (!inputText) {
                return { action: 'skipped', reason: 'empty_fast_input' }
            }

            console.log(`[WhatsApp Agent] Fast direct text path for ${cleanPhone}`)

            const quickSocialReply = resolveSocialQuickReply(
                buttonResponseTitle || buttonResponseId || inputText || null,
                configs
            )
            const historyMessages = (Array.isArray(conversation.messages) ? conversation.messages : [])
                .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')

            const updatedMessages = [...historyMessages, {
                role: 'user',
                content: inputText,
                type: 'text',
                source: 'lead',
                message_id: messageId || null,
                instance_id: instanceId,
                broker_id: broker.id,
                timestamp: new Date().toISOString()
            }]

            const aiResponse = quickSocialReply
                ? { text: quickSocialReply, shouldTransfer: false, extractedData: undefined as any }
                : await generateAIResponse(configs, broker, updatedMessages, senderName, cleanPhone)

            updatedMessages.push({
                role: 'assistant',
                content: aiResponse.text,
                type: 'text',
                source: quickSocialReply ? 'quick_reply' : 'agent',
                instance_id: instanceId,
                broker_id: broker.id,
                timestamp: new Date().toISOString()
            })

            await supabase
                .from('whatsapp_ai_conversations')
                .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
                .eq('id', conversation.id)

            if (configs['whatsapp_always_online'] !== 'false') {
                setPresenceAvailable(instanceToken, cleanPhone).catch((err) => {
                    console.warn('[WhatsApp Agent] fast setPresenceAvailable failed:', err)
                })
            }
            if (configs['whatsapp_mark_as_read'] !== 'false') {
                await markAsRead(cleanPhone, instanceToken, messageId).catch((err) => {
                    console.warn('[WhatsApp Agent] fast markAsRead before send failed:', err)
                })
            }

            const interactive = parseInteractiveElements(aiResponse.text)
            const { cleanText, urlButtons } = interactive
            let buttons = interactive.buttons
            if (isScheduleChoiceButtons(buttons) && !userAskedForScheduling(inputText)) {
                console.log('[WhatsApp Agent] Fast path suppressing premature schedule buttons')
                buttons = undefined
            }
            const sendFastTextRespectingSplit = async (message: string) => {
                const textToSend = String(message || '').trim()
                if (!textToSend) return null
                const splitEnabled = configs['whatsapp_split_messages'] !== 'false'
                const chunks = splitEnabled && textToSend.length > 120 ? splitIntoHumanChunks(textToSend) : [textToSend]
                let lastResult: any = null
                for (let index = 0; index < chunks.length; index++) {
                    if (index > 0) {
                        await new Promise(resolve => setTimeout(resolve, Math.min(1800 + chunks[index].length * 18, 3500)))
                    }
                    lastResult = await sendWhatsAppMessage({ phone: cleanPhone, message: chunks[index], instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, lastResult)
                }
                return lastResult
            }

            if (urlButtons && urlButtons.items.length > 0) {
                try {
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: cleanText || urlButtons.title || 'Acesse o link abaixo:',
                        type: 'button',
                        choices: buildTrackedUrlButtonChoices(urlButtons.items, cleanPhone, urlButtons.title),
                        instanceToken,
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Fast URL Buttons] Failed, falling back to text links:', e)
                    const linksText = buildTrackedUrlFallbackText(urlButtons.items, cleanPhone, urlButtons.title)
                    const sendResult = await sendWhatsAppMessage({
                        phone: cleanPhone,
                        message: `${cleanText ? cleanText + '\n\n' : ''}${linksText}`,
                        instanceToken,
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (buttons && buttons.options.length > 0) {
                try {
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: cleanText || buttons.title,
                        type: 'button',
                        choices: buttons.options.slice(0, 3).map(opt => opt.substring(0, 20)),
                        instanceToken,
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Fast Buttons] Failed, falling back to text:', e)
                    await sendFastTextRespectingSplit(cleanText || aiResponse.text)
                }
            } else {
                await sendFastTextRespectingSplit(cleanText || aiResponse.text)
            }

            if (configs['whatsapp_mark_as_read'] !== 'false') {
                markAsRead(cleanPhone, instanceToken, messageId).catch((err) => {
                    console.warn('[WhatsApp Agent] fast markAsRead after send failed:', err)
                })
            }

            await syncWhatsAppLeadSnapshot(supabase, {
                phone: cleanPhone,
                senderName,
                instanceId,
                instanceName,
                brokerId: broker.id,
                acquiredVia: 'whatsapp',
                messages: updatedMessages,
                extractedData: aiResponse.extractedData || null,
                shouldTransfer: aiResponse.shouldTransfer,
            }).catch((err) => {
                console.warn('[WhatsApp Agent] fast CRM sync failed:', err)
            })

            console.log(`[WhatsApp Agent] Fast direct response sent for ${cleanPhone}`)
            await step.run('log-fast-response-sent', async () => {
                await recordAgentLog(supabase, {
                    action: 'agent_response_sent',
                    instanceName,
                    messageType,
                    fromPhone: cleanPhone,
                    senderName,
                    payload: {
                        path: 'fast_direct_text',
                        messageId: messageId || null,
                        queuedMessageKey: queuedMessageKey || null,
                        responseLength: aiResponse.text.length,
                        shouldTransfer: Boolean(aiResponse.shouldTransfer),
                        queuedHistoryType: 'text',
                        hasMediaBatch: false,
                    },
                })
            })
            return {
                action: 'responded_fast',
                phone: cleanPhone,
                responseLength: aiResponse.text.length,
                transferred: aiResponse.shouldTransfer,
            }
        }

        // ── Step 3: Download audio to R2 if needed ──
        // This step runs in Inngest (no Vercel timeout!) so we can take the time to:
        // 1) Download audio from UAZAPI
        // 2) Upload to R2 (Cloudflare)
        // 3) Get a stable public URL for transcription
        const audioR2Url = isAudio ? await step.run('download-audio-to-r2', async () => {
            console.log(`[WhatsApp Agent] 🎤 Audio detected from ${cleanPhone}`)
            console.log(`[WhatsApp Agent] 🎤 audioUrl=${audioUrl ? audioUrl.substring(0, 100) + '...' : 'NULL'}, messageId=${messageId || 'NULL'}, mediaKey=${audioMediaKey ? 'available' : 'NULL'}`)

            let audioBuffer: Buffer | null = null

            // Strategy 1: UAZAPI /message/download (PREFERRED — decrypts and returns base64)
            if (!audioBuffer && messageId) {
                console.log(`[WhatsApp Agent] 🎤 Attempting UAZAPI /message/download with id=${messageId}...`)
                audioBuffer = await downloadMedia(messageId, instanceToken)
                if (audioBuffer) {
                    console.log(`[WhatsApp Agent] 🎤 UAZAPI download success! Size: ${audioBuffer.length} bytes`)
                } else {
                    console.warn(`[WhatsApp Agent] 🎤 UAZAPI download failed, trying E2EE decryption...`)
                }
            }

            // Strategy 2: E2EE decryption fallback (decrypt the encrypted WhatsApp CDN URL)
            if (!audioBuffer && audioUrl && audioMediaKey) {
                try {
                    console.log(`[WhatsApp Agent] 🎤 Attempting WhatsApp E2EE decryption with mediaKey...`)
                    audioBuffer = await decryptWhatsAppMedia(audioUrl, audioMediaKey, 'audio')
                    if (audioBuffer) {
                        console.log(`[WhatsApp Agent] 🎤 E2EE decryption success! Size: ${audioBuffer.length} bytes`)
                    } else {
                        console.error(`[WhatsApp Agent] 🎤 E2EE decryption also failed!`)
                    }
                } catch (e) {
                    console.error(`[WhatsApp Agent] 🎤 E2EE decryption error:`, e)
                }
            }

            if (!audioBuffer) {
                console.error(`[WhatsApp Agent] 🎤 Could not obtain audio buffer from any source`)
                return null
            }

            // Upload to R2 for a stable, public URL
            console.log(`[WhatsApp Agent] 🎤 Uploading ${audioBuffer.length} bytes to R2...`)
            const r2Url = await uploadAudioToR2(audioBuffer, supabase)
            if (r2Url) {
                console.log(`[WhatsApp Agent] 🎤 R2 upload success: ${r2Url.substring(0, 100)}`)
            } else {
                console.error(`[WhatsApp Agent] 🎤 R2 upload failed!`)
            }
            return r2Url
        }) : null

        // ── Step 3.1: Download and analyze media (image/document/video) ──
        if (isMediaMessage) {
            const mediaReadyDelay = configs['whatsapp_smart_timing_enabled'] !== 'false' ? 2 : 8
            await step.sleep('wait-media-file-ready', `${mediaReadyDelay}s`)
        }

        const mediaBatchItems: IncomingMediaBatchItem[] = []
        for (const item of pendingItems) {
            const kind = normalizePendingMediaKind(item.mediaType || item.type || null)
            if (!kind || !item.hasMedia) continue
            mediaBatchItems.push({
                kind,
                messageId: item.messageId || null,
                mediaUrl: item.mediaUrl || null,
                mediaMimetype: item.mediaMimetype || null,
                mediaFilename: item.mediaFilename || null,
                text: item.text || null,
            })
        }

        const currentKind = normalizePendingMediaKind(mediaType || messageType || null)
        if (!isAudio && isMediaMessage && currentKind) {
            const alreadyQueued = mediaBatchItems.some((item) => {
                if (messageId && item.messageId) return item.messageId === messageId
                return Boolean(item.mediaUrl && mediaUrl && item.mediaUrl === mediaUrl)
            })
            if (!alreadyQueued) {
                mediaBatchItems.push({
                    kind: currentKind,
                    messageId: messageId || null,
                    mediaUrl: mediaUrl || null,
                    mediaMimetype: mediaMimetype || null,
                    mediaFilename: mediaFilename || null,
                    text: messageText || allMessages || null,
                })
            }
        }

        const mediaBatchAnalysis = !isAudio && (mediaBatchItems.length > 1 || (mediaBatchItems.length === 1 && !currentKind))
            ? await step.run('analyze-media-batch', async () => {
                const { selected, totals, skipped } = limitIncomingMediaBatch(mediaBatchItems, configs)
                const analyzedResults: IncomingMediaAnalysisResult[] = []

                console.log(`[WhatsApp Agent] Analyzing media batch for ${cleanPhone}: received=${buildMediaBatchLabel(totals)}, selected=${selected.length}`)

                for (let index = 0; index < selected.length; index++) {
                    const result = await analyzeIncomingMediaItem({
                        supabase,
                        configs,
                        instanceToken,
                        item: selected[index],
                        contextText: allMessages || messageText || selected[index].text || null,
                    })
                    analyzedResults.push(result)
                }

                const okResults = analyzedResults.filter((result) => result.text)

                if (mediaBatchItems.length === 1 && okResults.length === 1) {
                    return okResults[0]
                }

                const skippedTotal = Object.values(skipped).reduce((sum, value) => sum + value, 0)
                const failedTotal = analyzedResults.length - okResults.length
                const resultLines = analyzedResults.map((result, index) => {
                    const label = result.fileName
                        ? `${result.kind} "${result.fileName}"`
                        : result.kind
                    if (result.text) {
                        return `Midia ${index + 1} (${label}):\n${result.text}`
                    }
                    const readableReason = result.reason === 'openai_video_not_supported'
                        ? 'video recebido, mas este provedor nao analisa video automaticamente nesta configuracao'
                        : result.reason === 'download_failed'
                            ? 'arquivo recebido, mas ainda nao ficou disponivel para leitura confiavel'
                            : result.reason?.startsWith('disabled_')
                                ? 'analise automatica desativada para este tipo de midia'
                                : `nao foi possivel analisar automaticamente (${result.reason || 'sem_detalhe'})`
                    return `Midia ${index + 1} (${label}): ${readableReason}.`
                })
                const summary = [
                    `[LOTE DE MIDIAS RECEBIDO]`,
                    `Total recebido: ${buildMediaBatchLabel(totals)}.`,
                    `Arquivos analisados nesta rodada: ${okResults.length}.`,
                    failedTotal > 0
                        ? `Arquivos recebidos sem analise confiavel: ${failedTotal}. Ainda assim, considere que eles fazem parte do contexto do lead.`
                        : '',
                    skippedTotal > 0
                        ? `Observacao: ${skippedTotal} arquivo(s) excederam o limite de analise automatica do lote, mas continuam registrados no historico do lead.`
                        : '',
                    ...resultLines,
                ].filter(Boolean).join('\n\n')

                return {
                    text: summary,
                    reason: okResults.length > 0 ? 'ok_batch' : 'batch_no_analysis',
                    kind: 'batch' as const,
                    results: analyzedResults,
                    totals,
                    skipped,
                }
            })
            : null

        const mediaAnalysis = mediaBatchAnalysis || (!isAudio && mediaType && ['image', 'video', 'document'].includes(String(mediaType))
            ? await step.run('analyze-media', async () => {
                const kind = mediaType as 'image' | 'video' | 'document'
                const mediaImageEnabled = configs['whatsapp_media_image_enabled'] !== 'false'
                const mediaDocumentEnabled = configs['whatsapp_media_document_enabled'] !== 'false'
                const mediaVideoEnabled = configs['whatsapp_media_video_enabled'] !== 'false'
                const allowed = (kind === 'image' && mediaImageEnabled)
                    || (kind === 'document' && mediaDocumentEnabled)
                    || (kind === 'video' && mediaVideoEnabled)
                if (!allowed) {
                    return { text: '', reason: `disabled_${kind}` }
                }

                let mediaBuffer: Buffer | null = null
                let storedMime: string | null = null

                const fetchStoredMedia = async () => {
                    if (!messageId) return null
                    const { data: storedMedia } = await supabase
                        .from('app_config')
                        .select('value')
                        .eq('key', `_wmedia_${messageId}`)
                        .maybeSingle()
                    return parseStoredMediaUrl(storedMedia?.value || null)
                }

                if (mediaUrl && !isLikelyEncryptedWhatsAppMediaUrl(mediaUrl)) {
                    mediaBuffer = await fetchMediaUrlToBuffer(mediaUrl)
                    const directMime = inferMimeType(kind, mediaMimetype || null)
                    if (mediaBuffer && !isLikelyUsableMediaBuffer(kind, directMime, mediaBuffer)) {
                        console.warn(`[WhatsApp Agent] Ignoring unusable direct media bytes for ${kind}; url=${mediaUrl.substring(0, 120)}`)
                        mediaBuffer = null
                    }
                } else if (mediaUrl) {
                    console.log(`[WhatsApp Agent] Skipping encrypted WhatsApp media URL; waiting for decoded media or UAZAPI download`)
                }

                if (!mediaBuffer && messageId) {
                    for (let attempt = 1; attempt <= 5 && !mediaBuffer; attempt++) {
                        const stored = await fetchStoredMedia()
                        if (stored?.url) {
                            storedMime = stored.mime || null
                            console.log(`[WhatsApp Agent] Stored media ready on attempt ${attempt}: ${stored.url.substring(0, 120)}`)
                            mediaBuffer = await fetchMediaUrlToBuffer(stored.url)
                            const storedMimeType = inferMimeType(kind, mediaMimetype || storedMime)
                            if (mediaBuffer && !isLikelyUsableMediaBuffer(kind, storedMimeType, mediaBuffer)) {
                                console.warn(`[WhatsApp Agent] Stored media bytes are not usable for ${kind}; url=${stored.url.substring(0, 120)}`)
                                mediaBuffer = null
                            }
                        } else {
                            console.log(`[WhatsApp Agent] Stored media not ready on attempt ${attempt} for message ${messageId}`)
                        }

                        if (!mediaBuffer && attempt < 5) {
                            await waitMs(1500)
                        }
                    }
                }

                if (!mediaBuffer && messageId) {
                    for (let attempt = 1; attempt <= 2 && !mediaBuffer; attempt++) {
                        console.log(`[WhatsApp Agent] Trying direct media download attempt ${attempt} for message ${messageId}`)
                        mediaBuffer = await downloadMedia(messageId, instanceToken)
                        const downloadedMimeType = inferMimeType(kind, mediaMimetype || storedMime)
                        if (mediaBuffer && !isLikelyUsableMediaBuffer(kind, downloadedMimeType, mediaBuffer)) {
                            console.warn(`[WhatsApp Agent] Downloaded media bytes are not usable for ${kind}; message=${messageId}`)
                            mediaBuffer = null
                        }
                        if (!mediaBuffer && attempt < 2) {
                            await waitMs(1500)
                        }
                    }
                }

                if (!mediaBuffer && !messageId) {
                    return { text: '', reason: 'missing_media_source' }
                }

                if (!mediaBuffer || mediaBuffer.length < 64) {
                    return { text: '', reason: 'download_failed' }
                }

                const mimeType = inferMimeType(kind, mediaMimetype || storedMime)
                let analysisBuffer = mediaBuffer
                let analysisFileName = mediaFilename || null
                let analysisContext = allMessages || messageText || null
                let analysisNote = ''

                // Keep memory/latency safe. Large PDFs are reduced to an analyzable
                // first-pages preview while the original remains stored in the lead file.
                const maxBytes = 12 * 1024 * 1024
                if (analysisBuffer.length > maxBytes) {
                    if (kind === 'document' && mimeType.includes('pdf')) {
                        const preview = await createPdfAnalysisPreview(analysisBuffer)
                        if (!preview) {
                            return { text: '', reason: `file_too_large_${analysisBuffer.length}` }
                        }
                        analysisBuffer = preview.buffer
                        analysisFileName = `preview-${analysisFileName || 'documento.pdf'}`
                        analysisNote = `Documento PDF original com ${preview.pageCount} paginas e ${(mediaBuffer.length / 1024 / 1024).toFixed(1)} MB. Para manter a analise rapida, foi enviada uma previa com as primeiras ${preview.includedPages} paginas. Se a resposta depender de paginas posteriores, informe que pode precisar do arquivo completo ou de um trecho especifico.`
                        analysisContext = [analysisContext, analysisNote].filter(Boolean).join('\n\n') || null
                        console.log(`[WhatsApp Agent] PDF preview generated for analysis: original=${mediaBuffer.length} preview=${analysisBuffer.length} pages=${preview.includedPages}/${preview.pageCount}`)
                    } else {
                        return { text: '', reason: `file_too_large_${analysisBuffer.length}` }
                    }
                }

                const geminiKey = configs['gemini_api_key']
                const openaiKey = configs['openai_api_key']
                const geminiModel = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
                const openaiModel = configs['openai_whatsapp_model'] || 'gpt-4o-mini'
                const globalProvider = configs['ai_provider'] || 'gemini'
                const effectiveProvider = configs['whatsapp_provider'] || globalProvider

                let analysisText = ''

                if (effectiveProvider === 'openai') {
                    if (kind === 'video') {
                        return {
                            text: '',
                            reason: 'openai_video_not_supported',
                            kind,
                            mimeType,
                            size: mediaBuffer.length
                        }
                    }

                    if (openaiKey && kind === 'image' && mimeType.startsWith('image/')) {
                        analysisText = await analyzeMediaWithOpenAIImage(
                            analysisBuffer,
                            mimeType,
                            openaiKey,
                            openaiModel,
                            analysisFileName
                        )
                    }

                    // Compatibility/fallback path: keep media analysis working if
                    // the selected provider returns no vision result.
                    if (!analysisText && geminiKey && (kind === 'image' || kind === 'document' || kind === 'video')) {
                        analysisText = await analyzeMediaWithGemini(
                            analysisBuffer,
                            mimeType,
                            geminiKey,
                            geminiModel,
                            kind,
                            analysisFileName,
                            analysisContext
                        )
                    }
                } else {
                    if (geminiKey) {
                        analysisText = await analyzeMediaWithGemini(
                            analysisBuffer,
                            mimeType,
                            geminiKey,
                            geminiModel,
                            kind,
                            analysisFileName,
                            analysisContext
                        )
                    }

                    if (!analysisText && openaiKey && kind === 'image' && mimeType.startsWith('image/')) {
                        analysisText = await analyzeMediaWithOpenAIImage(
                            analysisBuffer,
                            mimeType,
                            openaiKey,
                            openaiModel,
                            analysisFileName
                        )
                    }
                }

                return {
                    text: analysisText || '',
                    reason: analysisText ? 'ok' : 'no_analysis',
                    kind,
                    mimeType,
                    size: mediaBuffer.length,
                    analysisSize: analysisBuffer.length,
                    analysisNote
                }
            })
            : null)

        // ── Step 4: Transcribe audio if we got a R2 URL ──
        if (mediaAnalysis) {
            const mediaResult = mediaAnalysis as any
            console.log(`[WhatsApp Agent] mediaAnalysis result: reason=${mediaResult.reason || 'unknown'}, kind=${mediaResult.kind || mediaType || 'unknown'}, size=${mediaResult.size || 0}, hasText=${mediaResult.text ? 'yes' : 'no'}`)
        }

        const inputText = await step.run('process-input', async () => {
            console.log(`[WhatsApp Agent] process-input: isAudio=${isAudio}, mediaType=${mediaType || 'none'}, audioR2Url=${audioR2Url ? 'available' : 'null'}, messageText="${messageText}"`)
            
            const transcriptionEnabled = configs['whatsapp_transcription_enabled'] !== 'false'

            if (isAudio && !transcriptionEnabled) {
                return '[O usuário enviou áudio, mas a transcrição de áudio está desativada. Peça para ele enviar em texto ou ative a transcrição.]'
            }

            if (isAudio && audioR2Url) {
                console.log(`[WhatsApp Agent] Transcribing audio from R2 URL...`)
                
                // Helper: check if transcription result is actually valid
                const isValidTranscription = (text: string | undefined | null): boolean => {
                    if (!text) return false
                    const cleaned = text.replace(/[.\s…]+/g, '').trim()
                    return cleaned.length >= 2  // At least 2 real characters
                }
                
                const hasGemini = !!configs['gemini_api_key']
                const hasOpenAI = !!configs['openai_api_key']
                const geminiModel = configs['gemini_whatsapp_model'] || 'gemini-2.0-flash'
                
                // Respect the provider configured in the maintenance panel
                const globalProvider = configs['ai_provider'] || 'openai'
                const effectiveProvider = configs['whatsapp_provider'] || globalProvider
                const useWhisperFirst = effectiveProvider === 'openai'
                
                console.log(`[WhatsApp Agent] STT: provider=${effectiveProvider}, useWhisperFirst=${useWhisperFirst}, hasOpenAI=${hasOpenAI}, hasGemini=${hasGemini}`)
                
                let result: string | undefined
                
                if (useWhisperFirst) {
                    // ── OpenAI configured: Whisper first → Gemini fallback ──
                    if (hasOpenAI) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Whisper (OpenAI) transcription...`)
                            result = await transcribeWithWhisper(audioR2Url, configs['openai_api_key'])
                            console.log(`[WhatsApp Agent] Whisper result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                            console.log(`[WhatsApp Agent] Whisper returned invalid/empty result, trying Gemini fallback...`)
                        } catch (e) {
                            console.error('[WhatsApp Agent] Whisper transcription error:', e)
                        }
                    }
                    if (hasGemini) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Gemini transcription (fallback)...`)
                            result = await transcribeWithGemini(audioR2Url, configs['gemini_api_key'], geminiModel)
                            console.log(`[WhatsApp Agent] Gemini result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                        } catch (e) {
                            console.error('[WhatsApp Agent] Gemini transcription error:', e)
                        }
                    }
                } else {
                    // ── Gemini configured: Gemini first → Whisper fallback ──
                    if (hasGemini) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Gemini transcription...`)
                            result = await transcribeWithGemini(audioR2Url, configs['gemini_api_key'], geminiModel)
                            console.log(`[WhatsApp Agent] Gemini result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                            console.log(`[WhatsApp Agent] Gemini returned invalid/empty result, trying Whisper fallback...`)
                        } catch (e) {
                            console.error('[WhatsApp Agent] Gemini transcription error:', e)
                        }
                    }
                    if (hasOpenAI) {
                        try {
                            console.log(`[WhatsApp Agent] Attempting Whisper transcription (fallback)...`)
                            result = await transcribeWithWhisper(audioR2Url, configs['openai_api_key'])
                            console.log(`[WhatsApp Agent] Whisper result: "${result?.substring(0, 150)}"`)
                            if (isValidTranscription(result)) {
                                return result!.trim()
                            }
                        } catch (e) {
                            console.error('[WhatsApp Agent] Whisper transcription error:', e)
                        }
                    }
                }
                
                // All transcription attempts failed
                console.error('[WhatsApp Agent] All transcription attempts failed or returned empty')
                return '[O usuário enviou uma mensagem de áudio que não pôde ser transcrita. Responda pedindo que repita ou envie por texto.]'
            }
            
            // Audio detected but we couldn't get the buffer at all
            if (isAudio && !audioR2Url) {
                console.error('[WhatsApp Agent] Audio detected but no R2 URL available (download failed)')
                return '[O usuário enviou uma mensagem de áudio que não pôde ser processada. Responda pedindo que repita ou envie por texto.]'
            }

            // Image/document/video analysis path
            if (!isAudio && mediaAnalysis && mediaAnalysis.text) {
                const leadText = allMessages?.trim() || ''
                const normalizedMediaType = String((mediaAnalysis as any).kind || mediaType || '').toLowerCase()
                const mediaSpecificGuidance = normalizedMediaType === 'batch'
                    ? '\nSe for lote de midias, responda uma unica vez sobre o conjunto. Nao mande uma resposta separada para cada arquivo. Compare os sinais principais das midias, destaque o que parece mais importante para o lead e faca no maximo uma pergunta curta para avancar. Se houver botao/link de imovel, deixe o botao separado no final.'
                    : normalizedMediaType === 'video'
                    ? '\nSe for video, use a analise visual como fonte principal. Nao responda apenas pela legenda, audio ou transcricao. Se a analise identificou cards, telas, imoveis, cidades, valores ou ambientes, responda sobre esses elementos visuais.'
                    : normalizedMediaType === 'document'
                        ? '\nSe for documento, responda somente com base no conteudo extraido. Se a analise disser que nao foi possivel ler com seguranca, informe isso de forma curta e peca para reenviar em PDF/imagem legivel ou resumir o ponto principal.'
                        : ''
                if (mediaSpecificGuidance) {
                    mediaAnalysis.text = `${mediaAnalysis.text}${mediaSpecificGuidance}`
                }
                const base = leadText || (normalizedMediaType === 'batch'
                    ? '[O usuario enviou um lote de midias]'
                    : `[O usuário enviou uma mídia do tipo ${mediaType || messageType || 'desconhecido'}]`)
                return `${base}\n\n[ANÁLISE DA MÍDIA]\n${mediaAnalysis.text}\n\n[ORIENTACAO INTERNA PARA RESPOSTA]\nComo esta resposta nasceu de uma midia, responda em blocos curtos de WhatsApp. Se recomendar um imovel com botao/link, envie primeiro uma resposta curta e deixe o botao separado. Nao coloque uma explicacao longa dentro da mensagem do botao.`
            }

            if (!isAudio && mediaAnalysis?.reason === 'openai_video_not_supported') {
                const leadText = allMessages?.trim() || messageText?.trim() || ''
                const base = leadText || '[O usuario enviou um video]'
                return `${base}\n\n[MIDIA RECEBIDA]\nO cliente enviou um video, mas a analise automatica de video nao esta disponivel quando os agentes WhatsApp usam OpenAI. Responda avisando que recebeu o video e peca uma foto, print ou descricao para ajudar.`
            }

            if (!isAudio && (isMediaMessage || mediaBatchItems.length > 0)) {
                const leadText = allMessages?.trim() || messageText?.trim() || ''
                const fallbackKind = mediaBatchItems.length > 1 ? 'lote de midias' : (mediaBatchItems[0]?.kind || mediaType || messageType || 'desconhecido')
                const base = leadText || `[O usuário enviou uma mídia do tipo ${fallbackKind}]`
                const reason = String(mediaAnalysis?.reason || '')
                if (reason.startsWith('disabled_')) {
                    return `${base}\n\n[MIDIA RECEBIDA]\nO cliente enviou ${fallbackKind || 'midia'}, mas a analise automatica desse tipo esta desativada nas configuracoes.`
                }
                if (String(mediaBatchItems[0]?.kind || mediaType || '').toLowerCase() === 'document') {
                    return `${base}\n\n[MIDIA RECEBIDA]\nO cliente enviou um documento, mas o conteudo nao pode ser lido com seguranca. Responda de forma breve dizendo que recebeu, peca para reenviar em PDF/imagem legivel ou resumir o ponto principal. Nao prometa retorno futuro e nao chute informacoes do documento.`
                }
                return `${base}\n\n[MIDIA RECEBIDA]\nO cliente enviou ${fallbackKind || 'midia'}, mas a imagem/arquivo ainda nao ficou disponivel para uma analise confiavel. Responda de forma breve dizendo que recebeu e peca para reenviar ou descrever o que quer analisar. Nao afirme nome de imovel, preco, disponibilidade, localizacao ou link com base em chute.`
            }
            
            return allMessages
        })

        if (!inputText) {
            await step.run('log-empty-input', async () => {
                await recordAgentLog(supabase, {
                    action: 'agent_empty_input',
                    instanceName,
                    messageType,
                    fromPhone: cleanPhone,
                    senderName,
                    payload: {
                        messageId: messageId || null,
                        queuedMessageKey: queuedMessageKey || null,
                        queueReason: queueWork.reason,
                        pendingItems: pendingItems.length,
                        isAudio,
                        isMediaMessage,
                    },
                })
            })
            return { action: 'skipped', reason: 'empty_input' }
        }

        const quickSocialReplySource = buttonResponseTitle || buttonResponseId || (isMediaMessage ? (allMessages || messageText || '') : inputText) || null
        const quickSocialReply = resolveSocialQuickReply(
            quickSocialReplySource,
            configs
        )

        // ── Step 4: Generate AI response ──
        const aiResponse = await step.run('generate-ai-response', async () => {
            const historyMessages = (Array.isArray(conversation.messages) ? conversation.messages : [])
                .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')

            const updatedMessages = [...historyMessages, {
                role: 'user',
                content: inputText,
                type: isAudio ? 'audio' : queuedHistoryType,
                source: 'lead',
                message_id: messageId || null,
                instance_id: instanceId,
                broker_id: broker.id,
                timestamp: new Date().toISOString()
            }]

            const confirmedAppointment = detectConfirmedAppointment(updatedMessages)
            const confirmedAppointmentResult = confirmedAppointment
                ? await saveDetectedAppointment({
                    supabase,
                    appointment: confirmedAppointment,
                    broker,
                    leadPhone: cleanPhone,
                    senderName,
                    propertyTitle: null,
                    createdFrom: 'pre_response_lead_confirmation',
                })
                : null

            const response = confirmedAppointment && confirmedAppointmentResult !== 'failed'
                ? {
                    text: buildAppointmentConfirmationText(confirmedAppointment),
                    shouldTransfer: false,
                    extractedData: { appointment_created_from_marker: true, appointment_pre_saved: true } as any,
                }
                : quickSocialReply
                    ? { text: quickSocialReply, shouldTransfer: false, extractedData: undefined as any }
                    : await generateAIResponse(configs, broker, updatedMessages, senderName, cleanPhone)

            // Add assistant message to history
            updatedMessages.push({
                role: 'assistant',
                content: response.text,
                type: 'text',
                source: quickSocialReply ? 'quick_reply' : 'agent',
                instance_id: instanceId,
                broker_id: broker.id,
                timestamp: new Date().toISOString()
            })

            // Save to DB
            const updateData: any = {
                messages: updatedMessages,
                updated_at: new Date().toISOString()
            }
            await supabase
                .from('whatsapp_ai_conversations')
                .update(updateData)
                .eq('id', conversation.id)

            return { ...response, updatedMessages }
        })

        await step.run('sync-lead-snapshot', async () => {
            await syncWhatsAppLeadSnapshot(supabase, {
                phone: cleanPhone,
                senderName,
                instanceId,
                instanceName,
                brokerId: broker.id,
                acquiredVia: 'whatsapp',
                messages: aiResponse.updatedMessages,
                extractedData: aiResponse.extractedData || null,
                shouldTransfer: aiResponse.shouldTransfer,
            })
        })

        // ── Step 5: Human-like behavior (sleep is native in Inngest!) ──
        await step.run('ensure-online', async () => {
            if (configs['whatsapp_always_online'] !== 'false') {
                await setPresenceAvailable(instanceToken, cleanPhone).catch((err) => {
                    console.warn('[WhatsApp Agent] setPresenceAvailable failed:', err)
                })
            }
        })

        await step.run('mark-as-read', async () => {
            if (configs['whatsapp_mark_as_read'] !== 'false') {
                await markAsRead(cleanPhone, instanceToken, messageId).catch((err) => {
                    console.warn('[WhatsApp Agent] markAsRead (before send) failed:', err)
                })
            }
        })

        // Reading delay (1-3s) — Inngest native sleep, no timeout risk!
        if (!fastResponseMode) {
            const readDelay = Math.floor(Math.random() * 2000) + 1000
            await step.sleep('reading-delay', `${readDelay}ms`)
        }

        // Decide presence: "recording" if sending audio, "typing" otherwise
        const mode = (configs['whatsapp_response_mode'] || '').toLowerCase()
        const audioEnabled = configs['whatsapp_audio_enabled'] === 'true'
        const mirrorModeEnabled = configs['whatsapp_mirror_mode'] === 'true'
        const shouldMirror = mode ? mode === 'mirror' : mirrorModeEnabled
        const shouldAlwaysAudio = mode === 'audio'
        const willSendAudio = audioEnabled
            && (shouldAlwaysAudio || (isAudio && shouldMirror))
            && !isMediaMessage
            && (
                (!responseRequiresText(aiResponse.text) && !parseButtons(aiResponse.text).buttons)
                || /\[BOTOES_URL:/i.test(aiResponse.text)
            )

        await step.run('show-presence', async () => {
            if (willSendAudio) {
                await setPresenceRecording(cleanPhone, instanceToken).catch(() => { })
            } else {
                await setPresenceTyping(cleanPhone, instanceToken).catch(() => { })
            }
        })

        // Typing/recording delay proportional to response length
        const typingMs = Math.min(Math.max(aiResponse.text.length * 25, 1500), 8000)
        const actualTypingMs = Math.floor(typingMs * (0.7 + Math.random() * 0.6))
        if (!fastResponseMode) {
            await step.sleep('composing-delay', `${actualTypingMs}ms`)
        }

        // ── Step 6: Send response (Função Espelho + Interactive Messages) ──
        await step.run('send-response', async () => {
            const interactive = parseInteractiveElements(aiResponse.text)
            const { cleanText, urlButtons, list, poll, locationRequest, pix, carousel } = interactive
            let buttons = interactive.buttons
            let suppressedScheduleButtons = false
            if (isScheduleChoiceButtons(buttons) && !userAskedForScheduling(allMessages || messageText || '')) {
                console.log('[WhatsApp Agent] Suppressing premature schedule buttons')
                buttons = undefined
                suppressedScheduleButtons = true
            }
            const needsTextFormat = responseRequiresText(suppressedScheduleButtons ? cleanText : aiResponse.text)
            const hasInteractive = !!(buttons || urlButtons || list || poll || locationRequest || pix || carousel)
            const mode = (configs['whatsapp_response_mode'] || '').toLowerCase()
            const audioEnabled = configs['whatsapp_audio_enabled'] === 'true'
            const mirrorModeEnabled = configs['whatsapp_mirror_mode'] === 'true'
            const shouldMirror = mode ? mode === 'mirror' : mirrorModeEnabled
            const shouldAlwaysAudio = mode === 'audio'
            const mediaKind = String(mediaType || '').toLowerCase()
            const isVideoMessage = isMediaMessage && mediaKind === 'video'
            const isMediaBatchResponse = queuedHistoryType === 'media_batch' || mediaBatchItems.length > 1
            const wantsVideoHybrid = isVideoMessage && !isMediaBatchResponse && audioEnabled && configs['whatsapp_media_video_enabled'] !== 'false'
            const shouldSendAudio = audioEnabled
                && (shouldAlwaysAudio || (isAudio && shouldMirror))
                && !isMediaMessage
                && !needsTextFormat && !hasInteractive

            const wantsAudioInteractive = audioEnabled && (shouldAlwaysAudio || (isAudio && shouldMirror)) && !isMediaMessage
            const shouldSeparateMediaInteractiveText = (message: string) =>
                isMediaMessage
                && !wantsAudioInteractive
                && configs['whatsapp_split_messages'] !== 'false'
                && String(message || '').trim().length > 0
            const shortInteractiveText = (title: string | undefined, fallback = 'Segue o acesso:') => {
                const value = String(title || '').trim()
                return value && value.length <= 80 ? value : fallback
            }
            const sendTextChunks = async (message: string) => {
                const textToSend = String(message || '').trim()
                if (!textToSend) return
                const chunks = configs['whatsapp_split_messages'] !== 'false' && textToSend.length > 120
                    ? splitIntoHumanChunks(textToSend)
                    : [textToSend]
                for (let i = 0; i < chunks.length; i++) {
                    if (i > 0) await new Promise(resolve => setTimeout(resolve, Math.min(1800 + chunks[i].length * 18, 3500)))
                    const result = await sendWhatsAppMessage({ phone: cleanPhone, message: chunks[i], instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, result)
                }
            }
            const waitBeforeInteractive = async () => {
                const delaySeconds = configNumber(configs, 'whatsapp_timing_button_delay_seconds', 2, 0, 20)
                if (delaySeconds > 0) {
                    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
                }
            }
            const sendVideoHybridResponse = async (message: string) => {
                const textToSend = String(message || '').trim()
                if (!textToSend) return false

                const shouldUseAudio = wantsVideoHybrid && textToSend.length > 160
                if (!shouldUseAudio) {
                    await sendTextChunks(textToSend)
                    return false
                }

                const chunks = splitIntoHumanChunks(textToSend)
                if (chunks.length <= 1) {
                    await sendTextChunks(textToSend)
                    return false
                }

                const firstText = chunks[0]
                const audioText = chunks.slice(1).join('\n\n').trim()
                await sendTextChunks(firstText)
                if (!audioText) return false

                await setPresenceRecording(cleanPhone, instanceToken).catch(() => { })
                const audioResults = await sendMirrorAudioLeadIn({ text: audioText, broker, configs, supabase, cleanPhone, instanceToken })
                for (const audioResult of audioResults) {
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, audioResult)
                }
                if (audioResults.length === 0) {
                    await sendTextChunks(audioText)
                    return false
                }
                return true
            }

            console.log(`[WhatsApp Agent] 📤 Send decision: mode=${mode || 'legacy'}, isAudio=${isAudio}, audioEnabled=${audioEnabled}, needsTextFormat=${needsTextFormat}, buttons=${!!buttons}, urlButtons=${!!urlButtons}, list=${!!list}, poll=${!!poll}, location=${locationRequest}, pix=${!!pix}, carousel=${!!carousel}, shouldSendAudio=${shouldSendAudio}`)

            if (urlButtons && urlButtons.items.length > 0) {
                const separateMediaText = shouldSeparateMediaInteractiveText(cleanText)
                let separatedMediaTextSent = false
                try {
                    // UAZAPI expects URL buttons as choices: "texto|url:https://..."
                    const audioLeadInResults = wantsAudioInteractive
                        ? await sendMirrorAudioLeadIn({ text: cleanText, broker, configs, supabase, cleanPhone, instanceToken })
                        : []
                    for (const audioLeadInResult of audioLeadInResults) {
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, audioLeadInResult)
                    }
                    const sentAudioLeadIn = audioLeadInResults.length > 0
                    if (wantsAudioInteractive && !sentAudioLeadIn && cleanText) {
                        await sendTextChunks(cleanText)
                    }
                    if (separateMediaText) {
                        await sendVideoHybridResponse(cleanText)
                        separatedMediaTextSent = true
                    }
                    const finalText = sentAudioLeadIn
                        ? (urlButtons.title || 'Segue o acesso:')
                        : (wantsAudioInteractive || separateMediaText
                            ? shortInteractiveText(urlButtons.title, 'Ver opcoes')
                            : (cleanText || urlButtons.title || 'Acesse o link abaixo:'))
                    if (sentAudioLeadIn || separatedMediaTextSent) {
                        await waitBeforeInteractive()
                    }
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: finalText,
                        type: 'button',
                        choices: buildTrackedUrlButtonChoices(urlButtons.items, cleanPhone, urlButtons.title),
                        instanceToken,
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[URL Buttons] Failed, falling back to text links:', e)
                    const linksText = buildTrackedUrlFallbackText(urlButtons.items, cleanPhone, urlButtons.title)
                    const audioLeadInResults = wantsAudioInteractive
                        ? await sendMirrorAudioLeadIn({ text: cleanText, broker, configs, supabase, cleanPhone, instanceToken })
                        : []
                    for (const audioLeadInResult of audioLeadInResults) {
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, audioLeadInResult)
                    }
                    const sentAudioLeadIn = audioLeadInResults.length > 0
                    if (!sentAudioLeadIn && cleanText && !separatedMediaTextSent) {
                        await sendVideoHybridResponse(cleanText)
                        separatedMediaTextSent = true
                    }
                    if (sentAudioLeadIn || separatedMediaTextSent) {
                        await waitBeforeInteractive()
                    }
                    await sendTextChunks(`${sentAudioLeadIn ? 'Segue o link:\n' : ''}${linksText}`)
                }
            } else if (buttons && buttons.options.length > 0) {
                const separateMediaText = shouldSeparateMediaInteractiveText(cleanText)
                let separatedMediaTextSent = false
                try {
                    const audioLeadInResults = wantsAudioInteractive
                        ? await sendMirrorAudioLeadIn({ text: cleanText, broker, configs, supabase, cleanPhone, instanceToken })
                        : []
                    for (const audioLeadInResult of audioLeadInResults) {
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, audioLeadInResult)
                    }
                    const sentAudioLeadIn = audioLeadInResults.length > 0
                    if (wantsAudioInteractive && !sentAudioLeadIn && cleanText) {
                        await sendTextChunks(cleanText)
                    }
                    if (separateMediaText) {
                        await sendVideoHybridResponse(cleanText)
                        separatedMediaTextSent = true
                    }
                    if (sentAudioLeadIn || separatedMediaTextSent) {
                        await waitBeforeInteractive()
                    }
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: (sentAudioLeadIn || wantsAudioInteractive || separateMediaText)
                            ? shortInteractiveText(buttons.title, 'Escolha uma opcao:')
                            : (cleanText || buttons.title),
                        type: 'button',
                        choices: buttons.options.slice(0, 3).map(opt => opt.substring(0, 20)),
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Buttons] Failed, falling back to text:', e)
                    if (!separatedMediaTextSent) {
                        await sendVideoHybridResponse(cleanText || buttons.title || aiResponse.text)
                    }
                }
            } else if (list && list.sections.length > 0) {
                // Send as UAZAPI list with choices format
                try {
                    const choices: string[] = []
                    for (const section of list.sections) {
                        choices.push(`[${section.title}]`)
                        for (const row of section.rows) {
                            if (row.description) {
                                choices.push(`${row.title}|${row.id}|${row.description}`)
                            } else {
                                choices.push(row.title)
                            }
                        }
                    }
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: cleanText || 'Escolha uma opção:',
                        type: 'list',
                        choices,
                        listButton: list.buttonText,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[List] Failed, falling back to text:', e)
                    // Fallback: send as numbered text
                    const fallbackText = list.sections.map(s =>
                        `*${s.title}*\n${s.rows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ''}`).join('\n')}`
                    ).join('\n\n')
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: `${cleanText}\n\n${fallbackText}`, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (poll && poll.options.length >= 2) {
                // Send as UAZAPI poll
                try {
                    const sendResult = await sendMenuMessage({
                        phone: cleanPhone,
                        text: poll.question,
                        type: 'poll',
                        choices: poll.options,
                        selectableCount: poll.multiSelect ? poll.options.length : 1,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    // Also send the text before the poll if any
                    if (cleanText) {
                        await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    }
                } catch (e) {
                    console.warn('[Poll] Failed, falling back to text:', e)
                    const fallbackText = `${poll.question}\n\n${poll.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: `${cleanText ? cleanText + '\n\n' : ''}${fallbackText}`, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (locationRequest) {
                // Send text first, then location request button
                try {
                    if (cleanText) {
                        await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    }
                    const { sendLocationRequest } = await import('../uazapi')
                    const sendResult = await sendLocationRequest(
                        cleanPhone,
                        cleanText || 'Pode compartilhar sua localização? Isso nos ajuda a encontrar os melhores imóveis perto de você! 📍',
                        instanceToken
                    )
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Location] Failed, sending text only:', e)
                    if (!cleanText) {
                        const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: 'Pode nos informar em qual região você está buscando?', instanceToken })
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    }
                }
            } else if (pix) {
                try {
                    if (cleanText) {
                        await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    }
                    const sendResult = await sendPixButton(
                        cleanPhone,
                        pix.pixKey,
                        pix.pixName,
                        pix.pixType === 'EVP' ? 'RANDOM' : pix.pixType,
                        instanceToken
                    )
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[PIX] Failed, falling back to text:', e)
                    const sendResult = await sendWhatsAppMessage({
                        phone: cleanPhone,
                        message: `${cleanText ? cleanText + '\n\n' : ''}Chave PIX: ${pix.pixKey}`,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (carousel && carousel.cards.length > 0) {
                try {
                    const sendResult = await sendCarousel(
                        cleanPhone,
                        cleanText || carousel.text,
                        buildTrackedCarouselCards(carousel.cards, cleanPhone),
                        instanceToken
                    )
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } catch (e) {
                    console.warn('[Carousel] Failed, falling back to text:', e)
                    const sendResult = await sendWhatsAppMessage({
                        phone: cleanPhone,
                        message: cleanText || aiResponse.text,
                        instanceToken
                    })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            } else if (shouldSendAudio) {
                const rawVoiceId = (broker as any).voice_id || configs['whatsapp_tts_voice'] || ''

                // Support "openai:voice_name" format from the broker dropdown
                const isOpenAIVoice = rawVoiceId.startsWith('openai:')
                const voiceId = isOpenAIVoice ? rawVoiceId.replace('openai:', '') : rawVoiceId

                const debugSteps: string[] = []
                debugSteps.push(`voiceId=${voiceId}, isOpenAI=${isOpenAIVoice}, textLen=${cleanText.length}`)
                const audioChunks = ttsTextChunks(cleanText)
                debugSteps.push(`audio_chunks=${audioChunks.length}`)
                let sentAnyAudio = false

                for (let index = 0; index < audioChunks.length; index++) {
                    const chunk = audioChunks[index]
                    let audioBuffer: Buffer | null = null

                    if (isOpenAIVoice && configs['openai_api_key']) {
                        audioBuffer = await ttsOpenAI(chunk, configs['openai_api_key'], voiceId || 'onyx')
                        debugSteps.push(`chunk_${index + 1}_openai_tts: ${audioBuffer ? audioBuffer.length + 'b' : 'NULL'}`)
                    } else if (!isOpenAIVoice && configs['elevenlabs_api_key'] && voiceId) {
                        audioBuffer = await ttsElevenLabs(chunk, configs['elevenlabs_api_key'], voiceId)
                        debugSteps.push(`chunk_${index + 1}_elevenlabs_tts: ${audioBuffer ? audioBuffer.length + 'b' : 'NULL'}`)
                    } else {
                        debugSteps.push(`chunk_${index + 1}_no_tts_match: hasELKey=${!!configs['elevenlabs_api_key']}, hasOAIKey=${!!configs['openai_api_key']}, voiceId=${voiceId}`)
                    }
                    if (!audioBuffer && configs['openai_api_key']) {
                        audioBuffer = await ttsOpenAI(chunk, configs['openai_api_key'], configs['whatsapp_tts_voice'] || 'onyx')
                        debugSteps.push(`chunk_${index + 1}_openai_fallback: ${audioBuffer ? audioBuffer.length + 'b' : 'NULL'}`)
                    }
                    if (!audioBuffer) {
                        debugSteps.push(`chunk_${index + 1}_tts_failed`)
                        continue
                    }

                    const audioPublicUrl = await uploadAudioToR2(audioBuffer, supabase)
                    debugSteps.push(`chunk_${index + 1}_r2_url: ${audioPublicUrl || 'NULL'}`)
                    if (!audioPublicUrl) continue

                    try {
                        const sendResult = await sendAudioMessage({ phone: cleanPhone, audioUrl: audioPublicUrl, ptt: true, instanceToken })
                        debugSteps.push(`chunk_${index + 1}_send_audio: OK`)
                        sentAnyAudio = true
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                        if (index < audioChunks.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 900 + Math.min(chunk.length * 8, 1800)))
                        }
                    } catch (e: any) {
                        debugSteps.push(`chunk_${index + 1}_send_audio: FAIL, error=${e?.message || String(e)}`)
                    }
                }

                if (!sentAnyAudio) {
                    debugSteps.push('all_tts_failed, sending text')
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: cleanText, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                } else {
                    debugSteps.push('audio_chunks_sent')
                }

                // Save debug to DB (fire-and-forget)
                try {
                    await supabase.from('app_config').upsert({
                        key: '_debug_tts_pipeline',
                        value: JSON.stringify({ timestamp: new Date().toISOString(), steps: debugSteps }),
                        updated_at: new Date().toISOString()
                    })
                } catch (_) { /* ignore */ }
            } else {
                // Split messages into human-like chunks if enabled
                const splitEnabled = configs['whatsapp_split_messages'] !== 'false'
                const textToSend = cleanText || aiResponse.text

                if (wantsVideoHybrid && textToSend.length > 160) {
                    await sendVideoHybridResponse(textToSend)
                } else if (splitEnabled && textToSend.length > 120) {
                    const chunks = splitIntoHumanChunks(textToSend)
                    for (let i = 0; i < chunks.length; i++) {
                        if (i > 0) {
                            // Show typing between chunks + delay
                            await setPresenceTyping(cleanPhone, instanceToken).catch(() => {})
                            const chunkDelay = Math.floor(Math.random() * 2000) + 1000 + (chunks[i].length * 20)
                            await new Promise(r => setTimeout(r, Math.min(chunkDelay, 4000)))
                        }
                        const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: chunks[i], instanceToken })
                        botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                    }
                } else {
                    const sendResult = await sendWhatsAppMessage({ phone: cleanPhone, message: textToSend, instanceToken })
                    botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
                }
            }
        })

        await step.run('mark-as-read-after-send', async () => {
            if (configs['whatsapp_mark_as_read'] !== 'false') {
                await markAsRead(cleanPhone, instanceToken, messageId).catch((err) => {
                    console.warn('[WhatsApp Agent] markAsRead (after send) failed:', err)
                })
            }
        })

        // ── Step 7: Handle transfer if needed ──
        await step.run('log-response-sent', async () => {
            await recordAgentLog(supabase, {
                action: 'agent_response_sent',
                instanceName,
                messageType,
                fromPhone: cleanPhone,
                senderName,
                payload: {
                    path: 'standard',
                    messageId: messageId || null,
                    queuedMessageKey: queuedMessageKey || null,
                    responseLength: aiResponse.text.length,
                    shouldTransfer: Boolean(aiResponse.shouldTransfer),
                    queuedHistoryType,
                    hasMediaBatch: mediaBatchItems.length > 1 || queuedHistoryType === 'media_batch',
                    mediaBatchCount: mediaBatchItems.length,
                    inputType: isAudio ? 'audio' : (isMediaMessage ? String(mediaType || 'media') : 'text'),
                },
            })
        })

        if (aiResponse.shouldTransfer) {
            await step.run('handle-transfer', async () => {
                const summary = aiResponse.updatedMessages
                    .map((m: any) => `${m.role === 'user' ? 'Lead' : 'Agente'}: ${m.content}`)
                    .join('\n')
                // Co-piloto ativo: mantém a conversa ativa, apenas registra a transferência.
                await supabase
                    .from('whatsapp_ai_conversations')
                    .update({
                        status: 'active',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', conversation.id)

                // ═══ NOTIFICAR CORRETOR HUMANO ═══
                try {
                    // Load transfer configs
                    const { data: transferConfigs } = await supabase
                        .from('app_config')
                        .select('key, value')
                        .in('key', ['agent_transfer_message_broker', 'agent_transfer_message_lead', 'agent_default_instance_id', 'agent_transfer_instance_ids', 'agent_transfer_mode', 'agent_transfer_rr_index'])

                    const tCfg: Record<string, string> = {}
                    for (const r of (transferConfigs || [])) tCfg[r.key] = r.value
                    const contextText = [
                        messageText || '',
                        aiResponse.text || '',
                        aiResponse.extractedData?.interest || '',
                        aiResponse.extractedData?.region || '',
                        aiResponse.extractedData?.summary || '',
                        ...aiResponse.updatedMessages.slice(-12).map((m: any) => String(m?.content || '')),
                    ].join(' ')

                    const specialized = await pickTransferTargetByEmpreendimento(supabase, contextText)
                    const fallback = await pickTransferTargetInstance(supabase, instanceId, tCfg)
                    const targetInstance = specialized?.instance || fallback
                    const selectedBrokerName = specialized?.broker?.name || 'especialista'
                    const selectedEmpreendimento = specialized?.empreendimento?.nome || ''

                    if (specialized?.instance?.id) {
                        console.log(`[Transfer] Routing by empreendimento: ${(specialized.empreendimento as any)?.nome} -> ${(specialized.broker as any)?.name}`)
                    } else {
                        console.log('[Transfer] No empreendimento specialist matched, using queue fallback')
                    }
                    if (targetInstance?.phone_number && targetInstance?.instance_token) {
                        const { data: targetBroker } = await supabase
                            .from('virtual_brokers')
                            .select('id, name, handoff_prompt')
                            .eq('id', targetInstance.broker_id)
                            .maybeSingle()

                        // Extract lead data from conversation context
                        const leadName = senderName || 'Nao informado'
                        const lastMessages = aiResponse.updatedMessages.slice(-6)
                            .map((m: any) => `${m.role === 'user' ? '??' : '??'} ${m.content}`)
                            .join('\n')

                        // Build specialist notification with lead context
                        let brokerMsg = tCfg['agent_transfer_message_broker']
                            || '?? *Lead qualificado transferido!*\n\n?? Nome: {nome_lead}\n?? Telefone: {telefone}\n\n? Entre em contato agora!'

                        brokerMsg = brokerMsg
                            .replace(/\{nome_lead\}/g, leadName)
                            .replace(/\{telefone\}/g, cleanPhone)
                            .replace(/\{interesse\}/g, aiResponse.extractedData?.interest || 'Nao identificado')
                            .replace(/\{orcamento\}/g, aiResponse.extractedData?.budget || 'Nao informado')
                            .replace(/\{regiao\}/g, aiResponse.extractedData?.region || 'Nao informada')

                        brokerMsg += `\n\n?? *Ultimas mensagens:*\n${lastMessages}`

                        const { sendWhatsAppMessage } = await import('../uazapi')
                        await sendWhatsAppMessage({
                            phone: targetInstance.phone_number,
                            message: brokerMsg,
                            instanceToken
                        })
                        console.log(`[Transfer] Summary sent to specialist instance ${targetInstance.id}`)

                        // Specialist instance reaches the lead from its own WhatsApp
                        let leadMsg = tCfg['agent_transfer_message_lead']
                            || 'Perfeito! Vou te encaminhar para nosso especialista agora. Ele ja recebeu seu contexto.'
                        leadMsg = leadMsg
                            .replace(/\{nome_lead\}/g, senderName || 'cliente')
                            .replace(/\{telefone\}/g, cleanPhone)
                            .replace(/\{nome_corretor\}/g, selectedBrokerName)
                            .replace(/\{empreendimento\}/g, selectedEmpreendimento || 'seu interesse')
                        await sendWhatsAppMessage({
                            phone: cleanPhone,
                            message: leadMsg,
                            instanceToken: targetInstance.instance_token
                        })

                        // Mensagem inicial automática do especialista para o lead.
                        let specialistFirstMsg = String(targetBroker?.handoff_prompt || '').trim()
                        if (!specialistFirstMsg) {
                            specialistFirstMsg = `Oi ${senderName || 'tudo bem'}! Eu sou ${targetBroker?.name || selectedBrokerName}. Vi aqui seu atendimento e vou dar continuidade agora.`
                        }
                        specialistFirstMsg = specialistFirstMsg
                            .replace(/\{nome_lead\}/g, senderName || 'cliente')
                            .replace(/\{nome_corretor\}/g, targetBroker?.name || selectedBrokerName)
                            .replace(/\{telefone\}/g, cleanPhone)
                            .replace(/\{interesse\}/g, aiResponse.extractedData?.interest || 'não identificado')
                            .replace(/\{orcamento\}/g, aiResponse.extractedData?.budget || 'não informado')
                            .replace(/\{regiao\}/g, aiResponse.extractedData?.region || 'não informada')
                            .replace(/\{empreendimento\}/g, selectedEmpreendimento || 'seu interesse')

                        await sendWhatsAppMessage({
                            phone: cleanPhone,
                            message: specialistFirstMsg,
                            instanceToken: targetInstance.instance_token
                        })
                    } else {
                        console.warn('[Transfer] No eligible specialist instance in configured queue')
                    }
                } catch (transferErr) {
                    console.error('[Transfer] Erro ao notificar corretor:', transferErr)
                }
            })
        }

        // ── Step 8: Sync CRM (fire-and-forget) ──
        await step.run('sync-crm', async () => {
            try {
                const { updateLead } = await import('../uazapi')
                const leadData: Record<string, unknown> = {
                    id: cleanPhone,
                    lead_field12: new Date().toISOString(),  // Último contato
                    lead_field05: broker.name || 'AI Agent',  // Agente
                }

                // Sync sender name if available
                if (senderName) {
                    leadData.lead_name = senderName
                }

                // Extract data from conversation if AI extracted it
                if (aiResponse.extractedData) {
                    const d = aiResponse.extractedData
                    if (d.name) leadData.lead_fullName = d.name
                    if (d.phone) leadData.lead_field01 = d.phone  // may duplicate but useful
                    if (d.budget) leadData.lead_field02 = d.budget
                    if (d.interest) leadData.lead_field01 = d.interest  // Tipo de imóvel
                    if (d.timeframe) leadData.lead_field04 = d.timeframe
                    if (d.email) leadData.lead_email = d.email
                    if (d.classification) {
                        leadData.lead_status = d.classification
                        // Auto-tag
                        const tags: string[] = []
                        if (d.classification === 'vip') tags.push('VIP')
                        if (d.classification === 'hot') tags.push('Qualificado')
                        if (d.is_partner) tags.push('Parceiro')
                        if (tags.length > 0) leadData.lead_tags = tags
                    }
                    if (d.summary) leadData.lead_field20 = d.summary  // Notas AI
                }

                await updateLead(leadData as any, instanceToken)
                console.log(`[WhatsApp Agent] 📋 CRM sync completed for ${cleanPhone}`)
            } catch (e) {
                console.warn('[WhatsApp Agent] CRM sync failed (non-fatal):', e)
            }
        })

        // ── Step 9: Sync lead_collected_data (CRM interno) ──
        await step.run('sync-lead-collected-data', async () => {
            try {
                const d = aiResponse.extractedData || {}
                const { data: existingLead } = await supabase
                    .from('lead_collected_data')
                    .select('*')
                    .eq('lead_phone', cleanPhone)
                    .maybeSingle()

                const leadUpdate: Record<string, unknown> = {
                    lead_phone: cleanPhone,
                    updated_at: new Date().toISOString(),
                }

                if (senderName || d.name || existingLead?.lead_name) leadUpdate.lead_name = d.name || senderName || existingLead?.lead_name
                if (d.interest || existingLead?.interest) leadUpdate.interest = d.interest || existingLead?.interest
                if (d.region || existingLead?.region) leadUpdate.region = d.region || existingLead?.region
                if (d.budget) {
                    const budgetNum = parseBudgetToNumber(d.budget)
                    if (budgetNum) leadUpdate.budget_max = budgetNum
                }
                if (!leadUpdate.budget_max && existingLead?.budget_max) leadUpdate.budget_max = existingLead.budget_max
                if (d.bedrooms || existingLead?.bedrooms_wanted) leadUpdate.bedrooms_wanted = parseInt(d.bedrooms) || existingLead?.bedrooms_wanted || null
                if (d.property_type || existingLead?.property_type) leadUpdate.property_type = d.property_type || existingLead?.property_type
                if (d.timeframe || existingLead?.timeline) leadUpdate.timeline = d.timeframe || existingLead?.timeline

                // Calculate qualification score (0-100)
                const score = computeLeadScore(leadUpdate)
                leadUpdate.qualification_score = score

                // Determine status based on score
                if (aiResponse.shouldTransfer) {
                    leadUpdate.status = 'transferred'
                } else if (score >= 70) {
                    leadUpdate.status = 'qualified'
                } else if (score >= 30) {
                    leadUpdate.status = 'qualifying'
                }

                if (broker.id) leadUpdate.broker_id = broker.id

                // Upsert by lead_phone
                const { error } = await supabase
                    .from('lead_collected_data')
                    .upsert(leadUpdate, { onConflict: 'lead_phone' })

                if (error) {
                    console.warn('[CRM Interno] Upsert error:', error.message)
                } else {
                    console.log(`[CRM Interno] ✅ Lead ${cleanPhone} atualizado (score: ${score})`)
                }
            } catch (e) {
                console.warn('[CRM Interno] Sync failed (non-fatal):', e)
            }
        })

        // ── Step 10: Detect and save appointment ──
        await step.run('detect-appointment', async () => {
            try {
                if (aiResponse.extractedData?.appointment_created_from_marker) {
                    console.log(`[Appointment] Real agenda marker already handled for ${cleanPhone}`)
                    return
                }

                // Check if the incoming message or AI response indicates scheduling
                const lastUserMsg = (inputText || messageText || '').toLowerCase()
                const lastAiMsg = (aiResponse.text || '').toLowerCase()
                const buttonText = String(buttonResponseTitle || buttonResponseId || '').toLowerCase()
                const pollText = Array.isArray(pollVotes) ? pollVotes.join(' ').toLowerCase() : String(pollVotes || '').toLowerCase()
                const allMsgs = `${lastUserMsg} ${lastAiMsg} ${buttonText} ${pollText}`

                const timeSlots = ['manhã', 'tarde', 'noite', 'manha']
                const recentSchedulingContext = findRecentSchedulingContext(aiResponse.updatedMessages || [])
                const userConfirmed = isAppointmentConfirmation(`${lastUserMsg} ${buttonText} ${pollText}`)
                const schedulingText = userConfirmed && recentSchedulingContext
                    ? `${recentSchedulingContext} ${allMsgs}`
                    : allMsgs
                const normalizedSchedulingText = normalizeForSearch(schedulingText)
                const selectedSlot = ['manha', 'tarde', 'noite'].find(s => normalizedSchedulingText.includes(s))

                // Also check AI extracted data for scheduling
                const hasSchedulingContext = hasAppointmentContext(schedulingText)
                const explicitAppointmentTime = extractAppointmentTimeFromText(schedulingText)
                const appointmentDateFromText = resolveRelativeAppointmentDate(schedulingText, getSaoPauloDate())
                const aiIsRegistering = /(registr|agendad|marcad|confirmad)/.test(normalizeForSearch(lastAiMsg))
                const shouldCreateAppointment = hasSchedulingContext
                    && (userConfirmed || aiIsRegistering)
                    && (selectedSlot || explicitAppointmentTime)

                if (shouldCreateAppointment) {
                    const nowSp = getSaoPauloDate()
                    const appointmentDate = appointmentDateFromText || toDateKey(addDays(nowSp, 1))

                    const timeLabel = explicitAppointmentTime || formatAppointmentSlotLabel(selectedSlot || '')

                    const normalizedSlot = normalizeForSearch(timeLabel)
                    const { data: sameDayAppointments } = await supabase
                        .from('appointments')
                        .select('id, appointment_time, status')
                        .eq('lead_phone', cleanPhone)
                        .eq('appointment_date', appointmentDate)
                        .neq('status', 'cancelled')
                        .limit(20)

                    const alreadyExists = (sameDayAppointments || []).some((a: any) => {
                        const value = normalizeForSearch(String(a.appointment_time || ''))
                        return value.includes(normalizedSlot) || normalizedSlot.includes(value)
                    })

                    if (alreadyExists) {
                        console.log(`[Appointment] ℹ️ Duplicate prevented for ${cleanPhone} on ${appointmentDate} (${timeLabel})`)
                        return
                    }

                    const { error } = await supabase
                        .from('appointments')
                        .insert([{
                            lead_phone: cleanPhone,
                            lead_name: senderName || null,
                            broker_id: broker.id || null,
                            appointment_date: appointmentDate,
                            appointment_time: timeLabel,
                            appointment_type: 'visita',
                            property_title: aiResponse.extractedData?.property || null,
                            status: 'pending',
                        }])

                    if (error) {
                        console.warn('[Appointment] Insert error:', error.message)
                    } else {
                        console.log(`[Appointment] 📅 Agendamento criado: ${cleanPhone} em ${appointmentDate} (${timeLabel})`)
                    }
                }
            } catch (e) {
                console.warn('[Appointment] Detection failed (non-fatal):', e)
            }
        })

        // ── Step 11: Save location & documents ──
        await step.run('save-location-docs', async () => {
            try {
                const evData = event.data as any

                // Save GPS location if received
                if (configEnabled(configs, 'whatsapp_detect_location_enabled') && evData.receivedLatitude && evData.receivedLongitude) {
                    const { error } = await supabase
                        .from('lead_collected_data')
                        .upsert({
                            lead_phone: cleanPhone,
                            latitude: evData.receivedLatitude,
                            longitude: evData.receivedLongitude,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'lead_phone' })

                    if (error) {
                        console.warn('[Location] Save error:', error.message)
                    } else {
                        console.log(`[Location] 📍 GPS salvo para ${cleanPhone}: ${evData.receivedLatitude}, ${evData.receivedLongitude}`)
                    }
                }

                // Log document/image received
                if (configEnabled(configs, 'whatsapp_lead_file_storage_enabled') && evData.mediaType && ['document', 'image', 'video'].includes(evData.messageType || '')) {
                    const docEntry = {
                        type: evData.mediaType,
                        filename: evData.mediaFilename || `${evData.mediaType}_${Date.now()}`,
                        mimetype: evData.mediaMimetype || 'unknown',
                        url: evData.mediaUrl || null,
                        received_at: new Date().toISOString(),
                    }

                    // Get existing docs
                    const { data: existing } = await supabase
                        .from('lead_collected_data')
                        .select('documents_received')
                        .eq('lead_phone', cleanPhone)
                        .maybeSingle()

                    const docs = Array.isArray(existing?.documents_received) ? existing.documents_received : []
                    docs.push(docEntry)

                    const { error } = await supabase
                        .from('lead_collected_data')
                        .upsert({
                            lead_phone: cleanPhone,
                            documents_received: docs,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'lead_phone' })

                    if (error) {
                        console.warn('[Document] Save error:', error.message)
                    } else {
                        console.log(`[Document] 📄 Documento salvo para ${cleanPhone}: ${docEntry.filename} (${docEntry.type})`)
                    }
                }
            } catch (e) {
                console.warn('[Location/Docs] Save failed (non-fatal):', e)
            }
        })

        return {
            action: 'processed',
            phone: cleanPhone,
            broker: broker.name,
            responseLength: aiResponse.text.length,
            wasAudio: isAudio,
            transferred: aiResponse.shouldTransfer
        }
    }
)

// ═══════════════════════════════════════════════════════════════
// INNGEST FUNCTION: Handle Human Takeover Detection
// ═══════════════════════════════════════════════════════════════

export const detectHumanTakeover = inngest.createFunction(
    {
        id: 'whatsapp-detect-human-takeover',
        name: 'WhatsApp — Detect Human Takeover',
        retries: 0,
    },
    { event: 'whatsapp/from-me-message' },
    async ({ event }) => {
        const { botMsgId, instanceId, recipientPhone, messageText } = event.data
        const supabase = getSupabase()

        // Check if this message was sent by the bot
        const { data: botMsg } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id')
            .contains('bot_message_ids', [botMsgId])
            .limit(1)
            .maybeSingle()

        if (!botMsg && recipientPhone) {
            // This was a MANUAL message from the human operator
            console.log(`[Human Takeover] Detected on instance ${instanceId}`)
            const { data: conv } = await supabase
                .from('whatsapp_ai_conversations')
                .select('id, broker_id, lead_phone, messages, status')
                .eq('instance_id', instanceId)
                .eq('lead_phone', recipientPhone)
                .in('status', ['active', 'human_takeover', 'transferred'])
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            let currentConv = conv
            if (!currentConv?.id) {
                const { data: inst } = await supabase
                    .from('whatsapp_instances')
                    .select('broker_id')
                    .eq('id', instanceId)
                    .maybeSingle()

                if (inst?.broker_id) {
                    await ensureWhatsAppLead(supabase, {
                        phone: recipientPhone,
                        instanceId,
                        brokerId: inst.broker_id,
                        acquiredVia: 'whatsapp',
                    }).catch(() => null)
                    const { data: created } = await supabase
                        .from('whatsapp_ai_conversations')
                        .insert({
                            broker_id: inst.broker_id,
                            instance_id: instanceId,
                            lead_phone: recipientPhone,
                            messages: [],
                            bot_message_ids: [],
                            status: 'human_takeover',
                            human_takeover_at: new Date().toISOString(),
                        })
                        .select('id, broker_id, lead_phone, messages, status')
                        .single()
                    currentConv = created as any
                }
            }

            if (currentConv?.id) {
                const nextMessages = Array.isArray(currentConv.messages) ? [...currentConv.messages] : []
                const cleanHumanText = (messageText || '').trim()
                if (cleanHumanText) {
                    // Store manual broker message as assistant role so future AI turns preserve full context.
                    nextMessages.push({
                        role: 'assistant',
                        content: cleanHumanText,
                        type: 'text',
                        source: 'human',
                        timestamp: new Date().toISOString(),
                    })
                }

                await supabase
                    .from('whatsapp_ai_conversations')
                    .update({
                        status: 'human_takeover',
                        human_takeover_at: new Date().toISOString(),
                        messages: nextMessages,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentConv.id)

                if (cleanHumanText) {
                    const lead = await ensureWhatsAppLead(supabase, {
                        phone: recipientPhone,
                        instanceId,
                        brokerId: currentConv.broker_id || null,
                        acquiredVia: 'whatsapp',
                    }).catch(() => null)
                    await appendLeadConversationLog(supabase, lead?.id, {
                        role: 'assistant',
                        content: cleanHumanText,
                        type: 'text',
                        source: 'human',
                        instance_id: instanceId,
                        broker_id: currentConv.broker_id || null,
                    }).catch(() => { })
                }

                // Send shift handoff summary to broker phone (if configured)
                if (currentConv.broker_id) {
                    const { data: inst } = await supabase
                        .from('whatsapp_instances')
                        .select('instance_token')
                        .eq('id', instanceId)
                        .maybeSingle()
                    const instanceToken = inst?.instance_token || ''
                    await sendHandoffSummaryIfNeeded(supabase, {
                        conversation: { ...currentConv, messages: nextMessages },
                        instanceId,
                        instanceToken,
                        recipientPhone,
                        markerSuffix: `takeover_${new Date().toISOString().slice(0, 10)}`,
                    }).catch(() => { })
                }
            }

            return { action: 'takeover_activated', phone: recipientPhone }
        }

        return { action: 'bot_message_confirmed' }
    }
)

// ═══════════════════════════════════════════════════════════════
// INNGEST FUNCTION: Shadow Agent (for human brokers after hours)
// ═══════════════════════════════════════════════════════════════

export const shadowAgentResponse = inngest.createFunction(
    {
        id: 'whatsapp-shadow-agent',
        name: 'WhatsApp — Shadow Agent After Hours',
        retries: 1,
    },
    { event: 'whatsapp/shadow-agent' },
    async ({ event, step }) => {
        const { cleanPhone, messageText, instanceId, instanceToken, adminUserId } = event.data
        const supabase = getSupabase()

        const user = await step.run('load-user', async () => {
            const { data } = await supabase.from('admin_users').select('*').eq('id', adminUserId).single()
            return data
        })

        if (!user || !user.shadow_agent_enabled || !user.shadow_agent_prompt) {
            return { action: 'skipped', reason: 'shadow_agent_disabled' }
        }

        // Check availability
        const now = new Date()
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        const availableFrom = user.available_from || '08:00'
        const availableUntil = user.available_until || '20:00'

        if (currentTime >= availableFrom && currentTime <= availableUntil) {
            return { action: 'skipped', reason: 'user_available' }
        }

        // Find or create conversation
        const conversation = await step.run('find-or-create-shadow-conv', async () => {
            await ensureWhatsAppLead(supabase, {
                phone: cleanPhone,
                senderName: null,
                instanceId,
                acquiredVia: 'whatsapp',
            }).catch(() => null)

            const { data: existing } = await supabase
                .from('whatsapp_broker_conversations')
                .select('*')
                .eq('broker_user_id', user.id)
                .eq('lead_phone', cleanPhone)
                .eq('is_shadow_agent', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (existing) {
                return existing
            }

            const { data: newConv } = await supabase
                .from('whatsapp_broker_conversations')
                .insert({ broker_user_id: user.id, lead_phone: cleanPhone, messages: [], is_shadow_agent: true })
                .select()
                .single()
            return newConv
        })

        if (!conversation) return { action: 'error', reason: 'could_not_create_conversation' }

        // Generate AI response
        const responseText = await step.run('generate-shadow-response', async () => {
            const updatedMessages = [...(conversation.messages || []), {
                role: 'user',
                content: messageText,
                source: 'lead',
                instance_id: instanceId,
                timestamp: new Date().toISOString()
            }]

            const configs = await loadAIConfigs(supabase)
            const provider = configs['ai_provider'] || 'gemini'
            const apiKey = provider === 'openai' ? configs['openai_api_key'] : configs['gemini_api_key']

            if (!apiKey) return 'O corretor está indisponível no momento. Retornaremos em breve.'

            let text = ''
            try {
                if (provider === 'openai') {
                    const res = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [{ role: 'system', content: user.shadow_agent_prompt }, ...updatedMessages.map((m: any) => ({ role: m.role, content: m.content }))],
                            max_tokens: 300, temperature: 0.7
                        })
                    })
                    const data = await res.json()
                    text = data.choices?.[0]?.message?.content || ''
                } else {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            systemInstruction: { parts: [{ text: user.shadow_agent_prompt }] },
                            contents: updatedMessages.map((m: any) => ({
                                role: m.role === 'assistant' ? 'model' : 'user',
                                parts: [{ text: m.content }]
                            }))
                        })
                    })
                    const data = await res.json()
                    await recordGeminiUsage({
                        model: 'gemini-2.0-flash',
                        feature: 'whatsapp_shadow_agent',
                        usageMetadata: data.usageMetadata,
                        metadata: { admin_user_id: user.id || null },
                    })
                    text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                }
            } catch {
                text = 'O corretor está indisponível no momento.'
            }

            const finalText = text || 'O corretor está indisponível. Retornaremos em breve.'
            updatedMessages.push({
                role: 'assistant',
                content: finalText,
                source: 'shadow_agent',
                instance_id: instanceId,
                timestamp: new Date().toISOString()
            })

            await supabase
                .from('whatsapp_broker_conversations')
                .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
                .eq('id', conversation.id)

            await syncWhatsAppLeadSnapshot(supabase, {
                phone: cleanPhone,
                senderName: null,
                instanceId,
                acquiredVia: 'whatsapp',
                messages: updatedMessages,
                extractedData: null,
                shouldTransfer: false,
            }).catch(() => null)

            return finalText
        })

        // Human-like delays
        await step.sleep('shadow-read-delay', `${Math.floor(Math.random() * 2000) + 1000}ms`)

        await step.run('shadow-typing', async () => {
            await setPresenceTyping(cleanPhone, instanceToken).catch(() => { })
        })

        const typingMs = Math.min(Math.max(responseText.length * 25, 1500), 6000)
        await step.sleep('shadow-typing-delay', `${typingMs}ms`)

        await step.run('shadow-send', async () => {
            await sendWhatsAppMessage({ phone: cleanPhone, message: responseText, instanceToken })
        })

        return { action: 'shadow_responded', phone: cleanPhone }
    }
)

// ═══════════════════════════════════════════════════════════════
// INNGEST CRON: Keep WhatsApp Always Online
// ═══════════════════════════════════════════════════════════════

export const reliableMarkAsRead = inngest.createFunction(
    {
        id: 'whatsapp-reliable-mark-read',
        name: 'WhatsApp - Reliable Mark As Read',
        retries: 0,
    },
    { event: 'whatsapp/mark-read' },
    async ({ event, step }) => {
        const { instanceToken, remotePhone, cleanPhone, messageId } = event.data as {
            instanceToken: string
            remotePhone?: string | null
            cleanPhone: string
            messageId?: string | null
        }

        if (!instanceToken || !cleanPhone) {
            return { action: 'skipped', reason: 'missing_data' }
        }

        const targets = Array.from(new Set([
            remotePhone || '',
            cleanPhone,
            `${cleanPhone}@s.whatsapp.net`,
        ].filter(Boolean)))

        const delays = [0, 1, 2, 4, 8]
        const results: string[] = []

        for (let i = 0; i < delays.length; i++) {
            const delay = delays[i]
            if (delay > 0) {
                await step.sleep(`retry-wait-${i}`, `${delay}s`)
            }

            await step.run(`retry-mark-read-${i}`, async () => {
                const settled = await Promise.allSettled(
                    targets.map((target) => markAsRead(target, instanceToken, messageId))
                )
                const ok = settled.filter(r => r.status === 'fulfilled').length
                results.push(`t+${delay}s: ok=${ok}/${targets.length}`)
            })
        }

        return { action: 'done', targets, results }
    }
)

export const whatsappKeepOnline = inngest.createFunction(
    {
        id: 'whatsapp-keep-online',
        name: 'WhatsApp — Keep Instances Online',
        retries: 0,
    },
    { cron: '*/2 * * * *' },  // Every 2 minutes
    async () => {
        const supabase = getSupabase()

        // Get all connected instances with their config
        const { data: instances } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token, config')
            .eq('status', 'connected')

        if (!instances || instances.length === 0) {
            return { action: 'no_connected_instances' }
        }

        // Set presence for each instance that has always_online enabled
        const results: string[] = []
        for (const inst of instances) {
            const cfg = (inst.config as Record<string, any>) || {}
            // Default to true if not explicitly set to false
            if (cfg.always_online === false || cfg.always_online === 'false') {
                results.push(`${inst.instance_name}: skipped (always_online=false)`)
                continue
            }
            try {
                await setPresenceAvailable(inst.instance_token)
                results.push(`${inst.instance_name}: online`)
            } catch {
                results.push(`${inst.instance_name}: error`)
            }
        }

        console.log(`[KeepOnline] ${results.join(', ')}`)
        return { action: 'presence_set', count: instances.length, results }
    }
)
