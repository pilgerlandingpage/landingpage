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
import { buildAgentContextBrief, getAgentEcosystemContext } from '@/lib/intelligence/ecosystem'
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

type EditorialAgentDraftOptions = {
    contextAugmentation?: Record<string, unknown> | null
}

function safeArray(value: unknown, limit = 20) {
    return Array.isArray(value) ? value.slice(0, limit) : []
}

const MIN_BLOG_ARTICLE_WORDS = 950
const MIN_NEWS_ARTICLE_WORDS = 650

function countMarkdownWords(value: string) {
    return String(value || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[#>*_`~\-[\]()!.,;:?/\\]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .length
}

function cleanContextText(value: unknown, maxLength = 520) {
    return String(value || '')
        .replace(/[#>*_`[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
}

function contextCity(context: any, fallback = 'Santa Catarina') {
    return context.visitors?.find((item: any) => item?.city)?.city
        || context.properties?.find((item: any) => item?.city)?.city
        || fallback
}

function contextResearchSummary(context: any) {
    return cleanContextText(
        context.lara_benchmark_handoff?.opportunity?.summary
        || context.central_intelligence?.lara_benchmark_latest?.summary
        || context.central_intelligence?.latest_agent_summaries?.find((item: any) => item?.summary)?.summary
        || context.external_research?.summary
        || context.external_research?.executive_summary
        || context.external_research?.report_markdown
        || context.executive_summary
        || '',
        700
    )
}

function contextPropertySignals(context: any) {
    return safeArray(context.properties, 6)
        .map((property: any) => [
            property.property_type || property.title,
            property.city || property.location,
            property.status ? `status ${property.status}` : '',
        ].filter(Boolean).join(' em '))
        .filter(Boolean)
        .slice(0, 4)
}

function buildBlogDepthExpansion(draft: BlogAgentDraft, context: any) {
    const keyword = draft.primary_keyword || draft.seo_title || 'mercado imobiliario de alto padrao'
    const city = contextCity(context, draft.local_entities?.[0] || 'Santa Catarina')
    const researchSummary = contextResearchSummary(context)
    const propertySignals = contextPropertySignals(context)

    return [
        `## Leitura de mercado para ${keyword}`,
        '',
        `Uma boa decisao em imoveis de alto padrao raramente nasce de um unico dado. O comprador precisa cruzar localizacao, liquidez, padrao construtivo, momento de demanda, perfil do estoque e objetivo de uso. No caso de ${keyword}, a leitura fica mais forte quando o tema e analisado dentro do contexto de ${city}, porque cada bairro, eixo de acesso e tipologia tem um comportamento diferente.`,
        '',
        researchSummary
            ? `O contexto de pesquisa disponivel para esta pauta indica o seguinte ponto de partida: ${researchSummary}. Essa leitura nao deve ser tratada como promessa de valorizacao, mas como insumo para entender por que o assunto merece uma analise mais cuidadosa antes da visita ou da proposta.`
            : 'Quando nao ha um dado publico unico que explique o tema, a analise precisa se apoiar em sinais combinados: comportamento de busca, recorrencia de duvidas dos leads, tipo de estoque disponivel e comparacao entre regioes com liquidez semelhante.',
        '',
        '## O que muda para quem quer comprar',
        '',
        'Para o comprador, a pergunta principal nao e apenas se o imovel parece bom, mas se ele combina com o plano de vida ou investimento. Um apartamento para morar precisa responder bem a rotina, privacidade, acesso, insolacao, ruido, vagas e servicos no entorno. Um imovel para investimento exige outra camada: liquidez futura, raridade, facilidade de locacao, conservacao do edificio, padrao da vizinhanca e risco de comprar apenas pelo entusiasmo do momento.',
        '',
        'Na pratica, uma avaliacao premium precisa observar:',
        '',
        '- se a localizacao sustenta valor percebido mesmo fora de ciclos de alta;',
        '- se a planta entrega conforto real, e nao apenas metragem no papel;',
        '- se o edificio ou empreendimento tem manutencao, fachada, areas comuns e gestao coerentes com o publico-alvo;',
        '- se a vista, posicao solar, ventilacao e ruido valorizam ou limitam o uso diario;',
        '- se o preco pedido conversa com alternativas comparaveis na mesma regiao;',
        '- se existe uma tese clara para revenda, renda ou uso familiar.',
        '',
        '## Como cruzar o tema com estoque real',
        '',
        propertySignals.length
            ? `Entre os sinais internos que merecem comparacao estao: ${propertySignals.join('; ')}. Esses exemplos ajudam a transformar uma pauta ampla em uma curadoria concreta, porque mostram quais tipos de imovel podem ser avaliados dentro da mesma intencao de busca.`
            : 'O proximo passo e cruzar a tese editorial com oportunidades reais do estoque. Sem essa comparacao, o conteudo vira apenas opiniao. Com ela, o leitor consegue perceber diferencas entre bairros, tipologias, faixas de investimento e padroes de acabamento.',
        '',
        '## Riscos de uma leitura rasa',
        '',
        'O risco de uma analise superficial e tratar todo imovel de luxo como se fosse igual. Dois apartamentos com valores parecidos podem ter liquidez completamente diferente por causa de posicao, edificio, garagem, vista, privacidade, idade, padrao de entrega ou ate reputacao do entorno. Tambem e comum confundir desejo com decisao: uma capa bonita, uma vista forte ou um discurso de oportunidade nao substituem diligencia.',
        '',
        'Por isso, antes de avancar, vale fazer perguntas objetivas: o imovel resolve qual problema? Existe comparavel melhor? A localizacao sera desejada daqui a alguns anos? O custo de condominio e manutencao faz sentido para o perfil do comprador? A unidade tem atributos raros ou apenas repete o estoque comum da regiao?',
        '',
        '## Checklist para decidir com mais seguranca',
        '',
        'Uma decisao bem tomada costuma passar por quatro etapas. Primeiro, definir o objetivo: morar, investir, preservar patrimonio, gerar renda ou combinar uso familiar com valorizacao. Depois, comparar alternativas equivalentes, evitando olhar apenas para um imovel isolado. Em seguida, validar pontos tecnicos como documentacao, condominio, estado de conservacao, padrao construtivo e custos recorrentes. Por fim, negociar com clareza sobre prazo, forma de pagamento e margem real.',
        '',
        'Esse processo nao elimina o componente emocional da compra, mas impede que ele seja o unico criterio. Em mercados de alto padrao, a melhor oportunidade costuma ser aquela que une desejo, racionalidade e timing.',
        '',
        '## Proximo passo',
        '',
        'Se o tema faz sentido para o seu momento, o caminho mais eficiente e transformar a leitura em uma lista curta de oportunidades. A equipe da Imobiliaria Guilherme Pilger pode comparar regioes, tipologias e imoveis aderentes ao seu objetivo para separar o que e apenas bonito do que realmente merece visita.',
    ].join('\n')
}

function buildNewsDepthExpansion(draft: BlogAgentDraft, context: any) {
    const keyword = draft.primary_keyword || draft.seo_title || 'noticia do mercado imobiliario'
    const city = contextCity(context)
    const researchSummary = contextResearchSummary(context)

    return [
        `## Contexto do fato e por que ele merece atencao`,
        '',
        `Uma noticia sobre ${keyword} so ganha relevancia imobiliaria quando ajuda o leitor a entender o que pode mudar na pratica. Em mercados como ${city} e o litoral catarinense, obras, mobilidade, turismo, novos empreendimentos, indicadores de preco e movimentos de construtoras podem alterar percepcao de valor, fluxo de pessoas e prioridades de compra.`,
        '',
        researchSummary
            ? `A base de pesquisa disponivel para esta pauta aponta: ${researchSummary}. Esse contexto deve ser lido com prudencia, separando o que ja esta confirmado do que ainda depende de acompanhamento publico ou validacao editorial.`
            : 'Quando o fato ainda nao tem uma base publica completa no contexto do agente, a noticia precisa ser tratada como alerta de acompanhamento. O mais importante e explicar quais informacoes devem ser confirmadas antes de transformar o tema em decisao de compra, venda ou investimento.',
        '',
        '## O que compradores e investidores devem observar',
        '',
        'Para quem esta avaliando imoveis, a primeira pergunta e se a noticia afeta uso, acesso, liquidez ou percepcao de valor. Um anuncio de infraestrutura pode melhorar deslocamentos, mas tambem pode trazer periodo de obra, mudanca de fluxo e impacto temporario no entorno. Um indicador de valorizacao pode reforcar a atratividade de uma cidade, mas nao significa que qualquer unidade tenha o mesmo desempenho.',
        '',
        'Os pontos mais importantes sao:',
        '',
        '- qual orgao, entidade ou fonte confirmou a informacao;',
        '- se ha data, etapa, prazo ou apenas intencao anunciada;',
        '- quais bairros, eixos de acesso ou regioes podem ser afetados;',
        '- se o impacto e imediato, gradual ou ainda incerto;',
        '- como o fato conversa com estoque, demanda e perfil de comprador;',
        '- quais riscos precisam ser acompanhados antes de uma decisao.',
        '',
        '## Impacto imobiliario provavel',
        '',
        'O impacto mais relevante costuma aparecer em tres frentes. A primeira e a percepcao de conveniencia: melhor mobilidade, novos servicos ou maior atratividade turistica podem tornar certas regioes mais desejadas. A segunda e a leitura de liquidez: quando uma area ganha mais procura qualificada, bons imoveis tendem a ter mais defensabilidade. A terceira e a comparacao entre alternativas: o comprador passa a medir se vale pagar mais por uma localizacao consolidada ou antecipar movimento em uma regiao em transformacao.',
        '',
        'Mesmo assim, e importante evitar conclusoes automaticas. Valorizacao depende de produto, posicao, padrao, vista, conservacao, oferta concorrente e capacidade de pagamento do publico-alvo. A noticia cria contexto; a decisao exige analise individual do imovel.',
        '',
        '## Cuidados antes de decidir',
        '',
        'Noticias de mercado ajudam a orientar a conversa, mas nao substituem verificacao. Antes de comprar ou vender com base em um fato recente, vale confirmar a fonte, buscar documentos oficiais quando houver, entender o cronograma e comparar imoveis equivalentes. Tambem e prudente avaliar se o movimento ja esta precificado ou se ainda existe assimetria real entre preco pedido e potencial percebido.',
        '',
        'Para proprietarios, a noticia pode indicar melhor momento para reposicionar um ativo, atualizar preco ou revisar a estrategia de exposicao. Para compradores, pode abrir uma janela de estudo antes que o mercado absorva completamente o novo contexto.',
        '',
        '## Proximo acompanhamento',
        '',
        'A leitura editorial deve continuar acompanhando desdobramentos, novas fontes e reflexos no estoque real. Quando houver confirmacao adicional, o tema pode evoluir para uma analise mais detalhada no blog, com comparativos de regioes, tipos de imovel e criterios de decisao.',
    ].join('\n')
}

function deepenDraftIfNeeded(draft: BlogAgentDraft, context: any, contentType: 'blog' | 'news') {
    if (draft.decision !== 'create_article') return draft

    const minWords = contentType === 'news' ? MIN_NEWS_ARTICLE_WORDS : MIN_BLOG_ARTICLE_WORDS
    const words = countMarkdownWords(draft.article_markdown)
    if (words >= minWords) return draft

    const expansion = contentType === 'news'
        ? buildNewsDepthExpansion(draft, context)
        : buildBlogDepthExpansion(draft, context)
    const articleMarkdown = [draft.article_markdown, expansion].filter(Boolean).join('\n\n').trim()

    return {
        ...draft,
        article_markdown: articleMarkdown,
        approval_notes: [
            ...(draft.approval_notes || []),
            `Rascunho original tinha ${words} palavras; o sistema aprofundou a materia antes de enviar para revisao.`,
        ].slice(0, 12),
        editorial_quality_check: [
            ...(draft.editorial_quality_check || []),
            `Texto revisado para profundidade minima de ${minWords} palavras.`,
        ].slice(0, 12),
    }
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
    const laraOpportunity = context.central_intelligence?.lara_benchmark_opportunities?.find((item: any) => item?.keyword || item?.title)
    if (laraOpportunity?.keyword) return String(laraOpportunity.keyword)
    if (laraOpportunity?.title) return String(laraOpportunity.title)
    const radar = context.market_radar_insights?.find((item: any) => item?.keyword)
    if (radar?.keyword) return String(radar.keyword)
    const property = context.properties?.find((item: any) => item?.city || item?.property_type)
    if (property?.city && property?.property_type) return `${property.property_type} em ${property.city}`
    const visitor = context.visitors?.find((item: any) => item?.city)
    if (visitor?.city) return `mercado imobiliario de luxo em ${visitor.city}`
    return 'mercado imobiliario de luxo em Santa Catarina'
}

function applyEditorialContextAugmentation(context: any, augmentation?: Record<string, unknown> | null) {
    if (!augmentation) return context

    return {
        ...context,
        lara_benchmark_handoff: augmentation,
        signals: {
            ...(context.signals || {}),
            lara_benchmark_handoff: augmentation,
        },
    }
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
                central_intelligence: {
                    snapshot_count: context.central_intelligence?.snapshot_count || 0,
                    latest_agent_summaries: context.central_intelligence?.latest_agent_summaries?.slice(0, 8),
                    lara_benchmark_opportunities: context.central_intelligence?.lara_benchmark_opportunities?.slice(0, 8),
                    editorial_guidance: context.central_intelligence?.editorial_guidance,
                },
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
    const centralBrief = buildAgentContextBrief(context)
    const userPrompt = [
        topic ? `Tema sugerido pelo admin: ${topic}` : 'Escolha a melhor pauta com base nos dados.',
        'Regra de profundidade: se a decisao for create_article, entregue article_markdown completo. Blog deve ter pelo menos 950 palavras; noticia deve ter pelo menos 650 palavras. Se nao houver base factual/contextual suficiente, retorne observe ou reject.',
        'Use primeiro a Central de Inteligencia: priorize central_intelligence, lara_benchmark_opportunities, latest_research, market_radar_insights, sinais de leads e estoque real. Quando usar Lara/benchmark, trate como inteligencia competitiva interna e nao mencione Lara, Benchmark Editorial ou pauta de benchmark para o leitor.',
        '',
        'Briefing consolidado da Central de Inteligencia:',
        centralBrief || 'Sem briefing consolidado disponivel; use o JSON bruto com prudencia.',
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

export async function generateBlogArticleDraft(topic?: string, options: EditorialAgentDraftOptions = {}) {
    const supabase = createAdminClient()
    const baseContext = await getAgentEcosystemContext({ supabase, agent: 'blog', days: 30 })
    const enrichedContext = await enrichWithExternalResearch(baseContext, topic, {
        requester: 'blog-intelligence',
        topicIntent: 'blog',
    })
    const context = applyEditorialContextAugmentation(enrichedContext, options.contextAugmentation)
    const prompt = `${(await getAIConfig('blog_intelligence_system_prompt')) || BLOG_INTELLIGENCE_SYSTEM_PROMPT}${EDITORIAL_VISUAL_PROMPT_APPENDIX}`

    let draft: BlogAgentDraft
    try {
        draft = await callBlogAgent(prompt, context, topic)
    } catch (error: any) {
        console.warn('[Blog Agent] fallback draft used:', error?.message || error)
        draft = fallbackDraft(context, topic)
    }

    draft = await polishPortugueseCopyIfNeeded(deepenDraftIfNeeded(
        normalizeEditorialDraft(draft, 'Guia imobiliario de alto padrao'),
        context,
        'blog',
    ))

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

export async function generateNewsArticleDraft(topic?: string, options: EditorialAgentDraftOptions = {}) {
    const supabase = createAdminClient()
    const baseContext = await getAgentEcosystemContext({ supabase, agent: 'news', days: 30 })
    const enrichedContext = await enrichWithExternalResearch(baseContext, topic, {
        requester: 'news-intelligence',
        topicIntent: 'noticias',
    })
    const context = applyEditorialContextAugmentation(enrichedContext, options.contextAugmentation)
    const prompt = `${(await getAIConfig('news_intelligence_system_prompt')) || NEWS_INTELLIGENCE_SYSTEM_PROMPT}${EDITORIAL_VISUAL_PROMPT_APPENDIX}`

    let draft: BlogAgentDraft
    try {
        draft = await callBlogAgent(prompt, context, topic)
    } catch (error: any) {
        console.warn('[News Agent] fallback draft used:', error?.message || error)
        draft = fallbackNewsDraft(context, topic)
    }

    draft = await polishPortugueseCopyIfNeeded(deepenDraftIfNeeded(
        normalizeEditorialDraft(draft, 'Noticias do mercado imobiliario de alto padrao'),
        context,
        'news',
    ))

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
