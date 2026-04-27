import * as googleAds from '@/lib/ads/google'
import * as metaAds from '@/lib/ads/meta'

type Platform = 'meta' | 'google'
type SyncSource = 'live' | 'account_monthly'

interface PlatformSpend {
    platform: Platform
    amount: number
    source: SyncSource
}

interface SyncedEntry {
    platform: Platform
    amount: number
    month: string
    entry_id?: string
    action: 'inserted' | 'updated' | 'skipped'
    source: SyncSource
}

export interface AdsSpendSyncResult {
    month: string
    synced: number
    skipped: number
    meta_total: number
    google_total: number
    combined_total: number
    entries: SyncedEntry[]
    errors: string[]
}

export interface HistoricalAdsSpendSyncResult {
    months: number
    synced: number
    skipped: number
    meta_total: number
    google_total: number
    combined_total: number
    entries: SyncedEntry[]
    errors: string[]
}

function roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function todayInSaoPaulo() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
}

function currentMonthInSaoPaulo() {
    return todayInSaoPaulo().slice(0, 7)
}

function monthStart(month: string) {
    return `${month}-01`
}

function monthEnd(month: string) {
    const [year, monthNumber] = month.split('-').map(Number)
    return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
}

function cappedMonthEnd(month: string) {
    const today = todayInSaoPaulo()
    const end = monthEnd(month)
    return month === today.slice(0, 7) && today < end ? today : end
}

function monthLabel(month: string) {
    const [year, monthNumber] = month.split('-')
    return `${monthNumber}/${year}`
}

function platformLabel(platform: Platform) {
    return platform === 'meta' ? 'Meta Ads' : 'Google Ads'
}

function platformReference(platform: Platform, month: string) {
    return `paid_ads_monthly:${platform}:${month}`
}

async function getMarketingCostCenterId(admin: any) {
    const { data, error } = await admin
        .from('finance_cost_centers')
        .select('id')
        .ilike('name', 'Marketing')
        .eq('is_active', true)
        .maybeSingle()

    if (error) return null
    return data?.id || null
}

async function getLiveMonthlySpend(month: string): Promise<{ spends: PlatformSpend[]; errors: string[] }> {
    const errors: string[] = []
    const spends: PlatformSpend[] = []
    const range = { startDate: monthStart(month), endDate: cappedMonthEnd(month) }
    const metaRange = { since: range.startDate, until: range.endDate }

    try {
        const metaInsights = await metaAds.getAccountInsightsByCampaign('custom', metaRange)
        const metaSpend = Object.values(metaInsights || {}).reduce(
            (sum, row: any) => sum + Number.parseFloat(String(row?.spend || '0')),
            0
        )
        spends.push({ platform: 'meta', amount: roundCurrency(metaSpend), source: 'live' })
    } catch (err: any) {
        errors.push(`Meta Ads: ${err?.message || 'falha ao buscar gasto mensal'}`)
    }

    try {
        const googleInsights = await googleAds.getAllCampaignsWithMetrics('custom', range)
        const googleSpend = Object.values(googleInsights || {}).reduce(
            (sum, row: any) => sum + Number(row?.metrics?.spend || 0),
            0
        )
        spends.push({ platform: 'google', amount: roundCurrency(googleSpend), source: 'live' })
    } catch (err: any) {
        errors.push(`Google Ads: ${err?.message || 'falha ao buscar gasto mensal'}`)
    }

    return { spends, errors }
}

async function upsertPaidAdsFinanceEntry(
    admin: any,
    costCenterId: string | null,
    spend: PlatformSpend,
    month: string
): Promise<SyncedEntry | { error: string }> {
    const amount = roundCurrency(spend.amount)
    if (amount <= 0) {
        return { platform: spend.platform, amount, month, action: 'skipped', source: spend.source }
    }

    const label = platformLabel(spend.platform)
    const entryDate = cappedMonthEnd(month)
    const externalReference = platformReference(spend.platform, month)
    const payload: Record<string, any> = {
        description: `Trafego pago - ${label} - ${monthLabel(month)}`,
        entry_type: 'expense',
        amount,
        category: 'Marketing',
        subcategory: label,
        entry_date: entryDate,
        occurred_at: `${entryDate}T12:00:00.000Z`,
        payment_method: 'Cartao',
        payment_status: 'paid',
        counterparty_name: label,
        counterparty_type: 'pessoa_juridica',
        reference_company: label,
        due_date: entryDate,
        competence_date: monthStart(month),
        cost_center_id: costCenterId,
        notes: `Sincronizado automaticamente do ${label}. Competencia ${monthLabel(month)}. Fonte: ${spend.source}.`,
        source_module: 'paid_ads_monthly',
        external_reference: externalReference,
        updated_at: new Date().toISOString(),
    }

    const { data: existing, error: existingError } = await admin
        .from('finance_entries')
        .select('id')
        .eq('source_module', 'paid_ads_monthly')
        .eq('external_reference', externalReference)
        .maybeSingle()

    if (existingError) {
        return { error: `${label}: ${existingError.message}` }
    }

    if (existing?.id) {
        const { error } = await admin
            .from('finance_entries')
            .update(payload)
            .eq('id', existing.id)

        if (error) return { error: `${label}: ${error.message}` }

        return { platform: spend.platform, amount, month, entry_id: existing.id, action: 'updated', source: spend.source }
    }

    const { data: inserted, error } = await admin
        .from('finance_entries')
        .insert({
            ...payload,
            created_at: new Date().toISOString(),
        })
        .select('id')
        .single()

    if (error) return { error: `${label}: ${error.message}` }

    return { platform: spend.platform, amount, month, entry_id: inserted?.id, action: 'inserted', source: spend.source }
}

function applySyncedEntry(
    result: Pick<AdsSpendSyncResult, 'entries' | 'errors'> & { synced: number; skipped: number },
    entry: SyncedEntry | { error: string }
) {
    if ('error' in entry) {
        result.errors.push(entry.error)
        return
    }

    if (entry.action === 'skipped') result.skipped++
    else result.synced++

    result.entries.push(entry)
}

export async function syncPaidAdsSpendToFinance(admin: any, options?: { month?: string }): Promise<AdsSpendSyncResult> {
    const month = options?.month || currentMonthInSaoPaulo()
    const result: AdsSpendSyncResult = {
        month,
        synced: 0,
        skipped: 0,
        meta_total: 0,
        google_total: 0,
        combined_total: 0,
        entries: [],
        errors: [],
    }

    const live = await getLiveMonthlySpend(month)
    result.errors.push(...live.errors)

    const costCenterId = await getMarketingCostCenterId(admin)
    for (const platform of ['meta', 'google'] as Platform[]) {
        const spend = live.spends.find(item => item.platform === platform) || {
            platform,
            amount: 0,
            source: 'live' as const,
        }
        const entry = await upsertPaidAdsFinanceEntry(admin, costCenterId, spend, month)
        applySyncedEntry(result, entry)
    }

    result.meta_total = roundCurrency(result.entries.find(item => item.platform === 'meta')?.amount || 0)
    result.google_total = roundCurrency(result.entries.find(item => item.platform === 'google')?.amount || 0)
    result.combined_total = roundCurrency(result.meta_total + result.google_total)

    return result
}

export async function syncHistoricalPaidAdsSpendToFinance(admin: any): Promise<HistoricalAdsSpendSyncResult> {
    const result: HistoricalAdsSpendSyncResult = {
        months: 0,
        synced: 0,
        skipped: 0,
        meta_total: 0,
        google_total: 0,
        combined_total: 0,
        entries: [],
        errors: [],
    }

    const monthlyByPlatform: Record<Platform, Record<string, number>> = { meta: {}, google: {} }

    try {
        monthlyByPlatform.meta = await metaAds.getAccountMonthlySpend()
    } catch (err: any) {
        result.errors.push(`Meta Ads: ${err?.message || 'falha ao buscar historico mensal'}`)
    }

    try {
        monthlyByPlatform.google = await googleAds.getAccountMonthlySpend()
    } catch (err: any) {
        result.errors.push(`Google Ads: ${err?.message || 'falha ao buscar historico mensal'}`)
    }

    const months = Array.from(new Set([
        ...Object.keys(monthlyByPlatform.meta),
        ...Object.keys(monthlyByPlatform.google),
    ])).filter(month => /^\d{4}-\d{2}$/.test(month)).sort()

    result.meta_total = roundCurrency(Object.values(monthlyByPlatform.meta).reduce((sum, amount) => sum + Number(amount || 0), 0))
    result.google_total = roundCurrency(Object.values(monthlyByPlatform.google).reduce((sum, amount) => sum + Number(amount || 0), 0))
    result.combined_total = roundCurrency(result.meta_total + result.google_total)

    result.months = months.length
    const costCenterId = await getMarketingCostCenterId(admin)

    for (const month of months) {
        for (const platform of ['meta', 'google'] as Platform[]) {
            const amount = roundCurrency(monthlyByPlatform[platform][month] || 0)
            const entry = await upsertPaidAdsFinanceEntry(admin, costCenterId, {
                platform,
                amount,
                source: 'account_monthly',
            }, month)

            applySyncedEntry(result, entry)
        }
    }

    return result
}
