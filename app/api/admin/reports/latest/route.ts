import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { searchParams } = new URL(req.url)
    const platform = searchParams.get('platform') // 'meta' | 'google' | null

    let query = supabase
      .from('pilger_ai_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data: latestReport, error } = await query.single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return NextResponse.json({ report: latestReport || null })
  } catch (error: any) {
    console.error('Error fetching latest report:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
