'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
    ArrowLeft,
    ArrowRight,
    BarChart3,
    CheckCircle2,
    ClipboardCheck,
    ExternalLink,
    Loader2,
    Send,
    Trophy,
    UserRound,
} from 'lucide-react'
import {
    SELF_ASSESSMENT_QUESTIONS,
    calculateSelfAssessmentSummary,
    type SelfAssessmentSummary,
} from '@/lib/events/self-assessment'
import { trackEvent } from '@/lib/tracking/client'

type Props = {
    eventTitle: string
    eventSlug: string
    eventDateLabel: string
    eventLocation: string
    heroImage: string
}

type FormState = {
    full_name: string
    phone: string
    email: string
    broker_type: 'autonomo' | 'imobiliaria'
    real_estate_name: string
    creci: string
    creci_state: string
    city: string
}

type Stage = 'registration' | 'questions' | 'result'

const GUILHERME_AWARDS_VOTE_URL = 'https://awards.atrincarealestate.com.br/#/categoria/influenciador-do-ano/candidato/2ba4d003-3f4b-4d1a-b079-43c8a253c9b7'

type ApiResult = {
    success?: boolean
    error?: string
    registration_id?: string
    already_registered?: boolean
    summary?: SelfAssessmentSummary
}

const initialForm: FormState = {
    full_name: '',
    phone: '',
    email: '',
    broker_type: 'autonomo',
    real_estate_name: '',
    creci: '',
    creci_state: 'SC',
    city: '',
}

const scoreOptions = Array.from({ length: 11 }, (_, index) => index)

function draftKey(eventSlug: string) {
    return `pilger:self-assessment:${eventSlug}`
}

function getTrackingPayload() {
    if (typeof window === 'undefined') return {}
    const params = new URLSearchParams(window.location.search)

    return {
        page_url: window.location.href,
        referrer: document.referrer || '',
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        utm_content: params.get('utm_content') || '',
        utm_term: params.get('utm_term') || '',
    }
}

function scoreHint(score?: number) {
    if (score === undefined) return 'Escolha uma nota'
    if (score <= 4) return 'Preciso desenvolver'
    if (score <= 6) return 'Mediano'
    if (score <= 8) return 'Bom'
    return 'Referência'
}

function formatPhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function SelfAssessmentClient({
    eventTitle,
    eventSlug,
    eventDateLabel,
    eventLocation,
    heroImage,
}: Props) {
    const [stage, setStage] = useState<Stage>('registration')
    const [form, setForm] = useState<FormState>(initialForm)
    const [answers, setAnswers] = useState<Record<string, number>>({})
    const [currentIndex, setCurrentIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<SelfAssessmentSummary | null>(null)

    const currentQuestion = SELF_ASSESSMENT_QUESTIONS[currentIndex]
    const answeredCount = SELF_ASSESSMENT_QUESTIONS.filter(question => answers[question.id] !== undefined).length
    const progress = Math.round((answeredCount / SELF_ASSESSMENT_QUESTIONS.length) * 100)

    const previewSummary = useMemo(() => {
        const previewAnswers = SELF_ASSESSMENT_QUESTIONS.map(question => ({
            question_id: question.id,
            score: answers[question.id] ?? 0,
        }))
        return calculateSelfAssessmentSummary(previewAnswers)
    }, [answers])

    useEffect(() => {
        try {
            const raw = localStorage.getItem(draftKey(eventSlug))
            if (!raw) return
            const draft = JSON.parse(raw)
            if (draft?.form) setForm({ ...initialForm, ...draft.form })
            if (draft?.answers && typeof draft.answers === 'object') setAnswers(draft.answers)
            if (typeof draft?.currentIndex === 'number') {
                setCurrentIndex(Math.min(Math.max(draft.currentIndex, 0), SELF_ASSESSMENT_QUESTIONS.length - 1))
            }
        } catch {
            localStorage.removeItem(draftKey(eventSlug))
        }
    }, [eventSlug])

    useEffect(() => {
        if (stage === 'result') return
        try {
            localStorage.setItem(draftKey(eventSlug), JSON.stringify({ form, answers, currentIndex }))
        } catch {
            // Local draft is helpful during the event, but the flow still works without it.
        }
    }, [answers, currentIndex, eventSlug, form, stage])

    const updateForm = (field: keyof FormState, value: string) => {
        setForm(prev => ({ ...prev, [field]: field === 'phone' ? formatPhone(value) : value }))
    }

    const startAssessment = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)

        if (!form.full_name.trim()) {
            setError('Informe seu nome completo.')
            return
        }
        if (form.phone.replace(/\D/g, '').length < 10) {
            setError('Informe um WhatsApp válido.')
            return
        }
        if (!form.email.includes('@')) {
            setError('Informe um e-mail válido.')
            return
        }

        setStage('questions')
        trackEvent('event_self_assessment_started', {
            event_slug: eventSlug,
            event_title: eventTitle,
            assessment: 'perfil_corretor_ideal',
        }).catch(() => {})
    }

    const selectScore = (score: number) => {
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: score }))
        setError(null)
    }

    const goBack = () => {
        setError(null)
        if (stage === 'questions' && currentIndex === 0) {
            setStage('registration')
            return
        }
        setCurrentIndex(index => Math.max(0, index - 1))
    }

    const goNext = async () => {
        if (answers[currentQuestion.id] === undefined) {
            setError('Escolha uma nota para continuar.')
            return
        }

        if (currentIndex < SELF_ASSESSMENT_QUESTIONS.length - 1) {
            setError(null)
            setCurrentIndex(index => index + 1)
            return
        }

        await submitAssessment()
    }

    const submitAssessment = async () => {
        const missingIndex = SELF_ASSESSMENT_QUESTIONS.findIndex(question => answers[question.id] === undefined)
        if (missingIndex >= 0) {
            setCurrentIndex(missingIndex)
            setError('Responda todas as perguntas antes de finalizar.')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/eventos/${eventSlug}/self-assessment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    phone: form.phone.replace(/\D/g, ''),
                    consent_whatsapp: true,
                    answers: SELF_ASSESSMENT_QUESTIONS.map(question => ({
                        question_id: question.id,
                        score: answers[question.id],
                    })),
                    tracking: getTrackingPayload(),
                }),
            })
            const data = await response.json() as ApiResult
            if (!response.ok || !data.summary) throw new Error(data.error || 'Não foi possível salvar sua autoavaliação.')

            setResult(data.summary)
            setStage('result')
            localStorage.removeItem(draftKey(eventSlug))

            trackEvent('event_self_assessment_submitted', {
                event_slug: eventSlug,
                event_title: eventTitle,
                assessment: 'perfil_corretor_ideal',
                score_percent: data.summary.score_percent,
                classification: data.summary.classification_key,
                registration_id: data.registration_id,
            }).catch(() => {})
        } catch (err: any) {
            setError(err?.message || 'Não foi possível salvar sua autoavaliação.')
        } finally {
            setLoading(false)
        }
    }

    const resetFlow = () => {
        setForm(initialForm)
        setAnswers({})
        setCurrentIndex(0)
        setResult(null)
        setStage('registration')
        setError(null)
    }

    const trackAwardsVoteClick = () => {
        trackEvent('event_awards_vote_clicked', {
            event_slug: eventSlug,
            event_title: eventTitle,
            assessment: 'perfil_corretor_ideal',
            award: 'Real Estate Awards',
            category: 'Influenciador do Ano',
            candidate: 'Guilherme Pilger',
            target_url: GUILHERME_AWARDS_VOTE_URL,
            score_percent: result?.score_percent,
            classification: result?.classification_key,
        }).catch(() => {})
    }

    return (
        <main className="assessment-page" style={{ ['--assessment-bg' as string]: `url("${heroImage}")` }}>
            <section className="assessment-stage">
                <div className="assessment-heading">
                    <div>
                        <span className="assessment-kicker">Autoavaliação ao vivo</span>
                        <h1>Perfil do Corretor Ideal</h1>
                        <p>{eventTitle}</p>
                    </div>
                </div>

                <div className="assessment-layout">
                    <aside className="assessment-side" aria-label="Resumo da autoavaliação">
                        <div className="assessment-side-event">
                            <span>{eventDateLabel}</span>
                            <strong>{eventLocation}</strong>
                        </div>
                        <div className="assessment-side-mark">
                            <ClipboardCheck size={26} />
                            <div>
                                <span>12 dimensões</span>
                                <strong>{answeredCount}/{SELF_ASSESSMENT_QUESTIONS.length}</strong>
                            </div>
                        </div>
                        <div className="assessment-side-score">
                            <BarChart3 size={22} />
                            <div>
                                <span>Prévia</span>
                                <strong>{previewSummary.score_percent}/100</strong>
                            </div>
                        </div>
                        <div className="assessment-progress">
                            <span style={{ width: `${progress}%` }} />
                        </div>
                        <p>
                            Responda com honestidade. O resultado entra no painel do evento como aderência declarada ao perfil ideal.
                        </p>
                    </aside>

                    <section className="assessment-panel">
                        {stage === 'registration' && (
                            <form className="assessment-form" onSubmit={startAssessment}>
                                <div className="assessment-section-title">
                                    <UserRound size={23} />
                                    <div>
                                        <span>Cadastro do corretor</span>
                                        <h2>Antes de começar</h2>
                                    </div>
                                </div>

                                <label>
                                    Nome completo
                                    <input
                                        value={form.full_name}
                                        onChange={event => updateForm('full_name', event.target.value)}
                                        autoComplete="name"
                                        placeholder="Seu nome"
                                        required
                                    />
                                </label>

                                <div className="assessment-form-grid">
                                    <label>
                                        WhatsApp
                                        <input
                                            value={form.phone}
                                            onChange={event => updateForm('phone', event.target.value)}
                                            autoComplete="tel"
                                            inputMode="tel"
                                            placeholder="(47) 99999-9999"
                                            required
                                        />
                                    </label>
                                    <label>
                                        E-mail
                                        <input
                                            value={form.email}
                                            onChange={event => updateForm('email', event.target.value)}
                                            autoComplete="email"
                                            type="email"
                                            placeholder="voce@email.com"
                                            required
                                        />
                                    </label>
                                </div>

                                <div className="assessment-type" aria-label="Tipo de atuação">
                                    <button
                                        type="button"
                                        className={form.broker_type === 'autonomo' ? 'active' : ''}
                                        onClick={() => setForm(prev => ({ ...prev, broker_type: 'autonomo', real_estate_name: '' }))}
                                    >
                                        Autônomo
                                    </button>
                                    <button
                                        type="button"
                                        className={form.broker_type === 'imobiliaria' ? 'active' : ''}
                                        onClick={() => setForm(prev => ({ ...prev, broker_type: 'imobiliaria' }))}
                                    >
                                        Imobiliária
                                    </button>
                                </div>

                                {form.broker_type === 'imobiliaria' && (
                                    <label>
                                        Nome da imobiliária
                                        <input
                                            value={form.real_estate_name}
                                            onChange={event => updateForm('real_estate_name', event.target.value)}
                                            placeholder="Nome da empresa"
                                        />
                                    </label>
                                )}

                                <div className="assessment-form-grid three">
                                    <label>
                                        CRECI
                                        <input
                                            value={form.creci}
                                            onChange={event => updateForm('creci', event.target.value)}
                                            placeholder="Ex: 12345-F"
                                        />
                                    </label>
                                    <label>
                                        UF
                                        <input
                                            value={form.creci_state}
                                            onChange={event => updateForm('creci_state', event.target.value.toUpperCase().slice(0, 2))}
                                            placeholder="SC"
                                            maxLength={2}
                                        />
                                    </label>
                                    <label>
                                        Cidade
                                        <input
                                            value={form.city}
                                            onChange={event => updateForm('city', event.target.value)}
                                            placeholder="Balneário Camboriú"
                                        />
                                    </label>
                                </div>

                                {error && <div className="assessment-error">{error}</div>}

                                <button type="submit" className="assessment-primary">
                                    <ClipboardCheck size={18} />
                                    Começar autoavaliação
                                </button>
                            </form>
                        )}

                        {stage === 'questions' && currentQuestion && (
                            <div className="assessment-question">
                                <div className="assessment-question-top">
                                    <span>{currentQuestion.blockLabel}</span>
                                    <strong>{currentIndex + 1}/{SELF_ASSESSMENT_QUESTIONS.length}</strong>
                                </div>

                                <h2>{currentQuestion.title}</h2>
                                <p>{currentQuestion.prompt}</p>

                                <div className="assessment-criteria">
                                    {currentQuestion.criteria.map(item => (
                                        <span key={item}>{item}</span>
                                    ))}
                                </div>

                                <div className="assessment-scale-labels">
                                    <span>0-4 desenvolvimento</span>
                                    <span>5-6 mediano</span>
                                    <span>7-8 bom</span>
                                    <span>9-10 referência</span>
                                </div>

                                <div className="assessment-score-grid" role="radiogroup" aria-label="Nota de 0 a 10">
                                    {scoreOptions.map(score => {
                                        const active = answers[currentQuestion.id] === score
                                        return (
                                            <button
                                                key={score}
                                                type="button"
                                                className={active ? 'active' : ''}
                                                onClick={() => selectScore(score)}
                                                aria-pressed={active}
                                            >
                                                {score}
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="assessment-score-hint">
                                    {scoreHint(answers[currentQuestion.id])}
                                </div>

                                {error && <div className="assessment-error">{error}</div>}

                                <div className="assessment-actions">
                                    <button type="button" className="assessment-secondary" onClick={goBack}>
                                        <ArrowLeft size={17} />
                                        Voltar
                                    </button>
                                    <button type="button" className="assessment-primary" onClick={goNext} disabled={loading}>
                                        {loading ? <Loader2 className="spin" size={18} /> : currentIndex === SELF_ASSESSMENT_QUESTIONS.length - 1 ? <Send size={18} /> : <ArrowRight size={18} />}
                                        {currentIndex === SELF_ASSESSMENT_QUESTIONS.length - 1 ? 'Ver minha nota' : 'Próxima'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {stage === 'result' && result && (
                            <div className="assessment-result">
                                <div className="assessment-result-badge">
                                    <Trophy size={30} />
                                </div>
                                <span>Resultado registrado</span>
                                <h2>{result.score_percent}/100</h2>
                                <strong>{result.classification_label}</strong>
                                <p>{result.classification_description}</p>

                                <div className="assessment-awards-cta">
                                    <span>Próximo passo</span>
                                    <h3>Agora vote no Guilherme</h3>
                                    <p>
                                        Ele está concorrendo ao Real Estate Awards na categoria Influenciador do Ano.
                                        Seu voto ajuda a fortalecer a presença dele no mercado imobiliário.
                                    </p>
                                    <a
                                        href={GUILHERME_AWARDS_VOTE_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={trackAwardsVoteClick}
                                    >
                                        <ExternalLink size={17} />
                                        Votar no Guilherme
                                    </a>
                                </div>

                                <div className="assessment-blocks">
                                    {result.block_scores.map(block => (
                                        <div key={block.block}>
                                            <span>{block.label}</span>
                                            <strong>{block.percentage}%</strong>
                                        </div>
                                    ))}
                                </div>

                                <div className="assessment-result-grid">
                                    <div>
                                        <h3>Seus pontos fortes</h3>
                                        {result.strengths.map(item => (
                                            <p key={item.question_id}><CheckCircle2 size={15} />{item.title} - {item.score}/10</p>
                                        ))}
                                    </div>
                                    <div>
                                        <h3>Pontos para evoluir</h3>
                                        {result.improvements.map(item => (
                                            <p key={item.question_id}><BarChart3 size={15} />{item.title} - {item.score}/10</p>
                                        ))}
                                    </div>
                                </div>

                                <button type="button" className="assessment-secondary" onClick={resetFlow}>
                                    <UserRound size={17} />
                                    Avaliar outro corretor
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </section>

            <style>{`
                .assessment-page {
                    min-height: 100vh;
                    color: #fff8ec;
                    background:
                        linear-gradient(135deg, rgba(6, 10, 12, 0.92), rgba(22, 18, 14, 0.82) 48%, rgba(7, 10, 12, 0.94)),
                        var(--assessment-bg) center / cover fixed no-repeat;
                    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                }
                .assessment-stage {
                    width: min(1180px, calc(100% - 36px));
                    margin: 0 auto;
                    padding: 42px 0 72px;
                }
                .assessment-heading {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    gap: 22px;
                    align-items: end;
                    margin-bottom: 24px;
                }
                .assessment-kicker,
                .assessment-section-title span,
                .assessment-question-top span,
                .assessment-result > span {
                    color: #e7c265;
                    font-size: 0.74rem;
                    font-weight: 950;
                    letter-spacing: 0.13em;
                    text-transform: uppercase;
                }
                .assessment-heading h1 {
                    margin: 8px 0 10px;
                    color: #fff9ec;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(2rem, 5vw, 4.35rem);
                    line-height: 1;
                    letter-spacing: 0;
                }
                .assessment-heading p {
                    max-width: 680px;
                    margin: 0;
                    color: rgba(255, 248, 236, 0.72);
                    line-height: 1.55;
                }
                .assessment-layout {
                    display: grid;
                    grid-template-columns: 300px minmax(0, 1fr);
                    gap: 18px;
                    align-items: start;
                }
                .assessment-side,
                .assessment-panel {
                    border: 1px solid rgba(255, 255, 255, 0.13);
                    border-radius: 8px;
                    background:
                        radial-gradient(circle at 100% 0%, rgba(231, 194, 101, 0.14), transparent 32%),
                        rgba(7, 12, 14, 0.78);
                    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
                    backdrop-filter: blur(14px);
                }
                .assessment-side {
                    position: sticky;
                    top: 84px;
                    display: grid;
                    gap: 14px;
                    padding: 18px;
                }
                .assessment-side-event {
                    display: grid;
                    gap: 5px;
                    min-height: 66px;
                    padding: 12px;
                    border: 1px solid rgba(231, 194, 101, 0.22);
                    border-radius: 8px;
                    background: rgba(5, 8, 10, 0.55);
                }
                .assessment-side-mark,
                .assessment-side-score {
                    display: grid;
                    grid-template-columns: 38px minmax(0, 1fr);
                    gap: 11px;
                    align-items: center;
                    min-height: 66px;
                    padding: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.055);
                }
                .assessment-side svg {
                    color: #e7c265;
                }
                .assessment-side span {
                    display: block;
                    color: rgba(255, 248, 236, 0.62);
                    font-size: 0.74rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .assessment-side-event span {
                    font-weight: 700;
                    text-transform: none;
                }
                .assessment-side strong {
                    display: block;
                    margin-top: 3px;
                    color: #fff8ec;
                    font-size: 1.1rem;
                }
                .assessment-side p {
                    margin: 0;
                    color: rgba(255, 248, 236, 0.66);
                    font-size: 0.86rem;
                    line-height: 1.55;
                }
                .assessment-progress {
                    height: 9px;
                    border-radius: 99px;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.1);
                }
                .assessment-progress span {
                    display: block;
                    height: 100%;
                    border-radius: inherit;
                    background: linear-gradient(90deg, #e7c265, #42d392);
                    transition: width 0.24s ease;
                }
                .assessment-panel {
                    min-height: 560px;
                    padding: clamp(20px, 4vw, 34px);
                }
                .assessment-form,
                .assessment-question,
                .assessment-result {
                    display: grid;
                    gap: 16px;
                }
                .assessment-section-title {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    margin-bottom: 2px;
                }
                .assessment-section-title svg {
                    color: #e7c265;
                }
                .assessment-section-title h2,
                .assessment-result h2 {
                    margin: 3px 0 0;
                    color: #fff8ec;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.55rem, 4vw, 2.4rem);
                    line-height: 1.05;
                    letter-spacing: 0;
                }
                .assessment-question h2 {
                    margin: 3px 0 0;
                    color: #fff8ec;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.28rem, 2.9vw, 1.85rem);
                    line-height: 1.08;
                    letter-spacing: 0;
                }
                .assessment-form label {
                    display: grid;
                    gap: 8px;
                    color: rgba(255, 248, 236, 0.72);
                    font-size: 0.76rem;
                    font-weight: 850;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .assessment-form input {
                    width: 100%;
                    min-height: 48px;
                    border: 1px solid rgba(255, 255, 255, 0.16);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.075);
                    color: #fff8ec;
                    padding: 0 13px;
                    font-size: 0.94rem;
                    outline: none;
                }
                .assessment-form input:focus {
                    border-color: #e7c265;
                    box-shadow: 0 0 0 3px rgba(231, 194, 101, 0.15);
                }
                .assessment-form input::placeholder {
                    color: rgba(255, 248, 236, 0.34);
                }
                .assessment-form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                }
                .assessment-form-grid.three {
                    grid-template-columns: 1fr 86px 1fr;
                }
                .assessment-type {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                }
                .assessment-type button,
                .assessment-score-grid button,
                .assessment-primary,
                .assessment-secondary {
                    min-height: 48px;
                    border-radius: 8px;
                    font-weight: 950;
                    cursor: pointer;
                    transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
                }
                .assessment-type button {
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    background: rgba(255, 255, 255, 0.055);
                    color: rgba(255, 248, 236, 0.72);
                }
                .assessment-type button.active {
                    border-color: rgba(231, 194, 101, 0.78);
                    background: rgba(231, 194, 101, 0.16);
                    color: #fff8ec;
                }
                .assessment-primary,
                .assessment-secondary {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: 0;
                    padding: 0 18px;
                }
                .assessment-primary {
                    background: linear-gradient(135deg, #e7c265, #b87b25);
                    color: #120d08;
                    box-shadow: 0 18px 34px rgba(184, 123, 37, 0.22);
                }
                .assessment-primary:hover,
                .assessment-secondary:hover {
                    transform: translateY(-1px);
                }
                .assessment-primary:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }
                .assessment-secondary {
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    background: rgba(255, 255, 255, 0.06);
                    color: #fff8ec;
                }
                .assessment-error {
                    border: 1px solid rgba(248, 113, 113, 0.38);
                    border-radius: 8px;
                    background: rgba(248, 113, 113, 0.12);
                    color: #fecaca;
                    padding: 11px 12px;
                    font-size: 0.88rem;
                    line-height: 1.45;
                }
                .assessment-question-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                }
                .assessment-question-top strong {
                    color: rgba(255, 248, 236, 0.68);
                    font-size: 0.86rem;
                }
                .assessment-question p {
                    max-width: 720px;
                    margin: 0;
                    color: rgba(255, 248, 236, 0.72);
                    font-size: 1.02rem;
                    line-height: 1.62;
                }
                .assessment-criteria {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .assessment-criteria span {
                    min-height: 30px;
                    display: inline-flex;
                    align-items: center;
                    border-radius: 999px;
                    border: 1px solid rgba(231, 194, 101, 0.24);
                    background: rgba(231, 194, 101, 0.08);
                    color: rgba(255, 248, 236, 0.78);
                    padding: 0 10px;
                    font-size: 0.76rem;
                    font-weight: 750;
                }
                .assessment-scale-labels {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 8px;
                    color: rgba(255, 248, 236, 0.58);
                    font-size: 0.72rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .assessment-score-grid {
                    display: grid;
                    grid-template-columns: repeat(11, minmax(0, 1fr));
                    gap: 7px;
                }
                .assessment-score-grid button {
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    background: rgba(255, 255, 255, 0.06);
                    color: #fff8ec;
                    font-size: 1rem;
                }
                .assessment-score-grid button:hover,
                .assessment-score-grid button.active {
                    border-color: #e7c265;
                    background: rgba(231, 194, 101, 0.2);
                    box-shadow: 0 0 0 2px rgba(231, 194, 101, 0.16);
                }
                .assessment-score-hint {
                    min-height: 38px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: fit-content;
                    border-radius: 999px;
                    border: 1px solid rgba(66, 211, 146, 0.28);
                    background: rgba(66, 211, 146, 0.1);
                    color: #bbf7d0;
                    padding: 0 13px;
                    font-weight: 900;
                    font-size: 0.82rem;
                }
                .assessment-actions {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    margin-top: 6px;
                }
                .assessment-result {
                    justify-items: center;
                    text-align: center;
                }
                .assessment-result-badge {
                    display: grid;
                    place-items: center;
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, rgba(231, 194, 101, 0.28), rgba(66, 211, 146, 0.2));
                    color: #e7c265;
                }
                .assessment-result h2 {
                    font-size: clamp(3.4rem, 10vw, 6rem);
                }
                .assessment-result strong {
                    color: #bbf7d0;
                    font-size: 1.16rem;
                }
                .assessment-result > p {
                    max-width: 620px;
                    margin: 0;
                    color: rgba(255, 248, 236, 0.7);
                    line-height: 1.6;
                }
                .assessment-awards-cta {
                    width: min(620px, 100%);
                    display: grid;
                    justify-items: center;
                    gap: 9px;
                    padding: 18px;
                    border: 1px solid rgba(231, 194, 101, 0.32);
                    border-radius: 8px;
                    background:
                        radial-gradient(circle at 100% 0%, rgba(231, 194, 101, 0.22), transparent 38%),
                        rgba(10, 15, 18, 0.86);
                    color: #fff8ec;
                    box-shadow: 0 18px 45px rgba(12, 16, 20, 0.18);
                }
                .assessment-awards-cta span {
                    color: #f4cc72;
                    font-size: 0.7rem;
                    font-weight: 950;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .assessment-awards-cta h3 {
                    margin: 0;
                    color: #fff8ec;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.45rem, 4vw, 2rem);
                    line-height: 1.05;
                    letter-spacing: 0;
                }
                .assessment-awards-cta p {
                    max-width: 500px;
                    margin: 0;
                    color: rgba(255, 248, 236, 0.72);
                    font-size: 0.92rem;
                    line-height: 1.5;
                }
                .assessment-awards-cta a {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 48px;
                    margin-top: 3px;
                    padding: 0 18px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #f4cc72, #d59a2f);
                    color: #1a1206;
                    font-size: 0.86rem;
                    font-weight: 950;
                    text-decoration: none;
                    box-shadow: 0 14px 30px rgba(213, 154, 47, 0.22);
                }
                .assessment-blocks {
                    width: 100%;
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 10px;
                    margin-top: 8px;
                }
                .assessment-blocks div,
                .assessment-result-grid > div {
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.055);
                }
                .assessment-blocks div {
                    display: grid;
                    gap: 5px;
                    padding: 13px;
                }
                .assessment-blocks span {
                    color: rgba(255, 248, 236, 0.6);
                    font-size: 0.72rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }
                .assessment-blocks strong {
                    color: #fff8ec;
                    font-size: 1.18rem;
                }
                .assessment-result-grid {
                    width: 100%;
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                    text-align: left;
                }
                .assessment-result-grid > div {
                    padding: 16px;
                }
                .assessment-result-grid h3 {
                    margin: 0 0 10px;
                    color: #fff8ec;
                    font-size: 0.96rem;
                }
                .assessment-result-grid p {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 8px 0 0;
                    color: rgba(255, 248, 236, 0.72);
                    font-size: 0.88rem;
                    line-height: 1.38;
                }
                .assessment-result-grid svg {
                    flex: 0 0 auto;
                    color: #e7c265;
                }
                .spin {
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 920px) {
                    .assessment-heading,
                    .assessment-layout {
                        grid-template-columns: 1fr;
                    }
                    .assessment-side {
                        position: static;
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                    .assessment-progress,
                    .assessment-side p {
                        grid-column: 1 / -1;
                    }
                    .assessment-score-grid {
                        grid-template-columns: repeat(6, minmax(0, 1fr));
                    }
                    .assessment-blocks {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }
                @media (max-width: 640px) {
                    .assessment-stage {
                        width: min(100% - 28px, 430px);
                        padding-top: 28px;
                    }
                    .assessment-heading {
                        gap: 12px;
                        margin-bottom: 16px;
                    }
                    .assessment-heading h1 {
                        margin-top: 6px;
                        font-size: clamp(1.42rem, 6vw, 1.75rem);
                        line-height: 1.04;
                        white-space: nowrap;
                    }
                    .assessment-question h2 {
                        font-size: clamp(1.04rem, 4.2vw, 1.22rem);
                        line-height: 1.12;
                        white-space: nowrap;
                    }
                    .assessment-panel,
                    .assessment-side {
                        padding: 14px;
                    }
                    .assessment-form-grid,
                    .assessment-form-grid.three,
                    .assessment-scale-labels,
                    .assessment-result-grid,
                    .assessment-blocks {
                        grid-template-columns: 1fr;
                    }
                    .assessment-side {
                        grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.82fr) minmax(0, 0.82fr);
                    }
                    .assessment-score-grid {
                        grid-template-columns: repeat(4, minmax(0, 1fr));
                    }
                    .assessment-side {
                        gap: 8px;
                    }
                    .assessment-side-event,
                    .assessment-side-mark,
                    .assessment-side-score {
                        gap: 8px;
                        min-height: 48px;
                        padding: 9px 10px;
                    }
                    .assessment-side-event {
                        align-content: center;
                    }
                    .assessment-side-mark,
                    .assessment-side-score {
                        grid-template-columns: 22px minmax(0, 1fr);
                    }
                    .assessment-side-mark svg,
                    .assessment-side-score svg {
                        width: 18px;
                        height: 18px;
                    }
                    .assessment-side span {
                        font-size: 0.58rem;
                        line-height: 1.15;
                    }
                    .assessment-side strong {
                        margin-top: 1px;
                        font-size: 0.82rem;
                        line-height: 1.18;
                    }
                    .assessment-progress {
                        height: 6px;
                    }
                    .assessment-side p {
                        display: none;
                    }
                    .assessment-score-grid button {
                        min-height: 50px;
                    }
                    .assessment-actions {
                        display: grid;
                        grid-template-columns: 1fr;
                    }
                    .assessment-primary,
                    .assessment-secondary {
                        width: 100%;
                    }
                }
                .assessment-page {
                    color: #172033;
                    background:
                        linear-gradient(135deg, rgba(252, 250, 245, 0.96), rgba(247, 243, 234, 0.94) 48%, rgba(255, 255, 255, 0.96)),
                        var(--assessment-bg) center / cover fixed no-repeat;
                }
                .assessment-kicker,
                .assessment-section-title span,
                .assessment-question-top span,
                .assessment-result > span {
                    color: #9a6817;
                }
                .assessment-heading h1,
                .assessment-section-title h2,
                .assessment-question h2,
                .assessment-result h2,
                .assessment-result-grid h3 {
                    color: #172033;
                }
                .assessment-heading p,
                .assessment-question p,
                .assessment-result > p {
                    color: #475569;
                }
                .assessment-side,
                .assessment-panel {
                    border-color: rgba(154, 104, 23, 0.18);
                    background:
                        radial-gradient(circle at 100% 0%, rgba(220, 166, 54, 0.16), transparent 34%),
                        rgba(255, 255, 255, 0.9);
                    box-shadow: 0 22px 60px rgba(70, 50, 20, 0.12);
                }
                .assessment-side-event,
                .assessment-side-mark,
                .assessment-side-score,
                .assessment-blocks div,
                .assessment-result-grid > div {
                    border-color: rgba(154, 104, 23, 0.16);
                    background: rgba(255, 255, 255, 0.84);
                }
                .assessment-side svg,
                .assessment-section-title svg,
                .assessment-result-grid svg,
                .assessment-result-badge {
                    color: #b57a1c;
                }
                .assessment-side span,
                .assessment-question-top strong,
                .assessment-scale-labels,
                .assessment-blocks span {
                    color: #64748b;
                }
                .assessment-side strong,
                .assessment-blocks strong {
                    color: #172033;
                }
                .assessment-progress {
                    background: rgba(148, 163, 184, 0.22);
                }
                .assessment-progress span {
                    background: linear-gradient(90deg, #c8932f, #22c55e);
                }
                .assessment-form label {
                    color: #475569;
                }
                .assessment-form input {
                    border-color: rgba(100, 116, 139, 0.28);
                    background: rgba(255, 255, 255, 0.92);
                    color: #111827;
                }
                .assessment-form input::placeholder {
                    color: #94a3b8;
                }
                .assessment-type button,
                .assessment-secondary,
                .assessment-score-grid button {
                    border-color: rgba(100, 116, 139, 0.24);
                    background: rgba(255, 255, 255, 0.86);
                    color: #172033;
                }
                .assessment-type button.active,
                .assessment-score-grid button:hover,
                .assessment-score-grid button.active {
                    border-color: #c8932f;
                    background: rgba(248, 211, 120, 0.3);
                    color: #172033;
                }
                .assessment-criteria span {
                    border-color: rgba(200, 147, 47, 0.22);
                    background: rgba(248, 211, 120, 0.2);
                    color: #334155;
                }
                .assessment-score-hint {
                    border-color: rgba(34, 197, 94, 0.24);
                    background: rgba(220, 252, 231, 0.8);
                    color: #047857;
                }
                .assessment-result strong {
                    color: #047857;
                }
                .assessment-result-grid p {
                    color: #475569;
                }
                .assessment-awards-cta {
                    border-color: rgba(154, 104, 23, 0.2);
                    background:
                        radial-gradient(circle at 100% 0%, rgba(248, 211, 120, 0.28), transparent 40%),
                        rgba(255, 255, 255, 0.92);
                    color: #172033;
                    box-shadow: 0 20px 44px rgba(70, 50, 20, 0.12);
                }
                .assessment-awards-cta span {
                    color: #9a6817;
                }
                .assessment-awards-cta h3 {
                    color: #172033;
                }
                .assessment-awards-cta p {
                    color: #475569;
                }
            `}</style>
        </main>
    )
}
