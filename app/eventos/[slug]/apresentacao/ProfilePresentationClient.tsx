'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
    BarChart3,
    BriefcaseBusiness,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Instagram,
    Maximize2,
    Presentation,
    QrCode,
    RefreshCw,
    ScanQrCode,
    Target,
    Trophy,
    Video,
    Youtube,
    Eye,
} from 'lucide-react'
import { trackEvent } from '@/lib/tracking/client'
import { SELF_ASSESSMENT_QUESTIONS } from '@/lib/events/self-assessment'

type Props = {
    eventTitle: string
    eventSlug: string
    eventDateLabel: string
    eventLocation: string
    assessmentPath: string
}

type Slide = {
    id: string
    title: ReactNode
    eyebrow: string
    content: ReactNode
    variant?: 'hero' | 'qr' | 'focus' | 'results' | 'video' | 'question' | 'vote'
}

type AssessmentResults = {
    registrations_count: number
    submitted_count: number
    average_score: number
    updated_at: string | null
    block_averages: Array<{
        block: string
        label: string
        average_percentage: number
        responses: number
    }>
    classification_counts: Array<{
        key: string
        label: string
        count: number
    }>
    ranking: Array<{
        name: string
        city: string | null
        score_percent: number
        classification_label: string
    }>
    strongest_questions: Array<{
        question_id: string
        title: string
        block_label: string
        average_score: number
        responses: number
    }>
    improvement_questions: Array<{
        question_id: string
        title: string
        block_label: string
        average_score: number
        responses: number
    }>
    question_progress: Array<{
        question_id: string
        title: string
        block: string
        block_label: string
        step: number
        completed_count: number
    }>
}

type SocialAuthorityMetrics = {
    total_views: number
    updated_at: string | null
    platforms: Array<{
        platform: 'youtube' | 'instagram' | 'tiktok' | 'facebook'
        label: string
        handle: string
        followers: number
        videos: number
        views: number
        updated_at: string | null
    }>
}

const QR_IMAGE_SRC = '/images/eventos/perfil-corretor-ideal-qr.png'
const INTRO_VIDEO_EMBED_URL = 'https://www.youtube.com/embed/_FcNjjliEk0?rel=0&modestbranding=1&playsinline=1'
const PRESENTATION_BACKGROUND_IMAGE = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/portobelo.png'
const GUILHERME_STAGE_PHOTO = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png'
const PUBLIC_SITE_ORIGIN = 'https://guilhermepilger.ai'
const GUILHERME_AWARDS_VOTE_URL = 'https://awards.atrincarealestate.com.br/#/categoria/influenciador-do-ano/candidato/2ba4d003-3f4b-4d1a-b079-43c8a253c9b7'

function TikTokIcon({ size = 18 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M14.2 4c.35 2.46 1.78 4.12 4.3 4.28v3.1c-1.47.1-2.76-.34-4.22-1.23v5.8c0 7.36-8.02 9.66-11.25 4.38-2.08-3.4-.8-9.36 5.86-9.6v3.27c-.48.08-.99.2-1.45.36-1.39.47-2.18 1.36-1.96 2.92.42 2.98 5.88 3.86 5.42-1.96V4h3.3Z"
                fill="currentColor"
            />
        </svg>
    )
}

function formatUpdatedAt(value?: string | null) {
    if (!value) return 'Aguardando respostas'
    try {
        return new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value))
    } catch {
        return 'Atualizado agora'
    }
}

function formatCompactNumber(value?: number | null, fallback = '--') {
    const safeValue = Number(value || 0)
    if (!Number.isFinite(safeValue) || safeValue <= 0) return fallback

    return new Intl.NumberFormat('pt-BR', {
        notation: 'compact',
        maximumFractionDigits: safeValue >= 1_000_000 ? 1 : 0,
    }).format(safeValue)
}

function formatIntegerNumber(value?: number | null, fallback = '--') {
    const safeValue = Number(value || 0)
    if (!Number.isFinite(safeValue) || safeValue <= 0) return fallback

    return new Intl.NumberFormat('pt-BR').format(Math.round(safeValue))
}

function formatAtLeastCompactNumber(value?: number | null, fallback = '--') {
    const formatted = formatCompactNumber(value, fallback)
    if (formatted === fallback || formatted.startsWith('+')) return formatted
    return `+${formatted}`
}

export default function ProfilePresentationClient({
    eventTitle,
    eventSlug,
    eventDateLabel,
    eventLocation,
    assessmentPath,
}: Props) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [results, setResults] = useState<AssessmentResults | null>(null)
    const [resultsLoading, setResultsLoading] = useState(false)
    const [resultsError, setResultsError] = useState<string | null>(null)
    const [socialMetrics, setSocialMetrics] = useState<SocialAuthorityMetrics | null>(null)

    useEffect(() => {
        void trackEvent('event_profile_presentation_viewed', {
            event_slug: eventSlug,
            event_title: eventTitle,
            assessment: 'perfil_corretor_ideal',
        })
    }, [eventSlug, eventTitle])

    const assessmentUrl = useMemo(() => {
        return new URL(assessmentPath, PUBLIC_SITE_ORIGIN).toString()
    }, [assessmentPath])

    const trackAssessmentClick = useCallback((slideId: string) => {
        void trackEvent('event_profile_presentation_assessment_opened', {
            event_slug: eventSlug,
            event_title: eventTitle,
            assessment: 'perfil_corretor_ideal',
            target_url: assessmentUrl,
            slide_id: slideId,
        })
    }, [assessmentUrl, eventSlug, eventTitle])

    const trackVoteClick = useCallback((slideId: string) => {
        void trackEvent('event_profile_presentation_vote_opened', {
            event_slug: eventSlug,
            event_title: eventTitle,
            award: 'influenciador_do_ano',
            candidate: 'guilherme_pilger',
            target_url: GUILHERME_AWARDS_VOTE_URL,
            slide_id: slideId,
        })
    }, [eventSlug, eventTitle])

    const loadAssessmentResults = useCallback(async (showLoading = false) => {
        if (showLoading) setResultsLoading(true)
        setResultsError(null)

        try {
            const response = await fetch(`/api/eventos/${eventSlug}/self-assessment/results`, {
                cache: 'no-store',
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar o resultado.')
            setResults(data as AssessmentResults)
        } catch (error: any) {
            setResultsError(error?.message || 'Não foi possível carregar o resultado.')
        } finally {
            if (showLoading) setResultsLoading(false)
        }
    }, [eventSlug])

    const loadSocialAuthorityMetrics = useCallback(async () => {
        try {
            const response = await fetch(`/api/eventos/${eventSlug}/social-authority`, {
                cache: 'no-store',
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar as métricas sociais.')
            setSocialMetrics(data as SocialAuthorityMetrics)
        } catch (error) {
            console.warn('[Presentation] social authority metrics unavailable:', error)
        }
    }, [eventSlug])

    useEffect(() => {
        void loadAssessmentResults(true)
    }, [loadAssessmentResults])

    useEffect(() => {
        void loadSocialAuthorityMetrics()
        const interval = window.setInterval(() => {
            void loadSocialAuthorityMetrics()
        }, 60000)

        return () => window.clearInterval(interval)
    }, [loadSocialAuthorityMetrics])

    const socialByPlatform = useMemo(() => {
        return (socialMetrics?.platforms || []).reduce<Record<string, SocialAuthorityMetrics['platforms'][number]>>((acc, item) => {
            acc[item.platform] = item
            return acc
        }, {})
    }, [socialMetrics])

    const slides = useMemo<Slide[]>(() => [
        {
            id: 'abertura-video',
            eyebrow: 'Abertura',
            title: 'Perfil do Corretor Ideal',
            variant: 'video',
            content: (
                <div className="presentation-video-layout">
                    <iframe
                        src={INTRO_VIDEO_EMBED_URL}
                        title="Vídeo de abertura Perfil do Corretor Ideal"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
            ),
        },
        {
            id: 'guilherme',
            eyebrow: 'Apresentação ao vivo',
            title: 'Guilherme Pilger',
            variant: 'hero',
            content: (
                <div className="presentation-hero-content presentation-guilherme-overview">
                    <div className="presentation-guilherme-copy">
                        <p>
                            Corretor de imóveis de alto padrão, criador de conteúdo e uma das vozes da corretagem digital no litoral de Santa Catarina.
                        </p>
                        <div className="presentation-hero-facts" aria-label="Resumo de autoridade">
                            <span><BriefcaseBusiness size={18} /> Alto padrão</span>
                            <span><Video size={18} /> Autoridade em vídeo</span>
                            <span><Target size={18} /> Praia Brava e BC</span>
                        </div>
                        <div className="presentation-guilherme-panel" aria-label="Trajetória e autoridade de Guilherme Pilger">
                            <div className="presentation-guilherme-timeline">
                                <strong>Trajetória</strong>
                                {[
                                    ['2008', 'Início na corretagem no Rio Grande do Sul.'],
                                    ['2016', 'Primeiros vídeos de imóveis e validação da marca pessoal.'],
                                    ['2019', 'Mudança para Balneário Camboriú e entrada no litoral catarinense.'],
                                    ['2025', 'Nova operação de 295 m² na Praia Brava, em Itajaí.'],
                                    ['2026', 'Expansão da autoridade no alto padrão.'],
                                ].map(([year, text]) => (
                                    <div key={year}>
                                        <span>{year}</span>
                                        <p>{text}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="presentation-guilherme-metrics">
                                {[
                                    { value: 'R$ 200 mi', label: 'VGV em 2025', Icon: BarChart3 },
                                    { value: 'R$ 500 bi', label: 'Meta projetada', Icon: Trophy },
                                    {
                                        value: formatCompactNumber(socialByPlatform.youtube?.followers, '119 mil'),
                                        label: `${formatIntegerNumber(socialByPlatform.youtube?.videos, '980')} vídeos no YouTube`,
                                        Icon: Youtube,
                                        tone: 'youtube',
                                    },
                                    {
                                        value: formatCompactNumber(socialByPlatform.instagram?.followers, '199 mil'),
                                        label: `${formatIntegerNumber(socialByPlatform.instagram?.videos, '1.858')} publicações no Instagram`,
                                        Icon: Instagram,
                                        tone: 'instagram',
                                    },
                                    {
                                        value: formatCompactNumber(socialByPlatform.tiktok?.followers, '210 mil'),
                                        label: `${formatAtLeastCompactNumber(socialByPlatform.tiktok?.views, '+10 mi')} visualizações no TikTok`,
                                        Icon: TikTokIcon,
                                        tone: 'tiktok',
                                    },
                                    {
                                        value: formatAtLeastCompactNumber(socialMetrics?.total_views, '+5 bi'),
                                        label: 'visualizações estimadas',
                                        Icon: Eye,
                                        tone: 'views',
                                    },
                                ].map(({ value, label, Icon, tone }) => (
                                    <div key={`${value}-${label}`} className={tone ? `metric-${tone}` : undefined}>
                                        <span><Icon size={18} /></span>
                                        <strong>{value}</strong>
                                        <p>{label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'ferramenta',
            eyebrow: 'Por que criamos',
            title: 'Da rotina do alto padrão nasceu o Perfil do Corretor Ideal',
            variant: 'qr',
            content: (
                <div className="presentation-tool-qr-layout">
                    <div className="presentation-statement presentation-tool-story">
                        <p>
                            Na trajetória do Guilherme, uma coisa ficou clara: o corretor que mais cresce não vende apenas imóveis. Ele constrói confiança, domina o produto, cria presença digital e mantém uma rotina comercial consistente.
                        </p>
                        <p>
                            Por isso criamos um método de análise para transformar essa experiência em diagnóstico. Cada participante responde no celular, recebe sua nota e o painel do evento mostra a média geral dos corretores em tempo real.
                        </p>
                        <div>
                            <span>Cadastro rápido</span>
                            <span>{SELF_ASSESSMENT_QUESTIONS.length} perguntas guiadas</span>
                            <span>Nota no celular</span>
                            <span>Ranking e média ao vivo</span>
                        </div>
                    </div>
                    <div className="presentation-qr-panel">
                        <div className="presentation-qr-box">
                            <Image
                                src={QR_IMAGE_SRC}
                                alt="QR Code para acessar a autoavaliação Perfil do Corretor Ideal"
                                width={720}
                                height={720}
                                unoptimized
                            />
                        </div>
                        <div className="presentation-qr-copy">
                            <ScanQrCode size={34} />
                            <p>Escaneie, responda pelo celular e veja sua nota ao final.</p>
                            <Link href={assessmentPath} target="_blank" onClick={() => trackAssessmentClick('ferramenta-qr')}>
                                Abrir autoavaliação
                                <ExternalLink size={18} />
                            </Link>
                        </div>
                    </div>
                </div>
            ),
        },
        ...SELF_ASSESSMENT_QUESTIONS.map((question, index): Slide => {
            const progressForQuestion = results?.question_progress?.find(item => item.question_id === question.id)
            const completedCount = progressForQuestion?.completed_count || 0

            return {
                id: `pergunta-${question.id}`,
                eyebrow: `Pergunta ${index + 1} de ${SELF_ASSESSMENT_QUESTIONS.length} • ${question.blockLabel}`,
                title: question.title,
                variant: 'question',
                content: (
                    <div className="presentation-question-card">
                        <div className="presentation-question-head">
                            <div className="presentation-question-meta">
                                <span>{String(index + 1).padStart(2, '0')}</span>
                                <strong>{question.blockLabel}</strong>
                            </div>
                            <div className="presentation-question-live" aria-live="polite">
                                <RefreshCw className={resultsLoading ? 'spin' : ''} size={17} />
                                <div>
                                    <span>Finalizaram</span>
                                    <strong>{completedCount}</strong>
                                    <small>
                                        {results?.registrations_count
                                            ? `de ${results.registrations_count} cadastrados`
                                            : 'atualiza a cada 5s'}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <p className="presentation-question-prompt">{question.prompt}</p>
                        <div className="presentation-question-criteria" aria-label="Critérios da pergunta">
                            {question.criteria.map(criterion => (
                                <span key={criterion}>{criterion}</span>
                            ))}
                        </div>
                        <div className="presentation-question-scale" aria-label="Escala de resposta de 0 a 10">
                            <span>0</span>
                            <i />
                            <span>10</span>
                        </div>
                    </div>
                ),
            }
        }),
        {
            id: 'resultado-geral',
            eyebrow: 'Resultado ao vivo',
            title: 'Média geral dos corretores',
            variant: 'results',
            content: (
                <div className="presentation-results-layout">
                    <div className="presentation-results-scoreboard">
                        <span>Média geral</span>
                        <strong>{results?.submitted_count ? results.average_score : '--'}<small>/100</small></strong>
                        <p>
                            {results?.submitted_count
                                ? `${results.submitted_count} corretores finalizaram a autoavaliação.`
                                : 'Aguardando os primeiros corretores finalizarem a autoavaliação.'}
                        </p>
                        <div className="presentation-results-live">
                            <RefreshCw className={resultsLoading ? 'spin' : ''} size={17} />
                            <span>Atualização automática a cada 5 segundos</span>
                        </div>
                        {resultsError && <em>{resultsError}</em>}
                    </div>

                    <div className="presentation-results-grid">
                        <section className="presentation-results-panel">
                            <div className="presentation-results-panel-title">
                                <BarChart3 size={18} />
                                <strong>Dimensões</strong>
                            </div>
                            <div className="presentation-results-bars">
                                {(results?.block_averages || []).map(block => (
                                    <div key={block.block}>
                                        <span>{block.label}</span>
                                        <strong>{block.average_percentage}%</strong>
                                        <i><b style={{ width: `${block.average_percentage}%` }} /></i>
                                    </div>
                                ))}
                                {!results?.block_averages?.length && (
                                    <p>As médias aparecem aqui assim que houver respostas.</p>
                                )}
                            </div>
                        </section>

                        <section className="presentation-results-panel">
                            <div className="presentation-results-panel-title">
                                <Trophy size={18} />
                                <strong>Ranking</strong>
                            </div>
                            <div className="presentation-results-ranking">
                                {(results?.ranking || []).map((broker, index) => (
                                    <div key={`${broker.name}-${index}`}>
                                        <span>{index + 1}</span>
                                        <p>
                                            <strong>{broker.name}</strong>
                                            <small>{broker.city || broker.classification_label}</small>
                                        </p>
                                        <b>{broker.score_percent}</b>
                                    </div>
                                ))}
                                {!results?.ranking?.length && (
                                    <p>Aguardando ranking dos participantes.</p>
                                )}
                            </div>
                        </section>

                        <section className="presentation-results-panel presentation-results-insights">
                            <div className="presentation-results-panel-title">
                                <Target size={18} />
                                <strong>Leitura do grupo</strong>
                            </div>
                            <div>
                                <span>Forças</span>
                                {(results?.strongest_questions || []).slice(0, 2).map(item => (
                                    <p key={item.question_id}>{item.title} <strong>{item.average_score}/10</strong></p>
                                ))}
                            </div>
                            <div>
                                <span>Pontos de evolução</span>
                                {(results?.improvement_questions || []).slice(0, 2).map(item => (
                                    <p key={item.question_id}>{item.title} <strong>{item.average_score}/10</strong></p>
                                ))}
                            </div>
                            {!results?.submitted_count && (
                                <p>Quando as respostas entrarem, esta tela mostra a leitura geral da turma.</p>
                            )}
                        </section>
                    </div>

                    <div className="presentation-results-footer">
                        <span>{results?.registrations_count || 0} inscritos no evento</span>
                        <span>Atualização: {formatUpdatedAt(results?.updated_at)}</span>
                    </div>
                </div>
            ),
        },
        {
            id: 'voto-guilherme',
            eyebrow: 'Antes de encerrar',
            title: 'Vote no Guilherme como Influenciador do Ano',
            variant: 'vote',
            content: (
                <div className="presentation-vote-layout">
                    <div className="presentation-vote-copy">
                        <Trophy size={42} />
                        <p>
                            Se essa dinâmica ajudou você a enxergar melhor o seu perfil como corretor, deixe seu voto para o Guilherme no Real Estate Awards.
                        </p>
                        <div className="presentation-vote-steps">
                            <span>1. Clique em votar</span>
                            <span>2. Confirme seu voto</span>
                            <span>3. Compartilhe com outros corretores</span>
                        </div>
                        <Link
                            href={GUILHERME_AWARDS_VOTE_URL}
                            target="_blank"
                            onClick={() => trackVoteClick('voto-guilherme')}
                        >
                            Votar agora
                            <ExternalLink size={19} />
                        </Link>
                    </div>
                    <div className="presentation-vote-frame" aria-label="Página de votação do Real Estate Awards">
                        <iframe
                            src={GUILHERME_AWARDS_VOTE_URL}
                            title="Votação Guilherme Pilger no Real Estate Awards"
                            loading="lazy"
                            referrerPolicy="strict-origin-when-cross-origin"
                        />
                    </div>
                </div>
            ),
        },
    ], [assessmentPath, results, resultsError, resultsLoading, socialByPlatform, socialMetrics?.total_views, trackAssessmentClick, trackVoteClick])

    const currentSlide = slides[currentIndex]
    const progress = ((currentIndex + 1) / slides.length) * 100

    useEffect(() => {
        const shouldPollResults = currentSlide?.variant === 'question' || currentSlide?.id === 'resultado-geral'
        if (!shouldPollResults) return

        void loadAssessmentResults(currentSlide?.id === 'resultado-geral')
        const interval = window.setInterval(() => {
            void loadAssessmentResults()
        }, 5000)

        return () => window.clearInterval(interval)
    }, [currentSlide?.id, currentSlide?.variant, loadAssessmentResults])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
                event.preventDefault()
                setCurrentIndex(index => Math.min(index + 1, slides.length - 1))
            }
            if (['ArrowLeft', 'PageUp'].includes(event.key)) {
                event.preventDefault()
                setCurrentIndex(index => Math.max(index - 1, 0))
            }
            if (event.key === 'Home') setCurrentIndex(0)
            if (event.key === 'End') setCurrentIndex(slides.length - 1)
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [slides.length])

    useEffect(() => {
        if (!currentSlide) return
        void trackEvent('event_profile_presentation_slide_viewed', {
            event_slug: eventSlug,
            event_title: eventTitle,
            assessment: 'perfil_corretor_ideal',
            slide_id: currentSlide.id,
            slide_number: currentIndex + 1,
        })
    }, [currentIndex, currentSlide, eventSlug, eventTitle])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            void document.documentElement.requestFullscreen?.()
            return
        }
        void document.exitFullscreen?.()
    }

    return (
        <main className={`presentation-page presentation-${currentSlide.variant || 'default'}`}>
            <div className="presentation-progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
            </div>

            <section className="presentation-stage" aria-live="polite">
                <div className="presentation-side-portrait" aria-hidden="true">
                    <Image
                        src={GUILHERME_STAGE_PHOTO}
                        alt=""
                        fill
                        sizes="(max-width: 1280px) 0px, 28vw"
                        unoptimized
                    />
                </div>

                <div className="presentation-slide">
                    <div className="presentation-copy">
                        <span className="presentation-eyebrow">{currentSlide.eyebrow}</span>
                        <h1>{currentSlide.title}</h1>
                        {currentSlide.content}
                    </div>
                </div>
            </section>

            <div className="presentation-event-chip">
                <CalendarDays size={17} />
                <span>{eventDateLabel}</span>
                <strong>{eventLocation}</strong>
            </div>

            <div className="presentation-controls" aria-label="Controles da apresentação">
                <button
                    type="button"
                    onClick={() => setCurrentIndex(index => Math.max(index - 1, 0))}
                    disabled={currentIndex === 0}
                    aria-label="Voltar slide"
                    title="Voltar slide"
                >
                    <ChevronLeft size={22} />
                </button>
                <span>{currentIndex + 1}/{slides.length}</span>
                <button
                    type="button"
                    onClick={() => setCurrentIndex(index => Math.min(index + 1, slides.length - 1))}
                    disabled={currentIndex === slides.length - 1}
                    aria-label="Avançar slide"
                    title="Avançar slide"
                >
                    <ChevronRight size={22} />
                </button>
                <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label="Tela cheia"
                    title="Tela cheia"
                >
                    <Maximize2 size={20} />
                </button>
                <Link
                    href={assessmentPath}
                    target="_blank"
                    aria-label="Abrir autoavaliação"
                    title="Abrir autoavaliação"
                    onClick={() => trackAssessmentClick(currentSlide?.id || 'controls')}
                >
                    <QrCode size={20} />
                </Link>
            </div>

            <div className="presentation-brand">
                <Presentation size={18} />
                <span>Perfil do Corretor Ideal</span>
            </div>

            <style jsx global>{`
                .presentation-page {
                    min-height: 100vh;
                    position: relative;
                    overflow: hidden;
                    color: #172033;
                    font-family: 'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background:
                        linear-gradient(120deg, rgba(8, 7, 5, 0.78), rgba(12, 10, 7, 0.6) 46%, rgba(5, 12, 13, 0.72)),
                        url("${PRESENTATION_BACKGROUND_IMAGE}") center / cover no-repeat;
                }
                .presentation-page::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(90deg, rgba(193, 139, 43, 0.12), transparent 32%),
                        linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.5));
                    pointer-events: none;
                }
                .presentation-progress {
                    position: fixed;
                    inset: 0 0 auto;
                    z-index: 20;
                    height: 5px;
                    background: rgba(23, 32, 51, 0.08);
                }
                .presentation-progress span {
                    display: block;
                    height: 100%;
                    background: linear-gradient(90deg, #c8932f, #2f8f7f);
                    transition: width 220ms ease;
                }
                .presentation-stage {
                    min-height: 100vh;
                    position: relative;
                    display: grid;
                    align-items: center;
                    padding: 72px 7vw 86px;
                }
                .presentation-slide {
                    width: min(1080px, 100%);
                    position: relative;
                    z-index: 2;
                }
                .presentation-copy {
                    max-width: 900px;
                    display: grid;
                    gap: 24px;
                }
                .presentation-eyebrow {
                    color: #9a6817;
                    font-size: 0.82rem;
                    font-weight: 600;
                    letter-spacing: 0;
                    text-transform: uppercase;
                }
                .presentation-page h1 {
                    margin: 0;
                    max-width: 960px;
                    color: #111827;
                    font-family: 'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-size: 3.45rem;
                    font-weight: 500;
                    line-height: 1.04;
                    letter-spacing: 0;
                }
                .presentation-page p {
                    margin: 0;
                    color: #475569;
                    font-size: 1.2rem;
                    line-height: 1.55;
                    letter-spacing: 0;
                }
                .presentation-video .presentation-slide {
                    width: min(1240px, 100%);
                    margin: 0 auto;
                }
                .presentation-video {
                    color: #f8f2e7;
                    background:
                        linear-gradient(120deg, rgba(4, 5, 6, 0.82), rgba(12, 10, 7, 0.7) 45%, rgba(5, 12, 13, 0.78)),
                        url("${PRESENTATION_BACKGROUND_IMAGE}") center / cover no-repeat;
                }
                .presentation-video::before {
                    background:
                        linear-gradient(90deg, rgba(201, 147, 47, 0.18), transparent 36%),
                        linear-gradient(180deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.46));
                }
                .presentation-video .presentation-stage {
                    padding: 78px 6.5vw 88px;
                }
                .presentation-video .presentation-copy {
                    max-width: 1240px;
                    justify-items: center;
                    gap: 14px;
                    text-align: center;
                }
                .presentation-video .presentation-eyebrow {
                    color: #d7a84d;
                }
                .presentation-video h1 {
                    max-width: 1040px;
                    color: #fff8ec;
                    font-size: 3.55rem;
                    font-weight: 500;
                    line-height: 1.03;
                    text-transform: uppercase;
                    text-shadow: 0 18px 44px rgba(0, 0, 0, 0.4);
                }
                .presentation-video-layout {
                    width: min(1120px, 100%);
                    filter: drop-shadow(0 34px 86px rgba(0, 0, 0, 0.48));
                }
                .presentation-video-layout iframe {
                    display: block;
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    border: 1px solid rgba(255, 248, 236, 0.16);
                    border-radius: 8px;
                    background: #0f172a;
                }
                .presentation-video .presentation-event-chip,
                .presentation-video .presentation-brand,
                .presentation-video .presentation-controls {
                    border-color: rgba(215, 168, 77, 0.22);
                    background: rgba(10, 9, 7, 0.72);
                    color: rgba(248, 242, 231, 0.82);
                    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
                }
                .presentation-video .presentation-event-chip strong,
                .presentation-video .presentation-controls button,
                .presentation-video .presentation-controls a {
                    color: #fff8ec;
                }
                .presentation-video .presentation-brand,
                .presentation-video .presentation-controls span {
                    color: #f2cc78;
                }
                .presentation-photo {
                    position: absolute;
                    inset: 0 0 0 46%;
                    overflow: hidden;
                    z-index: 1;
                }
                .presentation-photo img {
                    object-fit: cover;
                    object-position: center;
                    filter: saturate(0.98) contrast(1.02);
                    transform: scaleX(-1);
                }
                .presentation-photo::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(90deg, rgba(252, 250, 245, 0.08), rgba(17, 24, 39, 0.08) 42%, rgba(17, 24, 39, 0.22)),
                        linear-gradient(180deg, rgba(252, 250, 245, 0.02), rgba(20, 16, 10, 0.14));
                }
                .presentation-hero .presentation-photo {
                    inset: 0 0 0 56%;
                }
                .presentation-hero .presentation-photo:empty {
                    inset: 0;
                    background:
                        linear-gradient(120deg, rgba(4, 5, 6, 0.78), rgba(12, 10, 7, 0.58) 46%, rgba(5, 12, 13, 0.76)),
                        url("${PRESENTATION_BACKGROUND_IMAGE}") center / cover no-repeat;
                    opacity: 1;
                }
                .presentation-hero .presentation-photo:empty::after {
                    background:
                        linear-gradient(90deg, rgba(8, 7, 5, 0.52), rgba(8, 7, 5, 0.16) 54%, rgba(8, 7, 5, 0.34)),
                        linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.42));
                }
                .presentation-hero .presentation-copy {
                    width: 100%;
                    max-width: none;
                }
                .presentation-hero .presentation-slide {
                    width: min(1660px, 100%);
                }
                .presentation-hero h1 {
                    max-width: 980px;
                    font-size: 4.15rem;
                    font-weight: 500;
                    line-height: 1.02;
                }
                .presentation-hero-content {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 22px;
                    align-items: stretch;
                    width: 100%;
                    max-width: none;
                }
                .presentation-guilherme-copy {
                    display: grid;
                    gap: 22px;
                    align-content: start;
                }
                .presentation-hero-facts {
                    max-width: 900px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                }
                .presentation-guilherme-overview > p {
                    max-width: 900px;
                    font-size: 1.62rem;
                    line-height: 1.38;
                }
                .presentation-hero-facts span,
                .presentation-statement span {
                    min-height: 50px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid rgba(154, 104, 23, 0.18);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.76);
                    color: #253044;
                    padding: 0 16px;
                    font-weight: 600;
                    font-size: 1rem;
                    box-shadow: 0 14px 34px rgba(70, 50, 20, 0.08);
                }
                .presentation-guilherme-panel {
                    max-width: 100%;
                    display: grid;
                    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
                    gap: 16px;
                    align-items: stretch;
                }
                .presentation-guilherme-timeline,
                .presentation-guilherme-metrics div {
                    border: 1px solid rgba(154, 104, 23, 0.16);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.84);
                    box-shadow: 0 18px 38px rgba(70, 50, 20, 0.08);
                }
                .presentation-guilherme-timeline {
                    display: grid;
                    gap: 0;
                    padding: 22px 24px;
                }
                .presentation-guilherme-timeline > strong {
                    color: #9a6817;
                    font-size: 1rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .presentation-guilherme-timeline div {
                    display: grid;
                    grid-template-columns: 72px minmax(0, 1fr);
                    gap: 16px;
                    align-items: start;
                    border-top: 1px solid rgba(154, 104, 23, 0.12);
                    padding: 11px 0;
                }
                .presentation-guilherme-timeline div:first-of-type {
                    border-top: 0;
                    margin-top: 7px;
                }
                .presentation-guilherme-timeline span {
                    color: #b57a1c;
                    font-size: 1.2rem;
                    font-weight: 600;
                }
                .presentation-guilherme-timeline p,
                .presentation-guilherme-metrics p {
                    color: #475569;
                    font-size: 1rem;
                    line-height: 1.36;
                }
                .presentation-guilherme-metrics {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 14px;
                }
                .presentation-guilherme-metrics div {
                    min-height: 124px;
                    display: grid;
                    align-content: start;
                    gap: 10px;
                    padding: 18px;
                }
                .presentation-guilherme-metrics span {
                    width: 42px;
                    height: 42px;
                    display: grid;
                    place-items: center;
                    border-radius: 8px;
                    background: rgba(200, 147, 47, 0.14);
                    color: #9a6817;
                }
                .presentation-guilherme-metrics .metric-youtube span {
                    background: rgba(255, 0, 0, 0.16);
                    color: #ff2a2a;
                }
                .presentation-guilherme-metrics .metric-instagram span {
                    background:
                        radial-gradient(circle at 30% 105%, rgba(254, 218, 117, 0.34), transparent 36%),
                        linear-gradient(135deg, rgba(131, 58, 180, 0.34), rgba(225, 48, 108, 0.28) 48%, rgba(245, 133, 41, 0.28));
                    color: #ff6aa2;
                }
                .presentation-guilherme-metrics .metric-tiktok span {
                    background:
                        linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(255, 0, 80, 0.2)),
                        rgba(255, 255, 255, 0.04);
                    color: #00f2ea;
                    filter: drop-shadow(1px 0 0 rgba(255, 0, 80, 0.72));
                }
                .presentation-guilherme-metrics .metric-views span {
                    background: rgba(72, 180, 159, 0.18);
                    color: #48d6bf;
                }
                .presentation-guilherme-metrics strong {
                    color: #111827;
                    font-size: 1.75rem;
                    line-height: 1;
                    font-weight: 600;
                }
                .presentation-timeline {
                    display: grid;
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: 12px;
                }
                .presentation-timeline div,
                .presentation-metric,
                .presentation-pillar,
                .presentation-focus-grid div,
                .presentation-steps div {
                    border: 1px solid rgba(154, 104, 23, 0.16);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.82);
                    box-shadow: 0 18px 38px rgba(70, 50, 20, 0.08);
                }
                .presentation-timeline div {
                    min-height: 174px;
                    display: grid;
                    align-content: start;
                    gap: 12px;
                    padding: 18px;
                }
                .presentation-timeline strong {
                    color: #b57a1c;
                    font-size: 1.35rem;
                    font-family: 'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-weight: 500;
                }
                .presentation-timeline p,
                .presentation-metric p,
                .presentation-pillar p,
                .presentation-focus-grid p,
                .presentation-steps p {
                    font-size: 0.98rem;
                    line-height: 1.45;
                }
                .presentation-metrics,
                .presentation-pillars {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 14px;
                }
                .presentation-pillars {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                .presentation-metric,
                .presentation-pillar {
                    min-height: 230px;
                    display: grid;
                    align-content: start;
                    gap: 12px;
                    padding: 20px;
                }
                .presentation-metric > span,
                .presentation-pillar > span {
                    width: 48px;
                    height: 48px;
                    display: grid;
                    place-items: center;
                    border-radius: 8px;
                    background: rgba(200, 147, 47, 0.14);
                    color: #9a6817;
                }
                .presentation-metric strong {
                    color: #111827;
                    font-size: 1.55rem;
                    line-height: 1;
                    font-weight: 500;
                }
                .presentation-metric small,
                .presentation-pillar strong {
                    color: #253044;
                    font-size: 1rem;
                    font-weight: 600;
                }
                .presentation-focus-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr);
                    align-items: center;
                    gap: 16px;
                    max-width: 950px;
                }
                .presentation-focus-grid svg {
                    color: #b57a1c;
                    justify-self: center;
                }
                .presentation-focus-grid div {
                    min-height: 230px;
                    display: grid;
                    align-content: center;
                    gap: 18px;
                    padding: 32px;
                }
                .presentation-focus-grid strong {
                    color: #111827;
                    font-size: 2.08rem;
                    font-family: 'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-weight: 500;
                }
                .presentation-focus-grid p {
                    max-width: 92%;
                    font-size: 1.2rem;
                    line-height: 1.46;
                }
                .presentation-statement {
                    max-width: 960px;
                    display: grid;
                    gap: 24px;
                }
                .presentation-tool-story {
                    max-width: 1060px;
                    gap: 18px;
                }
                .presentation-statement p {
                    max-width: 850px;
                    font-size: 1.45rem;
                    color: #334155;
                }
                .presentation-tool-story p {
                    max-width: 1000px;
                    font-size: 1.28rem;
                    line-height: 1.52;
                }
                .presentation-statement div {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .presentation-tool-story div {
                    margin-top: 8px;
                }
                .presentation-tool-qr-layout {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 360px;
                    gap: clamp(24px, 3vw, 46px);
                    align-items: center;
                    max-width: 1260px;
                }
                .presentation-tool-qr-layout .presentation-tool-story {
                    max-width: 820px;
                }
                .presentation-qr-panel {
                    display: grid;
                    gap: 16px;
                    justify-items: center;
                }
                .presentation-tool-qr-layout .presentation-qr-box {
                    width: min(100%, 340px);
                    padding: 18px;
                }
                .presentation-tool-qr-layout .presentation-qr-copy {
                    max-width: 340px;
                    justify-items: center;
                    text-align: center;
                    gap: 12px;
                }
                .presentation-tool-qr-layout .presentation-qr-copy p {
                    color: rgba(255, 252, 244, 0.92);
                    font-size: 1rem;
                    line-height: 1.35;
                }
                .presentation-steps {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 14px;
                }
                .presentation-steps div {
                    min-height: 190px;
                    display: grid;
                    align-content: start;
                    gap: 18px;
                    padding: 20px;
                }
                .presentation-steps strong {
                    width: 48px;
                    height: 48px;
                    display: grid;
                    place-items: center;
                    border-radius: 50%;
                    background: #172033;
                    color: #fff;
                    font-size: 1.1rem;
                    font-weight: 500;
                }
                .presentation-qr-layout {
                    display: grid;
                    grid-template-columns: 430px minmax(0, 1fr);
                    gap: 38px;
                    align-items: center;
                }
                .presentation-qr-box {
                    width: 430px;
                    aspect-ratio: 1;
                    display: grid;
                    place-items: center;
                    border: 1px solid rgba(154, 104, 23, 0.18);
                    border-radius: 8px;
                    background: #fff;
                    padding: 22px;
                    box-shadow: 0 24px 60px rgba(70, 50, 20, 0.16);
                }
                .presentation-qr-box img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .presentation-qr-copy {
                    display: grid;
                    gap: 18px;
                    max-width: 520px;
                }
                .presentation-qr-copy svg {
                    color: #2f8f7f;
                }
                .presentation-qr-copy a {
                    width: fit-content;
                    min-height: 48px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #e7c265, #c88b2f);
                    color: #120d08;
                    padding: 0 18px;
                    font-weight: 600;
                    text-decoration: none;
                    box-shadow: 0 18px 34px rgba(184, 123, 37, 0.18);
                }
                .presentation-question .presentation-copy {
                    gap: 18px;
                }
                .presentation-question h1 {
                    max-width: 900px;
                    font-size: 4.3rem;
                    font-weight: 500;
                    line-height: 1;
                }
                .presentation-question-card {
                    width: min(920px, 100%);
                    display: grid;
                    gap: 22px;
                    border: 1px solid rgba(154, 104, 23, 0.16);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.84);
                    padding: clamp(28px, 3vw, 46px);
                    box-shadow: 0 24px 68px rgba(70, 50, 20, 0.1);
                }
                .presentation-question-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                }
                .presentation-question-meta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .presentation-question-meta span {
                    width: 56px;
                    height: 56px;
                    display: grid;
                    place-items: center;
                    border-radius: 8px;
                    background: rgba(200, 147, 47, 0.14);
                    color: #9a6817;
                    font-size: 1.25rem;
                    font-weight: 600;
                }
                .presentation-question-meta strong {
                    color: #9a6817;
                    font-size: 0.92rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .presentation-question-live {
                    min-width: 230px;
                    min-height: 64px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border: 1px solid rgba(154, 104, 23, 0.18);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.72);
                    padding: 10px 14px;
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
                }
                .presentation-question-live svg {
                    color: #2f8f7f;
                }
                .presentation-question-live div {
                    display: grid;
                    gap: 1px;
                }
                .presentation-question-live span {
                    color: #9a6817;
                    font-size: 0.72rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .presentation-question-live strong {
                    color: #111827;
                    font-size: 1.85rem;
                    font-weight: 600;
                    line-height: 0.98;
                }
                .presentation-question-live div small {
                    color: #64748b;
                    font-size: 0.78rem;
                    line-height: 1.2;
                }
                .presentation-question-prompt {
                    max-width: 860px;
                    color: #172033;
                    font-size: 1.76rem;
                    line-height: 1.34;
                }
                .presentation-question-criteria {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .presentation-question-criteria span {
                    min-height: 42px;
                    display: inline-flex;
                    align-items: center;
                    border: 1px solid rgba(154, 104, 23, 0.16);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.76);
                    color: #253044;
                    padding: 0 14px;
                    font-size: 0.96rem;
                    font-weight: 600;
                }
                .presentation-question-scale {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    gap: 14px;
                    align-items: center;
                    color: #9a6817;
                    font-weight: 600;
                }
                .presentation-question-scale i {
                    height: 8px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, rgba(215, 168, 77, 0.38), #48b49f);
                }
                .presentation-question-live div small {
                    color: #64748b;
                    font-size: 0.78rem;
                    line-height: 1.2;
                }
                .presentation-results .presentation-slide {
                    width: min(1180px, 100%);
                }
                .presentation-results .presentation-copy {
                    max-width: 1180px;
                    gap: 18px;
                }
                .presentation-results h1 {
                    max-width: 980px;
                    font-size: 3.05rem;
                    font-weight: 500;
                }
                .presentation-results-layout {
                    display: grid;
                    grid-template-columns: 340px minmax(0, 1fr);
                    gap: 18px;
                    align-items: stretch;
                }
                .presentation-results-scoreboard,
                .presentation-results-panel {
                    border: 1px solid rgba(154, 104, 23, 0.16);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.84);
                    box-shadow: 0 18px 38px rgba(70, 50, 20, 0.08);
                }
                .presentation-results-scoreboard {
                    min-height: 390px;
                    display: grid;
                    align-content: center;
                    gap: 14px;
                    padding: 24px;
                }
                .presentation-results-scoreboard > span,
                .presentation-results-footer span,
                .presentation-results-insights span {
                    color: #9a6817;
                    font-size: 0.78rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .presentation-results-scoreboard strong {
                    color: #111827;
                    font-size: 4rem;
                    font-weight: 500;
                    line-height: 0.95;
                }
                .presentation-results-scoreboard small {
                    color: #64748b;
                    font-size: 1.3rem;
                    font-weight: 500;
                }
                .presentation-results-scoreboard p,
                .presentation-results-panel p {
                    color: #475569;
                    font-size: 0.94rem;
                    line-height: 1.4;
                }
                .presentation-results-live {
                    width: fit-content;
                    min-height: 42px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: 1px solid rgba(23, 32, 51, 0.1);
                    border-radius: 8px;
                    background: rgba(23, 32, 51, 0.08);
                    color: #172033;
                    padding: 0 14px;
                    font-size: 0.86rem;
                    font-weight: 600;
                }
                .presentation-results-live span {
                    color: inherit;
                }
                .presentation-results-scoreboard em {
                    color: #b42318;
                    font-size: 0.8rem;
                    font-style: normal;
                    font-weight: 500;
                }
                .presentation-results-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 14px;
                }
                .presentation-results-panel {
                    min-height: 188px;
                    display: grid;
                    align-content: start;
                    gap: 12px;
                    padding: 18px;
                }
                .presentation-results-insights {
                    grid-column: 1 / -1;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .presentation-results-insights .presentation-results-panel-title {
                    grid-column: 1 / -1;
                }
                .presentation-results-panel-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #9a6817;
                }
                .presentation-results-panel-title strong {
                    color: #253044;
                    font-size: 0.92rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .presentation-results-bars {
                    display: grid;
                    gap: 10px;
                }
                .presentation-results-bars div {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 48px;
                    gap: 10px;
                    align-items: center;
                }
                .presentation-results-bars span {
                    color: #334155;
                    font-size: 0.88rem;
                    font-weight: 500;
                }
                .presentation-results-bars strong {
                    color: #111827;
                    font-size: 0.94rem;
                    text-align: right;
                }
                .presentation-results-bars i {
                    grid-column: 1 / -1;
                    height: 8px;
                    overflow: hidden;
                    border-radius: 999px;
                    background: rgba(23, 32, 51, 0.1);
                }
                .presentation-results-bars b {
                    display: block;
                    height: 100%;
                    border-radius: inherit;
                    background: linear-gradient(90deg, #c8932f, #2f8f7f);
                }
                .presentation-results-ranking {
                    display: grid;
                    gap: 8px;
                }
                .presentation-results-ranking div {
                    display: grid;
                    grid-template-columns: 28px minmax(0, 1fr) 44px;
                    gap: 10px;
                    align-items: center;
                    border-bottom: 1px solid rgba(154, 104, 23, 0.12);
                    padding-bottom: 7px;
                }
                .presentation-results-ranking div:last-child {
                    border-bottom: 0;
                    padding-bottom: 0;
                }
                .presentation-results-ranking span {
                    width: 28px;
                    height: 28px;
                    display: grid;
                    place-items: center;
                    border-radius: 50%;
                    background: rgba(200, 147, 47, 0.14);
                    color: #9a6817;
                    font-weight: 600;
                }
                .presentation-results-ranking p {
                    display: grid;
                    gap: 1px;
                }
                .presentation-results-ranking strong {
                    color: #111827;
                    font-size: 0.9rem;
                    font-weight: 600;
                }
                .presentation-results-ranking small {
                    color: #64748b;
                    font-size: 0.72rem;
                    font-weight: 500;
                }
                .presentation-results-ranking b {
                    color: #111827;
                    font-size: 1.1rem;
                    text-align: right;
                }
                .presentation-results-insights > div:not(.presentation-results-panel-title) {
                    display: grid;
                    gap: 7px;
                }
                .presentation-results-insights p {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    border-bottom: 1px solid rgba(154, 104, 23, 0.12);
                    padding-bottom: 7px;
                }
                .presentation-results-insights p:last-child {
                    border-bottom: 0;
                    padding-bottom: 0;
                }
                .presentation-results-insights p strong {
                    color: #111827;
                    white-space: nowrap;
                }
                .presentation-results-footer {
                    grid-column: 1 / -1;
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    color: #64748b;
                }
                .presentation-vote .presentation-side-portrait {
                    display: none;
                }
                .presentation-vote .presentation-slide {
                    width: min(1580px, 100%);
                    margin: 0 auto;
                }
                .presentation-vote .presentation-copy {
                    max-width: none;
                    gap: 18px;
                }
                .presentation-vote h1 {
                    max-width: 1080px;
                    font-size: 3.15rem;
                    font-weight: 500;
                }
                .presentation-vote-layout {
                    display: grid;
                    grid-template-columns: minmax(340px, 0.42fr) minmax(0, 1fr);
                    gap: 22px;
                    align-items: stretch;
                }
                .presentation-vote-copy,
                .presentation-vote-frame {
                    border: 1px solid rgba(215, 168, 77, 0.22);
                    border-radius: 8px;
                    background:
                        linear-gradient(135deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.035));
                    box-shadow:
                        0 24px 68px rgba(0, 0, 0, 0.32),
                        inset 0 1px 0 rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(16px);
                }
                .presentation-vote-copy {
                    min-height: 500px;
                    display: grid;
                    align-content: center;
                    gap: 22px;
                    padding: clamp(24px, 2.8vw, 42px);
                }
                .presentation-vote-copy > svg {
                    color: #f2cc78;
                    filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.32));
                }
                .presentation-vote-copy p {
                    max-width: 620px;
                    color: rgba(255, 252, 244, 0.95);
                    font-size: 1.42rem;
                    line-height: 1.38;
                }
                .presentation-vote-steps {
                    display: grid;
                    gap: 10px;
                }
                .presentation-vote-steps span {
                    min-height: 46px;
                    display: flex;
                    align-items: center;
                    border: 1px solid rgba(215, 168, 77, 0.18);
                    border-radius: 8px;
                    background: rgba(255, 248, 236, 0.08);
                    color: #fff8ec;
                    padding: 0 14px;
                    font-size: 0.96rem;
                    font-weight: 500;
                }
                .presentation-vote-copy a {
                    width: fit-content;
                    min-height: 54px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #f2cc78, #c8932f);
                    color: #120d08;
                    padding: 0 22px;
                    font-size: 1rem;
                    font-weight: 600;
                    text-decoration: none;
                    box-shadow: 0 18px 42px rgba(201, 147, 47, 0.24);
                }
                .presentation-vote-frame {
                    min-height: min(62vh, 660px);
                    overflow: hidden;
                    padding: 8px;
                    background:
                        linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
                        rgba(4, 4, 4, 0.52);
                }
                .presentation-vote-frame iframe {
                    display: block;
                    width: 100%;
                    height: 100%;
                    min-height: 600px;
                    border: 0;
                    border-radius: 6px;
                    background: #050505;
                }
                .presentation-closing {
                    max-width: 820px;
                    display: grid;
                    gap: 20px;
                }
                .presentation-closing svg {
                    color: #2f8f7f;
                }
                .presentation-closing p {
                    color: #172033;
                    font-size: 1.55rem;
                    font-family: 'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-weight: 500;
                    line-height: 1.18;
                }
                .presentation-closing span {
                    max-width: 100%;
                    color: #64748b;
                    font-size: 0.98rem;
                    word-break: break-word;
                }
                .presentation-event-chip,
                .presentation-brand,
                .presentation-controls {
                    position: fixed;
                    z-index: 30;
                    display: inline-flex;
                    align-items: center;
                    border: 1px solid rgba(23, 32, 51, 0.1);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.82);
                    color: #334155;
                    backdrop-filter: blur(18px);
                    box-shadow: 0 14px 34px rgba(70, 50, 20, 0.08);
                }
                .presentation-event-chip {
                    top: 22px;
                    left: 7vw;
                    min-height: 42px;
                    gap: 8px;
                    padding: 0 12px;
                    font-size: 0.82rem;
                }
                .presentation-event-chip strong {
                    color: #172033;
                    font-weight: 600;
                }
                .presentation-brand {
                    right: 7vw;
                    top: 22px;
                    min-height: 42px;
                    gap: 8px;
                    padding: 0 12px;
                    color: #9a6817;
                    font-weight: 600;
                }
                .presentation-controls {
                    right: 7vw;
                    bottom: 22px;
                    gap: 6px;
                    padding: 6px;
                }
                .presentation-controls button,
                .presentation-controls a {
                    width: 42px;
                    height: 42px;
                    display: inline-grid;
                    place-items: center;
                    border: 0;
                    border-radius: 8px;
                    background: transparent;
                    color: #172033;
                    cursor: pointer;
                    text-decoration: none;
                }
                .presentation-controls button:hover,
                .presentation-controls a:hover {
                    background: rgba(200, 147, 47, 0.14);
                }
                .presentation-controls button:disabled {
                    color: #94a3b8;
                    cursor: not-allowed;
                }
                .presentation-controls span {
                    min-width: 48px;
                    text-align: center;
                    color: #475569;
                    font-size: 0.82rem;
                    font-weight: 600;
                }
                .presentation-side-portrait {
                    position: absolute;
                    z-index: 2;
                    top: 50%;
                    right: 7vw;
                    width: clamp(330px, 23vw, 440px);
                    height: min(64vh, 620px);
                    transform: translateY(-43%);
                    overflow: hidden;
                    border: 1px solid rgba(215, 168, 77, 0.24);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.04);
                    box-shadow:
                        0 26px 72px rgba(0, 0, 0, 0.32),
                        inset 0 1px 0 rgba(255, 255, 255, 0.08);
                    pointer-events: none;
                }
                .presentation-side-portrait img {
                    object-fit: cover;
                    object-position: center;
                    filter: saturate(1.02) contrast(1.04);
                }
                .presentation-side-portrait::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.2)),
                        linear-gradient(90deg, rgba(8, 7, 5, 0.2), transparent 42%);
                    pointer-events: none;
                }
                .presentation-video .presentation-slide {
                    width: min(1040px, calc(100vw - clamp(390px, 30vw, 540px) - 12vw));
                    margin-left: 0;
                    margin-right: auto;
                }
                .presentation-video .presentation-copy {
                    justify-items: start;
                    text-align: left;
                }
                .presentation-video .presentation-video-layout {
                    width: min(100%, 1040px);
                }
                .presentation-page:not(.presentation-video) {
                    color: #f8f2e7;
                    background:
                        linear-gradient(120deg, rgba(8, 7, 5, 0.82), rgba(12, 10, 7, 0.58) 46%, rgba(5, 12, 13, 0.76)),
                        url("${PRESENTATION_BACKGROUND_IMAGE}") center / cover no-repeat;
                }
                .presentation-page:not(.presentation-video) .presentation-slide {
                    width: min(1200px, calc(100vw - clamp(390px, 30vw, 540px) - 12vw));
                    margin-left: 0;
                    margin-right: auto;
                }
                .presentation-page:not(.presentation-video) .presentation-copy {
                    max-width: none;
                }
                .presentation-page:not(.presentation-video)::before {
                    background:
                        linear-gradient(90deg, rgba(201, 147, 47, 0.13), transparent 38%),
                        linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(0, 0, 0, 0.24));
                }
                .presentation-page:not(.presentation-video) .presentation-progress {
                    background: rgba(255, 248, 236, 0.1);
                }
                .presentation-page:not(.presentation-video) .presentation-progress span {
                    background: linear-gradient(90deg, #d7a84d, #48b49f);
                }
                .presentation-page:not(.presentation-video) .presentation-eyebrow {
                    color: #d7a84d;
                }
                .presentation-page:not(.presentation-video) h1 {
                    color: #fff8ec;
                    text-shadow: 0 18px 44px rgba(0, 0, 0, 0.32);
                }
                .presentation-page:not(.presentation-video) p {
                    color: rgba(255, 252, 244, 0.9);
                    text-shadow: 0 10px 28px rgba(0, 0, 0, 0.34);
                }
                .presentation-page:not(.presentation-video) .presentation-photo::after {
                    background:
                        linear-gradient(90deg, rgba(8, 7, 5, 0.58), rgba(8, 7, 5, 0.22) 46%, rgba(8, 7, 5, 0.36)),
                        linear-gradient(180deg, rgba(8, 7, 5, 0.08), rgba(8, 7, 5, 0.38));
                }
                .presentation-page:not(.presentation-video) .presentation-hero-facts span,
                .presentation-page:not(.presentation-video) .presentation-statement span,
                .presentation-page:not(.presentation-video) .presentation-timeline div,
                .presentation-page:not(.presentation-video) .presentation-metric,
                .presentation-page:not(.presentation-video) .presentation-pillar,
                .presentation-page:not(.presentation-video) .presentation-focus-grid div,
                .presentation-page:not(.presentation-video) .presentation-steps div,
                .presentation-page:not(.presentation-video) .presentation-guilherme-timeline,
                .presentation-page:not(.presentation-video) .presentation-guilherme-metrics div,
                .presentation-page:not(.presentation-video) .presentation-question-card,
                .presentation-page:not(.presentation-video) .presentation-results-scoreboard,
                .presentation-page:not(.presentation-video) .presentation-results-panel {
                    border-color: rgba(215, 168, 77, 0.22);
                    background:
                        linear-gradient(135deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.035));
                    box-shadow:
                        0 24px 68px rgba(0, 0, 0, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(16px);
                }
                .presentation-page:not(.presentation-video) .presentation-hero-facts span,
                .presentation-page:not(.presentation-video) .presentation-statement span,
                .presentation-page:not(.presentation-video) .presentation-question-criteria span {
                    color: #fff8ec;
                }
                .presentation-page:not(.presentation-video) .presentation-guilherme-timeline > strong,
                .presentation-page:not(.presentation-video) .presentation-guilherme-timeline span,
                .presentation-page:not(.presentation-video) .presentation-timeline strong,
                .presentation-page:not(.presentation-video) .presentation-question-meta strong,
                .presentation-page:not(.presentation-video) .presentation-question-scale,
                .presentation-page:not(.presentation-video) .presentation-results-scoreboard > span,
                .presentation-page:not(.presentation-video) .presentation-results-footer span,
                .presentation-page:not(.presentation-video) .presentation-results-insights span {
                    color: #d7a84d;
                }
                .presentation-page:not(.presentation-video) .presentation-guilherme-timeline div,
                .presentation-page:not(.presentation-video) .presentation-results-ranking div,
                .presentation-page:not(.presentation-video) .presentation-results-insights p {
                    border-color: rgba(215, 168, 77, 0.14);
                }
                .presentation-page:not(.presentation-video) .presentation-guilherme-timeline p,
                .presentation-page:not(.presentation-video) .presentation-guilherme-metrics p,
                .presentation-page:not(.presentation-video) .presentation-timeline p,
                .presentation-page:not(.presentation-video) .presentation-metric p,
                .presentation-page:not(.presentation-video) .presentation-pillar p,
                .presentation-page:not(.presentation-video) .presentation-focus-grid p,
                .presentation-page:not(.presentation-video) .presentation-steps p,
                .presentation-page:not(.presentation-video) .presentation-question-prompt,
                .presentation-page:not(.presentation-video) .presentation-results-scoreboard p,
                .presentation-page:not(.presentation-video) .presentation-results-panel p {
                    color: rgba(255, 252, 244, 0.84);
                }
                .presentation-page:not(.presentation-video) .presentation-statement p,
                .presentation-page:not(.presentation-video) .presentation-tool-story p {
                    color: rgba(255, 252, 244, 0.94);
                }
                .presentation-page:not(.presentation-video) .presentation-guilherme-metrics span,
                .presentation-page:not(.presentation-video) .presentation-metric > span,
                .presentation-page:not(.presentation-video) .presentation-pillar > span,
                .presentation-page:not(.presentation-video) .presentation-question-meta span,
                .presentation-page:not(.presentation-video) .presentation-results-ranking span {
                    background: rgba(215, 168, 77, 0.13);
                    color: #f2cc78;
                }
                .presentation-page:not(.presentation-video) .presentation-guilherme-metrics .metric-youtube span {
                    background: rgba(255, 0, 0, 0.18);
                    color: #ff3434;
                }
                .presentation-page:not(.presentation-video) .presentation-guilherme-metrics .metric-instagram span {
                    background:
                        radial-gradient(circle at 30% 105%, rgba(254, 218, 117, 0.38), transparent 36%),
                        linear-gradient(135deg, rgba(131, 58, 180, 0.38), rgba(225, 48, 108, 0.34) 48%, rgba(245, 133, 41, 0.32));
                    color: #ff76ad;
                }
                .presentation-page:not(.presentation-video) .presentation-guilherme-metrics .metric-tiktok span {
                    background:
                        linear-gradient(135deg, rgba(0, 242, 234, 0.22), rgba(255, 0, 80, 0.22)),
                        rgba(255, 255, 255, 0.04);
                    color: #00f2ea;
                    filter: drop-shadow(1px 0 0 rgba(255, 0, 80, 0.72));
                }
                .presentation-page:not(.presentation-video) .presentation-guilherme-metrics .metric-views span {
                    background: rgba(72, 180, 159, 0.2);
                    color: #54e4ca;
                }
                .presentation-page:not(.presentation-video) .presentation-question-criteria span {
                    border-color: rgba(215, 168, 77, 0.16);
                    background: rgba(255, 255, 255, 0.06);
                }
                .presentation-page:not(.presentation-video) .presentation-question-live {
                    border-color: rgba(215, 168, 77, 0.2);
                    background: rgba(255, 248, 236, 0.08);
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
                }
                .presentation-page:not(.presentation-video) .presentation-question-live svg {
                    color: #48b49f;
                }
                .presentation-page:not(.presentation-video) .presentation-question-live span {
                    color: #f2cc78;
                }
                .presentation-page:not(.presentation-video) .presentation-question-live strong {
                    color: #fff8ec;
                }
                .presentation-page:not(.presentation-video) .presentation-question-live div small {
                    color: rgba(248, 242, 231, 0.62);
                }
                .presentation-page:not(.presentation-video) .presentation-guilherme-metrics strong,
                .presentation-page:not(.presentation-video) .presentation-metric strong,
                .presentation-page:not(.presentation-video) .presentation-metric small,
                .presentation-page:not(.presentation-video) .presentation-pillar strong,
                .presentation-page:not(.presentation-video) .presentation-focus-grid strong,
                .presentation-page:not(.presentation-video) .presentation-results-scoreboard strong,
                .presentation-page:not(.presentation-video) .presentation-results-panel-title strong,
                .presentation-page:not(.presentation-video) .presentation-results-bars span,
                .presentation-page:not(.presentation-video) .presentation-results-bars strong,
                .presentation-page:not(.presentation-video) .presentation-results-ranking strong,
                .presentation-page:not(.presentation-video) .presentation-results-ranking b,
                .presentation-page:not(.presentation-video) .presentation-results-insights p strong {
                    color: #fff8ec;
                }
                .presentation-page:not(.presentation-video) .presentation-focus-grid svg,
                .presentation-page:not(.presentation-video) .presentation-qr-copy svg,
                .presentation-page:not(.presentation-video) .presentation-results-panel-title {
                    color: #48b49f;
                }
                .presentation-page:not(.presentation-video) .presentation-steps strong {
                    background: linear-gradient(135deg, #d7a84d, #9a6817);
                    color: #120d08;
                }
                .presentation-page:not(.presentation-video) .presentation-qr-box {
                    border-color: rgba(215, 168, 77, 0.24);
                    background: rgba(255, 248, 236, 0.95);
                    box-shadow: 0 30px 78px rgba(0, 0, 0, 0.32);
                }
                .presentation-page:not(.presentation-video) .presentation-qr-copy a {
                    background: linear-gradient(135deg, #f2cc78, #c8932f);
                    color: #120d08;
                    box-shadow: 0 18px 42px rgba(201, 147, 47, 0.22);
                }
                .presentation-page:not(.presentation-video) .presentation-results-live {
                    border-color: rgba(215, 168, 77, 0.18);
                    background: rgba(255, 248, 236, 0.08);
                    color: #fff8ec;
                }
                .presentation-page:not(.presentation-video) .presentation-results-bars i {
                    background: rgba(255, 248, 236, 0.12);
                }
                .presentation-page:not(.presentation-video) .presentation-results-bars b {
                    background: linear-gradient(90deg, #d7a84d, #48b49f);
                }
                .presentation-page:not(.presentation-video) .presentation-results-ranking small,
                .presentation-page:not(.presentation-video) .presentation-results-footer,
                .presentation-page:not(.presentation-video) .presentation-results-scoreboard small {
                    color: rgba(248, 242, 231, 0.56);
                }
                .presentation-page:not(.presentation-video) .presentation-event-chip,
                .presentation-page:not(.presentation-video) .presentation-brand,
                .presentation-page:not(.presentation-video) .presentation-controls {
                    border-color: rgba(215, 168, 77, 0.22);
                    background: rgba(10, 9, 7, 0.72);
                    color: rgba(248, 242, 231, 0.82);
                    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
                }
                .presentation-page:not(.presentation-video) .presentation-event-chip strong,
                .presentation-page:not(.presentation-video) .presentation-controls button,
                .presentation-page:not(.presentation-video) .presentation-controls a {
                    color: #fff8ec;
                }
                .presentation-page:not(.presentation-video) .presentation-brand,
                .presentation-page:not(.presentation-video) .presentation-controls span {
                    color: #f2cc78;
                }
                .presentation-page h1,
                .presentation-page strong,
                .presentation-page b,
                .presentation-page small,
                .presentation-page button,
                .presentation-page a,
                .presentation-page .presentation-eyebrow,
                .presentation-page .presentation-event-chip,
                .presentation-page .presentation-brand,
                .presentation-page .presentation-controls span {
                    font-family: 'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    font-weight: 500;
                }
                .presentation-page h1 {
                    font-weight: 500;
                }
                @media (max-width: 1280px) {
                    .presentation-side-portrait {
                        display: none;
                    }
                    .presentation-video .presentation-slide {
                        width: min(1240px, 100%);
                        margin: 0 auto;
                    }
                    .presentation-video .presentation-copy {
                        justify-items: center;
                        text-align: center;
                    }
                    .presentation-page:not(.presentation-video) .presentation-slide {
                        width: min(1080px, 100%);
                    }
                }
                @media (max-width: 1080px) {
                    .presentation-stage {
                        padding-inline: 28px;
                    }
                    .presentation-event-chip {
                        left: 28px;
                    }
                    .presentation-brand,
                    .presentation-controls {
                        right: 28px;
                    }
                    .presentation-page h1 {
                        font-size: 2.65rem;
                    }
                    .presentation-video h1 {
                        font-size: 2.8rem;
                    }
                    .presentation-hero h1 {
                        font-size: 3.25rem;
                    }
                    .presentation-guilherme-panel {
                        grid-template-columns: 1fr;
                    }
                    .presentation-guilherme-metrics {
                        grid-template-columns: repeat(4, minmax(0, 1fr));
                    }
                    .presentation-guilherme-overview > p {
                        font-size: 1.34rem;
                    }
                    .presentation-hero-content {
                        grid-template-columns: 1fr;
                    }
                    .presentation-guilherme-metrics div {
                        min-height: 124px;
                        padding: 18px;
                    }
                    .presentation-timeline,
                    .presentation-metrics,
                    .presentation-steps {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                    .presentation-pillars {
                        grid-template-columns: 1fr;
                    }
                    .presentation-qr-layout {
                        grid-template-columns: 340px minmax(0, 1fr);
                    }
                    .presentation-tool-qr-layout {
                        grid-template-columns: 1fr;
                        max-width: 900px;
                    }
                    .presentation-qr-panel {
                        justify-items: start;
                        grid-template-columns: 280px minmax(0, 1fr);
                        align-items: center;
                    }
                    .presentation-tool-qr-layout .presentation-qr-copy {
                        justify-items: start;
                        text-align: left;
                    }
                    .presentation-qr-box {
                        width: 340px;
                    }
                    .presentation-results h1 {
                        font-size: 2.6rem;
                    }
                    .presentation-vote h1 {
                        font-size: 2.5rem;
                    }
                    .presentation-vote-layout {
                        grid-template-columns: 1fr;
                    }
                    .presentation-vote-copy {
                        min-height: 0;
                        align-content: start;
                    }
                    .presentation-vote-frame {
                        min-height: 520px;
                    }
                    .presentation-vote-frame iframe {
                        min-height: 520px;
                    }
                    .presentation-results-layout {
                        grid-template-columns: 1fr;
                    }
                    .presentation-results-scoreboard {
                        min-height: 0;
                        grid-template-columns: minmax(0, 0.7fr) minmax(0, 1fr);
                        align-items: center;
                    }
                    .presentation-results-scoreboard strong,
                    .presentation-results-scoreboard > span {
                        grid-column: 1;
                    }
                    .presentation-results-scoreboard p,
                    .presentation-results-live,
                    .presentation-results-scoreboard em {
                        grid-column: 2;
                    }
                }
                @media (max-width: 760px) {
                    .presentation-page {
                        min-height: 100svh;
                        overflow: auto;
                    }
                    .presentation-stage {
                        min-height: 100svh;
                        padding: 86px 18px 120px;
                    }
                    .presentation-photo {
                        inset: 0;
                        display: none;
                    }
                    .presentation-hero .presentation-photo {
                        inset: 0;
                    }
                    .presentation-photo::after {
                        background: rgba(252, 250, 245, 0.76);
                    }
                    .presentation-copy {
                        gap: 18px;
                    }
                    .presentation-page h1,
                    .presentation-hero h1 {
                        font-size: 2.15rem;
                        line-height: 1.05;
                    }
                    .presentation-video h1 {
                        font-size: 1.82rem;
                    }
                    .presentation-video .presentation-copy {
                        gap: 14px;
                    }
                    .presentation-page p,
                    .presentation-statement p {
                        font-size: 1.02rem;
                    }
                    .presentation-event-chip {
                        left: 14px;
                        right: 14px;
                        top: 14px;
                        width: auto;
                        justify-content: center;
                    }
                    .presentation-brand {
                        display: none;
                    }
                    .presentation-controls {
                        right: 14px;
                        left: 14px;
                        bottom: 14px;
                        justify-content: center;
                    }
                    .presentation-timeline,
                    .presentation-metrics,
                    .presentation-guilherme-panel,
                    .presentation-pillars,
                    .presentation-steps,
                    .presentation-focus-grid,
                    .presentation-qr-layout,
                    .presentation-tool-qr-layout,
                    .presentation-results-grid,
                    .presentation-results-insights,
                    .presentation-results-scoreboard {
                        grid-template-columns: 1fr;
                    }
                    .presentation-results-scoreboard strong,
                    .presentation-results-scoreboard > span,
                    .presentation-results-scoreboard p,
                    .presentation-results-live,
                    .presentation-results-scoreboard em {
                        grid-column: auto;
                    }
                    .presentation-results h1 {
                        font-size: 1.72rem;
                    }
                    .presentation-vote h1 {
                        font-size: 1.68rem;
                    }
                    .presentation-vote-copy {
                        gap: 14px;
                        padding: 18px;
                    }
                    .presentation-vote-copy p {
                        font-size: 1rem;
                    }
                    .presentation-vote-copy a {
                        width: 100%;
                    }
                    .presentation-vote-frame {
                        min-height: 460px;
                    }
                    .presentation-vote-frame iframe {
                        min-height: 460px;
                    }
                    .presentation-results-scoreboard {
                        padding: 16px;
                    }
                    .presentation-results-scoreboard strong {
                        font-size: 2.85rem;
                    }
                    .presentation-results-panel {
                        min-height: 0;
                        padding: 16px;
                    }
                    .presentation-results-footer {
                        display: grid;
                    }
                    .presentation-guilherme-metrics {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                    .presentation-guilherme-overview > p {
                        font-size: 1.05rem;
                    }
                    .presentation-guilherme-copy {
                        gap: 14px;
                    }
                    .presentation-hero-facts span {
                        min-height: 40px;
                        font-size: 0.82rem;
                        padding-inline: 11px;
                    }
                    .presentation-guilherme-timeline {
                        padding: 16px;
                    }
                    .presentation-guilherme-timeline div {
                        grid-template-columns: 54px minmax(0, 1fr);
                        gap: 10px;
                        padding: 8px 0;
                    }
                    .presentation-guilherme-timeline span {
                        font-size: 0.92rem;
                    }
                    .presentation-guilherme-timeline p,
                    .presentation-guilherme-metrics p {
                        font-size: 0.78rem;
                    }
                    .presentation-guilherme-metrics div {
                        min-height: 104px;
                        padding: 13px;
                    }
                    .presentation-guilherme-metrics strong {
                        font-size: 1.18rem;
                    }
                    .presentation-focus-grid > svg {
                        transform: rotate(90deg);
                    }
                    .presentation-timeline div,
                    .presentation-metric,
                    .presentation-pillar,
                    .presentation-focus-grid div,
                    .presentation-question-card,
                    .presentation-steps div {
                        min-height: 0;
                        padding: 16px;
                    }
                    .presentation-question-card {
                        gap: 16px;
                    }
                    .presentation-question-head {
                        align-items: stretch;
                        flex-direction: column;
                    }
                    .presentation-question-live {
                        width: 100%;
                        min-width: 0;
                    }
                    .presentation-question-live strong {
                        font-size: 1.5rem;
                    }
                    .presentation-question-meta span {
                        width: 46px;
                        height: 46px;
                        font-size: 1rem;
                    }
                    .presentation-question-prompt {
                        font-size: 1.08rem;
                    }
                    .presentation-question-criteria span {
                        min-height: 38px;
                        font-size: 0.82rem;
                    }
                    .presentation-focus-grid strong {
                        font-size: 1.5rem;
                    }
                    .presentation-focus-grid p {
                        max-width: 100%;
                        font-size: 1rem;
                    }
                    .presentation-qr-box {
                        width: min(100%, 330px);
                        justify-self: center;
                    }
                    .presentation-qr-panel {
                        grid-template-columns: 1fr;
                        justify-items: center;
                    }
                    .presentation-qr-copy {
                        justify-items: center;
                        text-align: center;
                    }
                    .presentation-qr-copy a {
                        width: 100%;
                    }
                    .presentation-closing p {
                        font-size: 1.45rem;
                    }
                }
            `}</style>
        </main>
    )
}
