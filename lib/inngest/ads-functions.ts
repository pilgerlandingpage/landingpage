// =============================================
// Inngest Functions — Workers de Tráfego
// =============================================

import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import * as metaAds from '../ads/meta'
import * as googleAds from '../ads/google'
import { analyzeCampaignMetrics, calculateBudgetPacing, generateDailyReport } from '../ads/ai-brain'
import { sendAlertToAdmins, sendDailyReport } from '../ads/whatsapp-alerts'
import { syncPaidAdsSpendToFinance } from '../finance/ads-spend-sync'
import { generatePaidMarketingReport } from '../ads/paid-report-agent'
import { syncFacebookOrganic } from '../social/facebook'
import { syncInstagramOrganic } from '../social/instagram'
import { generateOrganicMarketingReport } from '../social/organic-report-agent'
import { publishDueScheduledPosts } from '../social/meta-publisher'
import { runScheduledResearchTopics } from '../research/pilger'
import { runEcosystemSnapshotCycle } from '../intelligence/ecosystem'
import { runBlogAgentDraft } from '../blog/runner'
import { getNewsAgentSchedule } from '../news/schedule'
import { runNewsAgentDraft } from '../news/runner'
import type { AdCampaign, MetricsSnapshot, AlertUrgency } from '../ads/types'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const DEFAULT_ADS_SYNC_INTERVAL_MINUTES = 60
const MIN_ADS_SYNC_INTERVAL_MINUTES = 1
const MAX_ADS_SYNC_INTERVAL_MINUTES = 1440
const DEFAULT_ORGANIC_SYNC_INTERVAL_MINUTES = 120
const MIN_ORGANIC_SYNC_INTERVAL_MINUTES = 30
const MAX_ORGANIC_SYNC_INTERVAL_MINUTES = 1440
const DEFAULT_ORGANIC_REPORT_INTERVAL_HOURS = 24
const MIN_ORGANIC_REPORT_INTERVAL_HOURS = 6
const MAX_ORGANIC_REPORT_INTERVAL_HOURS = 168
const DEFAULT_PAID_REPORT_INTERVAL_HOURS = 24
const MIN_PAID_REPORT_INTERVAL_HOURS = 6
const MAX_PAID_REPORT_INTERVAL_HOURS = 168
const DEFAULT_MARKETING_PUBLISHER_INTERVAL_MINUTES = 10
const MIN_MARKETING_PUBLISHER_INTERVAL_MINUTES = 5
const MAX_MARKETING_PUBLISHER_INTERVAL_MINUTES = 1440
const DEFAULT_ECOSYSTEM_INTELLIGENCE_INTERVAL_HOURS = 6
const MIN_ECOSYSTEM_INTELLIGENCE_INTERVAL_HOURS = 1
const MAX_ECOSYSTEM_INTELLIGENCE_INTERVAL_HOURS = 168
const BLOG_AGENT_TIME_ZONE = 'America/Sao_Paulo'
const DEFAULT_BLOG_AGENT_SCHEDULE_DAY = '1'
const DEFAULT_BLOG_AGENT_SCHEDULE_TIME = '09:00'
const BLOG_AGENT_RUN_IN_PROGRESS_GRACE_MINUTES = 30
const DEFAULT_BLOG_AGENT_WEEKLY_SLOTS = [
    { id: '1', day: '1', time: '09:00' },
    { id: '2', day: '3', time: '09:00' },
    { id: '3', day: '5', time: '09:00' },
    { id: '4', day: 'off', time: '09:00' },
    { id: '5', day: 'off', time: '09:00' },
    { id: '6', day: 'off', time: '09:00' },
    { id: '7', day: 'off', time: '09:00' },
]

function parseAdsSyncInterval(value?: string | null) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return DEFAULT_ADS_SYNC_INTERVAL_MINUTES
    return Math.min(MAX_ADS_SYNC_INTERVAL_MINUTES, Math.max(MIN_ADS_SYNC_INTERVAL_MINUTES, parsed))
}

function parseOrganicSyncInterval(value?: string | null) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return DEFAULT_ORGANIC_SYNC_INTERVAL_MINUTES
    return Math.min(MAX_ORGANIC_SYNC_INTERVAL_MINUTES, Math.max(MIN_ORGANIC_SYNC_INTERVAL_MINUTES, parsed))
}

function parseOrganicSyncLimit(value?: string | null) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return 12
    return Math.min(50, Math.max(3, parsed))
}

function parseOrganicReportIntervalHours(value?: string | null) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return DEFAULT_ORGANIC_REPORT_INTERVAL_HOURS
    return Math.min(MAX_ORGANIC_REPORT_INTERVAL_HOURS, Math.max(MIN_ORGANIC_REPORT_INTERVAL_HOURS, parsed))
}

function parsePaidReportIntervalHours(value?: string | null) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return DEFAULT_PAID_REPORT_INTERVAL_HOURS
    return Math.min(MAX_PAID_REPORT_INTERVAL_HOURS, Math.max(MIN_PAID_REPORT_INTERVAL_HOURS, parsed))
}

function parseMarketingPublisherIntervalMinutes(value?: string | null) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return DEFAULT_MARKETING_PUBLISHER_INTERVAL_MINUTES
    return Math.min(MAX_MARKETING_PUBLISHER_INTERVAL_MINUTES, Math.max(MIN_MARKETING_PUBLISHER_INTERVAL_MINUTES, parsed))
}

function parseEcosystemIntelligenceIntervalHours(value?: string | null) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return DEFAULT_ECOSYSTEM_INTELLIGENCE_INTERVAL_HOURS
    return Math.min(MAX_ECOSYSTEM_INTELLIGENCE_INTERVAL_HOURS, Math.max(MIN_ECOSYSTEM_INTELLIGENCE_INTERVAL_HOURS, parsed))
}

function parseConfigDate(value?: string | null) {
    if (!value) return null
    const ms = new Date(value).getTime()
    return Number.isFinite(ms) ? ms : null
}

function normalizeScheduleDay(value?: string | null, fallback = DEFAULT_BLOG_AGENT_SCHEDULE_DAY) {
    const selected = String(value || '').trim()
    if (selected === 'off') return 'off'
    return ['0', '1', '2', '3', '4', '5', '6'].includes(selected)
        ? selected
        : fallback
}

function normalizeScheduleTime(value?: string | null) {
    const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/)
    if (!match) return DEFAULT_BLOG_AGENT_SCHEDULE_TIME

    const hour = Number.parseInt(match[1], 10)
    const minute = Number.parseInt(match[2] || '0', 10)
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return DEFAULT_BLOG_AGENT_SCHEDULE_TIME

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function minutesFromScheduleTime(value: string) {
    const [hour, minute] = value.split(':').map(part => Number.parseInt(part, 10))
    return (hour * 60) + minute
}

function getBlogAgentLocalParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BLOG_AGENT_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date)

    const value = (type: string) => parts.find(part => part.type === type)?.value || '00'
    const dateStamp = `${value('year')}-${value('month')}-${value('day')}`
    const weekday = new Date(`${dateStamp}T00:00:00Z`).getUTCDay()

    return {
        dateStamp,
        weekday: String(weekday),
        minuteOfDay: (Number.parseInt(value('hour'), 10) * 60) + Number.parseInt(value('minute'), 10),
    }
}

function getBlogAgentWeeklySlots(config: Record<string, string>) {
    return DEFAULT_BLOG_AGENT_WEEKLY_SLOTS.map(slot => {
        const fallbackDay = slot.id === '1'
            ? (config.blog_agent_schedule_day || slot.day)
            : slot.day
        const fallbackTime = slot.id === '1'
            ? (config.blog_agent_schedule_time || slot.time)
            : slot.time
        const day = normalizeScheduleDay(config[`blog_agent_schedule_day_${slot.id}`] || fallbackDay, slot.day)
        const time = normalizeScheduleTime(config[`blog_agent_schedule_time_${slot.id}`] || fallbackTime)
        if (day === 'off') return null

        return {
            id: slot.id,
            day,
            time,
            minuteOfDay: minutesFromScheduleTime(time),
        }
    }).filter((slot): slot is { id: string; day: string; time: string; minuteOfDay: number } => Boolean(slot))
}

async function getAdsSyncSchedule(supabase: ReturnType<typeof getSupabase>) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['ads_sync_interval_minutes', 'ads_sync_last_run_at', 'ads_sync_last_started_at'])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const intervalMinutes = parseAdsSyncInterval(config.ads_sync_interval_minutes)
    const lastRunMs = parseConfigDate(config.ads_sync_last_run_at)
    const lastStartedMs = parseConfigDate(config.ads_sync_last_started_at)
    const lastActivityMs = Math.max(lastRunMs || 0, lastStartedMs || 0)
    const nowMs = Date.now()
    const elapsedMinutes = lastActivityMs ? Math.floor((nowMs - lastActivityMs) / 60000) : null

    return {
        shouldRun: !lastActivityMs || nowMs - lastActivityMs >= intervalMinutes * 60000,
        intervalMinutes,
        elapsedMinutes,
        lastRunAt: config.ads_sync_last_run_at || null,
        lastStartedAt: config.ads_sync_last_started_at || null,
    }
}

async function getOrganicSyncSchedule(supabase: ReturnType<typeof getSupabase>) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'organic_social_sync_enabled',
            'organic_social_sync_interval_minutes',
            'organic_social_sync_limit',
            'organic_social_sync_last_run_at',
            'organic_social_sync_last_started_at',
        ])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const enabled = config.organic_social_sync_enabled !== 'false'
    const intervalMinutes = parseOrganicSyncInterval(config.organic_social_sync_interval_minutes)
    const limit = parseOrganicSyncLimit(config.organic_social_sync_limit)
    const lastRunMs = parseConfigDate(config.organic_social_sync_last_run_at)
    const lastStartedMs = parseConfigDate(config.organic_social_sync_last_started_at)
    const lastActivityMs = Math.max(lastRunMs || 0, lastStartedMs || 0)
    const nowMs = Date.now()
    const elapsedMinutes = lastActivityMs ? Math.floor((nowMs - lastActivityMs) / 60000) : null

    return {
        enabled,
        shouldRun: enabled && (!lastActivityMs || nowMs - lastActivityMs >= intervalMinutes * 60000),
        intervalMinutes,
        limit,
        elapsedMinutes,
        lastRunAt: config.organic_social_sync_last_run_at || null,
        lastStartedAt: config.organic_social_sync_last_started_at || null,
    }
}

async function getOrganicReportSchedule(supabase: ReturnType<typeof getSupabase>) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'organic_report_agent_enabled',
            'organic_report_agent_interval_hours',
            'organic_report_agent_last_run_at',
            'organic_report_agent_last_started_at',
        ])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const enabled = config.organic_report_agent_enabled !== 'false'
    const intervalHours = parseOrganicReportIntervalHours(config.organic_report_agent_interval_hours)
    const lastRunMs = parseConfigDate(config.organic_report_agent_last_run_at)
    const lastStartedMs = parseConfigDate(config.organic_report_agent_last_started_at)
    const lastActivityMs = Math.max(lastRunMs || 0, lastStartedMs || 0)
    const nowMs = Date.now()
    const elapsedHours = lastActivityMs ? Math.floor((nowMs - lastActivityMs) / 3600000) : null

    return {
        enabled,
        shouldRun: enabled && (!lastActivityMs || nowMs - lastActivityMs >= intervalHours * 3600000),
        intervalHours,
        elapsedHours,
        lastRunAt: config.organic_report_agent_last_run_at || null,
        lastStartedAt: config.organic_report_agent_last_started_at || null,
    }
}

async function getPaidReportSchedule(supabase: ReturnType<typeof getSupabase>) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'paid_report_agent_enabled',
            'paid_report_agent_interval_hours',
            'paid_report_agent_last_run_at',
            'paid_report_agent_last_started_at',
        ])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const enabled = config.paid_report_agent_enabled !== 'false'
    const intervalHours = parsePaidReportIntervalHours(config.paid_report_agent_interval_hours)
    const lastRunMs = parseConfigDate(config.paid_report_agent_last_run_at)
    const lastStartedMs = parseConfigDate(config.paid_report_agent_last_started_at)
    const lastActivityMs = Math.max(lastRunMs || 0, lastStartedMs || 0)
    const nowMs = Date.now()
    const elapsedHours = lastActivityMs ? Math.floor((nowMs - lastActivityMs) / 3600000) : null

    return {
        enabled,
        shouldRun: enabled && (!lastActivityMs || nowMs - lastActivityMs >= intervalHours * 3600000),
        intervalHours,
        elapsedHours,
        lastRunAt: config.paid_report_agent_last_run_at || null,
        lastStartedAt: config.paid_report_agent_last_started_at || null,
    }
}

async function getMarketingPublisherSchedule(supabase: ReturnType<typeof getSupabase>) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'marketing_publisher_agent_enabled',
            'marketing_publisher_autopilot',
            'marketing_publisher_interval_minutes',
            'marketing_publisher_last_run_at',
            'marketing_publisher_last_started_at',
        ])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const enabled = config.marketing_publisher_agent_enabled !== 'false'
    const autopilot = config.marketing_publisher_autopilot === 'true'
    const intervalMinutes = parseMarketingPublisherIntervalMinutes(config.marketing_publisher_interval_minutes)
    const lastRunMs = parseConfigDate(config.marketing_publisher_last_run_at)
    const lastStartedMs = parseConfigDate(config.marketing_publisher_last_started_at)
    const lastActivityMs = Math.max(lastRunMs || 0, lastStartedMs || 0)
    const nowMs = Date.now()
    const elapsedMinutes = lastActivityMs ? Math.floor((nowMs - lastActivityMs) / 60000) : null

    return {
        enabled,
        autopilot,
        shouldRun: enabled && (!lastActivityMs || nowMs - lastActivityMs >= intervalMinutes * 60000),
        intervalMinutes,
        elapsedMinutes,
        lastRunAt: config.marketing_publisher_last_run_at || null,
        lastStartedAt: config.marketing_publisher_last_started_at || null,
    }
}

async function getEcosystemIntelligenceSchedule(supabase: ReturnType<typeof getSupabase>) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'ecosystem_intelligence_enabled',
            'ecosystem_intelligence_interval_hours',
            'ecosystem_intelligence_snapshot_days',
            'ecosystem_intelligence_last_run_at',
            'ecosystem_intelligence_last_started_at',
        ])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const enabled = config.ecosystem_intelligence_enabled !== 'false'
    const intervalHours = parseEcosystemIntelligenceIntervalHours(config.ecosystem_intelligence_interval_hours)
    const days = Math.max(7, Math.min(180, Number.parseInt(config.ecosystem_intelligence_snapshot_days || '30', 10) || 30))
    const lastRunMs = parseConfigDate(config.ecosystem_intelligence_last_run_at)
    const lastStartedMs = parseConfigDate(config.ecosystem_intelligence_last_started_at)
    const lastActivityMs = Math.max(lastRunMs || 0, lastStartedMs || 0)
    const nowMs = Date.now()
    const elapsedHours = lastActivityMs ? Math.floor((nowMs - lastActivityMs) / 3600000) : null

    return {
        enabled,
        shouldRun: enabled && (!lastActivityMs || nowMs - lastActivityMs >= intervalHours * 3600000),
        intervalHours,
        elapsedHours,
        days,
        lastRunAt: config.ecosystem_intelligence_last_run_at || null,
        lastStartedAt: config.ecosystem_intelligence_last_started_at || null,
    }
}

async function getBlogAgentSchedule(supabase: ReturnType<typeof getSupabase>) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            'blog_agent_enabled',
            'blog_agent_schedule_day',
            'blog_agent_schedule_time',
            'blog_agent_schedule_day_1',
            'blog_agent_schedule_time_1',
            'blog_agent_schedule_day_2',
            'blog_agent_schedule_time_2',
            'blog_agent_schedule_day_3',
            'blog_agent_schedule_time_3',
            'blog_agent_schedule_day_4',
            'blog_agent_schedule_time_4',
            'blog_agent_schedule_day_5',
            'blog_agent_schedule_time_5',
            'blog_agent_schedule_day_6',
            'blog_agent_schedule_time_6',
            'blog_agent_schedule_day_7',
            'blog_agent_schedule_time_7',
            'blog_agent_last_run_at',
            'blog_agent_last_started_at',
        ])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const enabled = config.blog_agent_enabled !== 'false'
    const slots = getBlogAgentWeeklySlots(config)
    const lastRunMs = parseConfigDate(config.blog_agent_last_run_at)
    const lastStartedMs = parseConfigDate(config.blog_agent_last_started_at)
    const now = getBlogAgentLocalParts()
    const lastRun = lastRunMs ? getBlogAgentLocalParts(new Date(lastRunMs)) : null
    const lastStarted = lastStartedMs ? getBlogAgentLocalParts(new Date(lastStartedMs)) : null
    const todaySlots = slots.filter(slot => slot.day === now.weekday).sort((a, b) => a.minuteOfDay - b.minuteOfDay)
    const reachedSlots = todaySlots.filter(slot => now.minuteOfDay >= slot.minuteOfDay)
    const dueSlots = reachedSlots.filter(slot => !(
        lastRun?.dateStamp === now.dateStamp && lastRun.minuteOfDay >= slot.minuteOfDay
    ))
    const nextSlot = dueSlots.sort((a, b) => b.minuteOfDay - a.minuteOfDay)[0] || null
    const startedReachedSlot = Boolean(lastStartedMs && lastStarted?.dateStamp === now.dateStamp && reachedSlots.some(slot => lastStarted.minuteOfDay >= slot.minuteOfDay))
    const completedAfterStart = Boolean(lastRunMs && lastStartedMs && lastRunMs >= lastStartedMs)
    const startedAgeMinutes = lastStartedMs ? Math.floor((Date.now() - lastStartedMs) / 60000) : null
    const runInProgress = startedReachedSlot && !completedAfterStart && startedAgeMinutes != null && startedAgeMinutes < BLOG_AGENT_RUN_IN_PROGRESS_GRACE_MINUTES

    let reason = 'ready'
    if (!enabled) reason = 'blog_agent_disabled'
    else if (slots.length === 0) reason = 'no_schedule_days'
    else if (todaySlots.length === 0) reason = 'weekday_not_due'
    else if (reachedSlots.length === 0) reason = 'time_not_reached'
    else if (runInProgress) reason = 'run_in_progress'
    else if (!nextSlot) reason = 'already_ran_slot'

    const shouldRun = enabled && reason === 'ready' && Boolean(nextSlot)

    return {
        enabled,
        shouldRun,
        reason,
        scheduleDay: nextSlot?.day || todaySlots[0]?.day || '',
        scheduleDate: '',
        scheduleTime: nextSlot?.time || todaySlots[0]?.time || '',
        scheduleSlot: nextSlot?.id || '',
        slots,
        today: now.dateStamp,
        lastActivityDate: lastRun?.dateStamp || lastStarted?.dateStamp || null,
        lastActivityMinute: lastRun?.minuteOfDay ?? lastStarted?.minuteOfDay ?? null,
        lastRunDate: lastRun?.dateStamp || null,
        lastRunMinute: lastRun?.minuteOfDay ?? null,
        lastStartedDate: lastStarted?.dateStamp || null,
        lastStartedMinute: lastStarted?.minuteOfDay ?? null,
        startedAgeMinutes,
        lastRunAt: config.blog_agent_last_run_at || null,
        lastStartedAt: config.blog_agent_last_started_at || null,
    }
}

async function saveAppConfig(supabase: ReturnType<typeof getSupabase>, key: string, value: string) {
    const { error } = await supabase
        .from('app_config')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) throw new Error(`Erro ao salvar ${key}: ${error.message}`)
}

async function markAdsSyncStarted(supabase: ReturnType<typeof getSupabase>) {
    await saveAppConfig(supabase, 'ads_sync_last_started_at', new Date().toISOString())
}

async function markAdsSyncCompleted(supabase: ReturnType<typeof getSupabase>) {
    const now = new Date().toISOString()
    await Promise.all([
        saveAppConfig(supabase, 'ads_sync_last_run_at', now),
        saveAppConfig(supabase, 'ads_sync_last_started_at', now),
        saveAppConfig(supabase, 'ads_sync_last_error', ''),
    ])
}

async function markAdsSyncFailed(supabase: ReturnType<typeof getSupabase>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    await Promise.all([
        saveAppConfig(supabase, 'ads_sync_last_error_at', new Date().toISOString()),
        saveAppConfig(supabase, 'ads_sync_last_error', message.slice(0, 500)),
    ])
}

async function markOrganicSyncStarted(supabase: ReturnType<typeof getSupabase>) {
    await saveAppConfig(supabase, 'organic_social_sync_last_started_at', new Date().toISOString())
}

async function markOrganicSyncCompleted(supabase: ReturnType<typeof getSupabase>) {
    const now = new Date().toISOString()
    await Promise.all([
        saveAppConfig(supabase, 'organic_social_sync_last_run_at', now),
        saveAppConfig(supabase, 'organic_social_sync_last_started_at', now),
        saveAppConfig(supabase, 'organic_social_sync_last_error', ''),
    ])
}

async function markOrganicSyncFailed(supabase: ReturnType<typeof getSupabase>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    await Promise.all([
        saveAppConfig(supabase, 'organic_social_sync_last_error_at', new Date().toISOString()),
        saveAppConfig(supabase, 'organic_social_sync_last_error', message.slice(0, 500)),
    ])
}

async function markOrganicReportStarted(supabase: ReturnType<typeof getSupabase>) {
    await saveAppConfig(supabase, 'organic_report_agent_last_started_at', new Date().toISOString())
}

async function markOrganicReportCompleted(supabase: ReturnType<typeof getSupabase>) {
    const now = new Date().toISOString()
    await Promise.all([
        saveAppConfig(supabase, 'organic_report_agent_last_run_at', now),
        saveAppConfig(supabase, 'organic_report_agent_last_started_at', now),
        saveAppConfig(supabase, 'organic_report_agent_last_error', ''),
    ])
}

async function markOrganicReportFailed(supabase: ReturnType<typeof getSupabase>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    await Promise.all([
        saveAppConfig(supabase, 'organic_report_agent_last_error', message),
        saveAppConfig(supabase, 'organic_report_agent_last_error_at', new Date().toISOString()),
    ])
}

async function markPaidReportStarted(supabase: ReturnType<typeof getSupabase>) {
    await saveAppConfig(supabase, 'paid_report_agent_last_started_at', new Date().toISOString())
}

async function markPaidReportCompleted(supabase: ReturnType<typeof getSupabase>) {
    const now = new Date().toISOString()
    await Promise.all([
        saveAppConfig(supabase, 'paid_report_agent_last_run_at', now),
        saveAppConfig(supabase, 'paid_report_agent_last_started_at', now),
        saveAppConfig(supabase, 'paid_report_agent_last_error', ''),
    ])
}

async function markPaidReportFailed(supabase: ReturnType<typeof getSupabase>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    await Promise.all([
        saveAppConfig(supabase, 'paid_report_agent_last_error', message.slice(0, 500)),
        saveAppConfig(supabase, 'paid_report_agent_last_error_at', new Date().toISOString()),
    ])
}

async function markMarketingPublisherStarted(supabase: ReturnType<typeof getSupabase>) {
    await saveAppConfig(supabase, 'marketing_publisher_last_started_at', new Date().toISOString())
}

async function markMarketingPublisherCompleted(supabase: ReturnType<typeof getSupabase>) {
    const now = new Date().toISOString()
    await Promise.all([
        saveAppConfig(supabase, 'marketing_publisher_last_run_at', now),
        saveAppConfig(supabase, 'marketing_publisher_last_started_at', now),
        saveAppConfig(supabase, 'marketing_publisher_last_error', ''),
    ])
}

async function markMarketingPublisherFailed(supabase: ReturnType<typeof getSupabase>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    await Promise.all([
        saveAppConfig(supabase, 'marketing_publisher_last_error', message.slice(0, 500)),
        saveAppConfig(supabase, 'marketing_publisher_last_error_at', new Date().toISOString()),
    ])
}

async function markEcosystemIntelligenceStarted(supabase: ReturnType<typeof getSupabase>) {
    await saveAppConfig(supabase, 'ecosystem_intelligence_last_started_at', new Date().toISOString())
}

async function markEcosystemIntelligenceCompleted(supabase: ReturnType<typeof getSupabase>) {
    const now = new Date().toISOString()
    await Promise.all([
        saveAppConfig(supabase, 'ecosystem_intelligence_last_run_at', now),
        saveAppConfig(supabase, 'ecosystem_intelligence_last_started_at', now),
        saveAppConfig(supabase, 'ecosystem_intelligence_last_error', ''),
    ])
}

async function markEcosystemIntelligenceFailed(supabase: ReturnType<typeof getSupabase>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    await Promise.all([
        saveAppConfig(supabase, 'ecosystem_intelligence_last_error', message.slice(0, 500)),
        saveAppConfig(supabase, 'ecosystem_intelligence_last_error_at', new Date().toISOString()),
    ])
}

async function markBlogAgentStarted(supabase: ReturnType<typeof getSupabase>) {
    await saveAppConfig(supabase, 'blog_agent_last_started_at', new Date().toISOString())
}

async function markBlogAgentCompleted(supabase: ReturnType<typeof getSupabase>) {
    const now = new Date().toISOString()
    await Promise.all([
        saveAppConfig(supabase, 'blog_agent_last_run_at', now),
        saveAppConfig(supabase, 'blog_agent_last_started_at', now),
        saveAppConfig(supabase, 'blog_agent_last_error', ''),
    ])
}

async function markBlogAgentFailed(supabase: ReturnType<typeof getSupabase>, error: unknown) {
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    await Promise.all([
        saveAppConfig(supabase, 'blog_agent_last_error', message.slice(0, 500)),
        saveAppConfig(supabase, 'blog_agent_last_error_at', new Date().toISOString()),
    ])
}

// =============================================
// 1. Publicar Campanha nas Plataformas
// =============================================

export const publishCampaign = inngest.createFunction(
    { id: 'ads-publish-campaign', name: 'Publicar Campanha nos Ads' },
    { event: 'ads/campaign-created' },
    async ({ event, step }) => {
        const { campaign_id } = event.data
        const supabase = getSupabase()

        // Buscar campanha do banco
        const { data: campaign } = await step.run('fetch-campaign', async () => {
            const { data, error } = await supabase
                .from('ad_campaigns')
                .select('*, ad_creatives(*)')
                .eq('id', campaign_id)
                .single()
            if (error) throw new Error(`Campanha não encontrada: ${error.message}`)
            return { data }
        })

        if (!campaign.data) throw new Error('Campanha não encontrada')
        const camp = campaign.data as AdCampaign & { ad_creatives: { file_url: string; type: string; headline?: string }[] }

        // Atualizar status para "pending"
        await step.run('update-status-pending', async () => {
            await supabase.from('ad_campaigns').update({ status: 'pending' }).eq('id', campaign_id)
        })

        try {
            if (camp.platform === 'meta') {
                // --- Meta Ads ---
                // metaAds module internally fetches the token from Supabase now 
                const externalCampaignId = await step.run('meta-create-campaign', async () => {
                    return metaAds.createCampaign({
                        name: camp.name,
                        objective: 'OUTCOME_LEADS',
                        daily_budget: Math.round((camp.total_budget / camp.duration_days) * 100), // centavos
                        status: 'PAUSED'
                    })
                })

                // Atualizar ID externo
                await step.run('save-external-ids', async () => {
                    await supabase.from('ad_campaigns').update({
                        external_campaign_id: externalCampaignId,
                        status: 'active',
                        start_date: new Date().toISOString().split('T')[0],
                        end_date: new Date(Date.now() + camp.duration_days * 86400000).toISOString().split('T')[0]
                    }).eq('id', campaign_id)
                })

            } else if (camp.platform === 'google') {
                // --- Google Ads ---
                const resourceName = await step.run('google-create-campaign', async () => {
                    return googleAds.createCampaign({
                        name: camp.name,
                        budget_amount_micros: Math.round((camp.total_budget / camp.duration_days) * 1_000_000),
                        campaign_type: 'DISPLAY',
                        status: 'PAUSED'
                    })
                })

                await step.run('save-external-ids', async () => {
                    await supabase.from('ad_campaigns').update({
                        external_campaign_id: resourceName,
                        status: 'active',
                        start_date: new Date().toISOString().split('T')[0],
                        end_date: new Date(Date.now() + camp.duration_days * 86400000).toISOString().split('T')[0]
                    }).eq('id', campaign_id)
                })
            }

            // Notificar admins via WhatsApp
            await step.run('notify-admins', async () => {
                await sendAlertToAdmins({
                    type: 'insight',
                    urgency: 'medium',
                    message: `Nova campanha "${camp.name}" publicada com sucesso! Orçamento: R$ ${camp.total_budget.toFixed(2)} por ${camp.duration_days} dias.`,
                    campaign_name: camp.name,
                    platform: camp.platform
                })
            })

        } catch (err) {
            await supabase.from('ad_campaigns').update({ status: 'error' }).eq('id', campaign_id)
            throw err
        }
    }
)

// =============================================
// 2. Polling de Métricas (Cron Job — a cada 1h)
// =============================================

export const pollMetricsCron = inngest.createFunction(
    { id: 'ads-poll-metrics', name: 'Buscar Métricas de Campanhas' },
    { cron: '* * * * *' }, // Checa a cada minuto; o intervalo real fica em app_config.ads_sync_interval_minutes
    async ({ step }) => {
        const supabase = getSupabase()

        const schedule = await step.run('check-ads-sync-schedule', async () => {
            return getAdsSyncSchedule(supabase)
        })

        if (!schedule.shouldRun) {
            return {
                skipped: true,
                reason: 'interval_not_reached',
                sync_interval_minutes: schedule.intervalMinutes,
                elapsed_minutes: schedule.elapsedMinutes,
                last_run_at: schedule.lastRunAt,
                last_started_at: schedule.lastStartedAt,
            }
        }

        await step.run('mark-ads-sync-started', async () => {
            await markAdsSyncStarted(supabase)
        })

        // Buscar campanhas ativas
        const campaigns = await step.run('fetch-active-campaigns', async () => {
            const { data, error } = await supabase
                .from('ad_campaigns')
                .select('*')
                .eq('status', 'active')
                .not('external_campaign_id', 'is', null)

            if (error) throw new Error(`Erro ao buscar campanhas: ${error.message}`)
            return data as AdCampaign[]
        })

        if (!campaigns || campaigns.length === 0) {
            await step.run('mark-ads-sync-completed-no-campaigns', async () => {
                await markAdsSyncCompleted(supabase)
            })

            return {
                message: 'Nenhuma campanha ativa para monitorar',
                sync_interval_minutes: schedule.intervalMinutes,
            }
        }

        const results = []
        const pollErrors: { campaign_id: string; campaign_name: string; error: string }[] = []

        for (const campaign of campaigns) {
            let metricsResult = null
            try {
                metricsResult = await step.run(`poll-${campaign.id}`, async () => {
                let snapshotData

                if (campaign.platform === 'meta' && campaign.external_campaign_id) {
                    // metaAds module internally fetches the token from Supabase now 
                    // Tenta buscar 'today' primeiro, mas se vier zerado (latência da API), tenta 'yesterday'
                    let metaInsights = await metaAds.getInsights(campaign.external_campaign_id, 'today');
                    if (!metaInsights || (parseInt(metaInsights.impressions || '0') === 0 && parseFloat(metaInsights.spend || '0') === 0)) {
                        metaInsights = await metaAds.getInsights(campaign.external_campaign_id, 'yesterday');
                    }

                    if (metaInsights) {
                        snapshotData = metaAds.parseInsightsToSnapshot(campaign.id, metaInsights);
                    }
                } else if (campaign.platform === 'google' && campaign.external_campaign_id) {
                    let gMetrics = await googleAds.getMetrics(campaign.external_campaign_id, 'TODAY');
                    if (!gMetrics || (gMetrics.impressions === 0 && gMetrics.spend === 0)) {
                        gMetrics = await googleAds.getMetrics(campaign.external_campaign_id, 'YESTERDAY');
                    }
                    if (gMetrics) {
                        snapshotData = { campaign_id: campaign.id, ...gMetrics }
                    }
                }

                if (snapshotData) {
                    const { error } = await supabase
                        .from('ad_metrics_snapshots')
                        .insert(snapshotData)

                    if (error) throw new Error(`Erro ao salvar snapshot: ${error.message}`)
                }

                return snapshotData || null
                })
            } catch (err: any) {
                pollErrors.push({
                    campaign_id: campaign.id,
                    campaign_name: campaign.name,
                    error: err?.message || 'Erro ao buscar metricas da campanha',
                })
                continue
            }

            if (metricsResult) {
                results.push({ campaign_id: campaign.id, metrics: metricsResult })
            }
        }

        if (campaigns.length > 0 && results.length === 0) {
            const firstError = pollErrors[0]
            const message = firstError
                ? `Nenhuma campanha de trafego pago gerou snapshot. Primeiro erro: ${firstError.campaign_name} - ${firstError.error}`
                : 'Nenhuma campanha de trafego pago gerou snapshot.'

            await step.run('mark-ads-sync-failed-empty-results', async () => {
                await markAdsSyncFailed(supabase, new Error(message))
            })

            throw new Error(message)
        }

        // Disparar análise da IA apenas às 23 horas (Horário de Brasília)
        const { hour } = getCurrentTimeSP()
        const shouldTriggerAIAnalysis = await step.run('check-daily-ads-ai-analysis', async () => {
            if (hour !== '23') return false

            const today = getCurrentDateSP()
            const { data } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'ads_ai_analysis_last_date')
                .maybeSingle()

            return String(data?.value || '') !== today
        })

        if (shouldTriggerAIAnalysis) {
            for (const result of results) {
                await step.sendEvent('trigger-ai-analysis', {
                    name: 'ads/ai-analyze',
                    data: {
                        campaign_id: result.campaign_id,
                        metrics: result.metrics
                    }
                })
            }

            await step.run('mark-daily-ads-ai-analysis', async () => {
                await saveAppConfig(supabase, 'ads_ai_analysis_last_date', getCurrentDateSP())
            })
        }

        let financeSync
        try {
            financeSync = await step.run('sync-paid-ads-spend-to-finance', async () => {
                return syncPaidAdsSpendToFinance(supabase)
            })
        } catch (error) {
            await step.run('mark-ads-sync-failed-finance', async () => {
                await markAdsSyncFailed(supabase, error)
            })
            throw error
        }

        await step.run('mark-ads-sync-completed', async () => {
            await markAdsSyncCompleted(supabase)
        })

        return {
            campaigns_polled: results.length,
            campaign_poll_errors: pollErrors,
            analysis_triggered: shouldTriggerAIAnalysis,
            finance_sync: financeSync,
            sync_interval_minutes: schedule.intervalMinutes,
        }
    }
)

// =============================================
// 3. Análise da IA
// =============================================

export const aiAnalyzeMetrics = inngest.createFunction(
    { id: 'ads-ai-analyze', name: 'Análise IA de Métricas' },
    { event: 'ads/ai-analyze' },
    async ({ event, step }) => {
        const { campaign_id, metrics } = event.data
        const supabase = getSupabase()

        // Buscar campanha
        const campaign = await step.run('fetch-campaign', async () => {
            const { data, error } = await supabase
                .from('ad_campaigns')
                .select('*')
                .eq('id', campaign_id)
                .single()
            if (error) throw new Error(error.message)
            return data as AdCampaign
        })

        // Análise da IA é feita para todas as campanhas, independente do ai_auto_manage

        // Chamar o cérebro da IA
        const analysis = await step.run('ai-analyze', async () => {
            return analyzeCampaignMetrics({
                name: campaign.name,
                platform: campaign.platform,
                total_budget: Number(campaign.total_budget),
                duration_days: campaign.duration_days,
                start_date: campaign.start_date || new Date().toISOString(),
                daily_budget: campaign.daily_budget ? Number(campaign.daily_budget) : undefined
            }, metrics as unknown as MetricsSnapshot)
        })

        // Salvar alerta no banco
        await step.run('save-alert', async () => {
            await supabase.from('ai_campaign_alerts').insert({
                campaign_id,
                type: analysis.action === 'NONE' ? 'insight' : 'action',
                urgency: analysis.urgency,
                action_taken: analysis.action,
                message: analysis.alert_message,
                ai_reasoning: analysis.reasoning
            })
        })

        // Se houver ação e auto_manage estiver ativado, delegar execução
        if (analysis.action !== 'NONE' && campaign.ai_auto_manage) {
            await step.sendEvent('execute-action', {
                name: 'ads/execute-action',
                data: {
                    campaign_id,
                    action: analysis.action,
                    alert_message: analysis.alert_message,
                    urgency: analysis.urgency,
                    budget_adjustment: analysis.budget_adjustment,
                    campaign_name: campaign.name,
                    platform: campaign.platform,
                    external_campaign_id: campaign.external_campaign_id,
                    external_adset_id: campaign.external_adset_id
                }
            })
        }

        return { action: analysis.action, urgency: analysis.urgency }
    }
)

// =============================================
// 4. Executar Ação da IA
// =============================================

export const executeAiAction = inngest.createFunction(
    { id: 'ads-execute-action', name: 'Executar Ação IA' },
    { event: 'ads/execute-action' },
    async ({ event, step }) => {
        const {
            campaign_id, action, alert_message, urgency,
            budget_adjustment, campaign_name, platform,
            external_campaign_id, external_adset_id
        } = event.data

        const supabase = getSupabase()

        // Executar ação na plataforma
        await step.run('execute-platform-action', async () => {
            if (!external_campaign_id) {
                console.warn('Sem ID externo — ação não executada na plataforma')
                return
            }

            if (action === 'PAUSE_AD') {
                if (platform === 'meta') {
                    await metaAds.updateCampaignStatus(external_campaign_id, 'PAUSED')
                } else {
                    await googleAds.updateCampaignStatus(external_campaign_id, 'PAUSED')
                }

                await supabase.from('ad_campaigns').update({ status: 'paused' }).eq('id', campaign_id)
            }

            if ((action === 'SCALE_BUDGET' || action === 'REDUCE_BUDGET') && budget_adjustment) {
                if (platform === 'meta' && external_adset_id) {
                    await metaAds.updateDailyBudget(
                        external_adset_id,
                        Math.round(budget_adjustment.new_daily_budget * 100)
                    )
                }
                // Google Ads budget update requer o resource name do budget
            }
        })

        // Registrar no log
        await step.run('log-action', async () => {
            await supabase.from('ai_action_log').insert({
                campaign_id,
                action,
                reason: alert_message,
                new_value: budget_adjustment ? `R$ ${budget_adjustment.new_daily_budget}` : undefined
            })
        })

        // Enviar alerta WhatsApp para admins
        await step.run('whatsapp-alert', async () => {
            await sendAlertToAdmins({
                type: 'action',
                urgency: urgency as AlertUrgency,
                message: alert_message,
                action_taken: action,
                campaign_name,
                platform
            })

            // Marcar como enviado
            await supabase
                .from('ai_campaign_alerts')
                .update({ whatsapp_sent: true })
                .eq('campaign_id', campaign_id)
                .eq('whatsapp_sent', false)
                .order('created_at', { ascending: false })
                .limit(1)
        })

        return { executed: action }
    }
)

// =============================================
// 5. Relatório Diário (Cron Job — 20h)
// =============================================

export const dailyReportCron = inngest.createFunction(
    { id: 'ads-daily-report', name: 'Relatório Diário de Tráfego' },
    { cron: '0 20 * * *' }, // Todo dia às 20h
    async ({ step }) => {
        const supabase = getSupabase()

        // Buscar métricas do dia
        const todayMetrics = await step.run('fetch-today-metrics', async () => {
            const today = new Date().toISOString().split('T')[0]
            const { data } = await supabase
                .from('ad_metrics_snapshots')
                .select('*, ad_campaigns!inner(name, platform, status)')
                .gte('snapshot_at', `${today}T00:00:00`)

            return data || []
        })

        if (todayMetrics.length === 0) {
            return { message: 'Sem métricas hoje' }
        }

        // Agregar dados
        const totalSpend = todayMetrics.reduce((s, m) => s + Number(m.spend || 0), 0)
        const totalLeads = todayMetrics.reduce((s, m) => s + (m.leads_count || 0), 0)
        const avgCpa = totalLeads > 0 ? totalSpend / totalLeads : 0

        // Encontrar melhor e pior (por CPA)
        const withLeads = todayMetrics.filter(m => m.leads_count > 0)
        const sorted = withLeads.sort((a, b) => {
            const cpaA = Number(a.spend) / a.leads_count
            const cpaB = Number(b.spend) / b.leads_count
            return cpaA - cpaB
        })

        const best = sorted[0]
        const worst = sorted[sorted.length - 1]

        // Enviar relatório
        await step.run('send-daily-report', async () => {
            await sendDailyReport({
                total_spend: totalSpend,
                total_leads: totalLeads,
                avg_cpa: avgCpa,
                best_campaign: (best as unknown as { ad_campaigns: { name: string } })?.ad_campaigns?.name || 'N/A',
                worst_campaign: (worst as unknown as { ad_campaigns: { name: string } })?.ad_campaigns?.name || 'N/A',
                campaigns_active: todayMetrics.filter(m => (m as unknown as { ad_campaigns: { status: string } }).ad_campaigns?.status === 'active').length,
                campaigns_paused: todayMetrics.filter(m => (m as unknown as { ad_campaigns: { status: string } }).ad_campaigns?.status === 'paused').length
            })
        })

        return { total_spend: totalSpend, total_leads: totalLeads }
    }
)

// =============================================
// 6. Sincronizar Leads Nativos do Meta (Forms)
// =============================================

export const syncMetaLeadsCron = inngest.createFunction(
    { id: 'ads-sync-meta-leads', name: 'Sincronizar Leads Nativos (Meta Forms)' },
    { cron: '0 * * * *' }, // A cada hora
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Buscar formulários ativos
        const forms = await step.run('fetch-meta-forms', async () => {
            return await metaAds.getLeadForms()
        })

        if (!forms || forms.length === 0) return { message: 'Nenhum formulário encontrado' }

        const summary = { forked_leads: 0, new_leads: 0 }

        for (const form of forms) {
            const leads = await step.run(`fetch-leads-from-form-${form.id}`, async () => {
                return await metaAds.getLeadsFromForm(form.id)
            })

            for (const metaLead of leads) {
                const leadId = metaLead.id
                
                // Extrair dados dos campos
                const fieldMap: Record<string, string> = {}
                metaLead.field_data?.forEach((f: any) => {
                    if (f.name && f.values?.[0]) {
                        fieldMap[f.name] = f.values[0]
                    }
                })

                const name = fieldMap.full_name || fieldMap.first_name || fieldMap.last_name || null
                const email = fieldMap.email || null
                const phone = (fieldMap.phone_number || '').replace(/\D/g, '')

                // 2. Verificar duplicidade por meta_lead_id no metadata
                const alreadyExists = await step.run(`check-lead-${leadId}`, async () => {
                    const { data } = await supabase
                        .from('leads')
                        .select('id')
                        .contains('metadata', { meta_lead_id: leadId })
                        .maybeSingle()
                    return !!data
                })

                if (!alreadyExists) {
                    await step.run(`insert-lead-${leadId}`, async () => {
                        // Buscar ou criar visitante fictício para o lead nativo se necessário,
                        // mas idealmente marcamos o source como 'Facebook Ads'
                        const { error } = await supabase.from('leads').insert({
                            name,
                            email,
                            phone,
                            acquired_via: 'Meta Lead Form',
                            funnel_stage: 'lead',
                            metadata: {
                                meta_lead_id: leadId,
                                meta_form_id: form.id,
                                meta_campaign_id: metaLead.campaign_id,
                                meta_ad_id: metaLead.ad_id,
                                platform: 'meta'
                            }
                        })
                        if (error) console.error(`Erro ao inserir lead nativo: ${error.message}`)
                    })
                    summary.new_leads++
                }
            }
        }

        return summary
    }
)

// =============================================
// 7. Relatórios de Gestão (Olho de Deus)
// =============================================

export const syncInstagramOrganicCron = inngest.createFunction(
    { id: 'organic-social-sync', name: 'Sincronizar Trafego Organico' },
    { cron: '0 * * * *' }, // Checa a cada hora; intervalo real fica em app_config.
    async ({ step }) => {
        const supabase = getSupabase()

        const schedule = await step.run('check-organic-social-sync-schedule', async () => {
            return getOrganicSyncSchedule(supabase)
        })

        if (!schedule.enabled) {
            return { skipped: true, reason: 'organic_sync_disabled' }
        }

        if (!schedule.shouldRun) {
            return {
                skipped: true,
                reason: 'interval_not_reached',
                sync_interval_minutes: schedule.intervalMinutes,
                elapsed_minutes: schedule.elapsedMinutes,
                last_run_at: schedule.lastRunAt,
                last_started_at: schedule.lastStartedAt,
            }
        }

        await step.run('mark-organic-social-sync-started', async () => {
            await markOrganicSyncStarted(supabase)
        })

        try {
            const instagram = await step.run('sync-instagram-organic', async () => {
                return syncInstagramOrganic(schedule.limit)
            })

            const facebook = await step.run('sync-facebook-organic', async () => {
                return syncFacebookOrganic(schedule.limit)
            })

            await step.run('mark-organic-social-sync-completed', async () => {
                await markOrganicSyncCompleted(supabase)
            })

            return {
                instagram: {
                    profile: instagram.profile?.username,
                    followers: instagram.totals.followers,
                    media_synced: instagram.media.length,
                    reels_synced: instagram.reels.length,
                },
                facebook: {
                    profile: facebook.profile?.display_name,
                    followers: facebook.totals.followers,
                    media_synced: facebook.media.length,
                    warning: facebook.warning || null,
                },
                sync_interval_minutes: schedule.intervalMinutes,
            }
        } catch (error) {
            await step.run('mark-organic-social-sync-failed', async () => {
                await markOrganicSyncFailed(supabase, error)
            })
            throw error
        }
    }
)

export const organicReportAgentCron = inngest.createFunction(
    { id: 'organic-report-agent', name: 'Gerar Relatorio Organico IA' },
    { cron: '15 * * * *' }, // Checa a cada hora; intervalo real fica em app_config.
    async ({ step }) => {
        const supabase = getSupabase()

        const schedule = await step.run('check-organic-report-schedule', async () => {
            return getOrganicReportSchedule(supabase)
        })

        if (!schedule.enabled) {
            return { skipped: true, reason: 'organic_report_agent_disabled' }
        }

        if (!schedule.shouldRun) {
            return {
                skipped: true,
                reason: 'interval_not_reached',
                interval_hours: schedule.intervalHours,
                elapsed_hours: schedule.elapsedHours,
                last_run_at: schedule.lastRunAt,
                last_started_at: schedule.lastStartedAt,
            }
        }

        await step.run('mark-organic-report-started', async () => {
            await markOrganicReportStarted(supabase)
        })

        try {
            const result = await step.run('generate-organic-report', async () => {
                return generateOrganicMarketingReport({ days: 30 })
            })

            await step.run('mark-organic-report-completed', async () => {
                await markOrganicReportCompleted(supabase)
            })

            return {
                report_id: result.report?.id,
                title: result.report?.title,
                interval_hours: schedule.intervalHours,
            }
        } catch (error) {
            await step.run('mark-organic-report-failed', async () => {
                await markOrganicReportFailed(supabase, error)
            })
            throw error
        }
    }
)

export const paidReportAgentCron = inngest.createFunction(
    { id: 'paid-report-agent', name: 'Gerar Relatorio Pago IA' },
    { cron: '30 * * * *' }, // Checa a cada hora; intervalo real fica em app_config.
    async ({ step }) => {
        const supabase = getSupabase()

        const schedule = await step.run('check-paid-report-schedule', async () => {
            return getPaidReportSchedule(supabase)
        })

        if (!schedule.enabled) {
            return { skipped: true, reason: 'paid_report_agent_disabled' }
        }

        if (!schedule.shouldRun) {
            return {
                skipped: true,
                reason: 'interval_not_reached',
                interval_hours: schedule.intervalHours,
                elapsed_hours: schedule.elapsedHours,
                last_run_at: schedule.lastRunAt,
                last_started_at: schedule.lastStartedAt,
            }
        }

        await step.run('mark-paid-report-started', async () => {
            await markPaidReportStarted(supabase)
        })

        try {
            const result = await step.run('generate-paid-report', async () => {
                return generatePaidMarketingReport({ days: 30 })
            })

            await step.run('mark-paid-report-completed', async () => {
                await markPaidReportCompleted(supabase)
            })

            return {
                report_id: result.report?.id,
                title: result.report?.title,
                interval_hours: schedule.intervalHours,
            }
        } catch (error) {
            await step.run('mark-paid-report-failed', async () => {
                await markPaidReportFailed(supabase, error)
            })
            throw error
        }
    }
)

export const marketingPublisherCron = inngest.createFunction(
    { id: 'marketing-publisher-agent', name: 'Publicador de Conteudo IA' },
    { cron: '*/5 * * * *' }, // Checa a cada 5 minutos; intervalo real fica em app_config.
    async ({ step }) => {
        const supabase = getSupabase()

        const schedule = await step.run('check-marketing-publisher-schedule', async () => {
            return getMarketingPublisherSchedule(supabase)
        })

        if (!schedule.enabled) {
            return { skipped: true, reason: 'marketing_publisher_disabled' }
        }

        if (!schedule.shouldRun) {
            return {
                skipped: true,
                reason: 'interval_not_reached',
                interval_minutes: schedule.intervalMinutes,
                elapsed_minutes: schedule.elapsedMinutes,
                last_run_at: schedule.lastRunAt,
                last_started_at: schedule.lastStartedAt,
            }
        }

        await step.run('mark-marketing-publisher-started', async () => {
            await markMarketingPublisherStarted(supabase)
        })

        try {
            const result = await step.run('publish-due-marketing-posts', async () => {
                return publishDueScheduledPosts({ limit: 10, dryRun: !schedule.autopilot })
            })

            await step.run('mark-marketing-publisher-completed', async () => {
                await markMarketingPublisherCompleted(supabase)
            })

            return {
                ...result,
                autopilot: schedule.autopilot,
                interval_minutes: schedule.intervalMinutes,
            }
        } catch (error) {
            await step.run('mark-marketing-publisher-failed', async () => {
                await markMarketingPublisherFailed(supabase, error)
            })
            throw error
        }
    }
)

export const blogAgentCron = inngest.createFunction(
    { id: 'blog-agent-draft', name: 'Gerar Rascunho do Blog IA' },
    { cron: '*/5 * * * *' },
    async ({ step }) => {
        const supabase = getSupabase()

        const schedule = await step.run('check-blog-agent-schedule', async () => {
            return getBlogAgentSchedule(supabase)
        })

        if (!schedule.enabled) {
            return { skipped: true, reason: 'blog_agent_disabled' }
        }

        if (!schedule.shouldRun) {
            return {
                skipped: true,
                reason: schedule.reason,
                schedule_slot: schedule.scheduleSlot,
                schedule_day: schedule.scheduleDay,
                schedule_date: schedule.scheduleDate,
                schedule_time: schedule.scheduleTime,
                schedule_slots: schedule.slots,
                today: schedule.today,
                last_activity_date: schedule.lastActivityDate,
                last_activity_minute: schedule.lastActivityMinute,
                last_run_at: schedule.lastRunAt,
                last_started_at: schedule.lastStartedAt,
            }
        }

        await step.run('mark-blog-agent-started', async () => {
            await markBlogAgentStarted(supabase)
        })

        try {
            const result = await step.run('run-blog-agent-draft', async () => {
                return runBlogAgentDraft({ source: 'inngest-blog-agent' })
            })

            await step.run('mark-blog-agent-completed', async () => {
                await markBlogAgentCompleted(supabase)
            })

            return {
                ...result,
                schedule_slot: schedule.scheduleSlot,
                schedule_day: schedule.scheduleDay,
                schedule_date: schedule.scheduleDate,
                schedule_time: schedule.scheduleTime,
            }
        } catch (error) {
            await step.run('mark-blog-agent-failed', async () => {
                await markBlogAgentFailed(supabase, error)
            })
            throw error
        }
    }
)

export const newsAgentCron = inngest.createFunction(
    { id: 'news-agent-draft', name: 'Gerar Rascunho de Noticias IA' },
    { cron: '*/5 * * * *' },
    async ({ step }) => {
        const supabase = getSupabase()

        const schedule = await step.run('check-news-agent-schedule', async () => {
            return getNewsAgentSchedule(supabase)
        })

        if (!schedule.enabled) {
            return { skipped: true, reason: 'news_agent_disabled' }
        }

        if (!schedule.shouldRun) {
            return {
                skipped: true,
                reason: schedule.reason,
                schedule_slot: schedule.scheduleSlot,
                schedule_day: schedule.scheduleDay,
                schedule_date: schedule.scheduleDate,
                schedule_time: schedule.scheduleTime,
                schedule_slots: schedule.slots,
                today: schedule.today,
                last_activity_date: schedule.lastActivityDate,
                last_activity_minute: schedule.lastActivityMinute,
                last_run_at: schedule.lastRunAt,
                last_started_at: schedule.lastStartedAt,
            }
        }

        const result = await step.run('run-news-agent-draft', async () => {
            return runNewsAgentDraft({ source: 'inngest-news-agent' })
        })

        return {
            ...result,
            schedule_slot: schedule.scheduleSlot,
            schedule_day: schedule.scheduleDay,
            schedule_date: schedule.scheduleDate,
            schedule_time: schedule.scheduleTime,
        }
    }
)

import { generateDailyPilgerReport, generateWeeklyPilgerReport, collectMarketRadarData } from '../ai/pilger-ceo'

// =============================================
// 7. Monitoramento Real-Time (Radar de Mercado)
// =============================================

export const radarCollectionCron = inngest.createFunction(
    { id: 'market-radar-collection', name: 'Coletar Dados do Radar de Mercado' },
    { cron: '0 * * * *' }, // Executa a cada hora para avaliar horários
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Verificar horários configurados
        const config = await step.run('check-radar-schedule', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['radar_collection_times', 'radar_collection_days'])
            
            // Padrão: 06, 12, 18
            const map = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
            const targetHours = (map.radar_collection_times || '06,12,18')
                .split(',')
                .map((v: string) => v.trim().padStart(2, '0'))
                .filter(Boolean)
            const targetDays = (map.radar_collection_days || '0,1,2,3,4,5,6')
                .split(',')
                .map((v: string) => v.trim())
                .filter(Boolean)
            const { hour, dayOfWeek } = getCurrentTimeSP()

            return {
                shouldRun: targetHours.includes(hour) && targetDays.includes(dayOfWeek),
                currentSlot: hour,
                currentDay: dayOfWeek
            }
        })

        if (!config.shouldRun) {
            return { skipped: true, reason: 'schedule_not_matched', hour: config.currentSlot, day: config.currentDay }
        }

        // 2. Executar Coleta
        const result = await step.run('collect-radar-data', async () => {
            return await collectMarketRadarData(config.currentSlot)
        })

        return { collected: result.length, slot: config.currentSlot }
    }
)

export const researchPilgerCron = inngest.createFunction(
    { id: 'research-pilger-monitor', name: 'Monitorar Pesquisa Profunda IA' },
    { cron: '0 * * * *' },
    async ({ step }) => {
        const supabase = getSupabase()

        const config = await step.run('check-research-pilger-schedule', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['research_pilger_schedule_enabled', 'research_pilger_run_times', 'research_pilger_weekdays'])

            const map = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
            const targetHours = (map.research_pilger_run_times || '09,15')
                .split(',')
                .map((v: string) => v.trim().padStart(2, '0'))
                .filter(Boolean)
            const targetDays = (map.research_pilger_weekdays || 'mon,wed,fri')
                .split(',')
                .map((v: string) => v.trim())
                .filter(Boolean)
            const weekdayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
            const { hour, dayOfWeek } = getCurrentTimeSP()
            const dayKey = weekdayMap[Number(dayOfWeek)] || 'sun'

            return {
                enabled: map.research_pilger_schedule_enabled !== 'false',
                shouldRun: map.research_pilger_schedule_enabled !== 'false' && targetHours.includes(hour) && targetDays.includes(dayKey),
                currentSlot: hour,
                currentDay: dayKey,
            }
        })

        if (!config.enabled) {
            return { skipped: true, reason: 'schedule_disabled' }
        }

        if (!config.shouldRun) {
            return { skipped: true, reason: 'schedule_not_matched', hour: config.currentSlot, day: config.currentDay }
        }

        return await step.run('run-research-pilger-monitor', async () => {
            return runScheduledResearchTopics({ slot: config.currentSlot })
        })
    }
)

// Função auxiliar para pegar hora atual em fuso horário (America/Sao_Paulo)
export const ecosystemIntelligenceCron = inngest.createFunction(
    { id: 'ecosystem-intelligence-snapshot', name: 'Sincronizar Central de Inteligencia Pilger' },
    { cron: '45 * * * *' },
    async ({ step }) => {
        const supabase = getSupabase()

        const schedule = await step.run('check-ecosystem-intelligence-schedule', async () => {
            return getEcosystemIntelligenceSchedule(supabase)
        })

        if (!schedule.enabled) {
            return { skipped: true, reason: 'ecosystem_intelligence_disabled' }
        }

        if (!schedule.shouldRun) {
            return {
                skipped: true,
                reason: 'interval_not_reached',
                interval_hours: schedule.intervalHours,
                elapsed_hours: schedule.elapsedHours,
                last_run_at: schedule.lastRunAt,
                last_started_at: schedule.lastStartedAt,
            }
        }

        await step.run('mark-ecosystem-intelligence-started', async () => {
            await markEcosystemIntelligenceStarted(supabase)
        })

        try {
            const result = await step.run('run-ecosystem-snapshot-cycle', async () => {
                return runEcosystemSnapshotCycle({
                    supabase,
                    days: schedule.days,
                    createdBy: 'inngest-ecosystem-intelligence',
                })
            })

            await step.run('mark-ecosystem-intelligence-completed', async () => {
                await markEcosystemIntelligenceCompleted(supabase)
            })

            return {
                ...result,
                interval_hours: schedule.intervalHours,
                snapshot_days: schedule.days,
            }
        } catch (error) {
            await step.run('mark-ecosystem-intelligence-failed', async () => {
                await markEcosystemIntelligenceFailed(supabase, error)
            })
            throw error
        }
    }
)

function getCurrentTimeSP() {
    const spTime = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const dateObj = new Date(spTime);
    
    // Fallback manual caso toLocaleString falhe em extrair corretamente (raro em Node moderno)
    // Mas para garantir 100% de estabilidade na comparação de strings:
    const hour = dateObj.getHours().toString().padStart(2, '0');
    const dayOfWeek = dateObj.getDay().toString();
    
    return { dayOfWeek, hour }
}

function getCurrentDateSP() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
}

export const generateDailyPilgerReportCron = inngest.createFunction(
    { id: 'pilger-daily-report', name: 'Gerar Relatório Diário Pilger AI' },
    { cron: '0 * * * *' }, // Executa a cada hora para avaliar configurações
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Verificar agendamento dinâmico (dias + horários)
        const config = await step.run('check-daily-schedule', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['pilger_daily_time', 'pilger_daily_days'])

            const map = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
            const targetHours = (map.pilger_daily_time || '23')
                .split(',')
                .map((v: string) => v.trim().padStart(2, '0'))
                .filter(Boolean)
            const targetDays = (map.pilger_daily_days || '0,1,2,3,4,5,6')
                .split(',')
                .map((v: string) => v.trim())
                .filter(Boolean)
            const { hour, dayOfWeek } = getCurrentTimeSP()

            return {
                shouldRun: targetHours.includes(hour) && targetDays.includes(dayOfWeek),
                currentSlot: hour,
                currentDay: dayOfWeek,
            }
        })

        if (!config.shouldRun) {
            return { skipped: true, reason: 'schedule_mismatch', current_hour: config.currentSlot, current_day: config.currentDay }
        }

        // 2. Extra proteção contra execuções duplas no mesmo horário do mesmo dia
        const hasRunToday = await step.run('check-already-run', async () => {
             const { data } = await supabase
                .from('pilger_ai_reports')
                .select('id')
                .eq('type', 'daily')
                // Supabase doesn't easily store runId yet in the default schema, so we can just look at created_at for the last 50 minutes.
                .gte('created_at', new Date(Date.now() - 50 * 60000).toISOString())
                .limit(1)
                
             return data && data.length > 0
        })

        if (hasRunToday) {
            return { skipped: true, reason: 'already_run_this_hour' }
        }

        // 3. Executar Relatório
        const result = await step.run('generate-daily-report', async () => {
            return await generateDailyPilgerReport()
        })
        return result
    }
)

export const generateWeeklyPilgerReportCron = inngest.createFunction(
    { id: 'pilger-weekly-report', name: 'Gerar Diretriz Semanal Pilger AI' },
    { cron: '0 * * * *' }, // Executa a cada hora para avaliar configurações
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Verificar agendamento dinâmico (dias + horários)
        const config = await step.run('check-weekly-schedule', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['pilger_weekly_days', 'pilger_weekly_times', 'pilger_weekly_day', 'pilger_weekly_time'])

            const map = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
            const targetDays = (map.pilger_weekly_days || map.pilger_weekly_day || '1')
                .split(',')
                .map((v: string) => v.trim())
                .filter(Boolean)
            const targetHours = (map.pilger_weekly_times || map.pilger_weekly_time || '23')
                .split(',')
                .map((v: string) => v.trim().padStart(2, '0'))
                .filter(Boolean)

            const { dayOfWeek, hour } = getCurrentTimeSP()
            return {
                shouldRun: targetDays.includes(dayOfWeek) && targetHours.includes(hour),
                currentDay: dayOfWeek,
                currentHour: hour,
            }
        })

        if (!config.shouldRun) {
            return { skipped: true, reason: 'schedule_mismatch', current_day: config.currentDay, current_hour: config.currentHour }
        }

        // 2. Extra proteção
        const hasRunToday = await step.run('check-already-run', async () => {
             const { data } = await supabase
                .from('pilger_ai_reports')
                .select('id')
                .eq('type', 'weekly')
                .gte('created_at', new Date(Date.now() - 50 * 60000).toISOString())
                .limit(1)
                
             return data && data.length > 0
        })

        if (hasRunToday) {
            return { skipped: true, reason: 'already_run_this_hour' }
        }

        // 3. Executar Relatório
        const result = await step.run('generate-weekly-report', async () => {
            return await generateWeeklyPilgerReport()
        })
        return result
    }
)


