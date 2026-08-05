'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react'
import { trackEvent } from '@/lib/tracking/client'

const THANK_YOU_PATH = '/corretor-nota-8/desconto'
const STORAGE_KEY = 'guilherme_vote_bridge_state_v1'
const OPENED_AT_KEY = 'vote_official_opened_at'
const LEFT_FOR_VOTE_KEY = 'guilherme_vote_bridge_left_for_official'

const INTERNAL_PARAM_KEYS = new Set([
  'acao',
  'campaign',
  'campaign_id',
  'comment_id',
  'delivery',
  'fbclid',
  'gclid',
  'lead_id',
  'lead_phone',
  'media_id',
  'origem',
  'platform',
  'post',
  'post_id',
  'source',
  'thread_id',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
  'wa_phone',
  'whatsapp',
  'wpp_phone',
])

const TRACKING_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'origem',
  'source',
  'platform',
  'acao',
  'delivery',
  'campaign',
  'campaign_id',
  'post',
  'post_id',
  'media_id',
  'comment_id',
  'lead_id',
] as const

type VoteJourneyState = 'initial' | 'opened' | 'returned'

type StoredVoteBridgeState = {
  voteOfficialOpenedAt?: string
  voteFlowSource?: string
  lastReturnAt?: string
  returnTrackedForOpenedAt?: string
  selfDeclaredAt?: string
  lastCtaLocation?: string
}

type VotarGuilhermeClientProps = {
  voteUrl: string
}

const heroCopy: Record<VoteJourneyState, { badge: string; title: string; text: string; statusTitle: string; statusText: string }> = {
  initial: {
    badge: 'ACESSO À VOTAÇÃO OFICIAL',
    title: 'Influenciador do ano a trinca',
    text: 'A votação acontece no ambiente oficial do prêmio. Abra a página, confira Guilherme Pilger na categoria Influenciador do Ano e, quando concluir, volte aqui para continuar.',
    statusTitle: 'Primeira ação',
    statusText: 'Abra o site externo da premiação para registrar o seu voto.',
  },
  opened: {
    badge: 'PRÓXIMO PASSO',
    title: 'Quando concluir, volte aqui.',
    text: 'Depois de finalizar no site oficial, retorne para esta página e declare abaixo para continuar.',
    statusTitle: 'Acesso aberto',
    statusText: 'Esta página salvou apenas que você abriu a votação. Ela não verifica o voto automaticamente.',
  },
  returned: {
    badge: 'PRÓXIMO PASSO',
    title: 'Voltou da votação?',
    text: 'Se você já concluiu no ambiente oficial, continue para acessar o agradecimento.',
    statusTitle: 'Pronto para continuar',
    statusText: 'Toque em “Já votei” somente se você terminou o processo no site externo.',
  },
}

function canUseSessionStorage() {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
  } catch {
    return false
  }
}

function readStoredState(): StoredVoteBridgeState {
  if (!canUseSessionStorage()) return {}

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}') as StoredVoteBridgeState
    const openedAt = window.sessionStorage.getItem(OPENED_AT_KEY) || parsed.voteOfficialOpenedAt
    return openedAt ? { ...parsed, voteOfficialOpenedAt: openedAt } : parsed
  } catch {
    return {}
  }
}

function writeStoredState(nextState: StoredVoteBridgeState) {
  if (!canUseSessionStorage()) return

  try {
    const merged = {
      ...readStoredState(),
      ...nextState,
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    if (merged.voteOfficialOpenedAt) {
      window.sessionStorage.setItem(OPENED_AT_KEY, merged.voteOfficialOpenedAt)
    }
  } catch {
    // Restricted in-app browsers can deny storage; the link must still work.
  }
}

function readSessionValue(key: string) {
  if (!canUseSessionStorage()) return null

  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSessionValue(key: string, value: string) {
  if (!canUseSessionStorage()) return

  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Storage is best-effort in embedded browsers.
  }
}

function removeSessionValue(key: string) {
  if (!canUseSessionStorage()) return

  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Storage is best-effort in embedded browsers.
  }
}

function shouldPreserveInternalParam(key: string) {
  const normalized = key.toLowerCase()
  return (
    INTERNAL_PARAM_KEYS.has(normalized)
    || normalized.startsWith('utm_')
    || normalized.startsWith('lead_')
    || normalized.startsWith('wa_')
    || normalized.startsWith('wpp_')
  )
}

function buildThankYouHref(search: string) {
  const current = new URLSearchParams(search)
  const next = new URLSearchParams()

  current.forEach((value, key) => {
    if (value && shouldPreserveInternalParam(key)) {
      next.append(key, value)
    }
  })

  next.set('acao', 'ja_votei')

  const query = next.toString()
  return query ? `${THANK_YOU_PATH}?${query}` : THANK_YOU_PATH
}

function normalizeToken(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function platformFromSearch(params: URLSearchParams) {
  const explicit = normalizeToken(params.get('platform'))
  const source = normalizeToken(params.get('utm_source') || params.get('origem') || params.get('source'))

  if (explicit) return explicit
  if (source.includes('instagram') || source === 'ig') return 'instagram'
  if (source.includes('facebook') || source === 'fb') return 'facebook'
  if (source.includes('whatsapp') || source === 'wpp') return 'whatsapp'
  if (source.includes('google')) return 'google'

  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('instagram')) return 'instagram'
    if (ua.includes('fbav') || ua.includes('fban') || ua.includes('fb_iab')) return 'facebook'
  }

  if (typeof document !== 'undefined') {
    const referrer = document.referrer.toLowerCase()
    if (referrer.includes('instagram.com')) return 'instagram'
    if (referrer.includes('facebook.com') || referrer.includes('fb.com')) return 'facebook'
  }

  return 'direct'
}

function sourceFromSearch(params: URLSearchParams) {
  return params.get('utm_source') || params.get('origem') || params.get('source') || platformFromSearch(params)
}

function trackingContext(search: string) {
  const params = new URLSearchParams(search)
  const metadata: Record<string, unknown> = {
    source: sourceFromSearch(params),
    platform: platformFromSearch(params),
  }

  TRACKING_PARAM_KEYS.forEach(key => {
    const value = params.get(key)
    if (value) metadata[key] = value
  })

  if (typeof document !== 'undefined' && document.referrer) {
    metadata.referrer = document.referrer
  }

  return metadata
}

export default function VotarGuilhermeClient({ voteUrl }: VotarGuilhermeClientProps) {
  const [journeyState, setJourneyState] = useState<VoteJourneyState>('initial')
  const [locationSearch, setLocationSearch] = useState('')
  const [stickyVisible, setStickyVisible] = useState(false)
  const primaryActionRef = useRef<HTMLDivElement | null>(null)
  const pageViewTrackedRef = useRef(false)

  const currentCopy = heroCopy[journeyState]
  const thankYouHref = useMemo(() => buildThankYouHref(locationSearch), [locationSearch])
  const continuationIsPrimary = journeyState !== 'initial'

  const sendTracking = useCallback((eventType: string, metadata: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return

    void trackEvent(eventType, {
      ...trackingContext(window.location.search),
      ...metadata,
    })
  }, [])

  const recordReturn = useCallback((returnReason: string) => {
    const stored = readStoredState()
    if (!stored.voteOfficialOpenedAt) return

    const returnedAt = new Date().toISOString()
    const alreadyTracked = stored.returnTrackedForOpenedAt === stored.voteOfficialOpenedAt

    writeStoredState({
      lastReturnAt: returnedAt,
      returnTrackedForOpenedAt: stored.voteOfficialOpenedAt,
    })

    removeSessionValue(LEFT_FOR_VOTE_KEY)

    setJourneyState('returned')

    if (!alreadyTracked) {
      sendTracking('vote_page_returned', {
        return_reason: returnReason,
        vote_official_opened_at: stored.voteOfficialOpenedAt,
        last_return_at: returnedAt,
      })
    }
  }, [sendTracking])

  useEffect(() => {
    let disposed = false

    const syncInitialState = () => {
      if (disposed) return

      const search = window.location.search
      const stored = readStoredState()
      const leftForVote = readSessionValue(LEFT_FOR_VOTE_KEY) === 'true'
      const initialState: VoteJourneyState = stored.voteOfficialOpenedAt
        ? leftForVote || stored.lastReturnAt
          ? 'returned'
          : 'opened'
        : 'initial'

      setLocationSearch(search)
      setJourneyState(initialState)

      if (!pageViewTrackedRef.current) {
        pageViewTrackedRef.current = true
        void trackEvent('vote_bridge_viewed', {
          ...trackingContext(search),
          journey_state: initialState,
          vote_official_opened_at: stored.voteOfficialOpenedAt || null,
        })
      }

      if (stored.voteOfficialOpenedAt && leftForVote) {
        recordReturn('page_mount')
      }
    }

    queueMicrotask(syncInitialState)

    return () => {
      disposed = true
    }
  }, [recordReturn])

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      const stored = readStoredState()
      const leftForVote = readSessionValue(LEFT_FOR_VOTE_KEY) === 'true'

      if (stored.voteOfficialOpenedAt && (event.persisted || leftForVote)) {
        recordReturn(event.persisted ? 'pageshow_bfcache' : 'pageshow')
      }
    }

    const handleFocus = () => {
      if (readSessionValue(LEFT_FOR_VOTE_KEY) === 'true') {
        recordReturn('focus')
      }
    }

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible'
        && readSessionValue(LEFT_FOR_VOTE_KEY) === 'true'
      ) {
        recordReturn('visibilitychange')
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [recordReturn])

  useEffect(() => {
    const actionElement = primaryActionRef.current
    if (!actionElement || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setStickyVisible(!entry.isIntersecting)
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -12px 0px',
      }
    )

    observer.observe(actionElement)
    return () => observer.disconnect()
  }, [journeyState])

  const handleOpenOfficialVote = useCallback((ctaLocation: string) => {
    const openedAt = new Date().toISOString()
    const params = new URLSearchParams(window.location.search)
    const source = sourceFromSearch(params)

    writeStoredState({
      voteOfficialOpenedAt: openedAt,
      voteFlowSource: source,
      lastCtaLocation: ctaLocation,
      lastReturnAt: undefined,
      returnTrackedForOpenedAt: undefined,
    })

    writeSessionValue(LEFT_FOR_VOTE_KEY, 'true')

    setJourneyState('opened')
    sendTracking('official_vote_opened', {
      cta_location: ctaLocation,
      source,
      vote_official_opened_at: openedAt,
      vote_url: voteUrl,
    })
  }, [sendTracking, voteUrl])

  const handleContinue = useCallback((ctaLocation: string) => {
    const stored = readStoredState()
    const selfDeclaredAt = new Date().toISOString()

    writeStoredState({
      selfDeclaredAt,
      lastCtaLocation: ctaLocation,
    })

    sendTracking('vote_self_declared', {
      cta_location: ctaLocation,
      self_declared_at: selfDeclaredAt,
      vote_official_opened_at: stored.voteOfficialOpenedAt || null,
    })

    sendTracking('vote_thank_you_opened', {
      cta_location: ctaLocation,
      destination_path: THANK_YOU_PATH,
      vote_official_opened_at: stored.voteOfficialOpenedAt || null,
    })
  }, [sendTracking])

  const officialVoteLink = (label: string, ctaLocation: string, className: string, shortLabel?: string) => (
    <a
      className={className}
      href={voteUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => handleOpenOfficialVote(ctaLocation)}
      aria-label={`${label} em site externo`}
    >
      <span>{shortLabel || label}</span>
      <ExternalLink size={18} aria-hidden="true" />
    </a>
  )

  return (
    <main className="vote-page" data-state={journeyState}>
      <section className="vote-hero" aria-labelledby="vote-title">
        <div className="vote-hero-inner">
          <div className="vote-copy">
            <span className="vote-kicker">
              <ShieldCheck size={15} aria-hidden="true" />
              {currentCopy.badge}
            </span>
            <h1 id="vote-title">{currentCopy.title}</h1>
            <p>{currentCopy.text}</p>

            <div className="vote-status" aria-live="polite">
              <strong>{currentCopy.statusTitle}</strong>
              <span>{currentCopy.statusText}</span>
            </div>
          </div>

          <div className="vote-media" aria-label="Fotografia de Guilherme Pilger">
            <div className="vote-photo-glow" aria-hidden="true" />
            <Image
              src="/images/products/corretor-nota-8-guilherme-hero-optimized.jpg"
              alt="Guilherme Pilger sentado, usando blazer preto e camisa branca."
              width={520}
              height={620}
              priority
            />
          </div>

          <div className="vote-action-panel" ref={primaryActionRef}>
            {continuationIsPrimary ? (
              <>
                <Link
                  className="vote-primary"
                  href={thankYouHref}
                  onClick={() => handleContinue('hero_primary')}
                >
                  <span>JÁ VOTEI — CONTINUAR</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                {officialVoteLink(
                  journeyState === 'returned' ? 'AINDA NÃO CONCLUÍ' : 'ABRIR VOTAÇÃO NOVAMENTE',
                  'hero_secondary',
                  'vote-secondary'
                )}
              </>
            ) : (
              <>
                {officialVoteLink('ABRIR VOTAÇÃO OFICIAL', 'hero_primary', 'vote-primary')}
                <Link
                  className="vote-secondary-link"
                  href={thankYouHref}
                  onClick={() => handleContinue('hero_secondary')}
                >
                  Já concluiu a votação? Continuar
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </>
            )}

            <p className="vote-microcopy">Você será direcionado para um site externo.</p>
          </div>
        </div>
      </section>

      <section className="vote-flow" aria-labelledby="vote-flow-title">
        <div className="vote-flow-heading">
          <span>Como funciona</span>
          <h2 id="vote-flow-title">É simples</h2>
        </div>
        <div className="vote-flow-steps">
          <article className="vote-flow-step" data-active={journeyState === 'initial'}>
            <strong>01</strong>
            <div>
              <h3>Abra a votação oficial</h3>
              <p>Acesse o ambiente oficial e confira o nome do candidato.</p>
            </div>
            {journeyState !== 'initial' && <span className="vote-step-state">Acesso aberto</span>}
          </article>

          <div className="vote-flow-divider" aria-hidden="true" />

          <article className="vote-flow-step" data-active={journeyState !== 'initial'}>
            <strong>02</strong>
            <div>
              <h3>Depois de votar, volte e continue</h3>
              <p>Quando terminar, retorne e toque em “Já votei”.</p>
            </div>
            {journeyState !== 'initial' && <span className="vote-step-state">Próximo passo</span>}
          </article>
        </div>
      </section>

      <footer className="vote-footer">
        <p>A votação acontece em ambiente externo e independente. Esta página apenas direciona você ao site oficial.</p>
      </footer>

      <div className={`vote-mobile-bar ${stickyVisible ? 'is-visible' : ''}`} aria-hidden={!stickyVisible}>
        {continuationIsPrimary ? (
          <Link
            className="vote-mobile-cta"
            href={thankYouHref}
            tabIndex={stickyVisible ? 0 : -1}
            onClick={() => handleContinue('mobile_sticky')}
          >
            <span>JÁ VOTEI — CONTINUAR</span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : (
          officialVoteLink('ABRIR VOTAÇÃO OFICIAL', 'mobile_sticky', 'vote-mobile-cta', 'ABRIR VOTAÇÃO')
        )}
      </div>

      <style jsx global>{`
        html,
        body {
          background: #020707 !important;
        }

        body {
          margin: 0;
        }

        .vote-page,
        .vote-page * {
          box-sizing: border-box;
        }

        .vote-page {
          min-height: 100vh;
          color: #fff9ec;
          background:
            linear-gradient(180deg, #020707 0%, #06100f 100%);
          overflow-x: hidden;
        }

        .vote-hero {
          position: relative;
          min-height: 560px;
          overflow: hidden;
          border-bottom: 1px solid rgba(232, 176, 73, 0.2);
          background:
            radial-gradient(circle at 76% 24%, rgba(232, 176, 73, 0.2), transparent 27%),
            linear-gradient(90deg, rgba(2, 7, 7, 0.98) 0%, rgba(2, 7, 7, 0.9) 43%, rgba(2, 7, 7, 0.62) 100%),
            url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") right center / cover no-repeat;
        }

        .vote-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(2, 7, 7, 0.18) 0%, rgba(2, 7, 7, 0.84) 100%),
            radial-gradient(circle at 58% 64%, rgba(232, 176, 73, 0.12), transparent 24%);
        }

        .vote-hero-inner {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
          grid-template-areas:
            "copy media"
            "actions media";
          align-items: center;
          column-gap: 64px;
          row-gap: 24px;
          width: min(1160px, calc(100% - 48px));
          min-height: 560px;
          margin: 0 auto;
          padding: 42px 0;
        }

        .vote-copy {
          grid-area: copy;
          max-width: 650px;
          animation: voteFadeIn 360ms ease both;
        }

        .vote-kicker,
        .vote-primary,
        .vote-secondary,
        .vote-secondary-link,
        .vote-mobile-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .vote-kicker {
          gap: 8px;
          width: fit-content;
          margin-bottom: 18px;
          padding: 7px 10px;
          border: 1px solid rgba(232, 176, 73, 0.5);
          border-radius: 8px;
          color: #f1b947;
          background: rgba(232, 176, 73, 0.08);
          font-size: 0.72rem;
          font-weight: 900;
          line-height: 1;
          text-transform: uppercase;
        }

        .vote-page h1,
        .vote-page h2,
        .vote-page h3 {
          margin: 0;
          letter-spacing: 0;
        }

        .vote-page h1 {
          max-width: 620px;
          color: #fffdf7;
          font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
          font-size: 4.8rem;
          font-weight: 700;
          line-height: 0.96;
        }

        .vote-copy > p {
          max-width: 620px;
          margin: 20px 0 0;
          color: rgba(255, 249, 236, 0.8);
          font-size: 1.05rem;
          line-height: 1.7;
        }

        .vote-status {
          display: grid;
          gap: 4px;
          max-width: 570px;
          margin-top: 22px;
          padding: 13px 15px;
          border: 1px solid rgba(232, 176, 73, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.045);
        }

        .vote-status strong {
          color: #f1b947;
          font-size: 0.78rem;
          line-height: 1.2;
          text-transform: uppercase;
        }

        .vote-status span {
          color: rgba(255, 249, 236, 0.76);
          font-size: 0.94rem;
          line-height: 1.48;
        }

        .vote-media {
          grid-area: media;
          position: relative;
          justify-self: end;
          width: min(100%, 410px);
          overflow: hidden;
          border: 1px solid rgba(232, 176, 73, 0.3);
          border-radius: 8px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01));
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.34);
          animation: voteFadeIn 420ms ease 70ms both;
        }

        .vote-photo-glow {
          position: absolute;
          inset: auto 12% -24px 12%;
          height: 80px;
          border-radius: 50%;
          background: rgba(232, 176, 73, 0.18);
          filter: blur(24px);
        }

        .vote-media img {
          position: relative;
          z-index: 1;
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        .vote-action-panel {
          grid-area: actions;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px 14px;
          max-width: 620px;
          animation: voteFadeIn 360ms ease 110ms both;
        }

        .vote-primary,
        .vote-secondary,
        .vote-mobile-cta {
          gap: 9px;
          min-height: 54px;
          border-radius: 8px;
          padding: 0 20px;
          border: 1px solid transparent;
          font-size: 0.8rem;
          font-weight: 950;
          line-height: 1.18;
          text-align: center;
          text-decoration: none;
          text-transform: uppercase;
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
        }

        .vote-primary,
        .vote-mobile-cta {
          color: #07100f;
          background: #f1b947;
          box-shadow: 0 16px 34px rgba(232, 176, 73, 0.24);
        }

        .vote-primary:hover,
        .vote-mobile-cta:hover {
          transform: translateY(-1px);
          background: #ffd06b;
          box-shadow: 0 18px 38px rgba(232, 176, 73, 0.3);
        }

        .vote-secondary {
          color: #fff9ec;
          border-color: rgba(255, 249, 236, 0.22);
          background: rgba(255, 255, 255, 0.055);
        }

        .vote-secondary:hover {
          transform: translateY(-1px);
          border-color: rgba(232, 176, 73, 0.45);
          background: rgba(232, 176, 73, 0.1);
        }

        .vote-secondary-link {
          gap: 7px;
          min-height: 44px;
          color: rgba(255, 249, 236, 0.82);
          font-size: 0.94rem;
          font-weight: 700;
          text-decoration: none;
        }

        .vote-secondary-link:hover {
          color: #f1b947;
        }

        .vote-microcopy {
          flex-basis: 100%;
          margin: -2px 0 0;
          color: rgba(255, 249, 236, 0.58);
          font-size: 0.88rem;
          line-height: 1.42;
        }

        .vote-primary:active,
        .vote-secondary:active,
        .vote-secondary-link:active,
        .vote-mobile-cta:active {
          transform: translateY(0);
        }

        .vote-primary:focus-visible,
        .vote-secondary:focus-visible,
        .vote-secondary-link:focus-visible,
        .vote-mobile-cta:focus-visible {
          outline: 3px solid rgba(255, 255, 255, 0.86);
          outline-offset: 3px;
        }

        .vote-flow {
          display: grid;
          grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
          gap: 34px;
          width: min(1160px, calc(100% - 48px));
          margin: 0 auto;
          padding: 34px 0 32px;
        }

        .vote-flow-heading span {
          display: block;
          color: #f1b947;
          font-size: 0.74rem;
          font-weight: 950;
          line-height: 1;
          text-transform: uppercase;
        }

        .vote-flow-heading h2 {
          margin-top: 8px;
          color: #fffdf7;
          font-size: 2rem;
          line-height: 1.05;
        }

        .vote-flow-steps {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr);
          align-items: stretch;
          gap: 18px;
        }

        .vote-flow-step {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 14px;
          align-content: start;
          min-height: 112px;
          padding: 16px 0;
          border-top: 1px solid rgba(232, 176, 73, 0.26);
        }

        .vote-flow-step strong {
          color: #f1b947;
          font-size: 0.8rem;
          line-height: 1.4;
        }

        .vote-flow-step h3 {
          color: #fffdf7;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 1rem;
          font-weight: 850;
          line-height: 1.25;
        }

        .vote-flow-step p {
          margin: 6px 0 0;
          color: rgba(255, 249, 236, 0.68);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .vote-flow-step[data-active="true"] {
          border-top-color: rgba(241, 185, 71, 0.78);
        }

        .vote-step-state {
          grid-column: 2;
          width: fit-content;
          padding: 4px 7px;
          border: 1px solid rgba(241, 185, 71, 0.26);
          border-radius: 999px;
          color: #f1b947;
          background: rgba(241, 185, 71, 0.08);
          font-size: 0.72rem;
          font-weight: 850;
          line-height: 1;
        }

        .vote-flow-divider {
          align-self: center;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(232, 176, 73, 0.55), transparent);
        }

        .vote-footer {
          border-top: 1px solid rgba(232, 176, 73, 0.16);
          padding: 16px 24px 20px;
          text-align: center;
          background: rgba(255, 255, 255, 0.025);
        }

        .vote-footer p {
          margin: 0 auto;
          max-width: 720px;
          color: rgba(255, 249, 236, 0.62);
          font-size: 0.88rem;
          line-height: 1.48;
        }

        .vote-mobile-bar {
          position: fixed;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 40;
          display: none;
          padding: 10px 18px max(10px, env(safe-area-inset-bottom));
          border-top: 1px solid rgba(232, 176, 73, 0.22);
          background: rgba(2, 7, 7, 0.92);
          opacity: 0;
          pointer-events: none;
          transform: translateY(12px);
          transition: opacity 180ms ease, transform 180ms ease;
          visibility: hidden;
        }

        .vote-mobile-bar.is-visible {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
          visibility: visible;
        }

        .vote-mobile-cta {
          width: 100%;
        }

        @keyframes voteFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (min-height: 900px) and (min-width: 901px) {
          .vote-hero,
          .vote-hero-inner {
            min-height: 620px;
          }
        }

        @media (max-width: 900px) {
          .vote-page {
            padding-bottom: 78px;
          }

          .vote-hero {
            min-height: auto;
            background:
              linear-gradient(180deg, rgba(2, 7, 7, 0.98) 0%, rgba(2, 7, 7, 0.88) 62%, rgba(2, 7, 7, 0.96) 100%),
              url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") center top / cover no-repeat;
          }

          .vote-hero-inner {
            display: grid;
            grid-template-columns: 1fr;
            grid-template-areas:
              "copy"
              "media"
              "actions";
            gap: 22px;
            width: min(640px, calc(100% - 40px));
            min-height: auto;
            padding: 34px 0 26px;
          }

          .vote-copy {
            max-width: 100%;
          }

          .vote-page h1 {
            max-width: 520px;
            font-size: 3rem;
            line-height: 1;
          }

          .vote-copy > p {
            max-width: 560px;
            margin-top: 16px;
            font-size: 1rem;
            line-height: 1.62;
          }

          .vote-status {
            margin-top: 16px;
            padding: 12px 13px;
          }

          .vote-media {
            justify-self: start;
            width: min(250px, 72vw);
          }

          .vote-action-panel {
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
            max-width: 430px;
            gap: 10px;
          }

          .vote-primary,
          .vote-secondary,
          .vote-mobile-cta {
            width: 100%;
            min-height: 56px;
            padding: 0 16px;
            font-size: 0.78rem;
          }

          .vote-secondary-link {
            justify-content: center;
            width: 100%;
            min-height: 44px;
            text-align: center;
          }

          .vote-microcopy {
            margin-top: 0;
            text-align: center;
          }

          .vote-flow {
            grid-template-columns: 1fr;
            gap: 16px;
            width: min(640px, calc(100% - 40px));
            padding: 26px 0 24px;
          }

          .vote-flow-heading h2 {
            font-size: 1.56rem;
          }

          .vote-flow-steps {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .vote-flow-step {
            min-height: auto;
            padding: 14px 0;
          }

          .vote-flow-divider {
            width: 1px;
            height: 18px;
            margin-left: 10px;
            background: linear-gradient(180deg, rgba(232, 176, 73, 0.6), transparent);
          }

          .vote-mobile-bar {
            display: block;
          }
        }

        @media (max-width: 520px) {
          .vote-page {
            padding-bottom: 76px;
          }

          .vote-hero-inner,
          .vote-flow {
            width: calc(100% - 36px);
          }

          .vote-hero-inner {
            gap: 18px;
            padding-top: 24px;
            padding-bottom: 18px;
          }

          .vote-kicker {
            max-width: 100%;
            margin-bottom: 14px;
            font-size: 0.66rem;
          }

          .vote-page h1 {
            font-size: 2.44rem;
          }

          .vote-copy > p {
            font-size: 1rem;
            line-height: 1.54;
          }

          .vote-status {
            gap: 3px;
            padding: 9px 10px;
          }

          .vote-status strong {
            font-size: 0.7rem;
          }

          .vote-status span,
          .vote-flow-step p,
          .vote-footer p {
            font-size: 0.88rem;
            line-height: 1.38;
          }

          .vote-media {
            width: min(170px, 58vw);
          }

          .vote-action-panel {
            gap: 8px;
          }

          .vote-secondary-link {
            min-height: 34px;
            font-size: 0.9rem;
          }

          .vote-microcopy {
            font-size: 0.82rem;
          }

          .vote-flow {
            gap: 12px;
            padding: 20px 0 18px;
          }

          .vote-flow-step {
            padding: 10px 0;
          }

          .vote-flow-step h3 {
            font-size: 0.96rem;
          }

          .vote-flow-step p {
            margin-top: 4px;
          }

          .vote-flow-heading h2 {
            font-size: 1.42rem;
          }

          .vote-flow-divider {
            height: 12px;
          }

          .vote-footer {
            padding: 12px 18px 14px;
          }

          .vote-mobile-bar {
            padding-right: 14px;
            padding-left: 14px;
          }
        }

        @media (max-width: 374px) {
          .vote-hero-inner,
          .vote-flow {
            width: calc(100% - 32px);
          }

          .vote-page h1 {
            font-size: 2.38rem;
          }

          .vote-primary,
          .vote-secondary,
          .vote-mobile-cta {
            font-size: 0.72rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .vote-copy,
          .vote-media,
          .vote-action-panel {
            animation: none;
          }

          .vote-primary,
          .vote-secondary,
          .vote-mobile-cta,
          .vote-mobile-bar {
            transition: none;
          }
        }
      `}</style>
    </main>
  )
}
