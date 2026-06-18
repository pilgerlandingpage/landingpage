import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { deleteFile } from '@/lib/r2'
import { notifyPropertyReviewReady } from '@/lib/properties/review-notifications'
import { recordPropertyPriceHistory } from '@/lib/properties/price-history'
import { processPropertySearchAlerts } from '@/lib/properties/search-alert-matcher'

const PROPERTY_TEXT_FIELDS = ['title', 'description', 'seo_title', 'seo_description'] as const

function normalizeBedroomText(value: string) {
    return value
        .replace(/\bQUARTOS\b/g, 'DORMITÓRIOS')
        .replace(/\bQuartos\b/g, 'Dormitórios')
        .replace(/\bquartos\b/g, 'dormitórios')
        .replace(/\bQUARTO\b/g, 'DORMITÓRIO')
        .replace(/\bQuarto\b/g, 'Dormitório')
        .replace(/\bquarto\b/g, 'dormitório')
}

function normalizePropertyPayload(payload: Record<string, any>) {
    const normalized = { ...payload }

    for (const field of PROPERTY_TEXT_FIELDS) {
        if (typeof normalized[field] === 'string') {
            normalized[field] = normalizeBedroomText(normalized[field])
        }
    }

    if (Array.isArray(normalized.amenities)) {
        normalized.amenities = normalized.amenities.map((item: unknown) => (
            typeof item === 'string' ? normalizeBedroomText(item) : item
        ))
    }

    return normalized
}

async function processSearchAlertsSafely(supabase: any, property: any, source: string) {
    if (property?.status !== 'active') {
        return { processed: false, skipped_reason: 'property_not_active' }
    }

    try {
        return await processPropertySearchAlerts(supabase, property, { source })
    } catch (error) {
        console.warn('[Admin Properties] search alert processing skipped:', error)
        return {
            processed: false,
            skipped_reason: 'search_alert_processing_failed',
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const { searchParams } = request.nextUrl
        const status = searchParams.get('status')
        const type = searchParams.get('type')
        const city = searchParams.get('city')
        const q = searchParams.get('q')?.trim()

        const data: any[] = []
        const pageSize = 1000
        for (let from = 0; ; from += pageSize) {
            let query = supabase
                .from('properties')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, from + pageSize - 1)

            if (status && status !== 'all') query = query.eq('status', status)
            if (type && type !== 'all') query = query.eq('property_type', type)
            if (city && city !== 'all') query = query.eq('city', city)
            if (q) {
                const escaped = q.replace(/[%_]/g, '\\$&')
                query = query.or([
                    `title.ilike.%${escaped}%`,
                    `city.ilike.%${escaped}%`,
                    `neighborhood.ilike.%${escaped}%`,
                    `property_type.ilike.%${escaped}%`,
                    `owner_name.ilike.%${escaped}%`,
                    `owner_phone.ilike.%${escaped}%`,
                    `source_reference.ilike.%${escaped}%`,
                ].join(','))
            }

            const { data: page, error } = await query

            if (error) throw error
            data.push(...(page || []))
            if (!page || page.length < pageSize) break
        }

        const normalized = data.map((property: any) => {
            const images = Array.isArray(property.images)
                ? property.images.filter(Boolean)
                : []

            return {
                ...property,
                images,
                featured_image: property.featured_image || images[0] || null,
            }
        })

        return NextResponse.json(normalized)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const supabase = createAdminClient()
        const insertBody = normalizePropertyPayload({
            ...body,
            status: body?.status || 'under_review',
        })

        const { data, error } = await supabase
            .from('properties')
            .insert(insertBody)
            .select()
            .single()

        if (error) throw error
        await recordPropertyPriceHistory(supabase, {
            property: data,
            eventType: 'listed',
            source: 'admin_create',
            metadata: {
                status: data?.status || null,
                created_via: body?.source_payload?.created_by || 'admin_form',
            },
        })

        const shouldNotifyReview = data?.status !== 'active'
        const notification = shouldNotifyReview
            ? await notifyPropertyReviewReady({
                supabase,
                property: data,
                origin: request.nextUrl.origin,
            })
            : { sent: false, skipped: true, reason: 'Imovel criado como ativo.' }
        const searchAlerts = await processSearchAlertsSafely(supabase, data, 'admin_create')

        return NextResponse.json({ property: data, notification, search_alerts: searchAlerts }, { status: 201 })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, ...updateData } = body
        if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

        const supabase = createAdminClient()
        const { data: previousProperty, error: previousError } = await supabase
            .from('properties')
            .select('id,title,city,neighborhood,status,source_reference,price,condo_fee,iptu,area_m2,area_private_m2')
            .eq('id', id)
            .single()

        if (previousError) throw previousError

        const normalizedUpdateData = normalizePropertyPayload(updateData)
        const { data, error } = await supabase
            .from('properties')
            .update(normalizedUpdateData)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        await recordPropertyPriceHistory(supabase, {
            property: data,
            previousProperty,
            source: 'admin_update',
            metadata: {
                status_before: previousProperty?.status || null,
                status_after: data?.status || null,
            },
        })
        const searchAlerts = await processSearchAlertsSafely(supabase, data, 'admin_update')

        return NextResponse.json({ ...data, search_alerts: searchAlerts })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

        const supabase = createAdminClient()

        // Fetch the property first to get image URLs for R2 cleanup
        const { data: property } = await supabase
            .from('properties')
            .select('featured_image, images')
            .eq('id', id)
            .single()

        // Delete the property from the database
        const { error } = await supabase
            .from('properties')
            .delete()
            .eq('id', id)

        if (error) throw error

        // Clean up R2 files in the background (don't block the response)
        if (property) {
            const r2PublicUrl = process.env.R2_PUBLIC_URL || ''
            const urlsToDelete: string[] = []

            if (property.featured_image) urlsToDelete.push(property.featured_image)
            if (Array.isArray(property.images)) {
                urlsToDelete.push(...property.images.filter(Boolean))
            }

            // Extract R2 keys and delete files
            const uniqueUrls = [...new Set(urlsToDelete)]
            for (const url of uniqueUrls) {
                try {
                    let key = url
                    if (r2PublicUrl && url.startsWith(r2PublicUrl)) {
                        key = url.replace(r2PublicUrl + '/', '').replace(r2PublicUrl, '')
                    } else {
                        try {
                            const parsed = new URL(url)
                            key = parsed.pathname.replace(/^\//, '')
                        } catch { /* not a URL, skip */ }
                    }
                    if (key) await deleteFile(key)
                } catch (e) {
                    console.error(`Failed to delete R2 file: ${url}`, e)
                }
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
