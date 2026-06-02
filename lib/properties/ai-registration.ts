import { createAdminClient } from '@/lib/supabase/server'
import { recordGeminiUsage } from '@/lib/ai/gemini-costs'
import { buildAgentContextBrief, getAgentEcosystemContext, recordEcosystemEvent } from '@/lib/intelligence/ecosystem'

type MediaInput = {
    url: string
    kind: 'image' | 'video' | 'document'
}

export type PropertyAiDraftRequest = {
    context: string
    images?: string[]
    videos?: string[]
    documents?: string[]
}

export type PropertyAiDraft = {
    title: string
    description: string
    city: string
    state: string
    price: number | null
    property_type: string
    bedrooms: number | null
    bathrooms: number | null
    area_m2: number | null
    amenities: string[]
    owner_name?: string
    owner_phone?: string
    owner_email?: string
    seo_title?: string
    seo_description?: string
    ai_notes?: string[]
    missing_information?: string[]
}

type ConfigMap = Record<string, string>

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MB = 1024 * 1024
const MAX_IMAGE_BYTES = 5 * MB
const MAX_VIDEO_BYTES = 18 * MB

const DEFAULT_AGENT_PROMPT = `Voce e o Agente de Cadastro de Imoveis da Imobiliaria Guilherme Pilger.

Sua missao e transformar informacoes soltas, fotos e videos em um cadastro imobiliario premium, com linguagem comercial elegante, SEO, AEO e GEO, sem inventar dados sensiveis.

Regras:
- Escreva em pt-BR.
- Foque em luxo, desejo, investimento, localizacao e experiencia.
- Nao invente preco, metragem, dormitorios, banheiros, cidade, condominio, vista permanente ou documentacao se nao estiver claro.
- No texto publico, use sempre "dormitorios"; nunca use "quarto" ou "quartos" para essa caracteristica.
- Extraia dados internos do proprietario/consignante quando o admin informar. Esses dados nao aparecem publicamente no site, mas devem ser cadastrados no sistema.
- Quando uma informacao estiver ausente, deixe null, string vazia ou inclua em missing_information.
- Use as imagens/videos para identificar padrao, acabamento, ambientes, vista, lazer e diferenciais visuais.
- Evite exageros juridicamente arriscados como "garantia de valorizacao".
- Crie textos com cara de landing page, mas o retorno deve ser JSON puro.

Retorne somente JSON valido neste formato:
{
  "title": "string",
  "description": "string com 2 a 5 paragrafos",
  "city": "string",
  "state": "string",
  "price": number ou null,
  "property_type": "Apartamento|Casa|Cobertura|Terreno|Outro",
  "bedrooms": number ou null,
  "bathrooms": number ou null,
  "area_m2": number ou null,
  "amenities": ["string"],
  "owner_name": "string",
  "owner_phone": "string",
  "owner_email": "string",
  "seo_title": "string",
  "seo_description": "string",
  "ai_notes": ["observacoes uteis para o admin"],
  "missing_information": ["informacoes importantes que faltam"]
}`

function cleanJsonText(text: string) {
    return text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()
}

function toNumberOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') return null
    const number = Number(String(value).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(number) ? number : null
}

function toStringArray(value: unknown) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 40)
    if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean).slice(0, 40)
    return []
}

function normalizeDraft(raw: any): PropertyAiDraft {
    return {
        title: String(raw?.title || '').trim().slice(0, 160),
        description: String(raw?.description || '').trim(),
        city: String(raw?.city || '').trim(),
        state: String(raw?.state || '').trim().slice(0, 2).toUpperCase(),
        price: toNumberOrNull(raw?.price),
        property_type: String(raw?.property_type || '').trim(),
        bedrooms: toNumberOrNull(raw?.bedrooms),
        bathrooms: toNumberOrNull(raw?.bathrooms),
        area_m2: toNumberOrNull(raw?.area_m2),
        amenities: toStringArray(raw?.amenities),
        owner_name: String(raw?.owner_name || '').trim().slice(0, 160),
        owner_phone: String(raw?.owner_phone || '').trim().slice(0, 40),
        owner_email: String(raw?.owner_email || '').trim().slice(0, 180),
        seo_title: String(raw?.seo_title || '').trim().slice(0, 180),
        seo_description: String(raw?.seo_description || '').trim().slice(0, 320),
        ai_notes: toStringArray(raw?.ai_notes),
        missing_information: toStringArray(raw?.missing_information),
    }
}

function fallbackDraftFromContext(context: string): PropertyAiDraft {
    const firstLine = context.split(/\r?\n/).map(line => line.trim()).find(Boolean) || 'Imovel exclusivo para analise'
    return normalizeDraft({
        title: firstLine.slice(0, 110),
        description: context,
        city: '',
        state: 'SC',
        price: null,
        property_type: '',
        amenities: [],
        ai_notes: ['A IA nao retornou todos os campos. Revise o cadastro manualmente.'],
        missing_information: ['Preco', 'cidade', 'metragem e dados tecnicos devem ser confirmados.'],
    })
}

async function getConfigMap(): Promise<ConfigMap> {
    const supabase = createAdminClient()
    const { data } = await supabase.from('app_config').select('key, value')
    return Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
}

function buildUserPrompt(request: PropertyAiDraftRequest, media: MediaInput[], ecosystemBrief = '') {
    const mediaSummary = media.length
        ? media.map((item, index) => `${index + 1}. ${item.kind}: ${item.url}`).join('\n')
        : 'Nenhuma midia enviada.'

    return `Crie o cadastro premium deste imovel com base no contexto e nas midias.

CONTEXTO INFORMADO PELO ADMIN:
${request.context}

MIDIAS ENVIADAS:
${mediaSummary}

${ecosystemBrief ? `CONTEXTO CENTRAL DO ECOSSISTEMA PILGER:\n${ecosystemBrief}\n\nUse esse contexto para alinhar linguagem, SEO, cidades, regioes, demanda e posicionamento. Nao revele dados internos, nomes de leads, IPs, IDs ou metricas sensiveis.` : ''}

Lembre-se: retorne somente JSON valido.`
}

async function fetchMediaPart(item: MediaInput) {
    const response = await fetch(item.url)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || (item.kind === 'image' ? 'image/jpeg' : 'video/mp4')
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (item.kind === 'document') return null

    const maxBytes = item.kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
    if (contentLength && contentLength > maxBytes) return null

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > maxBytes) return null

    return {
        inlineData: {
            mimeType: contentType.split(';')[0],
            data: Buffer.from(arrayBuffer).toString('base64'),
        },
    }
}

async function generateWithGemini(configs: ConfigMap, prompt: string, media: MediaInput[]) {
    const apiKey = configs.gemini_api_key || process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('Gemini nao configurado na sala de manutencao.')

    const model = configs.gemini_model
        || 'gemini-2.5-flash'

    const mediaParts = []
    for (const item of media) {
        const part = await fetchMediaPart(item).catch(() => null)
        if (part) mediaParts.push(part)
    }

    const systemPrompt = configs.property_register_system_prompt || DEFAULT_AGENT_PROMPT
    const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{
                role: 'user',
                parts: [
                    ...mediaParts,
                    { text: prompt },
                ],
            }],
            generationConfig: {
                temperature: 0.35,
                maxOutputTokens: 3000,
                responseMimeType: 'application/json',
            },
        }),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`Gemini falhou: ${errorText || response.statusText}`)
    }

    const data = await response.json()
    await recordGeminiUsage({
        model,
        feature: 'property_ai_registration',
        usageMetadata: data.usageMetadata,
        metadata: { images: media.filter(item => item.kind === 'image').length, videos: media.filter(item => item.kind === 'video').length },
    })

    const parts = data?.candidates?.[0]?.content?.parts
    return Array.isArray(parts) ? parts.map((part: any) => part?.text || '').join('\n') : ''
}

async function generateWithOpenAI(configs: ConfigMap, prompt: string, media: MediaInput[]) {
    const apiKey = configs.openai_api_key || process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OpenAI nao configurada na sala de manutencao.')

    const model = configs.openai_model
        || 'gpt-4o-mini'

    const imageParts = []
    for (const item of media.filter(m => m.kind === 'image').slice(0, 8)) {
        const mediaPart = await fetchMediaPart(item).catch(() => null)
        if (!mediaPart?.inlineData) continue
        imageParts.push({
            type: 'image_url',
            image_url: { url: `data:${mediaPart.inlineData.mimeType};base64,${mediaPart.inlineData.data}` },
        })
    }

    const videoNote = media.some(item => item.kind === 'video' || item.kind === 'document')
        ? '\n\nObservacao: ha videos ou documentos enviados. Neste provedor, use essas URLs como contexto e sinalize o que precisa ser conferido se nao conseguir analisar diretamente.'
        : ''

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            temperature: 0.35,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: configs.property_register_system_prompt || DEFAULT_AGENT_PROMPT },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `${prompt}${videoNote}` },
                        ...imageParts,
                    ],
                },
            ],
        }),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`OpenAI falhou: ${errorText || response.statusText}`)
    }

    const data = await response.json()
    return data?.choices?.[0]?.message?.content || ''
}

export async function generatePropertyAiDraft(request: PropertyAiDraftRequest) {
    const supabase = createAdminClient()
    const configs = await getConfigMap()
    const provider = String(configs.ai_provider || 'gemini').toLowerCase()

    const media: MediaInput[] = [
        ...(request.images || []).filter(Boolean).slice(0, 12).map(url => ({ url, kind: 'image' as const })),
        ...(request.videos || []).filter(Boolean).slice(0, 2).map(url => ({ url, kind: 'video' as const })),
        ...(request.documents || []).filter(Boolean).slice(0, 8).map(url => ({ url, kind: 'document' as const })),
    ]

    const ecosystemBrief = await getAgentEcosystemContext({ supabase, agent: 'property', days: 30, limit: 80 })
        .then(context => buildAgentContextBrief(context))
        .catch((error: any) => {
            console.warn('[Property AI Draft] Ecosystem context unavailable:', error?.message || error)
            return ''
        })
    const prompt = buildUserPrompt(request, media, ecosystemBrief)
    const text = provider === 'openai'
        ? await generateWithOpenAI(configs, prompt, media)
        : await generateWithGemini(configs, prompt, media)

    const draft = !text.trim()
        ? fallbackDraftFromContext(request.context)
        : (() => {
            try {
                return normalizeDraft(JSON.parse(cleanJsonText(text)))
            } catch {
                return fallbackDraftFromContext(`${request.context}\n\nResposta bruta da IA:\n${text}`)
            }
        })()

    await recordEcosystemEvent({
        supabase,
        eventType: 'property_ai_draft_created',
        actorType: 'agent',
        entityType: 'property_draft',
        entityId: draft.title || 'property_ai_draft',
        source: 'property-registration-agent',
        label: draft.title || 'Rascunho de imovel gerado pela IA',
        importanceScore: 58,
        metadata: {
            title: draft.title,
            city: draft.city,
            state: draft.state,
            property_type: draft.property_type,
            price: draft.price,
            bedrooms: draft.bedrooms,
            area_m2: draft.area_m2,
            missing_information: draft.missing_information || [],
            media: {
                images: request.images?.length || 0,
                videos: request.videos?.length || 0,
                documents: request.documents?.length || 0,
            },
        },
    }).catch((error: any) => {
        console.warn('[Property AI Draft] ecosystem event failed:', error?.message || error)
    })

    return draft
}

export { DEFAULT_AGENT_PROMPT as DEFAULT_PROPERTY_REGISTER_AGENT_PROMPT }
