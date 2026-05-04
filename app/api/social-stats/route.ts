import { NextResponse } from 'next/server'

export async function GET() {
  // Retorna os dados mockados no formato numérico real.
  // Futuramente, esta rota irá ler do Supabase ou fazer o fetch real nas APIs (YouTube Data API, Instagram Graph, etc)
  return NextResponse.json({
    instagram: 187000,
    tiktok: 210000,
    youtube: 119000
  })
}
