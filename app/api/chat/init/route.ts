import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') // home, property, landing_page
        const id = searchParams.get('id') || searchParams.get('propertyId')
        const slug = searchParams.get('slug')
        const landingPageId = searchParams.get('landingPageId') // legacy

        const supabase = createAdminClient()

        // 1. Randomly select a Virtual Broker
        const { data: brokers } = await supabase
            .from('virtual_brokers')
            .select('*')
            .eq('is_active', true)

        const broker = brokers && brokers.length > 0
            ? brokers[Math.floor(Math.random() * brokers.length)]
            : { name: 'Guilherme Pilger', creci: 'CRECI 5555' }

        // 2. Generate Greeting based on Context
        let greeting = `Olá! Sou o corretor ${broker.name} (${broker.creci}). Como posso te ajudar hoje?`

        if (type === 'home') {
            greeting = `Olá! Bem-vindo à Pilger Imóveis. Sou ${broker.name}. Está buscando algum imóvel específico ou gostaria de ver nossos destaques?`
        } else if (type === 'property' && id) {
            const { data: property } = await supabase.from('properties').select('title').eq('id', id).maybeSingle()
            if (property) {
                greeting = `Olá! Sou ${broker.name}. Excelente escolha visitar o "${property.title}". Gostaria de saber mais detalhes ou agendar uma visita?`
            }
        } else if (((type === 'landing_page' || type === 'cloned_landing_page') && slug) || landingPageId) {
            // Try fetching by slug first, then ID
            let query = supabase.from('landing_pages').select('title, property:properties(title)')

            if (slug && slug !== 'preview') {
                query = query.eq('slug', slug)
            } else if (landingPageId && landingPageId !== 'preview') {
                query = query.eq('id', landingPageId)
            }

            const { data: lp } = await query.maybeSingle()

            if (lp) {
                const title = (lp.property as any)?.title || lp.title
                greeting = `Olá! Sou ${broker.name}. Vi que você se interessou por "${title}". Posso te contar os diferenciais dessa oportunidade?`
            }
        }

        // 3. Fetch timing configs for humanization
        const { data: timingConfigs } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', ['chat_delay_before_typing', 'chat_typing_min_duration', 'chat_typing_max_duration'])

        const configMap: Record<string, string> = {}
        timingConfigs?.forEach((c: { key: string; value: string }) => { configMap[c.key] = c.value })

        const timing = {
            delayBeforeTyping: parseInt(configMap['chat_delay_before_typing'] || '2') * 1000,
            typingMinDuration: parseInt(configMap['chat_typing_min_duration'] || '5') * 1000,
            typingMaxDuration: parseInt(configMap['chat_typing_max_duration'] || '7') * 1000,
        }

        return NextResponse.json({
            greeting,
            broker: {
                name: broker.name,
                creci: broker.creci,
                photo_url: broker.photo_url
            },
            timing
        })
    } catch (error) {
        console.error('Chat Init Error:', error)
        return NextResponse.json({ greeting: null, broker: null })
    }
}
