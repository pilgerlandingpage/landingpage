import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/json-ld'

export default function robots(): MetadataRoute.Robots {
  const privatePaths = [
    '/admin/',
    '/api/',
    '/auth/',
    '/login',
    '/signup',
  ]

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: privatePaths,
      },
      {
        userAgent: ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'GPTBot'],
        allow: '/',
        disallow: privatePaths,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
