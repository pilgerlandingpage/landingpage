'use client'

import { useEffect, useState } from 'react'
import GoogleReviewsSection from '@/components/marketplace/GoogleReviewsSection'
import type { HomepageGoogleReviews } from '@/lib/google-reviews'

export default function PublicGoogleReviewsSection() {
  const [googleReviews, setGoogleReviews] = useState<HomepageGoogleReviews | null>(null)

  useEffect(() => {
    let active = true

    fetch('/api/public/google-reviews')
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (active) setGoogleReviews(payload?.data || null)
      })
      .catch(() => {
        if (active) setGoogleReviews(null)
      })

    return () => {
      active = false
    }
  }, [])

  return <GoogleReviewsSection data={googleReviews} />
}
