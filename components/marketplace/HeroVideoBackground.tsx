'use client'

import Image from 'next/image'

const HERO_BACKGROUND_IMAGE_SRC = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/unnamed.webp'

export default function HeroVideoBackground() {
  return (
    <Image
      src={HERO_BACKGROUND_IMAGE_SRC}
      alt=""
      aria-hidden="true"
      className="hero-background-frame"
      fill
      priority
      fetchPriority="high"
      quality={58}
      sizes="(max-width: 768px) 100vw, 1360px"
      style={{
        objectFit: 'cover',
        objectPosition: 'center',
        pointerEvents: 'none',
        opacity: 0.9,
      }}
    />
  )
}
