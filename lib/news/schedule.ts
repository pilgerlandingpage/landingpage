const NEWS_AGENT_TIME_ZONE = 'America/Sao_Paulo'
const DEFAULT_NEWS_AGENT_SCHEDULE_DAY = '2'
const DEFAULT_NEWS_AGENT_SCHEDULE_TIME = '10:00'
const RUN_IN_PROGRESS_GRACE_MINUTES = 30
const DEFAULT_NEWS_AGENT_WEEKLY_SLOTS = [
  { id: '1', day: '2', time: '10:00' },
  { id: '2', day: '4', time: '10:00' },
  { id: '3', day: 'off', time: '10:00' },
  { id: '4', day: 'off', time: '10:00' },
  { id: '5', day: 'off', time: '10:00' },
  { id: '6', day: 'off', time: '10:00' },
  { id: '7', day: 'off', time: '10:00' },
]

type SupabaseLike = {
  from: (table: string) => any
}

export type NewsAgentScheduleSlot = {
  id: string
  day: string
  time: string
  minuteOfDay: number
}

function parseConfigDate(value?: string | null) {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function normalizeScheduleDay(value?: string | null, fallback = DEFAULT_NEWS_AGENT_SCHEDULE_DAY) {
  const selected = String(value || '').trim()
  if (selected === 'off') return 'off'
  return ['0', '1', '2', '3', '4', '5', '6'].includes(selected)
    ? selected
    : fallback
}

function normalizeScheduleTime(value?: string | null) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!match) return DEFAULT_NEWS_AGENT_SCHEDULE_TIME

  const hour = Number.parseInt(match[1], 10)
  const minute = Number.parseInt(match[2] || '0', 10)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return DEFAULT_NEWS_AGENT_SCHEDULE_TIME

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function minutesFromScheduleTime(value: string) {
  const [hour, minute] = value.split(':').map(part => Number.parseInt(part, 10))
  return (hour * 60) + minute
}

function getNewsAgentLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEWS_AGENT_TIME_ZONE,
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

function getNewsAgentWeeklySlots(config: Record<string, string>) {
  return DEFAULT_NEWS_AGENT_WEEKLY_SLOTS.map(slot => {
    const fallbackDay = slot.id === '1'
      ? (config.news_agent_schedule_day || slot.day)
      : slot.day
    const fallbackTime = slot.id === '1'
      ? (config.news_agent_schedule_time || slot.time)
      : slot.time
    const day = normalizeScheduleDay(config[`news_agent_schedule_day_${slot.id}`] || fallbackDay, slot.day)
    const time = normalizeScheduleTime(config[`news_agent_schedule_time_${slot.id}`] || fallbackTime)
    if (day === 'off') return null

    return {
      id: slot.id,
      day,
      time,
      minuteOfDay: minutesFromScheduleTime(time),
    }
  }).filter((slot): slot is NewsAgentScheduleSlot => Boolean(slot))
}

export async function getNewsAgentSchedule(supabase: SupabaseLike) {
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'news_agent_enabled',
      'news_agent_schedule_day',
      'news_agent_schedule_time',
      'news_agent_schedule_day_1',
      'news_agent_schedule_time_1',
      'news_agent_schedule_day_2',
      'news_agent_schedule_time_2',
      'news_agent_schedule_day_3',
      'news_agent_schedule_time_3',
      'news_agent_schedule_day_4',
      'news_agent_schedule_time_4',
      'news_agent_schedule_day_5',
      'news_agent_schedule_time_5',
      'news_agent_schedule_day_6',
      'news_agent_schedule_time_6',
      'news_agent_schedule_day_7',
      'news_agent_schedule_time_7',
      'news_agent_last_run_at',
      'news_agent_last_started_at',
    ])

  const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
  const enabled = config.news_agent_enabled !== 'false'
  const slots = getNewsAgentWeeklySlots(config)
  const lastRunMs = parseConfigDate(config.news_agent_last_run_at)
  const lastStartedMs = parseConfigDate(config.news_agent_last_started_at)
  const now = getNewsAgentLocalParts()
  const lastRun = lastRunMs ? getNewsAgentLocalParts(new Date(lastRunMs)) : null
  const lastStarted = lastStartedMs ? getNewsAgentLocalParts(new Date(lastStartedMs)) : null
  const todaySlots = slots.filter(slot => slot.day === now.weekday).sort((a, b) => a.minuteOfDay - b.minuteOfDay)
  const reachedSlots = todaySlots.filter(slot => now.minuteOfDay >= slot.minuteOfDay)
  const dueSlots = reachedSlots.filter(slot => !(
    lastRun?.dateStamp === now.dateStamp && lastRun.minuteOfDay >= slot.minuteOfDay
  ))
  const nextSlot = dueSlots.sort((a, b) => b.minuteOfDay - a.minuteOfDay)[0] || null
  const startedReachedSlot = Boolean(lastStartedMs && lastStarted?.dateStamp === now.dateStamp && reachedSlots.some(slot => lastStarted.minuteOfDay >= slot.minuteOfDay))
  const completedAfterStart = Boolean(lastRunMs && lastStartedMs && lastRunMs >= lastStartedMs)
  const startedAgeMinutes = lastStartedMs ? Math.floor((Date.now() - lastStartedMs) / 60000) : null
  const runInProgress = startedReachedSlot && !completedAfterStart && startedAgeMinutes != null && startedAgeMinutes < RUN_IN_PROGRESS_GRACE_MINUTES

  let reason = 'ready'
  if (!enabled) reason = 'news_agent_disabled'
  else if (slots.length === 0) reason = 'no_schedule_days'
  else if (todaySlots.length === 0) reason = 'weekday_not_due'
  else if (reachedSlots.length === 0) reason = 'time_not_reached'
  else if (runInProgress) reason = 'run_in_progress'
  else if (!nextSlot) reason = 'already_ran_slot'

  return {
    enabled,
    shouldRun: enabled && reason === 'ready' && Boolean(nextSlot),
    reason,
    scheduleDay: nextSlot?.day || todaySlots[0]?.day || '',
    scheduleDate: '',
    scheduleTime: nextSlot?.time || todaySlots[0]?.time || '',
    scheduleSlot: nextSlot?.id || '',
    slots: slots.map(slot => ({ id: slot.id, day: slot.day, time: slot.time })),
    today: now,
    lastActivityDate: lastRun?.dateStamp || lastStarted?.dateStamp || null,
    lastActivityMinute: lastRun?.minuteOfDay ?? lastStarted?.minuteOfDay ?? null,
    lastRunDate: lastRun?.dateStamp || null,
    lastRunMinute: lastRun?.minuteOfDay ?? null,
    lastStartedDate: lastStarted?.dateStamp || null,
    lastStartedMinute: lastStarted?.minuteOfDay ?? null,
    startedAgeMinutes,
    lastRunAt: config.news_agent_last_run_at || null,
    lastStartedAt: config.news_agent_last_started_at || null,
  }
}
