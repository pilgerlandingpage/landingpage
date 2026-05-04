import { NextRequest, NextResponse } from 'next/server'
import { deleteFile } from '@/lib/r2'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * DELETE /api/upload/delete
 * Deletes a file from Cloudflare R2 by its public URL or key.
 * Body: { url: string } — the public R2 URL of the file to delete
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { url } = await request.json()

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        // Extract the R2 key from the full URL
        // URL format: https://domain.com/folder/filename.ext
        // We need just: folder/filename.ext
        const r2PublicUrl = process.env.R2_PUBLIC_URL || ''
        let key = url

        if (r2PublicUrl && url.startsWith(r2PublicUrl)) {
            key = url.replace(r2PublicUrl + '/', '').replace(r2PublicUrl, '')
        } else {
            // Try to extract path after the domain
            try {
                const parsed = new URL(url)
                key = parsed.pathname.replace(/^\//, '')
            } catch {
                // If it's not a full URL, assume it's already a key
            }
        }

        if (!key) {
            return NextResponse.json({ error: 'Could not determine file key from URL' }, { status: 400 })
        }

        await deleteFile(key)

        return NextResponse.json({ success: true, key })
    } catch (error: any) {
        console.error('Delete file error:', error?.message || error)
        return NextResponse.json(
            { error: 'Delete failed', details: error?.message || String(error) },
            { status: 500 }
        )
    }
}
