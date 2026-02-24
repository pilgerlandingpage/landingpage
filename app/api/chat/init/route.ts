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

        // 1. Select a Virtual Broker based on Duty Schedule
        const today = new Date()
        const todayDateStr = today.toISOString().split('T')[0] // YYYY-MM-DD
        const todayWeekday = today.getDay() // 0-6 (Sun-Sat)

        // Try to find brokers scheduled for today (either specific date or weekday)
        let { data: priorityBrokers } = await supabase
            .from('virtual_brokers')
            .select('*')
            .eq('is_active', true)
            .or(`duty_dates.cs.[{"${todayDateStr}"}],duty_weekdays.cs.[${todayWeekday}]`)

        // Fallback: If no priority broker, get all active brokers
        if (!priorityBrokers || priorityBrokers.length === 0) {
            const { data } = await supabase
                .from('virtual_brokers')
                .select('*')
                .eq('is_active', true)
            priorityBrokers = data
        }

        const broker = priorityBrokers && priorityBrokers.length > 0
            ? priorityBrokers[Math.floor(Math.random() * priorityBrokers.length)]
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

        // 3. Fetch timing configs for humanization + auto-open delays
        const { data: timingConfigs } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', [
                'chat_delay_before_typing', 'chat_typing_min_duration', 'chat_typing_max_duration',
                'concierge_delay_home', 'concierge_delay_property', 'concierge_delay_landing_page',
                'concierge_connection_search_delay', 'concierge_connection_found_delay', 'concierge_connection_connecting_delay'
            ])

        const configMap: Record<string, string> = {}
        timingConfigs?.forEach((c: { key: string; value: string }) => { configMap[c.key] = c.value })

        const timing = {
            delayBeforeTyping: parseInt(configMap['chat_delay_before_typing'] || '2') * 1000,
            typingMinDuration: parseInt(configMap['chat_typing_min_duration'] || '5') * 1000,
            typingMaxDuration: parseInt(configMap['chat_typing_max_duration'] || '7') * 1000,
            connectionSearchDelay: parseFloat(configMap['concierge_connection_search_delay'] || '1.5') * 1000,
            connectionFoundDelay: parseFloat(configMap['concierge_connection_found_delay'] || '1') * 1000,
            connectionConnectingDelay: parseFloat(configMap['concierge_connection_connecting_delay'] || '1.2') * 1000,
        }

        // Auto-open delay per page type (in milliseconds)
        const pageType = type || 'home'
        const delayKey = pageType === 'property' ? 'concierge_delay_property'
            : (pageType === 'landing_page' || pageType === 'cloned_landing_page') ? 'concierge_delay_landing_page'
                : 'concierge_delay_home'
        const autoOpenDelay = parseInt(configMap[delayKey] || (pageType === 'property' ? '5' : pageType === 'home' ? '15' : '10')) * 1000

        return NextResponse.json({
            greeting,
            broker: {
                name: broker.name,
                creci: broker.creci,
                photo_url: broker.photo_url
            },
            timing,
            autoOpenDelay
        })
    } catch (error) {
        console.error('Chat Init Error:', error)
        return NextResponse.json({ greeting: null, broker: null })
    }
}
