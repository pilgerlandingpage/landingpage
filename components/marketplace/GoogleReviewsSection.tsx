'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { ArrowUpRight, Star } from 'lucide-react'
import type { HomepageGoogleReview, HomepageGoogleReviews } from '@/lib/google-reviews'

function formatRating(value: number) {
  if (!value) return ''
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function formatReviewCount(value: number) {
  if (!value) return ''
  return value.toLocaleString('pt-BR')
}

function ReviewStars({ rating, size = 14 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating)

  return (
    <span className="google-review-stars" aria-label={`${formatRating(rating)} de 5 estrelas`}>
      {[0, 1, 2, 3, 4].map(index => (
        <Star
          key={index}
          size={size}
          fill={index < rounded ? '#d6a84f' : 'transparent'}
          color={index < rounded ? '#d6a84f' : 'rgba(24,20,16,0.22)'}
          strokeWidth={2.1}
        />
      ))}
    </span>
  )
}

function ReviewAuthor({ review }: { review: HomepageGoogleReview }) {
  const avatar = review.authorPhotoUri ? (
    <img src={review.authorPhotoUri} alt="" loading="lazy" referrerPolicy="no-referrer" />
  ) : (
    <span>{review.authorName.charAt(0).toUpperCase()}</span>
  )

  const content = (
    <>
      <span className="google-review-avatar" aria-hidden="true">{avatar}</span>
      <span className="google-review-author-copy">
        <strong>{review.authorName}</strong>
        {review.publishedLabel && <small>{review.publishedLabel}</small>}
      </span>
    </>
  )

  if (!review.authorUri) {
    return <div className="google-review-author">{content}</div>
  }

  return (
    <a className="google-review-author" href={review.authorUri} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  )
}

function GoogleWordmark() {
  return (
    <span className="google-wordmark" translate="no" aria-label="Google">
      <span style={{ color: '#4285f4' }}>G</span>
      <span style={{ color: '#ea4335' }}>o</span>
      <span style={{ color: '#fbbc05' }}>o</span>
      <span style={{ color: '#4285f4' }}>g</span>
      <span style={{ color: '#34a853' }}>l</span>
      <span style={{ color: '#ea4335' }}>e</span>
    </span>
  )
}

export default function GoogleReviewsSection({ data }: { data: HomepageGoogleReviews | null }) {
  const reviews = data?.reviews || []
  const reviewCount = reviews.length
  const [activeReviewIndex, setActiveReviewIndex] = useState(0)
  const [isCarouselPaused, setIsCarouselPaused] = useState(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const clearResumeTimer = useCallback(() => {
    if (!resumeTimerRef.current) return
    clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = null
  }, [])

  const pauseCarousel = useCallback((resumeAfterMs = 0) => {
    setIsCarouselPaused(true)
    clearResumeTimer()

    if (resumeAfterMs > 0) {
      resumeTimerRef.current = setTimeout(() => {
        setIsCarouselPaused(false)
        resumeTimerRef.current = null
      }, resumeAfterMs)
    }
  }, [clearResumeTimer])

  const resumeCarousel = useCallback(() => {
    clearResumeTimer()
    setIsCarouselPaused(false)
  }, [clearResumeTimer])

  const selectReview = useCallback((index: number) => {
    setActiveReviewIndex(index)
    pauseCarousel(9000)
  }, [pauseCarousel])

  const showPreviousReview = useCallback(() => {
    setActiveReviewIndex(current => (current - 1 + reviewCount) % reviewCount)
    pauseCarousel(9000)
  }, [pauseCarousel, reviewCount])

  const showNextReview = useCallback(() => {
    setActiveReviewIndex(current => (current + 1) % reviewCount)
    pauseCarousel(9000)
  }, [pauseCarousel, reviewCount])

  const handleReviewTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (reviewCount <= 1) return

    const touch = event.touches[0]
    if (!touch) return

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    }
    pauseCarousel(9000)
  }, [pauseCarousel, reviewCount])

  const handleReviewTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current
    touchStartRef.current = null

    if (!start || reviewCount <= 1) return

    const touch = event.changedTouches[0]
    if (!touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    const isHorizontalSwipe = Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25

    if (!isHorizontalSwipe) return

    if (deltaX < 0) {
      showNextReview()
    } else {
      showPreviousReview()
    }
  }, [reviewCount, showNextReview, showPreviousReview])

  useEffect(() => {
    if (reviewCount <= 1 || isCarouselPaused) return

    const interval = window.setInterval(() => {
      setActiveReviewIndex(current => (current + 1) % reviewCount)
    }, 4200)

    return () => window.clearInterval(interval)
  }, [isCarouselPaused, reviewCount])

  useEffect(() => () => clearResumeTimer(), [clearResumeTimer])

  if (!data || reviewCount === 0) return null

  const primaryReviewUrl = data.reviewUrl || data.googleMapsUri || ''
  const safeActiveReviewIndex = Math.min(activeReviewIndex, reviewCount - 1)

  return (
    <section className="google-reviews-section" aria-labelledby="google-reviews-title">
      <div className="google-reviews-inner">
        <div className="google-reviews-header">
          <div className="google-reviews-copy">
            <span className="google-reviews-kicker">Depoimentos reais</span>
            <h2 id="google-reviews-title">O que clientes dizem no <GoogleWordmark />.</h2>
            <p>
              Avaliacoes publicadas por clientes no <span translate="no">Google Maps</span>, exibidas por relevancia.
            </p>
          </div>

          <div className="google-reviews-summary">
            <div className="google-reviews-score">
              <strong>{formatRating(data.rating) || '5,0'}</strong>
              <span>
                <ReviewStars rating={data.rating || 5} size={15} />
                {data.userRatingCount > 0 && <small>{formatReviewCount(data.userRatingCount)} avaliacoes</small>}
              </span>
            </div>

            {primaryReviewUrl && (
              <a
                className="google-reviews-cta"
                href={primaryReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Avaliar no Google"
              >
                <span>Avaliar no</span>
                <GoogleWordmark />
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </div>

        <div
          className="google-reviews-grid"
          style={{ '--google-review-count': reviewCount } as CSSProperties}
          onMouseEnter={() => pauseCarousel()}
          onMouseLeave={resumeCarousel}
          onPointerDown={() => pauseCarousel(9000)}
          onTouchStart={handleReviewTouchStart}
          onTouchEnd={handleReviewTouchEnd}
          onTouchCancel={() => { touchStartRef.current = null }}
          onFocusCapture={() => pauseCarousel()}
          onBlurCapture={resumeCarousel}
        >
          {reviews.map((review, index) => (
            <article
              className={`google-review-card${index === safeActiveReviewIndex ? ' is-active' : ''}`}
              key={review.id}
            >
              <div className="google-review-card-head">
                <ReviewAuthor review={review} />
                <ReviewStars rating={review.rating} />
              </div>
              <p>&quot;{review.text}&quot;</p>
              {(review.reviewUri || review.flagContentUri) && (
                <div className="google-review-links">
                  {review.reviewUri && (
                    <a className="google-review-source" href={review.reviewUri} target="_blank" rel="noopener noreferrer">
                      Ver no <span translate="no">Google Maps</span>
                      <ArrowUpRight size={13} />
                    </a>
                  )}
                  {review.flagContentUri && (
                    <a className="google-review-report" href={review.flagContentUri} target="_blank" rel="noopener noreferrer">
                      Reportar
                    </a>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>

        {reviewCount > 1 && (
          <div className="google-reviews-carousel-controls" aria-label="Selecionar depoimento">
            {reviews.map((review, index) => (
              <button
                type="button"
                key={review.id}
                className={index === safeActiveReviewIndex ? 'is-active' : ''}
                aria-label={`Ver depoimento ${index + 1}`}
                aria-pressed={index === safeActiveReviewIndex}
                onClick={() => selectReview(index)}
              />
            ))}
          </div>
        )}

        <div className="google-reviews-attribution">
          Fonte: <span translate="no">Google Maps</span>
          {data.googleMapsUri && (
            <a href={data.googleMapsUri} target="_blank" rel="noopener noreferrer">
              Ver perfil
              <ArrowUpRight size={13} />
            </a>
          )}
        </div>
      </div>

      <style>{`
        .google-reviews-section {
          position: relative;
          overflow: hidden;
          padding: clamp(34px, 4.8vw, 64px) 20px;
          background: linear-gradient(180deg, #fffaf1 0%, #f7f7f5 100%);
          color: #17130f;
        }
        .google-reviews-inner {
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
        }
        .google-reviews-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 18px;
        }
        .google-reviews-copy {
          min-width: 0;
        }
        .google-reviews-kicker {
          display: inline-flex;
          color: #b8945f;
          font: 950 0.68rem/1 'Inter', sans-serif;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .google-reviews-copy h2 {
          max-width: 760px;
          margin: 8px 0 0;
          color: #17130f;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(1.5rem, 2.1vw, 2.35rem);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: 0;
        }
        .google-wordmark {
          display: inline-flex;
          align-items: baseline;
          font-family: Arial, Helvetica, sans-serif;
          font-weight: 500;
          letter-spacing: 0;
          line-height: 0.92;
          text-transform: none;
          white-space: nowrap;
        }
        .google-reviews-copy p {
          max-width: 760px;
          margin: 12px 0 0;
          color: #6d6255;
          font-size: 0.84rem;
          font-weight: 600;
          line-height: 1.45;
        }
        .google-reviews-summary {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex-shrink: 0;
        }
        .google-reviews-score {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          padding: 8px 12px;
          border: 1px solid rgba(31,27,21,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.72);
        }
        .google-reviews-score strong {
          color: #17130f;
          font-size: 1.38rem;
          font-weight: 950;
          line-height: 1;
        }
        .google-reviews-score > span {
          display: grid;
          gap: 3px;
        }
        .google-reviews-score small {
          color: #7a6e60;
          font-size: 0.66rem;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
        }
        .google-reviews-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          padding: 0 16px;
          border: 1px solid rgba(60,64,67,0.18);
          border-radius: 999px;
          background: #fff;
          color: #202124 !important;
          font: 950 0.7rem/1 'Inter', sans-serif;
          letter-spacing: 0.08em;
          text-decoration: none;
          text-transform: uppercase;
          white-space: nowrap;
          box-shadow: 0 8px 22px rgba(60,64,67,0.12);
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .google-reviews-cta .google-wordmark {
          font-size: 0.96rem;
          transform: translateY(-0.5px);
        }
        .google-reviews-cta:hover {
          border-color: rgba(66,133,244,0.42);
          box-shadow: 0 10px 26px rgba(66,133,244,0.16);
          transform: translateY(-1px);
        }
        .google-reviews-grid {
          display: grid;
          grid-template-columns: repeat(var(--google-review-count), minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }
        .google-review-card {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 256px;
          padding: 16px;
          border: 1px solid rgba(31,27,21,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.86);
          box-shadow: 0 14px 36px rgba(43,34,21,0.08);
        }
        .google-review-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
          margin-bottom: 14px;
        }
        .google-review-author {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          color: inherit;
          text-decoration: none;
        }
        .google-review-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          overflow: hidden;
          border-radius: 50%;
          background: #17130f;
          color: #dfc18e;
          font-size: 0.82rem;
          font-weight: 950;
          flex: 0 0 auto;
        }
        .google-review-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .google-review-author-copy {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .google-review-author-copy strong {
          overflow: hidden;
          color: #17130f;
          font-size: 0.88rem;
          font-weight: 900;
          line-height: 1.1;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .google-review-author-copy small {
          color: #8a7c6b;
          font-size: 0.68rem;
          font-weight: 750;
          line-height: 1;
        }
        .google-review-card p {
          display: -webkit-box;
          margin: 0;
          overflow: hidden;
          color: #4f463b;
          font-size: 0.82rem;
          font-weight: 540;
          line-height: 1.5;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 7;
        }
        .google-review-links {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: auto;
          padding-top: 16px;
        }
        .google-review-source,
        .google-review-report {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #7a5a26 !important;
          font-size: 0.68rem;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-decoration: none;
          text-transform: uppercase;
        }
        .google-review-report {
          color: #8a7c6b !important;
          font-size: 0.62rem;
        }
        .google-reviews-attribution {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 12px;
          color: #7f7468;
          font-size: 0.72rem;
          font-weight: 760;
        }
        .google-reviews-attribution a {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #17130f !important;
          font-weight: 900;
          text-decoration: none;
        }
        .google-review-stars {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          line-height: 1;
          white-space: nowrap;
        }
        .google-reviews-carousel-controls {
          display: none;
        }
        @media (max-width: 1180px) {
          .google-reviews-header {
            align-items: flex-start;
            flex-direction: column;
          }
          .google-reviews-summary {
            width: 100%;
            justify-content: space-between;
          }
          .google-reviews-grid {
            position: relative;
            grid-template-columns: 1fr;
            min-height: 272px;
            overflow: hidden;
            touch-action: pan-y;
            cursor: grab;
            user-select: none;
          }
          .google-reviews-grid:active {
            cursor: grabbing;
          }
          .google-review-card {
            grid-area: 1 / 1;
            min-height: 254px;
            opacity: 0;
            pointer-events: none;
            transform: translateX(18px) scale(0.985);
            transition: opacity 0.34s ease, transform 0.34s ease, visibility 0.34s ease;
            visibility: hidden;
          }
          .google-review-card.is-active {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(0) scale(1);
            visibility: visible;
          }
          .google-reviews-carousel-controls {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 22px;
            margin-top: 12px;
          }
          .google-reviews-carousel-controls button {
            width: 7px;
            height: 7px;
            padding: 0;
            border: 0;
            border-radius: 999px;
            background: rgba(122,90,38,0.28);
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease, width 0.2s ease;
          }
          .google-reviews-carousel-controls button.is-active {
            width: 22px;
            background: #7a5a26;
          }
        }
        @media (max-width: 560px) {
          .google-reviews-section {
            padding: 34px 14px;
          }
          .google-reviews-copy h2 {
            font-size: clamp(1.18rem, 6vw, 1.52rem);
          }
          .google-reviews-copy p {
            font-size: 0.72rem;
          }
          .google-reviews-summary {
            align-items: stretch;
            flex-direction: column;
            gap: 10px;
          }
          .google-reviews-cta {
            width: 100%;
          }
          .google-reviews-score {
            align-self: flex-start;
            min-height: 0;
            padding: 8px 10px;
            gap: 8px;
            border-radius: 999px;
            background: rgba(255,255,255,0.82);
          }
          .google-reviews-score strong {
            font-size: 1.1rem;
          }
          .google-reviews-score > span {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .google-reviews-score small {
            font-size: 0.62rem;
          }
          .google-reviews-score .google-review-stars svg {
            width: 12px;
            height: 12px;
          }
          .google-reviews-grid {
            min-height: 252px;
          }
          .google-review-card {
            min-height: 236px;
            padding: 18px;
          }
          .google-review-card p {
            font-size: 0.86rem;
            -webkit-line-clamp: 6;
          }
          .google-reviews-attribution {
            align-items: flex-start;
            justify-content: flex-start;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </section>
  )
}
