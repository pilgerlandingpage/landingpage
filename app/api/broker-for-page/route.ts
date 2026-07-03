import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Retorna o corretor IA atribuído a uma página específica.
 * 
 * Query: ?slug=home ou ?slug=brava-concetto
 * 
 * Lógica:
 * 1. Busca corretor IA com assigned_page_slugs contendo o slug
 * 2. Fallback: busca corretor com assignment_type = 'all'
 * 3. Se múltiplos, retorna o primeiro ativo
 */
export async function GET(request: NextRequest) {
    try {
        const slug = request.nextUrl.searchParams.get('slug') || ''
        const supabase = createAdminClient()

        interface BrokerRow {
            id: string; name: string; phone: string | null; photo_url: string | null
            greeting_message: string | null; assignment_type: string | null; assigned_page_slugs: string[] | null
        }

        // 1. Buscar corretores IA ativos
        const { data } = await supabase
            .from('virtual_brokers')
            .select('id, name, phone, photo_url, greeting_message, assignment_type, assigned_page_slugs')
            .eq('is_active', true)
            .order('name')

        const brokers = (data || []) as BrokerRow[]

        if (brokers.length === 0) {
            return NextResponse.json({ broker: null, message: 'Nenhum corretor IA ativo' })
        }

        // 2. Buscar corretor atribuído a esta página específica
        let matchedBroker = brokers.find(b =>
            b.assignment_type === 'landing_pages' &&
            b.assigned_page_slugs?.includes(slug)
        )

        // 3. Fallback: buscar corretor com rodízio geral
        if (!matchedBroker) {
            matchedBroker = brokers.find(b => b.assignment_type === 'all')
        }

        // 4. Último fallback: primeiro corretor ativo
        if (!matchedBroker) {
            matchedBroker = brokers[0]
        }

        return NextResponse.json({
            broker: {
                id: matchedBroker.id,
                name: matchedBroker.name,
                phone: matchedBroker.phone,
                photo_url: matchedBroker.photo_url,
                greeting_message: matchedBroker.greeting_message || 'Olá, gostaria de mais informações sobre os imóveis'
            }
        })
    } catch (error) {
        console.error('[broker-for-page] Erro:', error)
        return NextResponse.json({ broker: null, error: 'Erro interno' }, { status: 500 })
    }
}
