import { NextResponse } from 'next/server'
import { getPublicMarketRadarFeed } from '@/lib/market-radar/public-feed'

export const dynamic = 'force-dynamic'

export async function GET() {
  const feed = await getPublicMarketRadarFeed()

  return NextResponse.json(feed, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
    },
  })
}
