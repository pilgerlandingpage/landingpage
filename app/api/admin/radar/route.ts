import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const supabase = getSupabase()
    const { data: radars, error } = await supabase
      .from('market_radars')
      .select('*, market_radar_data(*)')
      .order('created_at', { ascending: false })

    if (error) throw error

    const radarIds = (radars || []).map((radar: any) => radar.id)
    let insightsByRadar: Record<string, any[]> = {}
    if (radarIds.length > 0) {
      const { data: insights, error: insightsError } = await supabase
        .from('market_radar_insights')
        .select('*')
        .in('radar_id', radarIds)

      if (!insightsError) {
        insightsByRadar = (insights || []).reduce((acc: Record<string, any[]>, insight: any) => {
          acc[insight.radar_id] = acc[insight.radar_id] || []
          acc[insight.radar_id].push(insight)
          return acc
        }, {})
      } else {
        console.warn('[Radar] Insights table unavailable:', insightsError.message)
      }
    }

    // Sort market_radar_data manually by date and then time_slot if needed
    // or improve the query if Supabase allowed sub-ordering easily
    const sortedRadars = (radars || []).map(r => ({
      ...r,
      market_radar_data: (r.market_radar_data || []).sort((a: any, b: any) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.time_slot || '').localeCompare(b.time_slot || '')
      }),
      market_radar_insights: (insightsByRadar[r.id] || []).sort((a: any, b: any) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.time_slot || '').localeCompare(b.time_slot || '')
      })
    }))

    return NextResponse.json({ radars: sortedRadars })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase()
    const body = await req.json()
    const { keyword, location, action } = body

    // Coleta manual
    if (action === 'collect') {
      const { collectMarketRadarData } = await import('@/lib/ai/pilger-ceo')
      const results = await collectMarketRadarData()
      return NextResponse.json({ success: true, collected: results.length })
    }

    if (!keyword) return NextResponse.json({ error: 'Keyword is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('market_radars')
      .insert({ keyword, location: location || 'BR', is_active: true })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ radar: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const { error } = await supabase
      .from('market_radars')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
