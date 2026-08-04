import { getAIConfig, getActiveAIProvider, getGeminiApiKey, getOpenAIApiKey } from '@/lib/ai/config'
import { buildGeminiGenerationConfig } from '@/lib/ai/gemini-controls'
import { recordGeminiUsage } from '@/lib/ai/gemini-costs'

export type VoteProofDecision = 'approved' | 'rejected' | 'review'
export type VoteProofMediaKind = 'image' | 'video' | 'document'

export type VoteProofAnalysis = {
    status: VoteProofDecision
    confidence: number
    reason: string
    evidence: string[]
    extracted_text: string
    checks: {
        has_awards_context: boolean
        has_candidate_guilherme: boolean
        has_influencer_category: boolean
        has_vote_confirmation: boolean
        appears_pre_vote_form: boolean
        appears_edited_or_unreliable: boolean
    }
    provider?: string
    model?: string
}

const VOTE_PROOF_PROMPT = `Você é um auditor de comprovantes da campanha de Guilherme Pilger no Real Estate Awards.

Analise somente a mídia enviada e responda em JSON puro.

Objetivo: decidir se a mídia comprova que a pessoa votou em Guilherme Pilger na categoria Influenciador do Ano.

Aprove somente quando a mídia tiver evidências visuais suficientes de:
- contexto do Real Estate Awards, ATrinca Real Estate Awards, ATrinca Real Estate ou domínio awards.atrincarealestate.com.br;
- candidato Guilherme Pilger;
- categoria Influenciador do Ano;
- voto já concluído/confirmado/registrado, tela de sucesso, agradecimento, selo "Seu voto", botão "Votado" ou mensagem equivalente no card do Guilherme.

Rejeite quando:
- for apenas a tela antes do voto, com formulário de CPF/nome/email/WhatsApp ou botão "confirmar e votar";
- mostrar outro candidato, outra categoria, tela inicial, ranking, ou uma chamada sem confirmação;
- não tiver Guilherme Pilger;
- não tiver confirmação de voto.

Use "review" quando a mídia estiver cortada, borrada, ilegível, com informação insuficiente ou com sinais de edição. Em vídeos, analise os quadros visuais. Em documentos/PDFs, leia o conteúdo visual/textual disponível.

JSON esperado:
{
  "status": "approved" | "rejected" | "review",
  "confidence": 0.0,
  "reason": "explicação curta em pt-BR",
  "evidence": ["sinais visuais encontrados"],
  "extracted_text": "texto principal lido na mídia",
  "checks": {
    "has_awards_context": true,
    "has_candidate_guilherme": true,
    "has_influencer_category": true,
    "has_vote_confirmation": true,
    "appears_pre_vote_form": false,
    "appears_edited_or_unreliable": false
  }
}`

function buildVoteProofPrompt(mediaKind: VoteProofMediaKind) {
    const kindLabel = mediaKind === 'video'
        ? 'vídeo'
        : mediaKind === 'document'
            ? 'documento/PDF'
            : 'imagem/print'
    return `Tipo de mídia recebido: ${kindLabel}.

${VOTE_PROOF_PROMPT}`
}

function bool(value: unknown) {
    return value === true
}

function cleanText(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 1200) : fallback
}

function clampConfidence(value: unknown) {
    const number = Number(value)
    if (!Number.isFinite(number)) return 0
    return Math.max(0, Math.min(1, number > 1 ? number / 100 : number))
}

function extractJsonObject(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return null

    try {
        return JSON.parse(trimmed)
    } catch {
        const start = trimmed.indexOf('{')
        const end = trimmed.lastIndexOf('}')
        if (start < 0 || end <= start) return null
        try {
            return JSON.parse(trimmed.slice(start, end + 1))
        } catch {
            return null
        }
    }
}

function normalizeAnalysis(raw: any, provider: string, model: string): VoteProofAnalysis {
    const rawStatus = String(raw?.status || '').toLowerCase()
    const status: VoteProofDecision = rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'review'
    const checks = raw?.checks && typeof raw.checks === 'object' ? raw.checks : {}
    const evidence = Array.isArray(raw?.evidence)
        ? raw.evidence.map((item: unknown) => cleanText(item)).filter(Boolean).slice(0, 8)
        : []

    return {
        status,
        confidence: clampConfidence(raw?.confidence),
        reason: cleanText(raw?.reason, status === 'approved' ? 'Comprovante aprovado.' : 'Não foi possível validar o comprovante com segurança.'),
        evidence,
        extracted_text: cleanText(raw?.extracted_text),
        checks: {
            has_awards_context: bool(checks.has_awards_context),
            has_candidate_guilherme: bool(checks.has_candidate_guilherme),
            has_influencer_category: bool(checks.has_influencer_category),
            has_vote_confirmation: bool(checks.has_vote_confirmation),
            appears_pre_vote_form: bool(checks.appears_pre_vote_form),
            appears_edited_or_unreliable: bool(checks.appears_edited_or_unreliable),
        },
        provider,
        model,
    }
}

function conservativeStatus(analysis: VoteProofAnalysis): VoteProofAnalysis {
    const approvedByChecks =
        analysis.checks.has_awards_context &&
        analysis.checks.has_candidate_guilherme &&
        analysis.checks.has_vote_confirmation &&
        !analysis.checks.appears_pre_vote_form &&
        !analysis.checks.appears_edited_or_unreliable &&
        analysis.confidence >= 0.65

    if (analysis.status !== 'approved' && approvedByChecks) {
        return {
            ...analysis,
            status: 'approved',
            reason: 'Comprovante aprovado: o card do Guilherme Pilger mostra voto confirmado no contexto do Real Estate Awards.',
        }
    }

    if (analysis.status === 'approved' && !approvedByChecks) {
        return {
            ...analysis,
            status: 'review',
            reason: 'O comprovante tem alguns sinais positivos, mas não comprova todos os critérios com segurança.',
        }
    }

    return analysis
}

async function analyzeWithGemini(buffer: Buffer, mimeType: string, mediaKind: VoteProofMediaKind) {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) throw new Error('Gemini API Key não configurada.')

    const model = (await getAIConfig('gemini_vision_model')) || (await getAIConfig('gemini_model')) || 'gemini-2.5-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data: buffer.toString('base64') } },
                    { text: buildVoteProofPrompt(mediaKind) },
                ],
            }],
            generationConfig: buildGeminiGenerationConfig(model, {
                temperature: 0,
                responseMimeType: 'application/json',
                maxOutputTokens: 512,
            }),
        }),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`Gemini vision falhou (${response.status}): ${errorText.slice(0, 300)}`)
    }

    const data = await response.json()
    await recordGeminiUsage({
        model,
        feature: 'self_assessment_vote_proof',
        usageMetadata: data.usageMetadata,
        metadata: { mimeType, mediaKind },
    }).catch(() => {})

    const text = Array.isArray(data?.candidates?.[0]?.content?.parts)
        ? data.candidates[0].content.parts.map((part: any) => part?.text || '').join('\n').trim()
        : ''
    const parsed = extractJsonObject(text)
    if (!parsed) throw new Error('Gemini não retornou JSON válido.')
    return conservativeStatus(normalizeAnalysis(parsed, 'gemini', model))
}

async function analyzeWithOpenAI(buffer: Buffer, mimeType: string, mediaKind: VoteProofMediaKind) {
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) throw new Error('OpenAI API Key não configurada.')

    const model = (await getAIConfig('openai_vision_model')) || 'gpt-4o-mini'
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: 'Você responde somente JSON válido.',
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: buildVoteProofPrompt(mediaKind) },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}` } },
                    ],
                },
            ],
        }),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`OpenAI vision falhou (${response.status}): ${errorText.slice(0, 300)}`)
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || ''
    const parsed = extractJsonObject(text)
    if (!parsed) throw new Error('OpenAI não retornou JSON válido.')
    return conservativeStatus(normalizeAnalysis(parsed, 'openai', model))
}

export async function analyzeVoteProofMedia(
    buffer: Buffer,
    mimeType: string,
    mediaKind: VoteProofMediaKind = 'image'
): Promise<VoteProofAnalysis> {
    const normalizedKind: VoteProofMediaKind = mediaKind === 'video' || mediaKind === 'document' ? mediaKind : 'image'
    const activeProvider = String(await getActiveAIProvider()).toLowerCase() === 'openai' ? 'openai' : 'gemini'
    const providers = activeProvider === 'openai' ? ['openai', 'gemini'] : ['gemini', 'openai']
    const errors: string[] = []

    for (const provider of providers) {
        try {
            if (provider === 'openai' && !String(mimeType || '').toLowerCase().startsWith('image/')) {
                errors.push('OpenAI vision não analisa este tipo de comprovante; usando fallback Gemini.')
                continue
            }
            return provider === 'openai'
                ? await analyzeWithOpenAI(buffer, mimeType, normalizedKind)
                : await analyzeWithGemini(buffer, mimeType, normalizedKind)
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error))
        }
    }

    return {
        status: 'review',
        confidence: 0,
        reason: 'Não foi possível analisar automaticamente agora. Tente enviar outro comprovante da tela final de confirmação.',
        evidence: errors.slice(0, 2),
        extracted_text: '',
        checks: {
            has_awards_context: false,
            has_candidate_guilherme: false,
            has_influencer_category: false,
            has_vote_confirmation: false,
            appears_pre_vote_form: false,
            appears_edited_or_unreliable: true,
        },
        provider: 'fallback',
        model: 'none',
    }
}

export async function analyzeVoteProofImage(buffer: Buffer, mimeType: string): Promise<VoteProofAnalysis> {
    return analyzeVoteProofMedia(buffer, mimeType, 'image')
}
