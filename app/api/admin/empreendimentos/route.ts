import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('empreendimentos')
            .select('id, nome, slug, ativo, created_at')
            .order('nome', { ascending: true })

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ data: data || [] })
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()
        const nome = String(body?.nome || '').trim()
        const slug = String(body?.slug || nome)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')

        if (!nome || !slug) {
            return NextResponse.json({ error: 'nome e slug são obrigatórios' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('empreendimentos')
            .insert([{ nome, slug, ativo: body?.ativo ?? true }])
            .select('id, nome, slug, ativo')
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ data })
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

        const { error } = await supabase.from('empreendimentos').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
