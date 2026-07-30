import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { maskPublicPriceText } from '@/lib/properties/public-policy'

export const dynamic = 'force-dynamic'

type DevelopmentStage = 'launch' | 'ready'

type PublicDevelopment = {
    slug: string
    name: string
    locationName: string
    priceRange: string
    availableUnitsCount: number | null
    heroImage: string
    stage: DevelopmentStage
    stageLabel: string
}

type PublicDevelopmentGroup = {
    id: DevelopmentStage
    label: string
    href: string
    total: number
    developments: PublicDevelopment[]
}

const MENU_GROUP_LIMIT = 8

const DEVELOPMENT_STAGE_META: Record<DevelopmentStage, { label: string; href: string }> = {
    launch: { label: 'Lancamentos', href: '/busca?tag=lancamento' },
    ready: { label: 'Prontos', href: '/busca?tag=pronto' },
}

const DEVELOPMENT_STAGE_ORDER: DevelopmentStage[] = ['launch', 'ready']

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function asText(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function normalizeText(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function firstImageFromGallery(content: Record<string, any>) {
    const customGallery = Array.isArray(content.custom_gallery) ? content.custom_gallery : []
    const developmentGallery = Array.isArray(asRecord(content.development).gallery) ? asRecord(content.development).gallery : []
    const gallery = [...customGallery, ...developmentGallery]

    for (const item of gallery) {
        if (typeof item === 'string' && item.trim()) return item.trim()
        const image = asText(asRecord(item).image ?? asRecord(item).url ?? asRecord(item).src)
        if (image) return image
    }

    return '/placeholder-house.jpg'
}

function stageFromText(value: unknown): DevelopmentStage | null {
    const text = normalizeText(value)
    if (!text) return null
    if (/\b(launch|construction|lancamento|pre lancamento|pre-lancamento|na planta|em construcao|construcao|obra|em obra|entrega prevista)\b/.test(text)) return 'launch'
    if (/\b(ready|pronto|pronta|pronto para morar|entregue)\b/.test(text)) return 'ready'
    return null
}

function resolveDevelopmentStage(page: Record<string, any>, content: Record<string, any>, development: Record<string, any>): DevelopmentStage {
    const explicit = stageFromText(
        development.stage
        ?? development.status
        ?? development.constructionStatus
        ?? development.construction_status
        ?? content.development_stage
        ?? content.stage
    )
    if (explicit) return explicit

    return stageFromText([
        page.title,
        content.custom_title,
        content.custom_description,
        development.name,
        development.tagline,
        development.description,
    ].filter(Boolean).join(' ')) || 'ready'
}

function normalizeDevelopment(page: Record<string, any>): PublicDevelopment | null {
    const content = asRecord(page.content)
    if (content.template && content.template !== 'brava-concetto') return null

    const development = asRecord(content.development)
    const slug = asText(page.slug)
    if (!slug) return null
    const isBravaConcetto = slug === 'bravaconceto'
    const stage = resolveDevelopmentStage(page, content, development)

    const name = asText(
        development.name,
        isBravaConcetto ? 'Brava Concetto' : asText(content.custom_title, asText(page.title, 'Empreendimento'))
    )

    return {
        slug,
        name,
        locationName: asText(development.locationName ?? development.location_name, isBravaConcetto ? 'Praia Brava, Itajai - SC' : 'Litoral catarinense'),
        priceRange: maskPublicPriceText(
            asText(development.priceRange ?? development.price_range, isBravaConcetto ? 'R$ 8.600.000 a R$ 21.000.000' : 'Consultar valores'),
            'Consultar valores'
        ),
        availableUnitsCount: asNumber(development.availableUnitsCount ?? development.available_units_count ?? content.available_units_count) ?? (isBravaConcetto ? 3 : null),
        heroImage: isBravaConcetto
            ? asText(development.heroImage ?? development.hero_image, '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg')
            : asText(development.heroImage ?? development.hero_image ?? content.custom_hero_image, firstImageFromGallery(content)),
        stage,
        stageLabel: DEVELOPMENT_STAGE_META[stage].label,
    }
}

function sortDevelopments(developments: PublicDevelopment[]) {
    return [...developments].sort((a, b) => {
        if (a.slug === 'bravaconceto') return -1
        if (b.slug === 'bravaconceto') return 1
        const stageDiff = DEVELOPMENT_STAGE_ORDER.indexOf(a.stage) - DEVELOPMENT_STAGE_ORDER.indexOf(b.stage)
        if (stageDiff !== 0) return stageDiff
        return a.name.localeCompare(b.name, 'pt-BR')
    })
}

function groupDevelopments(developments: PublicDevelopment[], limitPerGroup?: number): PublicDevelopmentGroup[] {
    return DEVELOPMENT_STAGE_ORDER.map(stage => {
        const items = developments.filter(development => development.stage === stage)
        const meta = DEVELOPMENT_STAGE_META[stage]
        return {
            id: stage,
            label: meta.label,
            href: meta.href,
            total: items.length,
            developments: typeof limitPerGroup === 'number' ? items.slice(0, limitPerGroup) : items,
        }
    }).filter(group => group.total > 0)
}

export async function GET(request: NextRequest) {
    try {
        const menuMode = request.nextUrl.searchParams.get('menu') === '1'
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('landing_pages')
            .select('id, slug, title, content, created_at')
            .eq('status', 'published')
            .order('created_at', { ascending: true })

        if (error) {
            return NextResponse.json({ developments: [], groups: [], error: 'Nao foi possivel carregar os empreendimentos.' }, { status: 500 })
        }

        const pages = (data || []) as Array<Record<string, any>>
        const developments = sortDevelopments(
            pages
                .map(page => normalizeDevelopment(page))
                .filter((item: PublicDevelopment | null): item is PublicDevelopment => Boolean(item))
        )
        const groups = groupDevelopments(developments, menuMode ? MENU_GROUP_LIMIT : undefined)
        const responseDevelopments = menuMode
            ? groups.flatMap(group => group.developments)
            : developments

        return NextResponse.json({
            developments: responseDevelopments,
            groups,
            total: developments.length,
        })
    } catch {
        return NextResponse.json({ developments: [], groups: [], total: 0 })
    }
}
