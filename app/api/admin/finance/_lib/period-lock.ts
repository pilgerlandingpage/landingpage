type PeriodLockAdminClient = {
    from: (table: string) => any
}

function normalizeDateOnly(raw: any): string | null {
    const value = String(raw || '').trim()
    if (!value) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toISOString().slice(0, 10)
}

function periodMonthFromDate(rawDate: any): string | null {
    const dateOnly = normalizeDateOnly(rawDate)
    if (!dateOnly) return null
    return `${dateOnly.slice(0, 7)}-01`
}

function periodLabel(periodMonth: string): string {
    const safe = String(periodMonth || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe
    const year = safe.slice(0, 4)
    const month = safe.slice(5, 7)
    return `${month}/${year}`
}

export async function isPeriodLocked(admin: PeriodLockAdminClient, rawDate: any): Promise<boolean> {
    const periodMonth = periodMonthFromDate(rawDate)
    if (!periodMonth) return false

    try {
        const { data, error } = await admin
            .from('finance_closing_periods')
            .select('status')
            .eq('period_month', periodMonth)
            .maybeSingle()

        if (error) return false
        return String(data?.status || '').trim().toLowerCase() === 'locked'
    } catch {
        return false
    }
}

export async function ensureUnlockedDates(
    admin: PeriodLockAdminClient,
    rawDates: any[],
    contextLabel: string,
): Promise<string | null> {
    const uniquePeriods = Array.from(
        new Set(
            (rawDates || [])
                .map(date => periodMonthFromDate(date))
                .filter((period): period is string => !!period),
        ),
    )

    for (const period of uniquePeriods) {
        const locked = await isPeriodLocked(admin, period)
        if (locked) {
            return `${contextLabel}: periodo ${periodLabel(period)} bloqueado para alteracoes.`
        }
    }

    return null
}

export function normalizeDateForLock(rawDate: any): string | null {
    return normalizeDateOnly(rawDate)
}

