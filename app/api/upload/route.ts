import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/r2'
import { createServerSupabase } from '@/lib/supabase/server'

const MB = 1024 * 1024
const UPLOAD_LIMITS = {
    image: 5 * MB,
    video: 16 * MB,
    document: 100 * MB,
    audio: 16 * MB,
    default: 25 * MB,
}

const MAX_REQUEST_SIZE = Math.max(...Object.values(UPLOAD_LIMITS))

function inferKind(fileType: string, folder: string, requestedKind: string) {
    if (['image', 'video', 'document', 'audio'].includes(requestedKind)) return requestedKind as keyof typeof UPLOAD_LIMITS
    if (fileType.startsWith('image/')) return 'image'
    if (fileType.startsWith('video/')) return 'video'
    if (fileType.startsWith('audio/')) return 'audio'
    if (folder.includes('document')) return 'document'
    return 'default'
}

function formatMb(bytes: number) {
    return `${Math.round(bytes / MB)}MB`
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const contentLength = Number(request.headers.get('content-length') || 0)
        if (contentLength > MAX_REQUEST_SIZE + 1024 * 1024) {
            return NextResponse.json(
                { error: `File too large. Maximum ${formatMb(MAX_REQUEST_SIZE)}` },
                { status: 413 }
            )
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const folder = (formData.get('folder') as string) || 'uploads'
        const requestedKind = String(formData.get('kind') || '')

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 })
        }

        // Validate file type (use startsWith to handle codec suffixes like audio/webm;codecs=opus)
        const allowedPrefixes = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
            'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg',
            'video/mp4', 'video/webm',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain', 'text/csv',
        ]
        const fileType = file.type.split(';')[0].trim() // Strip codec info e.g. audio/webm;codecs=opus -> audio/webm
        if (!allowedPrefixes.includes(fileType)) {
            console.error('[Upload] Rejected file type:', file.type, '| Stripped:', fileType)
            return NextResponse.json(
                { error: `Invalid file type: ${file.type}. Allowed: images, audio, video, documents` },
                { status: 400 }
            )
        }

        const kind = inferKind(fileType, folder, requestedKind)
        const maxSize = UPLOAD_LIMITS[kind] || UPLOAD_LIMITS.default
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `File too large for ${kind}. Maximum ${formatMb(maxSize)}` },
                { status: 400 }
            )
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await uploadFile(buffer, file.name, folder, file.type)

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Upload error:', error?.message || error)
        console.error('Upload error name:', error?.name)
        console.error('Upload error code:', error?.Code || error?.$metadata)
        return NextResponse.json({ error: 'Upload failed', details: error?.message || String(error) }, { status: 500 })
    }
}
