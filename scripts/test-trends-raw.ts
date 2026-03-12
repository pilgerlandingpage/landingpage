import googleTrends from 'google-trends-api'

async function test() {
  const startTime = new Date()
  startTime.setDate(startTime.getDate() - 7)
  const resStr = await googleTrends.interestOverTime({
    keyword: 'imóveis de luxo',
    startTime,
    geo: 'BR'
  })
  console.log("RAW RESPONSE:")
  console.log(resStr.substring(0, 500))
}

test()
