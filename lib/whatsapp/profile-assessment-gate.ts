import { generateChatResponse } from '@/lib/ai/generation'
import { getPublicAppUrl } from '@/lib/app-url'

export const PROFILE_ASSESSMENT_VOTE_URL = 'https://awards.atrincarealestate.com.br/#/categoria/influenciador-do-ano/candidato/2ba4d003-3f4b-4d1a-b079-43c8a253c9b7'
export const PROFILE_ASSESSMENT_TOOL_PATH = '/eventos/perfil-corretor-ideal-ao-vivo/perfil-corretor-ideal'
export const PROFILE_ASSESSMENT_GATE_PREFIX = 'profile_assessment_tool_gate'

export type ProfileAssessmentIntentResult = {
    matched: boolean
    method: 'keyword' | 'semantic' | 'none' | 'error'
    confidence: number
    reason: string
}

function normalizePhoneDigits(value: unknown) {
    return String(value || '').replace(/\D/g, '')
}

export function normalizeProfileAssessmentIntentText(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

export function isProfileAssessmentToolRequestByKeyword(text: string) {
    const normalized = normalizeProfileAssessmentIntentText(text)
    const looksLikePropertyLead = /\b(avaliar|avaliacao|vender|venda|comprar|compra|procurando|busco|quero|tenho|anunciar|captar)\b[\s\S]{0,32}\b(meu|minha|imovel|imoveis|apartamento|casa|terreno|cobertura|sala|loja)\b/.test(normalized)
        || /\b(meu|minha)\s+(imovel|apartamento|casa|terreno|cobertura|sala|loja)\b/.test(normalized)
    const hasCampaignShortcut = /\b(perfil do corretor ideal|perfil do corretor ideial|corretor ideal|corretor ideial|analise do corretor|avaliacao do corretor|autoavaliacao do corretor|teste do corretor|diagnostico do corretor|relatorio do corretor|ferramenta do guilherme)\b/.test(normalized)
    if (hasCampaignShortcut) return true
    if (looksLikePropertyLead) return false

    const hasToolIntent = /\b(ferramenta|analise|avaliacao|autoavaliacao|teste|diagnostico|perfil|metodo|relatorio)\b/.test(normalized)
    const hasBrokerContext = /\b(corretor|corretores|corretagem|vendedor|profissional imobiliario)\b/.test(normalized)
    return hasToolIntent && hasBrokerContext
}

export function isProfileAssessmentAwaitingProofFollowUp(text: string) {
    const normalized = normalizeProfileAssessmentIntentText(text)
    if (!normalized.trim()) return false

    if (/\b(print|screenshot|comprovante|confirmacao|confirmar|voto|votei|votar|votacao|ja votei|ja fiz|fiz o voto|influenciador|guilherme pilger)\b/.test(normalized)) {
        return true
    }

    if (/\b(perfil do corretor ideal|perfil do corretor ideial|corretor ideal|corretor ideial|analise do corretor|avaliacao do corretor|autoavaliacao do corretor|teste do corretor|diagnostico do corretor|relatorio do corretor|ferramenta do guilherme)\b/.test(normalized)) {
        return true
    }

    const asksForAccess = /\b(link|acesso|acessar|libera|liberar|libere|manda|mandar|envia|enviar|abre|abrir|ferramenta|analise|avaliacao|autoavaliacao|teste|diagnostico|relatorio)\b/.test(normalized)
    if (!asksForAccess) return false

    const hasBrokerContext = /\b(corretor|corretores|corretagem|imobiliario|ideal|guilherme|video|reels|instagram|youtube)\b/.test(normalized)
    if (hasBrokerContext) return true

    const looksLikePropertyLead = /\b(imovel|imoveis|apartamento|casa|terreno|cobertura|sala|loja|comprar|vender|alugar|locacao|visita|endereco|localizacao|bairro|preco|valor)\b/.test(normalized)
    return !looksLikePropertyLead && normalized.length <= 120
}

function shouldRunSemanticClassifier(text: string) {
    const normalized = normalizeProfileAssessmentIntentText(text)
    if (normalized.length < 3) return false
    if (/^\s*(oi|ola|ol[aá]|bom dia|boa tarde|boa noite|tudo bem)\s*[!.?]*\s*$/.test(normalized)) return false

    const likelyPropertyService = /\b(avaliar|avaliacao|vender|venda|comprar|compra|procurando|busco|anunciar|captar)\b[\s\S]{0,40}\b(meu|minha|imovel|imoveis|apartamento|casa|terreno|cobertura|sala|loja)\b/.test(normalized)
        || /\b(meu|minha)\s+(imovel|apartamento|casa|terreno|cobertura|sala|loja)\b/.test(normalized)
    if (likelyPropertyService && !/\b(corretor ideal|corretor ideial|perfil do corretor|ferramenta do guilherme)\b/.test(normalized)) return false

    return /\b(ferramenta|analise|avaliacao|autoavaliacao|teste|diagnostico|perfil|corretor|corretagem|ideal|nota|metodo|guilherme|video|reels|instagram|youtube|whatsapp|zap|libera|liberar|acesso|quero|manda|mandar|conhecer|fazer|participar)\b/.test(normalized)
}

function extractJsonObject(text: string) {
    const cleaned = String(text || '').trim()
    const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    const candidate = fenced || cleaned.match(/\{[\s\S]*\}/)?.[0] || cleaned
    return JSON.parse(candidate)
}

export async function detectProfileAssessmentToolIntent(params: {
    text: string
    configs?: Record<string, string> | null
}): Promise<ProfileAssessmentIntentResult> {
    const text = String(params.text || '').trim()
    if (!text) {
        return { matched: false, method: 'none', confidence: 0, reason: 'empty_text' }
    }

    if (isProfileAssessmentToolRequestByKeyword(text)) {
        return { matched: true, method: 'keyword', confidence: 0.95, reason: 'keyword_match' }
    }

    if (!shouldRunSemanticClassifier(text)) {
        return { matched: false, method: 'none', confidence: 0, reason: 'no_campaign_signal' }
    }

    try {
        const configs = params.configs || {}
        const provider = configs['ai_provider'] === 'openai' ? 'openai' : 'gemini'
        const raw = await generateChatResponse(
            [],
            [
                'Mensagem do lead no WhatsApp:',
                text,
            ].join('\n'),
            [
                'Você classifica intenções de leads da campanha de Guilherme Pilger.',
                'Responda somente JSON válido, sem markdown.',
                '',
                'Objetivo: dizer se o lead está pedindo acesso à ferramenta gratuita Perfil do Corretor Ideal, também chamada de ferramenta de análise, avaliação, autoavaliação, diagnóstico, teste ou relatório do corretor.',
                '',
                'Marque wants_tool=true quando a pessoa pedir, mencionar ou demonstrar querer:',
                '- a ferramenta/análise/avaliação/teste/diagnóstico do corretor;',
                '- o Perfil do Corretor Ideal;',
                '- o link prometido no vídeo, reels, story, Instagram, YouTube ou WhatsApp do Guilherme sobre corretor/corretagem;',
                '- "quero fazer", "me manda", "libera o acesso" quando o contexto indicar a ferramenta da campanha.',
                '',
                'Marque false quando a pessoa pedir avaliação de imóvel, quiser comprar/vender/anunciar um imóvel, pedir atendimento imobiliário comum, suporte administrativo, financeiro, agenda, blog ou outro assunto sem relação com a ferramenta.',
                '',
                'Formato exato:',
                '{"wants_tool":true|false,"confidence":0.0,"reason":"curto"}',
            ].join('\n'),
            {
                provider,
                geminiModel: configs['gemini_model'] || undefined,
                openaiModel: configs['openai_model'] || undefined,
            }
        )
        const parsed = extractJsonObject(raw)
        const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence || 0)))
        const matched = parsed?.wants_tool === true && confidence >= 0.65
        return {
            matched,
            method: 'semantic',
            confidence,
            reason: String(parsed?.reason || (matched ? 'semantic_match' : 'semantic_no_match')).slice(0, 240),
        }
    } catch (error: any) {
        return {
            matched: false,
            method: 'error',
            confidence: 0,
            reason: error?.message || String(error),
        }
    }
}

export function profileAssessmentGateKey(phone: string) {
    return `${PROFILE_ASSESSMENT_GATE_PREFIX}_${normalizePhoneDigits(phone)}`
}

export function profileAssessmentToolUrl(origin: string | null | undefined, phone: string) {
    const url = new URL(PROFILE_ASSESSMENT_TOOL_PATH, getPublicAppUrl(origin))
    url.searchParams.set('origem', 'whatsapp-voto-validado')
    const digits = normalizePhoneDigits(phone)
    if (digits) url.searchParams.set('whatsapp', digits)
    return url.toString()
}

export async function loadProfileAssessmentGate(supabase: any, phone: string) {
    const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', profileAssessmentGateKey(phone))
        .maybeSingle()
    if (!data?.value) return null
    try {
        return JSON.parse(data.value)
    } catch {
        return null
    }
}

export async function saveProfileAssessmentGate(supabase: any, phone: string, value: Record<string, unknown>) {
    await supabase.from('app_config').upsert({
        key: profileAssessmentGateKey(phone),
        value: JSON.stringify(value),
        updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
}
