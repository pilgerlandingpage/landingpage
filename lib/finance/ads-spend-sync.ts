import * as googleAds from '@/lib/ads/google'
import * as metaAds from '@/lib/ads/meta'

type Platform = 'meta' | 'google'

type SyncSource = 'live' | 'snapshot'

interface PlatformSpend {
    platform: Platform
    amount: number
    source: SyncSource
}

export interface AdsSpendSyncResult {
    date: string
    synced: number
    skipped: number
    entries: Array<{
        platform: Platform
        amount: number
        entry_id?: string
        action: 'inserted' | 'updated' | 'skipped'
        source: SyncSource
    }>
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

function dateLabel(date: string) {
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
}

function platformLabel(platform: Platform) {
    return platform === 'meta' ? 'Meta Ads' : 'Google Ads'
}

function platformReference(platform: Platform, date: string) {
    return `paid_ads:${platform}:${date}`
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

async function getLiveDailySpend(): Promise<{ spends: PlatformSpend[]; errors: string[] }> {
    const errors: string[] = []
    const spends: PlatformSpend[] = []

    try {
        const metaInsights = await metaAds.getAccountInsightsByCampaign('today')
        const metaSpend = Object.values(metaInsights || {}).reduce(
            (sum, row: any) => sum + Number.parseFloat(String(row?.spend || '0')),
            0
        )
        spends.push({ platform: 'meta', amount: roundCurrency(metaSpend), source: 'live' })
    } catch (err: any) {
        errors.push(`Meta Ads: ${err?.message || 'falha ao buscar gasto diario'}`)
    }

    try {
        const googleInsights = await googleAds.getAllCampaignsWithMetrics('today')
        const googleSpend = Object.values(googleInsights || {}).reduce(
            (sum, row: any) => sum + Number(row?.metrics?.spend || 0),
            0
        )
        spends.push({ platform: 'google', amount: roundCurrency(googleSpend), source: 'live' })
    } catch (err: any) {
        errors.push(`Google Ads: ${err?.message || 'falha ao buscar gasto diario'}`)
    }

    return { spends, errors }
}

async function getSnapshotDailySpend(admin: any, date: string): Promise<PlatformSpend[]> {
    const dayStartDate = new Date(`${date}T00:00:00-03:00`)
    const dayStart = dayStartDate.toISOString()
    const nextDay = new Date(dayStartDate)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    const dayEnd = nextDay.toISOString()

    const { data, error } = await admin
        .from('ad_metrics_snapshots')
        .select('campaign_id, spend, snapshot_at, ad_campaigns(platform)')
        .gte('snapshot_at', dayStart)
        .lt('snapshot_at', dayEnd)

    if (error || !data) return []

    const maxSpendByCampaign = new Map<string, { platform: Platform; spend: number }>()
    for (const row of data) {
        const platform = row?.ad_campaigns?.platform as Platform | undefined
        if (platform !== 'meta' && platform !== 'google') continue

        const campaignId = String(row.campaign_id || '').trim()
        if (!campaignId) continue

        const spend = Number(row.spend || 0)
        const current = maxSpendByCampaign.get(campaignId)
        if (!current || spend > current.spend) {
            maxSpendByCampaign.set(campaignId, { platform, spend })
        }
    }

    const totals: Record<Platform, number> = { meta: 0, google: 0 }
    for (const item of maxSpendByCampaign.values()) {
        totals[item.platform] += item.spend
    }

    return (['meta', 'google'] as Platform[]).map(platform => ({
        platform,
        amount: roundCurrency(totals[platform]),
        source: 'snapshot' as const,
    }))
}

export async function syncPaidAdsSpendToFinance(admin: any, options?: { date?: string }) {
    const today = todayInSaoPaulo()
    const date = options?.date || today
    const result: AdsSpendSyncResult = {
        date,
        synced: 0,
        skipped: 0,
        entries: [],
        errors: [],
    }

    const live = await getLiveDailySpend()
    result.errors.push(...live.errors)

    const snapshotSpends = await getSnapshotDailySpend(admin, date)
    const spends = (['meta', 'google'] as Platform[]).map(platform => {
        const liveSpend = live.spends.find(item => item.platform === platform)
        if (liveSpend && liveSpend.amount > 0) return liveSpend

        const snapshotSpend = snapshotSpends.find(item => item.platform === platform)
        if (snapshotSpend && snapshotSpend.amount > 0) return snapshotSpend

        return liveSpend || snapshotSpend || { platform, amount: 0, source: 'snapshot' as const }
    })
    const costCenterId = await getMarketingCostCenterId(admin)

    for (const spend of spends) {
        const amount = roundCurrency(spend.amount)
        if (amount <= 0) {
            result.skipped++
            result.entries.push({ platform: spend.platform, amount, action: 'skipped', source: spend.source })
            continue
        }

        const label = platformLabel(spend.platform)
        const externalReference = platformReference(spend.platform, date)
        const payload: Record<string, any> = {
            description: `Trafego pago - ${label} - ${dateLabel(date)}`,
            entry_type: 'expense',
            amount,
            category: 'Marketing',
            subcategory: label,
            entry_date: date,
            occurred_at: `${date}T12:00:00.000Z`,
            payment_method: 'Cartao',
            payment_status: 'paid',
            counterparty_name: label,
            counterparty_type: 'pessoa_juridica',
            reference_company: label,
            due_date: date,
            competence_date: date,
            cost_center_id: costCenterId,
            notes: `Sincronizado automaticamente do ${label}. Dia ${dateLabel(date)}. Fonte: ${spend.source}.`,
            source_module: 'paid_ads',
            external_reference: externalReference,
            updated_at: new Date().toISOString(),
        }

        const { data: existing, error: existingError } = await admin
            .from('finance_entries')
            .select('id')
            .eq('source_module', 'paid_ads')
            .eq('external_reference', externalReference)
            .maybeSingle()

        if (existingError) {
            result.errors.push(`${label}: ${existingError.message}`)
            continue
        }

        if (existing?.id) {
            const { error } = await admin
                .from('finance_entries')
                .update(payload)
                .eq('id', existing.id)

            if (error) {
                result.errors.push(`${label}: ${error.message}`)
                continue
            }

            result.synced++
            result.entries.push({ platform: spend.platform, amount, entry_id: existing.id, action: 'updated', source: spend.source })
            continue
        }

        const { data: inserted, error } = await admin
            .from('finance_entries')
            .insert({
                ...payload,
                created_at: new Date().toISOString(),
            })
            .select('id')
            .single()

        if (error) {
            result.errors.push(`${label}: ${error.message}`)
            continue
        }

        result.synced++
        result.entries.push({ platform: spend.platform, amount, entry_id: inserted?.id, action: 'inserted', source: spend.source })
    }

    return result
}
