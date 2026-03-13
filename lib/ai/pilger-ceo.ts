import { createClient } from '@supabase/supabase-js'
import { generateChatResponse } from '../ai/generation'
import { getMarketRadarTrends } from '../market-radar/trends'
import { sendAlertToAdmins } from '../ads/whatsapp-alerts'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Helper: extrair score de 0-100 do markdown gerado pela IA ───
function extractPerformanceScore(markdown: string): number | null {
  // Tenta encontrar padrão: **SCORE: XX** ou SCORE: XX ou Nota: XX/100
  const patterns = [
    /\*\*SCORE:\s*(\d{1,3})\*\*/i,
    /SCORE:\s*(\d{1,3})/i,
    /nota[:\s]+(\d{1,3})\s*\/?\s*100/i,
    /performance_score[:\s]+(\d{1,3})/i,
    /termômetro[:\s]+(\d{1,3})/i,
    /🌡️\s*(\d{1,3})/,
  ]
  for (const pat of patterns) {
    const match = markdown.match(pat)
    if (match) {
      const val = parseInt(match[1], 10)
      if (val >= 0 && val <= 100) return val
    }
  }
  return null
}

// ─── Score suffix appended to every prompt ───
const SCORE_INSTRUCTION = `

IMPORTANTE: No final do seu relatório, inclua obrigatoriamente uma linha com a nota de desempenho no formato exato:
**SCORE: XX**
Onde XX é um número inteiro de 0 a 100 representando a nota de desempenho geral das campanhas analisadas.

Critérios para a nota:
- 80-100 (🟢 Excelente): CPA baixo, CTR acima de 2%, conversões consistentes, ROI positivo
- 60-79 (🔵 Bom): Performance sólida, métricas na média ou acima, sem desperdício
- 40-59 (🟡 Médio): Atenção necessária, CPA subindo, CTR caindo, ajustes recomendados
- 20-39 (🟠 Ruim): CPA alto, baixa conversão, desperdício de verba significativo
- 0-19 (🔴 Crítico): Campanhas com performance muito baixa, sugerido pausar/reformular
`

// ═══════════════════════════════════════════════
// RELATÓRIO DIÁRIO (por plataforma)
// ═══════════════════════════════════════════════

export async function generateDailyPilgerReport() {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  // 1. Coletar KPIs das campanhas (dia de hoje) do banco primeiro
  const { data: metrics } = await supabase
    .from('ad_metrics_snapshots')
    .select('*, ad_campaigns(name, platform, status)')
    .gte('snapshot_at', `${today}T00:00:00`)

  let metaMetrics: any[] = []
  let googleMetrics: any[] = []

  // Se tem dados do banco (Inngest rodou nas últimas horas)
  if (metrics && metrics.length > 0) {
    metaMetrics = metrics.filter(m => (m.ad_campaigns as any)?.platform === 'meta')
    googleMetrics = metrics.filter(m => (m.ad_campaigns as any)?.platform === 'google')
  } else {
    // 1b. FALLBACK: Se não tem snapshots, buscar dados reais AGORA
    console.log('[Pilger CEO] Sem snapshots hoje. Fazendo live-fetch nas APIs...')
    
    // Importações dinâmicas para evitar dependências circulares
    const { getAccountInsightsByCampaign } = await import('../ads/meta')
    const { getAllCampaignsWithMetrics } = await import('../ads/google')
    const { data: activeCampaigns } = await supabase
        .from('ad_campaigns')
        .select('id, name, platform, external_campaign_id')
        .in('status', ['active', 'paused'])

    const activeMeta = activeCampaigns?.filter(c => c.platform === 'meta' && c.external_campaign_id) || []
    const activeGoogle = activeCampaigns?.filter(c => c.platform === 'google' && c.external_campaign_id) || []

    if (activeMeta.length > 0) {
        const metaInsights = await getAccountInsightsByCampaign('today')
        metaMetrics = activeMeta.map(c => {
            const ins = metaInsights[c.external_campaign_id!]
            if (!ins) return null
            return {
                ad_campaigns: { name: c.name, platform: 'meta' },
                spend: parseFloat(ins.spend || '0'),
                impressions: parseInt(ins.impressions || '0'),
                clicks: parseInt(ins.clicks || '0'),
                leads_count: parseInt(ins.actions?.find((a:any) => a.action_type === 'lead')?.value || '0')
            }
        }).filter(Boolean)
    }

    if (activeGoogle.length > 0) {
        const googleInsights = await getAllCampaignsWithMetrics('today')
        googleMetrics = activeGoogle.map(c => {
            const ins = googleInsights[c.external_campaign_id!]?.metrics
            if (!ins) return null
            return {
                ad_campaigns: { name: c.name, platform: 'google' },
                spend: ins.spend || 0,
                impressions: ins.impressions || 0,
                clicks: ins.clicks || 0,
                leads_count: ins.leads_count || 0
            }
        }).filter(Boolean)
    }
  }

  if (metaMetrics.length === 0 && googleMetrics.length === 0) {
    console.log('[Pilger CEO] Sem métricas para o relatório diário hoje, mesmo após fallback.')
    return null
  }

  // 2. Radar de Mercado (Últimas tendências para o relatório diário)
  const { data: latestRadar } = await supabase
    .from('market_radar_data')
    .select('*, market_radars(keyword)')
    .order('collected_at', { ascending: false })
    .limit(10)

  const radarContext = (latestRadar || []).map(r => ({
    keyword: (r.market_radars as any)?.keyword,
    score: r.trend_score,
    date: r.date
  }))

  const results = []

  // 3. Obter o prompt customizado do banco ou usar o fallback
  const { data: configData } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'pilger_daily_system_prompt')
    .single()

  const systemPrompt = configData?.value || "Você é Pilger AI CEO, um gestor de tráfego de elite focado em ROI."

  // 4. Gerar relatório para cada plataforma que tenha métricas
  for (const { platform, platformMetrics, platformLabel } of [
    { platform: 'meta', platformMetrics: metaMetrics, platformLabel: 'Meta Ads' },
    { platform: 'google', platformMetrics: googleMetrics, platformLabel: 'Google Ads' },
  ]) {
    if (platformMetrics.length === 0) continue

    const summaryData = platformMetrics.map(m => {
      const camp = m.ad_campaigns as any
      return {
        campaign: camp?.name || 'Desconhecida',
        platform: camp?.platform || 'N/A',
        spend: m.spend,
        impressions: m.impressions,
        clicks: m.clicks,
        leads: m.leads_count || 0,
        cpc: m.spend / (m.clicks || 1),
        cpa: m.spend / (m.leads_count || 1)
      }
    })

    const prompt = `
Você é o Pilger AI, um gestor de tráfego de elite (Olho de Deus).
Analise o desempenho de tráfego de HOJE (${today}) EXCLUSIVAMENTE para as campanhas do **${platformLabel}** e gere um "Fechamento do Dia" rápido, direto e executivo.

Dados das Campanhas ${platformLabel} Hoje:
${JSON.stringify(summaryData, null, 2)}

Radar de Mercado (Interesse atual):
${JSON.stringify(radarContext, null, 2)}

Formato de Saída esperado (Markdown):
1. **🚀 Resumo Geral ${platformLabel}:** O que aconteceu de mais importante hoje (gastos vs leads).
2. **🏆 Destaque:** A melhor campanha do dia.
3. **⚠️ Ponto de Atenção:** Campanhas gastando sem converter ou CPA muito alto.
4. **💡 Ação Recomendada:** O que Pilger AI sugere ou já fez no background, considerando também o interesse de busca no radar.

Seja breve e focado em ROI.
${SCORE_INSTRUCTION}`

    const reportMarkdown = await generateChatResponse([], prompt, systemPrompt, 'pilger')
    const performanceScore = extractPerformanceScore(reportMarkdown)

    // Salvar no Supabase com a plataforma
    await supabase.from('pilger_ai_reports').insert({
      type: 'daily',
      date: today,
      platform,
      content_markdown: reportMarkdown,
      performance_score: performanceScore,
      token_usage: {}
    })

    results.push({ platform, score: performanceScore })
  }

  // 5. Enviar Alerta WhatsApp
  const scoresSummary = results.map(r => `${r.platform === 'meta' ? 'Meta' : 'Google'}: ${r.score ?? '?'}/100`).join(' | ')
  await sendAlertToAdmins({
    type: 'insight',
    urgency: 'low',
    message: `O Fechamento do Dia do Pilger AI acaba de ser gerado.\n\n🌡️ Scores: ${scoresSummary}`,
    campaign_name: 'Relatório Diário',
    platform: 'Pilger AI CEO'
  })

  return { type: 'daily', success: true, reports: results }
}

// ═══════════════════════════════════════════════
// COLETOR DE DADOS DO RADAR
// ═══════════════════════════════════════════════

export async function collectMarketRadarData(timeSlot?: string) {
  const supabase = getSupabase()
  const todayStr = new Date().toISOString().split('T')[0]
  
  // Se não informar slot, tenta inferir pela hora (06, 12, 18)
  if (!timeSlot) {
    const hour = new Date().getHours()
    if (hour < 10) timeSlot = '06'
    else if (hour < 15) timeSlot = '12'
    else timeSlot = '18'
  }

  const { data: radars } = await supabase
    .from('market_radars')
    .select('*')
    .eq('is_active', true)

  const results = []
  if (radars && radars.length > 0) {
    for (const radar of radars) {
      try {
        const trend = await getMarketRadarTrends(radar.keyword, radar.location)
        if (trend) {
          results.push(trend)
          await supabase.from('market_radar_data').upsert({
            radar_id: radar.id,
            date: todayStr,
            time_slot: timeSlot,
            trend_score: trend.currentScore,
            collected_at: new Date().toISOString()
          }, { onConflict: 'radar_id, date, time_slot' })
        }
      } catch (err) {
        console.error(`[Radar] Erro ao coletar keyword "${radar.keyword}":`, err)
      }
    }
  }
  return results
}

// ═══════════════════════════════════════════════
// DIRETRIZ SEMANAL (por plataforma)
// ═══════════════════════════════════════════════

export async function generateWeeklyPilgerReport() {
  const supabase = getSupabase()

  const today = new Date()
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)
  const todayStr = today.toISOString().split('T')[0]
  const lastWeekStr = lastWeek.toISOString().split('T')[0]

  // 1. Coletar KPIs da última semana
  const { data: metrics } = await supabase
    .from('ad_metrics_snapshots')
    .select('*, ad_campaigns(name, platform, status)')
    .gte('snapshot_at', `${lastWeekStr}T00:00:00`)
    .lte('snapshot_at', `${todayStr}T23:59:59`)

  // 2. Coletar Market Radar (Gera nova coleta se for o horário, ou pega as existentes)
  const radarResults = await collectMarketRadarData('06')

  // 3. Separar métricas por plataforma (com fallback para last_7d)
  let metaMetrics: any[] = []
  let googleMetrics: any[] = []

  if (metrics && metrics.length > 0) {
      metaMetrics = (metrics || []).filter(m => (m.ad_campaigns as any)?.platform === 'meta')
      googleMetrics = (metrics || []).filter(m => (m.ad_campaigns as any)?.platform === 'google')
  } else {
      console.log('[Pilger CEO] Sem snapshots semanais. Fazendo live-fetch nas APIs (last_7d)...')
      const { getAccountInsightsByCampaign } = await import('../ads/meta')
      const { getAllCampaignsWithMetrics } = await import('../ads/google')
      const { data: activeCampaigns } = await supabase
          .from('ad_campaigns')
          .select('id, name, platform, external_campaign_id')
          .in('status', ['active', 'paused'])

      const activeMeta = activeCampaigns?.filter(c => c.platform === 'meta' && c.external_campaign_id) || []
      const activeGoogle = activeCampaigns?.filter(c => c.platform === 'google' && c.external_campaign_id) || []

      if (activeMeta.length > 0) {
          const metaInsights = await getAccountInsightsByCampaign('last_7d')
          metaMetrics = activeMeta.map(c => {
              const ins = metaInsights[c.external_campaign_id!]
              if (!ins) return null
              return {
                  ad_campaigns: { name: c.name, platform: 'meta' },
                  spend: parseFloat(ins.spend || '0'),
                  impressions: parseInt(ins.impressions || '0'),
                  clicks: parseInt(ins.clicks || '0'),
                  leads_count: parseInt(ins.actions?.find((a:any) => a.action_type === 'lead')?.value || '0')
              }
          }).filter(Boolean)
      }

      if (activeGoogle.length > 0) {
          const googleInsights = await getAllCampaignsWithMetrics('last_7d')
          googleMetrics = activeGoogle.map(c => {
              const ins = googleInsights[c.external_campaign_id!]?.metrics
              if (!ins) return null
              return {
                  ad_campaigns: { name: c.name, platform: 'google' },
                  spend: ins.spend || 0,
                  impressions: ins.impressions || 0,
                  clicks: ins.clicks || 0,
                  leads_count: ins.leads_count || 0
              }
          }).filter(Boolean)
      }
  }

  // 4. Obter o prompt customizado
  const { data: configData } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'pilger_weekly_system_prompt')
    .single()

  const systemPrompt = configData?.value || "Você é Pilger AI CEO, o líder estratégico que alinha mercado, tráfego e metas de negócio."

  const results = []

  for (const { platform, platformMetrics, platformLabel } of [
    { platform: 'meta', platformMetrics: metaMetrics, platformLabel: 'Meta Ads' },
    { platform: 'google', platformMetrics: googleMetrics, platformLabel: 'Google Ads' },
  ]) {
    if (platformMetrics.length === 0) continue

    // Preparar resumo semanal por campanha
    const summaryData = platformMetrics.reduce((acc: any, m) => {
      const campName = (m.ad_campaigns as any)?.name || 'Desconhecida'
      if (!acc[campName]) acc[campName] = { spend: 0, leads: 0, clicks: 0, impressions: 0 }
      acc[campName].spend += Number(m.spend || 0)
      acc[campName].leads += Number(m.leads_count || 0)
      acc[campName].clicks += Number(m.clicks || 0)
      acc[campName].impressions += Number(m.impressions || 0)
      return acc
    }, {})

    const prompt = `
Você é o Pilger AI, o "Olho de Deus" Proativo.
Faça a análise de DIRETRIZ SEMANAL EXCLUSIVAMENTE para as campanhas do **${platformLabel}**, cruzando o desempenho interno com os movimentos de mercado (Google Trends).

Período: ${lastWeekStr} a ${todayStr}

**1. Desempenho Interno (Campanhas ${platformLabel} da Semana):**
${JSON.stringify(summaryData, null, 2)}

**2. Radar de Mercado (Trends Externos):**
${JSON.stringify(radarResults.map(r => ({ keyword: r.keyword, type: r.trend, currentScore: r.currentScore, avgScore: r.averageScore })), null, 2)}

Formato de Saída esperado (Markdown):
1. **📊 Balanço Semanal ${platformLabel}:** Como foi a semana (CPA geral, Volume de Leads, Qualidade).
2. **🔭 Radar de Mercado:** O que o Google Trends nos diz sobre a intenção de busca?
3. **🎯 Diretriz Pilger (Estratégia da Semana):** Com base no mercado e nos nossos dados, quais devem ser as metas e ajustes para esta semana?

Seja extremamente estratégico e assuma a persona de um Gestor de Elite.
${SCORE_INSTRUCTION}`

    const reportMarkdown = await generateChatResponse([], prompt, systemPrompt, 'pilger')
    const performanceScore = extractPerformanceScore(reportMarkdown)

    await supabase.from('pilger_ai_reports').insert({
      type: 'weekly',
      date: todayStr,
      platform,
      content_markdown: reportMarkdown,
      performance_score: performanceScore,
      token_usage: {}
    })

    results.push({ platform, score: performanceScore })
  }

  // 5. Enviar Alerta WhatsApp
  const scoresSummary = results.map(r => `${r.platform === 'meta' ? 'Meta' : 'Google'}: ${r.score ?? '?'}/100`).join(' | ')
  await sendAlertToAdmins({
    type: 'insight',
    urgency: 'medium',
    message: `A Diretriz Semanal do Pilger AI acaba de ser publicada.\n\n🌡️ Scores: ${scoresSummary}`,
    campaign_name: 'Planejamento Semanal',
    platform: 'Pilger AI CEO'
  })

  return { type: 'weekly', success: true, reports: results }
}
