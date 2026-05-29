import { NextResponse } from 'next/server'
import { getCachedFacebookOrganic } from '@/lib/social/facebook'
import { getCachedInstagramOrganic } from '@/lib/social/instagram'

export async function GET() {
  let instagram = 187000
  let facebook = 14915

  try {
    const cached = await getCachedInstagramOrganic(1)
    instagram = cached?.totals.followers || instagram
  } catch (error) {
    console.warn('Instagram social stats cache unavailable:', error instanceof Error ? error.message : error)
  }

  try {
    const cached = await getCachedFacebookOrganic(1)
    facebook = cached?.totals.followers || facebook
  } catch (error) {
    console.warn('Facebook social stats cache unavailable:', error instanceof Error ? error.message : error)
  }

  return NextResponse.json({
    instagram,
    facebook,
    tiktok: 210000,
    youtube: 119000,
  })
}
