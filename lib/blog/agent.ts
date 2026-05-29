import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { BLOG_INTELLIGENCE_SYSTEM_PROMPT, NEWS_INTELLIGENCE_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import {
    getActiveAIProvider,
    getAIConfig,
    getGeminiApiKey,
    getOpenAIApiKey,
} from '@/lib/ai/config'
import { createAdminClient } from '@/lib/supabase/server'
import { chooseResearchTopicFromBank, createResearchReport, getResearchTopicBank } from '@/lib/research/pilger'
import { getAgentEcosystemContext } from '@/lib/intelligence/ecosystem'
import { BLOG_AUTHOR_NAME } from './author'
import { pickPublicBlogSummary, slugifyBlog } from './types'
import { buildEditorialVisualPlan } from '@/lib/media/editorial-visual-plan'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type BlogAgentDraft = {
    decision: 'create_article' | 'observe' | 'reject'
    strategic_reason: string
    primary_keyword: string
    secondary_keywords: string[]
    local_entities: string[]
    search_intent: string
    seo_title: string
    meta_description: string
    outline: Array<{ heading: string; children?: string[] }>
    article_markdown: string
    aeo_questions: Array<{ question: string; answer: string }>
    internal_links: Array<{ label: string; target: string; reason?: string }>
    external_sources?: Array<{ label: string; url: string; reason?: string }>
    source_citations?: Array<{ claim?: string; label: string; url: string; reason?: string }>
    linking_strategy?: { internal?: string; external?: string }
    image_search_terms?: string[]
    visual_brief?: string
    image_plan?: Array<{ section: string; query: string; reason?: string }>
    editorial_quality_check?: string[]
    cta: string
    approval_notes: string[]
}

function safeArray(value: unknown, limit = 20) {
    return Array.isArray(value) ? value.slice(0, limit) : []
}

function cleanJsonText(text: string) {
    const cleaned = String(text || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

    if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned

    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return cleaned.slice(firstBrace, lastBrace + 1).trim()
    }

    return cleaned
}

function cleanEditorialRedline(value: string, fallback = 'Guia imobiliario de alto padrao') {
    let output = String(value || '').trim()

    const blockedPrefixes = [
        /^\s*(?:not(?:i|\u00ed)cia|blog|pauta|radar|leitura|artigo)\s+pilger\s*[:\-–—]\s*/i,
        /^\s*pilger\s*[:\-–—]\s*/i,
    ]

    let previous = ''
    while (output && output !== previous) {
        previous = output
        for (const pattern of blockedPrefixes) {
            output = output.replace(pattern, '').trim()
        }
    }

    output = output
        .replace(/\bnot(?:i|\u00ed)cia\s+pilger\b/gi, 'noticia do mercado imobiliario')
        .replace(/\bblog\s+pilger\b/gi, 'conteudo imobiliario')
        .replace(/\bpauta\s+pilger\b/gi, 'pauta imobiliaria')
        .replace(/\bradar\s+pilger\b/gi, 'radar imobiliario')
        .replace(/\bleitura\s+pilger\b/gi, 'leitura editorial')
        .trim()

    return output || fallback
}

function cleanEditorialMarkdownRedlines(markdown: string, title: string) {
    let output = String(markdown || '').trim()
    if (!output) return output

    output = output
        .replace(/^#\s*(?:not(?:i|\u00ed)cia|blog|pauta|radar|leitura|artigo)\s+pilger\s*[:\-–—]\s*.+$/im, `# ${title}`)
        .replace(/^#\s*pilger\s*[:\-–—]\s*.+$/im, `# ${title}`)
        .replace(/^##\s*Leitura\s+Pilger\s*$/gim, '## Leitura editorial')
        .replace(/\bnot(?:i|\u00ed)cia\s+pilger\b/gi, 'noticia do mercado imobiliario')
        .replace(/\bblog\s+pilger\b/gi, 'conteudo imobiliario')
        .replace(/\bpauta\s+pilger\b/gi, 'pauta imobiliaria')
        .replace(/\bradar\s+pilger\b/gi, 'radar imobiliario')
        .replace(/\bleitura\s+pilger\b/gi, 'leitura editorial')

    return output
}

function normalizeEditorialDraft(draft: BlogAgentDraft, fallbackTitle: string): BlogAgentDraft {
    const seoTitle = cleanEditorialRedline(draft.seo_title, fallbackTitle)
    return {
        ...draft,
        strategic_reason: cleanEditorialRedline(draft.strategic_reason, draft.strategic_reason),
        seo_title: seoTitle,
        meta_description: cleanEditorialRedline(draft.meta_description, draft.meta_description),
        article_markdown: cleanEditorialMarkdownRedlines(draft.article_markdown, seoTitle),
    }
}

function needsPortugueseCopyReview(draft: BlogAgentDraft) {
    const text = [
        draft.strategic_reason,
        draft.seo_title,
        draft.meta_description,
        draft.article_markdown,
        draft.cta,
        ...(draft.approval_notes || []),
        ...(draft.aeo_questions || []).flatMap(item => [item.question, item.answer]),
    ].join(' ')
    const accentCount = (text.match(/[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/g) || []).length
    const commonUnaccentedWords = /\b(acao|acoes|atencao|informacao|informacoes|imovel|imoveis|regiao|regioes|localizacao|proximo|proxima|decisao|noticia|noticias|publico|estrategia|experiencia|criterio|criterios|tambem|disponivel|avaliacao|relacao)\b/i
    return accentCount < 8 && commonUnaccentedWords.test(text)
}

function mergePolishedDraft(original: BlogAgentDraft, polished: any): BlogAgentDraft {
    const aeoQuestions = Array.isArray(polished?.aeo_questions)
        ? polished.aeo_questions
            .filter((item: any) => item?.question && item?.answer)
            .slice(0, 12)
            .map((item: any) => ({ question: String(item.question), answer: String(item.answer) }))
        : original.aeo_questions

    return {
        ...original,
        strategic_reason: String(polished?.strategic_reason || original.strategic_reason),
        seo_title: String(polished?.seo_title || original.seo_title),
        meta_description: String(polished?.meta_description || original.meta_description).slice(0, 320),
        article_markdown: String(polished?.article_markdown || original.article_markdown),
        aeo_questions: aeoQuestions,
        visual_brief: String(polished?.visual_brief || original.visual_brief || ''),
        cta: String(polished?.cta || original.cta),
        approval_notes: Array.isArray(polished?.approval_notes)
            ? polished.approval_notes.map(String).slice(0, 12)
            : original.approval_notes,
    }
}

async function polishPortugueseCopyIfNeeded(draft: BlogAgentDraft): Promise<BlogAgentDraft> {
    if (!needsPortugueseCopyReview(draft)) return draft

    const instruction = [
        'Revise o conteúdo editorial em português do Brasil.',
        'Corrija acentuação, ortografia, concordância e pontuação, mantendo tom premium, claro e natural.',
        'Não mude fatos, números, datas, nomes, URLs, links Markdown, slugs, placeholders, CTAs ou estrutura principal.',
        'Não acrescente informações novas. Apenas corrija a escrita.',
        'Retorne somente JSON válido com os mesmos campos recebidos.',
    ].join('\n')
    const payload = {
        strategic_reason: draft.strategic_reason,
        seo_title: draft.seo_title,
        meta_description: draft.meta_description,
        article_markdown: draft.article_markdown,
        aeo_questions: draft.aeo_questions,
        visual_brief: draft.visual_brief,
        cta: draft.cta,
        approval_notes: draft.approval_notes,
    }

    try {
        const provider = await getActiveAIProvider()
        let text = ''
        if (provider === 'openai') {
            const apiKey = await getOpenAIApiKey()
            if (!apiKey) return draft
            const model = (await getAIConfig('openai_model')) || 'gpt-4o-mini'
            const openai = new OpenAI({ apiKey })
            const result = await openai.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: instruction },
                    { role: 'user', content: JSON.stringify(payload, null, 2) },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1,
            })
            text = result.choices[0]?.message?.content || '{}'
        } else {
            const apiKey = await getGeminiApiKey()
            if (!apiKey) return draft
            const modelName = (await getAIConfig('gemini_model')) || 'gemini-2.5-flash'
            const genAI = new GoogleGenerativeAI(apiKey)
            const model = genAI.getGenerativeModel({ model: modelName })
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload, null, 2) }] }],
                systemInstruction: { role: 'model', parts: [{ text: instruction }] },
                generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
            })
            text = result.response.text()
        }
        return mergePolishedDraft(draft, JSON.parse(cleanJsonText(text)))
    } catch (error: any) {
        console.warn('[Blog Agent] Portuguese polish skipped:', error?.message || error)
        return draft
    }
}

async function safeQuery<T>(label: string, promise: PromiseLike<{ data: T | null; error: any }>) {
    try {
        const { data, error } = await promise
        if (error) return { label, ok: false, error: error.message || String(error), data: null }
        return { label, ok: true, data, error: null }
    } catch (error: any) {
        return { label, ok: false, error: error?.message || String(error), data: null }
    }
}

async function collectBlogContext(supabase: SupabaseAdmin) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
        leads,
        visitors,
        events,
        properties,
        landingPages,
        radarInsights,
        adCampaigns,
        existingPosts,
        empreendimentos,
        conversations,
    ] = await Promise.all([
        safeQuery('leads', supabase.from('leads').select('id, name, lead_purpose, funnel_stage, source, landing_page_slug, city, state, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(80)),
        safeQuery('visitors', supabase.from('visitors').select('id, city, region, country, detected_source, device_type, browser, page_views, last_visit_at').order('last_visit_at', { ascending: false }).limit(80)),
        safeQuery('funnel_events', supabase.from('funnel_events').select('event_type, landing_page_slug, created_at, metadata').gte('created_at', since).order('created_at', { ascending: false }).limit(120)),
        safeQuery('properties', supabase.from('properties').select('id, title, city, state, location, price, property_type, bedrooms, bathrooms, area, status, tags, amenities').order('created_at', { ascending: false }).limit(80)),
        safeQuery('landing_pages', supabase.from('landing_pages').select('id, title, slug, property_id, created_at').order('created_at', { ascending: false }).limit(80)),
        safeQuery('market_radar_insights', supabase.from('market_radar_insights').select('keyword, location, opportunity_score, summary, content_opportunities, created_at').order('created_at', { ascending: false }).limit(50)),
        safeQuery('ad_campaigns', supabase.from('ad_campaigns').select('id, name, platform, status, objective, created_at').order('created_at', { ascending: false }).limit(50)),
        safeQuery('blog_posts', supabase.from('blog_posts').select('title, slug, primary_keyword, status, published_at').order('created_at', { ascending: false }).limit(50)),
        safeQuery('empreendimentos', supabase.from('empreendimentos').select('id, nome, slug, ativo, created_at').order('created_at', { ascending: false }).limit(50)),
        safeQuery('whatsapp_ai_conversations', supabase.from('whatsapp_ai_conversations').select('id, lead_name, funnel_stage, lead_purpose, summary, updated_at').order('updated_at', { ascending: false }).limit(60)),
    ])

    const successful = [leads, visitors, events, properties, landingPages, radarInsights, adCampaigns, existingPosts, empreendimentos, conversations]
        .filter(item => item.ok)
        .map(item => item.label)

    const failed = [leads, visitors, events, properties, landingPages, radarInsights, adCampaigns, existingPosts, empreendimentos, conversations]
        .filter(item => !item.ok)
        .map(item => ({ source: item.label, error: item.error }))

    return {
        period: 'ultimos 30 dias',
        collected_sources: successful,
        unavailable_sources: failed,
        leads: safeArray(leads.data, 80),
        visitors: safeArray(visitors.data, 80),
        funnel_events: safeArray(events.data, 120),
        properties: safeArray(properties.data, 80),
        landing_pages: safeArray(landingPages.data, 80),
        market_radar_insights: safeArray(radarInsights.data, 50),
        ad_campaigns: safeArray(adCampaigns.data, 50),
        existing_blog_posts: safeArray(existingPosts.data, 50),
        empreendimentos: safeArray(empreendimentos.data, 50),
        whatsapp_conversations: safeArray(conversations.data, 60),
    }
}

function fallbackDraft(context: any, topic?: string): BlogAgentDraft {
    const radar = context.market_radar_insights?.[0]
    const city = context.visitors?.find((item: any) => item.city)?.city || 'Balneário Camboriú'
    const keyword = topic || radar?.keyword || `imóveis de luxo em ${city}`
    return {
        decision: 'create_article',
        strategic_reason: 'Rascunho criado por fallback porque a IA não retornou JSON válido, usando sinais disponíveis do ecossistema.',
        primary_keyword: keyword,
        secondary_keywords: ['imóveis de luxo', 'alto padrão', 'investimento imobiliário'],
        local_entities: [city, 'Santa Catarina'].filter(Boolean),
        search_intent: 'commercial',
        seo_title: `Guia premium sobre ${keyword}`,
        meta_description: `Entenda oportunidades, contexto de mercado e critérios para avaliar ${keyword} com curadoria Pilger.`,
        outline: [
            { heading: `Por que ${keyword} entrou no radar`, children: ['Sinais de demanda', 'Estoque e oportunidade'] },
            { heading: 'Como avaliar antes de comprar', children: ['Localização', 'Liquidez', 'Perfil do imóvel'] },
        ],
        article_markdown: `# Guia premium sobre ${keyword}\n\nO mercado de alto padrão exige leitura de dados, contexto local e curadoria. Este artigo foi criado para organizar os principais sinais observados no ecossistema Pilger e ajudar o comprador a tomar uma decisão mais segura.\n\n## O que observar\n\n- Localização e liquidez.\n- Perfil do estoque disponível.\n- Diferenciais reais do imóvel.\n- Momento de demanda na região.\n\n## Próximo passo\n\nAntes de visitar um imóvel, vale cruzar objetivo, prazo, faixa de investimento e região desejada com oportunidades reais do estoque.`,
        aeo_questions: [
            { question: `Vale investir em ${keyword}?`, answer: 'Depende de localização, liquidez, estoque disponível, preço pedido e objetivo do comprador.' },
        ],
        internal_links: [{ label: 'Ver imóveis no mapa', target: '/busca', reason: 'Levar o leitor para o estoque ativo.' }],
        external_sources: [],
        source_citations: [],
        linking_strategy: {
            internal: 'Conectar o leitor ao estoque ativo e a páginas de busca relacionadas.',
            external: 'Usar apenas quando houver dado público verificável.',
        },
        image_search_terms: [keyword, city, 'luxury real estate beach architecture'].filter(Boolean),
        visual_brief: `Imagem editorial premium relacionada a ${keyword}, com litoral, arquitetura e mercado imobiliário de alto padrão.`,
        image_plan: [
            { section: 'Capa', query: `${keyword} ${city} luxury real estate`, reason: 'Imagem de abertura alinhada ao tema e ao mercado premium.' },
            { section: 'Contexto local', query: `${city} beach architecture real estate`, reason: 'Imagem interna para apoiar leitura local.' },
        ],
        editorial_quality_check: [
            'Separar fatos, inferências e recomendações.',
            'Usar links internos com âncora descritiva.',
            'Validar qualquer fonte externa antes de publicar.',
        ],
        cta: 'Fale com a equipe Pilger para receber uma curadoria alinhada ao seu objetivo.',
        approval_notes: ['Validar dados de mercado e links internos antes de publicar.'],
    }
}

function fallbackNewsDraft(context: any, topic?: string): BlogAgentDraft {
    const researchTopic = context.external_research?.topic || topic
    const radar = context.market_radar_insights?.[0]
    const city = context.visitors?.find((item: any) => item.city)?.city || 'Santa Catarina'
    const keyword = researchTopic || radar?.keyword || `notícias do mercado imobiliário em ${city}`

    return {
        decision: 'create_article',
        strategic_reason: 'Rascunho de notícia criado por fallback usando o contexto disponível. Revisar fontes e atualidade antes de publicar.',
        primary_keyword: keyword,
        secondary_keywords: ['notícias imobiliárias', 'mercado imobiliário', 'Santa Catarina'],
        local_entities: [city, 'Santa Catarina'].filter(Boolean),
        search_intent: 'informational',
        seo_title: `${keyword}: contexto e impacto no mercado imobiliario`,
        meta_description: `Entenda o contexto de ${keyword} e o possível impacto para compradores, investidores e proprietários no litoral catarinense.`,
        outline: [
            { heading: 'O que aconteceu', children: ['Resumo do fato público', 'Contexto local'] },
            { heading: 'Por que isso importa para o mercado imobiliário', children: ['Possíveis impactos', 'Pontos de atenção'] },
        ],
        article_markdown: `# ${keyword}: contexto e impacto no mercado imobiliario\n\nUma nova movimentação relacionada a ${keyword} merece atenção de compradores, investidores e proprietários no mercado imobiliário de alto padrão.\n\n## O que observar\n\n- Confirmar a fonte oficial e a data da informação.\n- Entender se o fato impacta mobilidade, turismo, infraestrutura, oferta ou demanda.\n- Avaliar a relação com regiões e empreendimentos de interesse dos leads.\n\n## Leitura editorial\n\nA notícia deve ser analisada com prudência. Antes de transformar o tema em decisão de compra, venda ou investimento, vale cruzar o fato com localização, liquidez, estoque disponível e objetivo do cliente.`,
        aeo_questions: [
            { question: `Por que ${keyword} importa para o mercado imobiliário?`, answer: 'Porque fatos públicos sobre infraestrutura, economia, turismo e cidade podem influenciar percepção de valor, demanda e timing de decisão.' },
        ],
        internal_links: [{ label: 'Ver imóveis no mapa', target: '/busca', reason: 'Conectar a leitura da notícia ao estoque ativo.' }],
        external_sources: [],
        source_citations: [],
        linking_strategy: {
            internal: 'Relacionar a notícia a bairros, busca ou imóveis sem forçar promessa comercial.',
            external: 'Obrigatório quando houver fato público, data, obra, número ou declaração.',
        },
        image_search_terms: [keyword, city, 'real estate city beach architecture'].filter(Boolean),
        visual_brief: `Imagem editorial verificável e não enganosa relacionada a ${keyword}, sem sugerir foto factual de um acontecimento específico.`,
        image_plan: [
            { section: 'Capa', query: `${keyword} ${city} city real estate`, reason: 'Imagem editorial sem sugerir registro factual do acontecimento.' },
            { section: 'Impacto imobiliario', query: `${city} urban development real estate`, reason: 'Imagem interna para contextualizar cidade e mercado.' },
        ],
        editorial_quality_check: [
            'Confirmar fonte, data e atualidade.',
            'Citar fontes externas no texto quando houver fato público.',
            'Evitar linguagem de valorização garantida.',
        ],
        cta: 'Fale com a equipe Pilger para entender como essa notícia pode se relacionar ao seu objetivo imobiliário.',
        approval_notes: ['Validar fontes, data da informação e impacto real antes de publicar.'],
    }
}

const EDITORIAL_VISUAL_PROMPT_APPENDIX = `

Regras adicionais obrigatorias de linha editorial, fontes, links e imagens:
- Escreva obrigatoriamente em português do Brasil com acentuação correta. Não entregue textos sem acentos.
- Antes de retornar o JSON, revise ortografia, acentuação, concordância, pontuação e naturalidade. Corrija títulos, resumo, corpo, perguntas, CTA e notas.
- Preserve nomes próprios, URLs, links Markdown, números, datas, placeholders e fatos. Não invente nada durante a revisão.
- Crie conteudo para pessoas primeiro e para busca depois: util, original, especifico, confiavel, com experiencia local e valor alem do obvio.
- SEO, AEO e GEO devem aparecer na estrutura: titulo claro, resposta direta para perguntas, entidades locais, contexto, secoes bem nomeadas e texto facil de entender por mecanismos de resposta.
- Para buscas com IA, considere fan-out de consultas: responda tambem perguntas relacionadas, comparacoes, riscos, bairros, timing, exemplos praticos e criterios de decisao.
- Separe fato, inferencia e recomendacao. Fato precisa vir do contexto ou de fonte externa citavel; inferencia deve ser prudente; recomendacao deve ser acionavel.
- Use links internos naturais para home, busca, imoveis, empreendimentos, blog, noticias, bairros ou paginas relacionadas quando isso ajudar a jornada do leitor.
- Anchora de link precisa ser descritiva e curta. Evite "clique aqui", "leia mais", "site" ou texto generico como ancora.
- Quando usar fato externo, cite a fonte com link no proprio texto em Markdown perto da afirmacao. Nao invente fonte, URL, numero, data ou orgao.
- Em noticias, fontes externas sao obrigatorias para fatos publicos, obras, indices, prazos, anuncios, declaracoes, dados de mercado ou movimentacoes de cidade.
- Em blog, fontes externas devem ser usadas quando houver dado publico; links internos devem conectar o tema a estoque real, buscas, bairros, imoveis visitados e artigos relacionados.
- Nao copie texto de fontes externas; sintetize com palavras proprias e adicione leitura editorial especializada, contexto local e impacto para o publico.
- Nao use "Noticia Pilger", "Blog Pilger", "Pauta Pilger", "Radar Pilger", "Leitura Pilger" ou qualquer redline baseada na marca. Titulo, H1, seo_title, meta_description e primeira chamada devem ranquear por assunto, cidade, bairro, tipo de imovel, fato e intencao de busca.
- Se precisar mencionar a empresa ou o profissional, use "Imobiliaria Guilherme Pilger" ou "corretor de imoveis Guilherme Pilger" apenas em contexto institucional, assinatura ou CTA discreto.
- Sugira imagem de capa e imagens internas por secao. Cada imagem precisa ter tema, motivo e alt text esperado.
- Para a imagem de capa, priorize Pexels/Pixabay com imagem editorial coerente, horizontal, premium e alinhada ao tema. Use foto de imovel interno como capa apenas se os bancos editoriais nao retornarem imagem adequada.
- Use imagens reais de imoveis do ecossistema como apoio interno quando o tema falar de cidade, bairro, tipo de imovel, empreendimento, frente mar, cobertura, luxo ou investimento.
- Quando usar Pexels/Pixabay, escolha imagens editoriais coerentes e nao enganosas; em noticias, nao use imagem que pareca registro factual de um acontecimento se for apenas ilustrativa.
- Planeje imagens proximas das secoes relevantes, com descricao util e sem keyword stuffing no alt text.
- O artigo/noticia final deve mostrar links internos e fontes externas no Markdown sempre que existirem; nao deixe isso apenas nos campos JSON.
- Antes de finalizar, faca uma checagem editorial: utilidade real, originalidade, fonte verificavel, links internos uteis, imagem coerente e ausencia de promessa exagerada.

Inclua estes campos no JSON:
"external_sources": [{"label": "string", "url": "https://...", "reason": "string"}],
"source_citations": [{"claim": "string", "label": "string", "url": "https://...", "reason": "string"}],
"linking_strategy": {"internal": "string", "external": "string"},
"image_search_terms": ["string"],
"visual_brief": "string",
"image_plan": [{"section": "string", "query": "string", "reason": "string"}],
"editorial_quality_check": ["string"]
`

function isLikelyUrl(value: unknown) {
    return /^https?:\/\//i.test(String(value || '').trim())
}

function formatEditorialLinkLine(label: string, target: string, reason?: string) {
    const cleanLabel = String(label || target).trim()
    const cleanTarget = String(target || '').trim()
    const cleanReason = String(reason || '').trim()
    return `- [${cleanLabel}](${cleanTarget})${cleanReason ? ` - ${cleanReason}` : ''}`
}

function appendEditorialLinkSections(
    markdown: string,
    internalLinks: Array<{ label: string; target: string; reason?: string }> = [],
    externalSources: Array<{ label: string; url: string; reason?: string }> = [],
) {
    let output = String(markdown || '').trim()
    if (!output) return output

    const sourceLines = externalSources
        .filter(source => isLikelyUrl(source.url) && !output.includes(source.url))
        .slice(0, 6)
        .map(source => formatEditorialLinkLine(source.label || 'Fonte externa', source.url, source.reason))

    const internalLines = internalLinks
        .filter(link => link?.target && !output.includes(`](${link.target})`) && !output.includes(String(link.target)))
        .slice(0, 6)
        .map(link => formatEditorialLinkLine(link.label || 'Pagina relacionada', link.target, link.reason))

    if (internalLines.length) {
        output += `\n\n## Leia tambem\n\n${internalLines.join('\n')}`
    }

    if (sourceLines.length) {
        output += `\n\n## Fontes e referencias\n\n${sourceLines.join('\n')}`
    }

    return output
}

function inferResearchTopic(context: any, topic?: string) {
    if (topic?.trim()) return topic.trim()
    const radar = context.market_radar_insights?.find((item: any) => item?.keyword)
    if (radar?.keyword) return String(radar.keyword)
    const property = context.properties?.find((item: any) => item?.city || item?.property_type)
    if (property?.city && property?.property_type) return `${property.property_type} em ${property.city}`
    const visitor = context.visitors?.find((item: any) => item?.city)
    if (visitor?.city) return `mercado imobiliario de luxo em ${visitor.city}`
    return 'mercado imobiliario de luxo em Santa Catarina'
}

async function loadReusableBlogResearchReport(topic?: string, requester = 'blog-intelligence') {
    if (topic?.trim()) return null

    const supabase = createAdminClient()
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
        .from('ai_research_reports')
        .select('id, topic, executive_summary, report_markdown, sources, queries, created_at, updated_at')
        .eq('requester', requester)
        .eq('status', 'completed')
        .gte('created_at', since)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error || !data) return null

    return {
        id: data.id,
        topic: data.topic,
        summary: data.executive_summary,
        report_markdown: data.report_markdown,
        sources: data.sources,
        queries: data.queries,
        reused: true,
    }
}

async function chooseAgentResearchTopic(intent = 'blog') {
    if (intent !== 'noticias') return chooseResearchTopicFromBank(intent)

    const preferredIntents = ['noticias', 'prefeitura', 'economia', 'empreendimentos', 'geral']
    for (const preferredIntent of preferredIntents) {
        const topics = await getResearchTopicBank(preferredIntent)
        if (topics[0]) return topics[0]
    }

    return null
}

async function enrichWithExternalResearch(
    context: any,
    topic?: string,
    options: { requester?: string; topicIntent?: string } = {}
) {
    try {
        const enabled = (await getAIConfig('research_pilger_enabled')) !== 'false'
        if (!enabled) return context

        const requester = options.requester || 'blog-intelligence'
        const topicIntent = options.topicIntent || 'blog'
        const reusableReport = await loadReusableBlogResearchReport(topic, requester)
        if (reusableReport) {
            return {
                ...context,
                external_research: reusableReport,
            }
        }

        const bankTopic = topic?.trim() ? null : await chooseAgentResearchTopic(topicIntent)
        const researchTopic = bankTopic
            ? [bankTopic.topic, bankTopic.region].filter(Boolean).join(' - ')
            : inferResearchTopic(context, topic)
        const report = await createResearchReport({
            topic: researchTopic,
            requester,
            context: {
                period: context.period,
                collected_sources: context.collected_sources,
                unavailable_sources: context.unavailable_sources,
                source_counts: context.source_counts,
                executive_summary: context.executive_summary,
                topic_source: bankTopic ? 'research_pilger_topic_bank' : 'ecosystem_signals',
                manual_research_topic: bankTopic,
                signals_overview: context.signals?.overview,
                top_search_terms: context.signals?.top_search_terms?.slice(0, 12),
                top_pages: context.signals?.top_pages?.slice(0, 12),
                top_lead_cities: context.signals?.top_lead_cities?.slice(0, 12),
                hot_properties: context.signals?.hot_properties?.slice(0, 12),
                lead_questions: context.signals?.lead_questions?.slice(0, 12),
                radar_opportunities: context.signals?.radar_opportunities?.slice(0, 12),
                latest_research: context.signals?.latest_research?.slice(0, 8),
                organic_top_content: context.signals?.organic_top_content?.slice(0, 10),
                traffic_sources: context.signals?.traffic_sources?.slice(0, 10),
                top_radar: context.market_radar_insights?.slice(0, 12),
                top_properties: context.properties?.slice(0, 16),
                top_visitor_locations: context.visitors?.slice(0, 30),
                top_funnel_events: context.funnel_events?.slice(0, 40),
                active_campaigns: context.ad_campaigns?.slice(0, 20),
                ad_metrics: context.ad_metrics_snapshots?.slice(0, 30),
                landing_pages: context.landing_pages?.slice(0, 20),
                existing_blog_posts: context.existing_blog_posts?.slice(0, 20),
                marketing_creatives: context.marketing_creatives?.slice(0, 12),
            },
        })

        return {
            ...context,
            external_research: {
                id: report.id,
                topic: report.topic,
                summary: report.executive_summary,
                report_markdown: report.report_markdown,
                sources: report.sources,
                queries: report.queries,
            },
        }
    } catch (error: any) {
        return {
            ...context,
            external_research_error: error?.message || String(error),
        }
    }
}

async function callBlogAgent(prompt: string, context: any, topic?: string): Promise<BlogAgentDraft> {
    const provider = await getActiveAIProvider()
    const userPrompt = [
        topic ? `Tema sugerido pelo admin: ${topic}` : 'Escolha a melhor pauta com base nos dados.',
        '',
        'Contexto do ecossistema em JSON:',
        JSON.stringify(context, null, 2),
    ].join('\n')

    let text = ''
    if (provider === 'openai') {
        const apiKey = await getOpenAIApiKey()
        if (!apiKey) throw new Error('OpenAI API Key nao configurada.')
        const model = (await getAIConfig('openai_model')) || 'gpt-4o-mini'
        const openai = new OpenAI({ apiKey })
        const result = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.35,
        })
        text = result.choices[0]?.message?.content || '{}'
    } else {
        const apiKey = await getGeminiApiKey()
        if (!apiKey) throw new Error('Gemini API Key nao configurada.')
        const modelName = (await getAIConfig('gemini_model')) || 'gemini-2.5-flash'
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: { role: 'model', parts: [{ text: prompt }] },
            generationConfig: { responseMimeType: 'application/json', temperature: 0.35 },
        })
        text = result.response.text()
    }

    const parsed = JSON.parse(cleanJsonText(text))
    const draft: BlogAgentDraft = {
        decision: parsed.decision === 'observe' || parsed.decision === 'reject' ? parsed.decision : 'create_article',
        strategic_reason: String(parsed.strategic_reason || ''),
        primary_keyword: String(parsed.primary_keyword || topic || ''),
        secondary_keywords: safeArray(parsed.secondary_keywords, 12).map(String),
        local_entities: safeArray(parsed.local_entities, 12).map(String),
        search_intent: String(parsed.search_intent || 'commercial'),
        seo_title: String(parsed.seo_title || parsed.title || topic || 'Guia imobiliario de alto padrao'),
        meta_description: String(parsed.meta_description || '').slice(0, 320),
        outline: safeArray(parsed.outline, 12) as BlogAgentDraft['outline'],
        article_markdown: String(parsed.article_markdown || ''),
        aeo_questions: safeArray(parsed.aeo_questions, 12) as BlogAgentDraft['aeo_questions'],
        internal_links: safeArray(parsed.internal_links, 12) as BlogAgentDraft['internal_links'],
        external_sources: safeArray(parsed.external_sources, 12) as BlogAgentDraft['external_sources'],
        source_citations: safeArray(parsed.source_citations, 12) as BlogAgentDraft['source_citations'],
        linking_strategy: typeof parsed.linking_strategy === 'object' && parsed.linking_strategy
            ? {
                internal: String(parsed.linking_strategy.internal || ''),
                external: String(parsed.linking_strategy.external || ''),
            }
            : undefined,
        image_search_terms: safeArray(parsed.image_search_terms, 12).map(String),
        visual_brief: String(parsed.visual_brief || ''),
        image_plan: safeArray(parsed.image_plan, 8) as BlogAgentDraft['image_plan'],
        editorial_quality_check: safeArray(parsed.editorial_quality_check, 12).map(String),
        cta: String(parsed.cta || ''),
        approval_notes: safeArray(parsed.approval_notes, 12).map(String),
    }
    return polishPortugueseCopyIfNeeded(normalizeEditorialDraft(draft, 'Guia imobiliario de alto padrao'))
}

export async function generateBlogArticleDraft(topic?: string) {
    const supabase = createAdminClient()
    const baseContext = await getAgentEcosystemContext({ supabase, agent: 'blog', days: 30 })
    const context = await enrichWithExternalResearch(baseContext, topic, {
        requester: 'blog-intelligence',
        topicIntent: 'blog',
    })
    const prompt = `${(await getAIConfig('blog_intelligence_system_prompt')) || BLOG_INTELLIGENCE_SYSTEM_PROMPT}${EDITORIAL_VISUAL_PROMPT_APPENDIX}`

    let draft: BlogAgentDraft
    try {
        draft = await callBlogAgent(prompt, context, topic)
    } catch (error: any) {
        console.warn('[Blog Agent] fallback draft used:', error?.message || error)
        draft = fallbackDraft(context, topic)
    }

    draft = normalizeEditorialDraft(draft, 'Guia imobiliario de alto padrao')

    const title = draft.seo_title || draft.primary_keyword || 'Guia imobiliario de alto padrao'
    const visualPlan = await buildEditorialVisualPlan(supabase, {
        contentType: 'blog',
        title,
        markdown: draft.article_markdown,
        keywords: [
            draft.primary_keyword,
            draft.visual_brief || '',
            ...(draft.image_search_terms || []),
            ...draft.secondary_keywords,
            ...draft.local_entities,
        ],
        existingInternalLinks: draft.internal_links,
        maxInlineImages: 2,
    })

    const sourceSummary = {
        ...context,
        editorial_visual_plan: {
            image_search_query: visualPlan.imageSearchQuery,
            assets: visualPlan.assets,
            external_sources: draft.external_sources || [],
            source_citations: draft.source_citations || [],
            linking_strategy: draft.linking_strategy || null,
            image_plan: draft.image_plan || [],
            editorial_quality_check: draft.editorial_quality_check || [],
        },
    }

    const contentMarkdown = appendEditorialLinkSections(
        visualPlan.contentMarkdown,
        visualPlan.internalLinks,
        draft.external_sources || [],
    )

    return {
        title,
        slug: slugifyBlog(title),
        excerpt: pickPublicBlogSummary({
            excerpt: draft.strategic_reason,
            meta_description: draft.meta_description,
            content_markdown: draft.article_markdown,
        }),
        content_markdown: contentMarkdown,
        status: 'under_review' as const,
        cover_image_url: visualPlan.coverImageUrl,
        author_name: BLOG_AUTHOR_NAME,
        category: 'Mercado Imobiliario',
        tags: [...new Set([
            draft.primary_keyword,
            draft.visual_brief || '',
            ...(draft.image_search_terms || []),
            ...draft.secondary_keywords,
            ...draft.local_entities,
        ].filter(Boolean))].slice(0, 16),
        seo_title: draft.seo_title,
        meta_description: draft.meta_description,
        primary_keyword: draft.primary_keyword,
        secondary_keywords: draft.secondary_keywords,
        local_entities: draft.local_entities,
        aeo_questions: draft.aeo_questions,
        internal_links: visualPlan.internalLinks,
        source_summary: sourceSummary,
        approval_notes: [...(draft.approval_notes || []), ...(draft.editorial_quality_check || [])].slice(0, 16),
        generated_by: 'blog-intelligence',
    }
}

export async function generateNewsArticleDraft(topic?: string) {
    const supabase = createAdminClient()
    const baseContext = await getAgentEcosystemContext({ supabase, agent: 'news', days: 30 })
    const context = await enrichWithExternalResearch(baseContext, topic, {
        requester: 'news-intelligence',
        topicIntent: 'noticias',
    })
    const prompt = `${(await getAIConfig('news_intelligence_system_prompt')) || NEWS_INTELLIGENCE_SYSTEM_PROMPT}${EDITORIAL_VISUAL_PROMPT_APPENDIX}`

    let draft: BlogAgentDraft
    try {
        draft = await callBlogAgent(prompt, context, topic)
    } catch (error: any) {
        console.warn('[News Agent] fallback draft used:', error?.message || error)
        draft = fallbackNewsDraft(context, topic)
    }

    draft = normalizeEditorialDraft(draft, 'Noticias do mercado imobiliario de alto padrao')

    const title = draft.seo_title || draft.primary_keyword || 'Noticias do mercado imobiliario de alto padrao'
    const visualPlan = await buildEditorialVisualPlan(supabase, {
        contentType: 'news',
        title,
        markdown: draft.article_markdown,
        keywords: [
            draft.primary_keyword,
            draft.visual_brief || '',
            ...(draft.image_search_terms || []),
            ...draft.secondary_keywords,
            ...draft.local_entities,
            'noticias',
        ],
        existingInternalLinks: draft.internal_links,
        maxInlineImages: 2,
    })

    const sourceSummary = {
        ...context,
        editorial_visual_plan: {
            image_search_query: visualPlan.imageSearchQuery,
            assets: visualPlan.assets,
            external_sources: draft.external_sources || [],
            source_citations: draft.source_citations || [],
            linking_strategy: draft.linking_strategy || null,
            image_plan: draft.image_plan || [],
            editorial_quality_check: draft.editorial_quality_check || [],
        },
    }

    const contentMarkdown = appendEditorialLinkSections(
        visualPlan.contentMarkdown,
        visualPlan.internalLinks,
        draft.external_sources || [],
    )

    return {
        title,
        slug: slugifyBlog(title),
        excerpt: pickPublicBlogSummary({
            excerpt: draft.strategic_reason,
            meta_description: draft.meta_description,
            content_markdown: draft.article_markdown,
        }),
        content_markdown: contentMarkdown,
        status: 'under_review' as const,
        cover_image_url: visualPlan.coverImageUrl,
        author_name: BLOG_AUTHOR_NAME,
        category: 'Noticias',
        tags: [...new Set([
            draft.primary_keyword,
            draft.visual_brief,
            ...(draft.image_search_terms || []),
            ...draft.secondary_keywords,
            ...draft.local_entities,
            'noticias',
        ].filter(Boolean))].slice(0, 16),
        seo_title: draft.seo_title,
        meta_description: draft.meta_description,
        primary_keyword: draft.primary_keyword,
        secondary_keywords: draft.secondary_keywords,
        local_entities: draft.local_entities,
        aeo_questions: draft.aeo_questions,
        internal_links: visualPlan.internalLinks,
        source_summary: sourceSummary,
        approval_notes: [...(draft.approval_notes || []), ...(draft.editorial_quality_check || [])].slice(0, 16),
        generated_by: 'news-intelligence',
    }
}
