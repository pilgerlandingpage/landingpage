import { getMarketRadarTrends } from '../lib/market-radar/trends'

async function test() {
  console.log("Testando Google Trends API...")
  const res = await getMarketRadarTrends('imóveis de luxo balneário camboriú', 'BR-SC')
  console.log("Resultado: ", JSON.stringify(res, null, 2))
}

test()
