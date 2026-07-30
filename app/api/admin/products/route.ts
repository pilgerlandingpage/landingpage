import { NextRequest, NextResponse } from 'next/server'
import { requireAdminModules } from '@/lib/admin/require-admin'

export const dynamic = 'force-dynamic'

type ProductType = 'ebook' | 'course' | 'mentorship' | 'bundle' | 'digital_download'
type ProductStatus = 'draft' | 'active' | 'hidden' | 'archived'
type OfferStatus = 'draft' | 'active' | 'paused' | 'archived'
type ContentType = 'module' | 'lesson' | 'video' | 'pdf' | 'ebook' | 'bonus' | 'external_link'

const PRODUCT_TYPES = new Set<ProductType>(['ebook', 'course', 'mentorship', 'bundle', 'digital_download'])
const PRODUCT_STATUS = new Set<ProductStatus>(['draft', 'active', 'hidden', 'archived'])
const OFFER_STATUS = new Set<OfferStatus>(['draft', 'active', 'paused', 'archived'])
const CONTENT_TYPES = new Set<ContentType>(['module', 'lesson', 'video', 'pdf', 'ebook', 'bonus', 'external_link'])

function text(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function nullableText(value: unknown) {
    const cleaned = text(value)
    return cleaned || null
}

function slugify(value: unknown) {
    return text(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function cents(value: unknown, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.round(value))
    }

    const raw = text(value)
    if (!raw) return fallback

    const parsed = Number(raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(0, Math.round(parsed * 100))
}

function intValue(value: unknown, fallback = 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

function boolValue(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') return value === 'true'
    return fallback
}

function metadata(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function productPayload(body: any) {
    const title = text(body?.title)
    const slug = slugify(body?.slug || title)
    if (!title) throw new Error('Título do produto é obrigatório.')
    if (!slug) throw new Error('Slug do produto é obrigatório.')

    const product_type = PRODUCT_TYPES.has(body?.product_type) ? body.product_type as ProductType : 'course'
    const status = PRODUCT_STATUS.has(body?.status) ? body.status as ProductStatus : 'draft'

    return {
        slug,
        title,
        subtitle: nullableText(body?.subtitle),
        description: nullableText(body?.description),
        product_type,
        status,
        access_model: body?.access_model === 'limited_time' || body?.access_model === 'subscription' ? body.access_model : 'lifetime',
        cover_image_url: nullableText(body?.cover_image_url),
        thumbnail_url: nullableText(body?.thumbnail_url ?? body?.cover_image_url),
        sales_content: metadata(body?.sales_content),
        metadata: metadata(body?.metadata),
        updated_at: new Date().toISOString(),
    }
}

function offerPayload(body: any) {
    const name = text(body?.name)
    const product_id = text(body?.product_id)
    const slug = slugify(body?.slug || name)
    if (!product_id) throw new Error('Produto da oferta é obrigatório.')
    if (!name) throw new Error('Nome da oferta é obrigatório.')
    if (!slug) throw new Error('Slug da oferta é obrigatório.')

    const status = OFFER_STATUS.has(body?.status) ? body.status as OfferStatus : 'draft'
    const rawPaymentMethods = Array.isArray(body?.payment_methods) ? body.payment_methods : ['pix']
    const payment_methods = rawPaymentMethods.map((item: unknown) => text(item)).filter(Boolean)

    return {
        product_id,
        landing_page_id: nullableText(body?.landing_page_id),
        slug,
        name,
        description: nullableText(body?.description),
        status,
        price_cents: cents(body?.price_cents ?? body?.price),
        currency: text(body?.currency, 'BRL').slice(0, 3).toUpperCase(),
        checkout_path: nullableText(body?.checkout_path),
        payment_methods: payment_methods.length ? payment_methods : ['pix'],
        max_installments: Math.max(1, intValue(body?.max_installments, 1)),
        starts_at: nullableText(body?.starts_at),
        ends_at: nullableText(body?.ends_at),
        metadata: metadata(body?.metadata),
        updated_at: new Date().toISOString(),
    }
}

function contentPayload(body: any) {
    const product_id = text(body?.product_id)
    const title = text(body?.title)
    if (!product_id) throw new Error('Produto do conteúdo é obrigatório.')
    if (!title) throw new Error('Título do conteúdo é obrigatório.')

    const content_type = CONTENT_TYPES.has(body?.content_type) ? body.content_type as ContentType : 'lesson'

    return {
        product_id,
        parent_id: nullableText(body?.parent_id),
        content_type,
        title,
        description: nullableText(body?.description),
        body: nullableText(body?.body),
        asset_url: nullableText(body?.asset_url),
        asset_storage_path: nullableText(body?.asset_storage_path),
        duration_seconds: intValue(body?.duration_seconds, 0) || null,
        position: intValue(body?.position, 0),
        is_preview: boolValue(body?.is_preview, false),
        is_active: boolValue(body?.is_active, true),
        metadata: metadata(body?.metadata),
        updated_at: new Date().toISOString(),
    }
}

function bumpPayload(body: any) {
    const offer_id = text(body?.offer_id)
    const bump_product_id = text(body?.bump_product_id)
    const title = text(body?.title)
    if (!offer_id) throw new Error('Oferta principal é obrigatória.')
    if (!bump_product_id) throw new Error('Produto do order bump é obrigatório.')
    if (!title) throw new Error('Título do order bump é obrigatório.')

    return {
        offer_id,
        bump_product_id,
        bump_offer_id: nullableText(body?.bump_offer_id),
        title,
        description: nullableText(body?.description),
        price_cents: cents(body?.price_cents ?? body?.price),
        is_active: boolValue(body?.is_active, true),
        position: intValue(body?.position, 0),
        metadata: metadata(body?.metadata),
        updated_at: new Date().toISOString(),
    }
}

export async function GET() {
    try {
        const auth = await requireAdminModules(['products', 'commerce', 'maintenance'])
        if (!auth.ok) return auth.response

        const supabase = auth.admin
        const [
            productsRes,
            offersRes,
            contentsRes,
            bumpsRes,
            landingPagesRes,
        ] = await Promise.all([
            supabase.from('commerce_products').select('*').order('updated_at', { ascending: false }),
            supabase.from('commerce_offers').select('*').order('updated_at', { ascending: false }),
            supabase.from('commerce_product_contents').select('*').order('product_id').order('position').order('created_at'),
            supabase.from('commerce_order_bumps').select('*').order('offer_id').order('position').order('created_at'),
            supabase.from('landing_pages').select('id, slug, title, status, page_type').eq('page_type', 'product').order('title'),
        ])

        const error = productsRes.error || offersRes.error || contentsRes.error || bumpsRes.error || landingPagesRes.error
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        return NextResponse.json({
            products: productsRes.data || [],
            offers: offersRes.data || [],
            contents: contentsRes.data || [],
            order_bumps: bumpsRes.data || [],
            landing_pages: landingPagesRes.data || [],
        })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminModules(['products', 'commerce', 'maintenance'])
        if (!auth.ok) return auth.response

        const supabase = auth.admin
        const body = await request.json()
        const resource = text(body?.resource, 'product')

        if (resource === 'product') {
            const payload = productPayload(body)
            const { data, error } = await supabase
                .from('commerce_products')
                .insert([{ ...payload, created_at: new Date().toISOString() }])
                .select()
                .single()
            if (error) throw error
            return NextResponse.json({ success: true, data })
        }

        if (resource === 'offer') {
            const payload = offerPayload(body)
            const { data, error } = await supabase
                .from('commerce_offers')
                .insert([{ ...payload, created_at: new Date().toISOString() }])
                .select()
                .single()
            if (error) throw error
            return NextResponse.json({ success: true, data })
        }

        if (resource === 'content') {
            const payload = contentPayload(body)
            const { data, error } = await supabase
                .from('commerce_product_contents')
                .insert([{ ...payload, created_at: new Date().toISOString() }])
                .select()
                .single()
            if (error) throw error
            return NextResponse.json({ success: true, data })
        }

        if (resource === 'order_bump') {
            const payload = bumpPayload(body)
            const { data, error } = await supabase
                .from('commerce_order_bumps')
                .insert([{ ...payload, created_at: new Date().toISOString() }])
                .select()
                .single()
            if (error) throw error
            return NextResponse.json({ success: true, data })
        }

        return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const auth = await requireAdminModules(['products', 'commerce', 'maintenance'])
        if (!auth.ok) return auth.response

        const supabase = auth.admin
        const body = await request.json()
        const id = text(body?.id)
        const resource = text(body?.resource, 'product')
        if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })

        const table = resource === 'product'
            ? 'commerce_products'
            : resource === 'offer'
                ? 'commerce_offers'
                : resource === 'content'
                    ? 'commerce_product_contents'
                    : resource === 'order_bump'
                        ? 'commerce_order_bumps'
                        : ''

        if (!table) return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 })

        const payload = resource === 'product'
            ? productPayload(body)
            : resource === 'offer'
                ? offerPayload(body)
                : resource === 'content'
                    ? contentPayload(body)
                    : bumpPayload(body)

        const { data, error } = await supabase
            .from(table)
            .update(payload)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}
