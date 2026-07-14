import { NextRequest, NextResponse } from 'next/server'
import { searchEditorialImages, type EditorialImageOrientation, type EditorialImageProvider } from '@/lib/media/editorial-image-providers'

export const dynamic = 'force-dynamic'

function normalizeOrientation(value: string | null): EditorialImageOrientation {
  if (value === 'vertical' || value === 'all') return value
  return 'horizontal'
}

function normalizeProvider(value: string | null): EditorialImageProvider | undefined {
  if (value === 'wikimedia_commons' || value === 'google_licensed' || value === 'pexels' || value === 'pixabay') return value
  return undefined
}

async function runSearch(input: {
  query?: string
  orientation?: string | null
  provider?: string | null
  perPage?: number | string | null
}) {
  const query = String(input.query || '').trim()
  if (!query) {
    return NextResponse.json({ success: false, message: 'Informe um termo de busca.' }, { status: 400 })
  }

  const parsedPerPage = Number.parseInt(String(input.perPage || '12'), 10)
  const images = await searchEditorialImages({
    query,
    orientation: normalizeOrientation(input.orientation || null),
    provider: normalizeProvider(input.provider || null),
    perPage: Number.isFinite(parsedPerPage) ? Math.min(40, Math.max(3, parsedPerPage)) : 12,
  })

  return NextResponse.json({
    success: true,
    images,
    total: images.length,
  })
}

export async function GET(request: NextRequest) {
  return runSearch({
    query: request.nextUrl.searchParams.get('q') || '',
    orientation: request.nextUrl.searchParams.get('orientation'),
    provider: request.nextUrl.searchParams.get('provider'),
    perPage: request.nextUrl.searchParams.get('perPage'),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return runSearch(body)
}
