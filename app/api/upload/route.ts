import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/r2'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const folder = (formData.get('folder') as string) || 'uploads'

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 })
        }

        // Validate file type (use startsWith to handle codec suffixes like audio/webm;codecs=opus)
        const allowedPrefixes = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
            'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg',
            'video/mp4', 'video/webm',
        ]
        const fileType = file.type.split(';')[0].trim() // Strip codec info e.g. audio/webm;codecs=opus -> audio/webm
        if (!allowedPrefixes.includes(fileType)) {
            console.error('[Upload] Rejected file type:', file.type, '| Stripped:', fileType)
            return NextResponse.json(
                { error: `Invalid file type: ${file.type}. Allowed: images, audio, video` },
                { status: 400 }
            )
        }

        // Validate file size (max 25MB)
        const MAX_SIZE = 25 * 1024 * 1024
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: 'File too large. Maximum 25MB' },
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
