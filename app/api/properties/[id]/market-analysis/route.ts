import { NextRequest, NextResponse } from 'next/server'
import {
    MARKET_ANALYSIS_PROPERTY_SELECT,
    buildMarketRadarAnalysis,
    fetchInternalMarketComparables,
    type MarketAnalysisProperty,
} from '@/lib/market-analysis/radar'
import { fetchPropertyPriceHistory } from '@/lib/properties/price-history'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: string) {
    return UUID_PATTERN.test(value)
}

function locationLabelFor(property: any) {
    return [property?.neighborhood, property?.city, property?.state].filter(Boolean).join(' - ')
}

async function getPropertyByIdentifier(identifier: string): Promise<MarketAnalysisProperty | null> {
    const supabase = await createServerSupabase()
    const decodedIdentifier = decodeURIComponent(identifier || '').trim()
    const idFromSeoSlug = extractPropertyIdFromSeoSlug(decodedIdentifier)

    if (idFromSeoSlug || isUuid(decodedIdentifier)) {
        const propertyId = idFromSeoSlug || decodedIdentifier
        const { data, error } = await supabase
            .from('properties')
            .select(MARKET_ANALYSIS_PROPERTY_SELECT)
            .eq('id', propertyId)
            .maybeSingle()

        if (error) throw error
        return (data || null) as MarketAnalysisProperty | null
    }

    const { data, error } = await supabase
        .from('properties')
        .select(MARKET_ANALYSIS_PROPERTY_SELECT)
        .eq('source_slug', decodedIdentifier)
        .limit(1)
        .maybeSingle()

    if (error) throw error
    return (data || null) as MarketAnalysisProperty | null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        if (!id) return NextResponse.json({ error: 'ID obrigatorio' }, { status: 400 })

        const property = await getPropertyByIdentifier(id)
        if (!property) return NextResponse.json({ error: 'Imovel nao encontrado' }, { status: 404 })

        const admin = createAdminClient()
        const comparables = await fetchInternalMarketComparables(admin, property)
        const history = await fetchPropertyPriceHistory(admin, property.id, 20)
        const analysis = buildMarketRadarAnalysis({
            property,
            candidates: comparables,
            locationLabel: locationLabelFor(property),
            priceHistoryEvents: history,
        })

        return NextResponse.json({
            property: {
                id: property.id,
                title: property.title || property.seo_title || null,
                city: property.city || null,
                neighborhood: property.neighborhood || null,
                property_type: property.property_type || null,
                price: analysis.currentPrice,
                area_m2: analysis.currentArea,
                price_per_m2: analysis.currentPriceM2,
            },
            comparables: {
                qualified: analysis.comparableCount,
                candidates: analysis.rawComparableCount,
                confidence: analysis.confidence,
                confidence_label: analysis.confidenceLabel,
                average_price_per_m2: analysis.averageM2,
                median_price_per_m2: analysis.medianM2,
                min_price_per_m2: analysis.minM2,
                max_price_per_m2: analysis.maxM2,
                difference_to_median_percent: analysis.deltaToMedian,
                percentile: analysis.percentile,
                outliers_removed: analysis.outlierCount,
            },
            positioning: analysis.positioning,
            price_history: analysis.timeline,
            reading: analysis.reading,
            methodology: {
                criteria: analysis.criteriaSummary,
                summary: analysis.calculationSummary,
                disclaimers: analysis.disclaimers,
            },
            regional_trend: {
                six_months: null,
                twelve_months: null,
                twenty_four_months: null,
                status: 'em_formacao',
                note: 'A serie historica regional exige snapshots periodicos da base. O endpoint ja separa este campo para receber esse dado quando a coleta temporal for ativada.',
            },
        })
    } catch (err: any) {
        console.error('[Market Analysis API] failed:', err)
        return NextResponse.json({ error: err?.message || 'Erro ao gerar analise de mercado' }, { status: 500 })
    }
}
