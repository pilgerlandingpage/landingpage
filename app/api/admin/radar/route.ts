import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data: radars, error } = await supabase
      .from('market_radars')
      .select('*, market_radar_data(*)')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ radars: radars || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { keyword, location } = await req.json()
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
