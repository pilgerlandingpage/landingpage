'use client'

import Image from 'next/image'

const HERO_BACKGROUND_IMAGE_SRC = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/ARTE%20SITE%20PILGER.png'

export default function HeroVideoBackground() {
  return (
    <Image
      src={HERO_BACKGROUND_IMAGE_SRC}
      alt="Guilherme Pilger em curadoria de imóveis de alto padrão no litoral catarinense"
      className="hero-background-frame"
      fill
      priority
      fetchPriority="high"
      quality={88}
      sizes="(max-width: 768px) 100vw, 1360px"
      style={{
        objectFit: 'cover',
        objectPosition: 'center 28%',
        pointerEvents: 'none',
        opacity: 0.9,
      }}
    />
  )
}
