import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import * as metaAds from '@/lib/ads/meta'

export const dynamic = 'force-dynamic'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null
}

function isPaidMetaLead(row: any) {
  const visitor = firstRelation(row?.visitors)
  const sourceText = [
    row?.acquired_via,
    visitor?.detected_source,
    visitor?.utm_source,
    visitor?.utm_medium,
    visitor?.utm_campaign,
  ].filter(Boolean).join(' ').toLowerCase()

  return sourceText.includes('facebook')
    || sourceText.includes('instagram')
    || sourceText.includes('meta')
    || sourceText.includes('fbclid')
    || sourceText.includes('ads')
}

function parseDatePreset(value: string | null): metaAds.DatePreset | 'custom' {
  const allowed = new Set(['today', 'yesterday', 'last_7d', 'last_30d', 'this_month', 'last_month', 'maximum', 'custom'])
  return allowed.has(String(value || '')) ? value as metaAds.DatePreset | 'custom' : 'last_30d'
}

function dateRangeFromRequest(request: NextRequest) {
  const start = request.nextUrl.searchParams.get('start_date')
  const end = request.nextUrl.searchParams.get('end_date')
  if (!start || !end) return undefined
  return { since: start, until: end }
}

function internalLeadRange(datePreset: metaAds.DatePreset | 'custom', timeRange?: { since: string; until: string }) {
  const now = new Date()
  const until = now.toISOString()
  const start = new Date(now)

  if (datePreset === 'today') start.setHours(0, 0, 0, 0)
  else if (datePreset === 'yesterday') {
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date(start)
    yesterdayEnd.setHours(23, 59, 59, 999)
    return { since: start.toISOString(), until: yesterdayEnd.toISOString() }
  } else if (datePreset === 'last_7d') start.setDate(start.getDate() - 7)
  else if (datePreset === 'last_30d') start.setDate(start.getDate() - 30)
  else if (datePreset === 'this_month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  } else if (datePreset === 'last_month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    return { since: first.toISOString(), until: last.toISOString() }
  } else if (datePreset === 'custom' && timeRange) {
    const customEnd = new Date(timeRange.until)
    customEnd.setHours(23, 59, 59, 999)
    return { since: new Date(timeRange.since).toISOString(), until: customEnd.toISOString() }
  } else {
    start.setDate(start.getDate() - 30)
  }

  return { since: start.toISOString(), until }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const datePreset = parseDatePreset(request.nextUrl.searchParams.get('date_preset'))
    const timeRange = datePreset === 'custom' ? dateRangeFromRequest(request) : undefined

    const snapshot = await metaAds.getMetaTrafficManagerSnapshot({ datePreset, timeRange })
    const leadRange = internalLeadRange(datePreset, timeRange)

    const { data: leadRows, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, phone, created_at, funnel_stage, acquired_via, visitors(detected_source, utm_source, utm_medium, utm_campaign)')
      .gte('created_at', leadRange.since)
      .lte('created_at', leadRange.until)
      .order('created_at', { ascending: false })
      .limit(500)

    if (leadsError) {
      console.warn('[Paid Traffic Manager] Falha ao cruzar leads internos:', leadsError.message)
    }

    const internalMetaLeads = ((leadRows || []) as any[]).filter(isPaidMetaLead)
    const platformLeads = snapshot.totals.leads
    const crmLeadCount = internalMetaLeads.length
    const missingAttribution = Math.max(0, platformLeads - crmLeadCount)

    return NextResponse.json({
      success: true,
      manager: {
        ...snapshot,
        crm_attribution: {
          platform_leads: platformLeads,
          crm_leads: crmLeadCount,
          missing_attribution: missingAttribution,
          attribution_rate: platformLeads > 0 ? (crmLeadCount / platformLeads) * 100 : 0,
          recent_leads: internalMetaLeads.slice(0, 12),
        },
      },
    })
  } catch (error) {
    console.error('[Paid Traffic Manager] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar gestor de trafego pago.' },
      { status: 500 },
    )
  }
}
