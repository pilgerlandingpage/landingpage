import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPublicGoogleTrackingConfig } from '@/lib/analytics/google'
import { resolveMetaPixelId } from '@/lib/tracking/meta-pixel'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const supabase = createAdminClient()
        const [{ data: metaPixel }, google] = await Promise.all([
            supabase
                .from('app_config')
                .select('value')
                .eq('key', 'meta_pixel_id')
                .maybeSingle(),
            getPublicGoogleTrackingConfig(supabase),
        ])

        return NextResponse.json({
            metaPixelId: resolveMetaPixelId(metaPixel?.value, process.env.META_PIXEL_ID),
            googleAnalyticsId: google.googleAnalyticsId,
            googleAdsId: google.googleAdsId,
        })
    } catch {
        return NextResponse.json({
            metaPixelId: resolveMetaPixelId(process.env.META_PIXEL_ID),
            googleAnalyticsId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || '',
            googleAdsId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '',
        })
    }
}
