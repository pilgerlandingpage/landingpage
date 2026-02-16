import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateChatResponse } from '@/lib/ai/generation'

import { PILGER_AI_PROMPT } from '@/lib/ai/prompts'

export const maxDuration = 60

export async function POST(req: NextRequest) {
    try {
        const { message, history } = await req.json()
        const supabase = createAdminClient()

        // 1. Get admin-configured prompts for Pilger AI
        const { data: pilgerConfigs } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', ['pilger_ai_system_prompt', 'pilger_ai_rules_prompt'])

        const pilgerConfigMap: Record<string, string> = {}
        pilgerConfigs?.forEach((c: { key: string; value: string }) => { pilgerConfigMap[c.key] = c.value })

        const basePrompt = pilgerConfigMap['pilger_ai_system_prompt'] || PILGER_AI_PROMPT
        const rulesPrompt = pilgerConfigMap['pilger_ai_rules_prompt']

        // Combine base + rules (if admin set custom rules, append them)
        const systemPrompt = rulesPrompt ? `${basePrompt}\n\n${rulesPrompt}` : basePrompt

        // 2. Generate AI Response
        const response = await generateChatResponse(history || [], message, systemPrompt, 'pilger')

        // 3. Extract feedback from conversation (lightweight check)
        const feedbackKeywords = ['sugest', 'melhori', 'poderia', 'deveria', 'seria bom', 'problema', 'bug', 'erro', 'não funciona', 'travou', 'parabéns', 'ótimo', 'excelente', 'adorei', 'dúvida', 'como faz', 'como faço', 'não consigo', 'não entendi']
        const lowerMsg = message.toLowerCase()
        const hasFeedback = feedbackKeywords.some(kw => lowerMsg.includes(kw))

        if (hasFeedback && history && history.length >= 2) {
            // Determine feedback type
            let feedbackType = 'outro'
            if (['sugest', 'melhori', 'poderia', 'deveria', 'seria bom'].some(kw => lowerMsg.includes(kw))) {
                feedbackType = 'sugestao'
            } else if (['problema', 'bug', 'erro', 'não funciona', 'travou'].some(kw => lowerMsg.includes(kw))) {
                feedbackType = 'bug'
            } else if (['parabéns', 'ótimo', 'excelente', 'adorei'].some(kw => lowerMsg.includes(kw))) {
                feedbackType = 'elogio'
            } else if (['dúvida', 'como faz', 'como faço', 'não consigo', 'não entendi'].some(kw => lowerMsg.includes(kw))) {
                feedbackType = 'duvida'
            }

            // Build conversation log
            const conversationLog = (history || [])
                .map((msg: any) => `${msg.role === 'user' ? 'Usuário' : 'Pilger AI'}: ${msg.content}`)
                .join('\n') + `\nUsuário: ${message}\nPilger AI: ${response}`

            // Extract user name from conversation
            let userName: string | null = null
            for (const msg of history) {
                const nameMatch = msg.content?.match(/(?:me chamo|meu nome é|sou o|sou a)\s+(\w+)/i)
                if (nameMatch) {
                    userName = nameMatch[1]
                    break
                }
            }

            // Save feedback
            await supabase.from('user_feedback').insert({
                type: feedbackType,
                content: message,
                conversation_log: conversationLog,
                user_name: userName,
                status: 'novo'
            })
        }

        return NextResponse.json({ response })

    } catch (error: any) {
        console.error('Pilger AI Error:', error)
        return NextResponse.json({
            error: 'Desculpe, estou indisponível no momento.',
            details: error.message || String(error)
        }, { status: 500 })
    }
}
