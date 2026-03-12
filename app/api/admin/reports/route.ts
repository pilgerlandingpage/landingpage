import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { searchParams } = new URL(req.url)
    const platform = searchParams.get('platform') // 'meta' | 'google' | 'all' | null
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    let query = supabase
      .from('pilger_ai_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (platform && platform !== 'all') {
      query = query.eq('platform', platform)
    }

    const { data: reports, error } = await query

    if (error) throw error

    return NextResponse.json({ reports: reports || [] })
  } catch (error: any) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
