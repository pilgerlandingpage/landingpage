import googleTrends from 'google-trends-api'
import { getSerpApiKey, getDataForSEOLogin, getDataForSEOPassword } from '../ai/config'

export interface TrendAnalysisResult {
  keyword: string
  location: string | null
  currentScore: number
  averageScore: number
  trend: 'hot' | 'warm' | 'cold'
  recentData: Array<{ date: string; value: number }>
}

/**
 * Fallback para o SerpApi quando o Google bloqueia o pacote nativo (Bot detection).
 * Documentação: https://serpapi.com/google-trends-api
 */
async function fetchSerpApiTrends(keyword: string, location: string): Promise<TrendAnalysisResult | null> {
  const apiKey = await getSerpApiKey()
  if (!apiKey) {
    console.warn('[Market Radar] SERPAPI_API_KEY não configurada. Não é possível usar o fallback.')
    return null
  }

  try {
    // Parâmetros do SerpApi:
    // engine: google_trends
    // q: keyword
    // data_type: TIMESERIES
    // date: today 1-m (Últimos 30 dias - o mais próximo de 7 dias ou usamos now 7-d)
    const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&data_type=TIMESERIES&date=now%207-d&api_key=${apiKey}`

    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[Market Radar] Erro na API do SerpApi. Status: ${res.status}`)
      return null
    }

    const data = await res.json()
    const timelineData = data?.interest_over_time?.timeline_data || []
    
    if (timelineData.length === 0) return null

    // O SerpApi retorna values (interest) com a chave 'values' [ { extraction_date, values: [ { query, extracted_value } ] } ]
    const recentData = timelineData.map((point: any) => {
      const valueObj = point.values?.find((v: any) => v.query.toLowerCase() === keyword.toLowerCase())
      return {
        date: point.date, // ex: "Nov 12"
        value: valueObj ? parseInt(valueObj.extracted_value, 10) : 0
      }
    })

    const values = recentData.map((d: any) => d.value)
    const currentScore = values[values.length - 1] || 0
    const sum = values.reduce((a: number, b: number) => a + b, 0)
    const averageScore = Math.round(sum / (values.length || 1))

    let trend: 'hot' | 'warm' | 'cold' = 'cold'
    if (currentScore >= 75) trend = 'hot'
    else if (currentScore >= 40) trend = 'warm'

    return {
      keyword,
      location,
      currentScore,
      averageScore,
      trend,
      recentData
    }
  } catch (error) {
    console.error(`[Market Radar] Erro no fallback SerpApi para "${keyword}":`, error)
    return null
  }
}

/**
 * Fallback para o DataForSEO (Mais barato, $1 rende 1000 requests)
 * Documentação: https://docs.dataforseo.com/v3/google/trends/explore/live/
 */
async function fetchDataForSEOTrends(keyword: string, location: string): Promise<TrendAnalysisResult | null> {
  const login = await getDataForSEOLogin()
  const password = await getDataForSEOPassword()

  if (!login || !password) {
    console.warn('[Market Radar] Credenciais DATAFORSEO não configuradas. Não é possível usar o fallback.')
    return null
  }

  try {
    const postData = [{
      keyword: keyword,
      location_name: location === 'BR' ? 'Brazil' : location,
      type: "web",
      time_range: "past_7_days"
    }]

    const res = await fetch('https://api.dataforseo.com/v3/google/trends/explore/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    })

    if (!res.ok) {
      console.warn(`[Market Radar] Erro na API do DataForSEO. Status: ${res.status}`)
      return null
    }

    const data = await res.json()
    const tasks = data?.tasks || []
    if (tasks.length === 0 || !tasks[0].result || tasks[0].result.length === 0) return null

    const items = tasks[0].result[0].items || []
    if (items.length === 0) return null

    const recentData = items.map((point: any) => ({
      date: point.date, // "2023-11-01"
      value: point.values && point.values.length > 0 ? point.values[0].value : 0
    }))

    const values = recentData.map((d: any) => d.value)
    const currentScore = values[values.length - 1] || 0
    const sum = values.reduce((a: number, b: number) => a + b, 0)
    const averageScore = Math.round(sum / (values.length || 1))

    let trend: 'hot' | 'warm' | 'cold' = 'cold'
    if (currentScore >= 75) trend = 'hot'
    else if (currentScore >= 40) trend = 'warm'

    return {
      keyword,
      location,
      currentScore,
      averageScore,
      trend,
      recentData
    }
  } catch (error) {
    console.error(`[Market Radar] Erro no fallback DataForSEO para "${keyword}":`, error)
    return null
  }
}

/**
 * Busca dados do Google Trends para os últimos 7 dias.
 */
export async function getMarketRadarTrends(
  keyword: string,
  location?: string | null
): Promise<TrendAnalysisResult | null> {
  try {
    const startTime = new Date()
    startTime.setDate(startTime.getDate() - 7) // Last 7 days

    const resStr = await googleTrends.interestOverTime({
      keyword,
      startTime,
      geo: location || 'BR',
      hl: 'pt-BR'
    })

    // Se o Google bloquear com CAPTCHA/Robot, a resposta será HTML
    if (resStr.trim().startsWith('<')) {
      console.warn(`[Market Radar] Google bloqueou a pacote nativo para "${keyword}". (Robot block)`)
      
      console.log(`[Market Radar] Tentando fallback para SerpApi...`)
      const serpApiResult = await fetchSerpApiTrends(keyword, location || 'BR')
      if (serpApiResult) return serpApiResult

      console.log(`[Market Radar] Tentando fallback para DataForSEO...`)
      return await fetchDataForSEOTrends(keyword, location || 'BR')
    }

    const data = JSON.parse(resStr)

    // A resposta do google-trends-api tem este formato:
    // data.default.timelineData = [ { time: "...", formattedTime: "...", value: [Number], ... } ]
    const timelineData: any[] = data?.default?.timelineData || []
    
    if (timelineData.length === 0) {
      return null
    }

    // Extrair os valores
    const recentData = timelineData.map(point => ({
      date: point.formattedTime,
      value: point.value[0] || 0
    }))

    // Calcular as métricas
    const values = recentData.map(d => d.value)
    const currentScore = values[values.length - 1] || 0
    const sum = values.reduce((a, b) => a + b, 0)
    const averageScore = Math.round(sum / values.length) || 0

    // Definir a tendência (frios/mornos/quentes)
    let trend: 'hot' | 'warm' | 'cold' = 'cold'
    if (currentScore >= 75) {
      trend = 'hot'
    } else if (currentScore >= 40) {
      trend = 'warm'
    }

    return {
      keyword,
      location: location || 'BR',
      currentScore,
      averageScore,
      trend,
      recentData
    }
  } catch (error) {
    console.error(`Erro ao buscar trends para "${keyword}":`, error)
    return null
  }
}
