import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()

        // 1. Authorization Check
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Ideally check for admin role here too
        // const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        // if (profile?.role !== 'admin') ...

        const body = await request.json()
        const { url, customPrompt, title } = body

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 })
        }

        // 2. Generate Slug (simplistic for now)
        // In a real scenario, the scraper might refine this later, but we need one to start.
        // We might update it after scraping title.
        const tempSlug = `cloned-${uuidv4().substring(0, 8)}`

        // 3. Create Record in DB
        const { data: page, error: dbError } = await supabase
            .from('landing_pages')
            .insert({
                original_url: url,
                custom_prompt: customPrompt,
                status: 'queued',
                slug: tempSlug,
                title: title || 'Cloning in progress...',
            })
            .select()
            .single()

        if (dbError) {
            console.error('DB Error:', dbError)
            return NextResponse.json({ error: 'Failed to create page record', details: dbError.message }, { status: 500 })
        }

        // 4. Trigger Inngest Event
        await inngest.send({
            name: 'cloner/process-url',
            data: {
                pageId: page.id,
                url,
                customPrompt,
                userId: user.id
            },
        })

        return NextResponse.json({
            success: true,
            message: 'Cloning job started',
            jobId: page.id
        })

    } catch (error) {
        console.error('API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
