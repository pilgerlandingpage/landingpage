import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { deleteFile } from '@/lib/r2'

export async function GET() {
    try {
        const supabase = createAdminClient()

        const data: any[] = []
        const pageSize = 1000
        for (let from = 0; ; from += pageSize) {
            const { data: page, error } = await supabase
                .from('properties')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, from + pageSize - 1)

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

        const { data, error } = await supabase
            .from('properties')
            .insert(body)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data, { status: 201 })
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
        const { data, error } = await supabase
            .from('properties')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json(data)
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
