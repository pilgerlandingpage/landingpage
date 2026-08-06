import { NextRequest, NextResponse } from 'next/server'
import { chatWithGemini } from '@/lib/gemini'
import { getAiAutomationGate } from '@/lib/ai/automation-control'
import { createAdminClient } from '@/lib/supabase/server'
import {
  buildCentralContextPrompt,
  getAgentCentralContext,
  recordAgentCentralSignal,
} from '@/lib/intelligence/agent-runtime'

export const dynamic = 'force-dynamic'

function cleanString(value: unknown, max = 3000) {
  const text = String(value || '').trim()
  return text.length > max ? text.slice(0, max) : text
}

function cleanArray(value: unknown) {
  if (Array.isArray(value)) return value.map(item => cleanString(item, 60)).filter(Boolean).slice(0, 12)
  return String(value || '')
    .split(',')
    .map(item => cleanString(item, 60))
    .filter(Boolean)
    .slice(0, 12)
}

function extractJson(raw: string) {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first >= 0 && last > first) {
    return JSON.parse(cleaned.slice(first, last + 1))
  }
  return JSON.parse(cleaned)
}

function fallbackCopy(body: Record<string, unknown>) {
  const title = cleanString(body.title, 160) || 'Novo conteudo Pilger'
  const sku = cleanString(body.property_sku, 80)
  const platforms = cleanArray(body.platform_targets)
  return {
    caption: `${title}\n\nCuradoria Pilger para quem busca imoveis com mais contexto, seguranca e leitura de mercado.${sku ? `\n\nSKU: ${sku}` : ''}`,
    short_caption: `${title}. Curadoria Pilger com contexto e leitura de mercado.`,
    paid_headline: title.slice(0, 72),
    paid_primary_text: `Conheca este destaque com a curadoria da Pilger Luxury Search.${sku ? ` SKU ${sku}.` : ''}`,
    cta: 'Falar com especialista',
    hashtags: ['#GuilhermePilger', '#PilgerLuxurySearch', '#ImoveisDeLuxo'],
    angles: ['Desejo e exclusividade', 'Contexto de mercado', 'Atendimento consultivo'],
    schedule_suggestion: {
      platforms: platforms.length ? platforms : ['instagram', 'facebook'],
      best_window: '19:00-21:00',
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = cleanString(body.title, 160)
    if (!title) {
      return NextResponse.json({ success: false, error: 'Informe um titulo para gerar a copy.' }, { status: 400 })
    }

    const payload = {
      title,
      description: cleanString(body.description, 1200),
      ai_context: cleanString(body.ai_context, 3000),
      campaign_type: cleanString(body.campaign_type, 40) || 'organic',
      content_type: cleanString(body.content_type, 40) || 'post',
      asset_type: cleanString(body.asset_type, 40) || 'image',
      property_sku: cleanString(body.property_sku, 80),
      platform_targets: cleanArray(body.platform_targets),
    }

    const supabase = createAdminClient()
    const aiGate = await getAiAutomationGate({
      supabase,
      agentId: 'creative-strategy-agent',
      enabledKey: 'marketing_creative_ai_enabled',
    })
    if (!aiGate.allowed) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: aiGate.reason,
        copy: fallbackCopy(body),
      })
    }

    const centralContext = await getAgentCentralContext({
      supabase,
      agentId: 'creative-strategy-agent',
      days: 30,
      limit: 100,
    })
      .then(context => buildCentralContextPrompt(context))
      .catch((error: any) => {
        console.warn('[Creative Copy] Central context unavailable:', error?.message || error)
        return ''
      })

    const raw = await chatWithGemini({
      systemPrompt: [
        'Voce e o estrategista de conteudo da Pilger Luxury Search.',
        'Escreva em portugues do Brasil, tom premium, direto e sem exageros.',
        'Nunca invente dados do imovel. Se algo faltar, use linguagem consultiva.',
        'Use a Central de Inteligencia para conectar copy com sinais reais de leads, imoveis, campanhas, benchmark e radar.',
        'Responda somente JSON valido, sem markdown.',
      ].join('\n'),
      history: [],
      userMessage: [
        'Gere uma copy pronta para publicar e uma versao para trafego pago com este briefing:',
        JSON.stringify(payload, null, 2),
        centralContext,
        '',
        'Formato obrigatorio:',
        '{',
        '  "caption": "legenda completa",',
        '  "short_caption": "legenda curta",',
        '  "paid_headline": "headline para anuncio",',
        '  "paid_primary_text": "texto principal para anuncio",',
        '  "cta": "chamada curta",',
        '  "hashtags": ["..."],',
        '  "angles": ["3 a 5 angulos criativos"],',
        '  "schedule_suggestion": { "platforms": ["instagram"], "best_window": "HH:MM-HH:MM" }',
        '}',
      ].join('\n'),
      temperature: 0.55,
      maxTokens: 1200,
    })

    let copy
    try {
      copy = extractJson(raw)
    } catch {
      copy = fallbackCopy(body)
    }

    await recordAgentCentralSignal({
      supabase,
      agentId: 'creative-strategy-agent',
      eventType: 'creative_copy_generated',
      entityType: 'marketing_creative_copy',
      entityId: title,
      source: 'creative-strategy-agent',
      label: `Clara Criativos gerou copy para ${title}`,
      importanceScore: 64,
      metadata: {
        briefing: payload,
        copy,
        central_context_used: Boolean(centralContext),
      },
      handoffTargets: ['content-publisher-agent', 'ads-analyst', 'organic-report-agent'],
    }).catch((error: any) => {
      console.warn('[Creative Copy] central signal failed:', error?.message || error)
    })

    return NextResponse.json({ success: true, copy, raw })
  } catch (error) {
    console.error('Error generating marketing creative copy:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao gerar copy com IA.' },
      { status: 500 },
    )
  }
}
