import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchPropertyPriceHistory } from '@/lib/properties/price-history'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

        const supabase = createAdminClient()
        const history = await fetchPropertyPriceHistory(supabase, id, 20)

        return NextResponse.json({ history })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
