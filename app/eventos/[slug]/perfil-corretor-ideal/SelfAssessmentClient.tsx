'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
    ArrowLeft,
    ArrowRight,
    BarChart3,
    CheckCircle2,
    ClipboardCheck,
    Download,
    FileText,
    Loader2,
    MessageCircle,
    Printer,
    Send,
    Target,
    Trophy,
    UserRound,
} from 'lucide-react'
import {
    SELF_ASSESSMENT_QUESTIONS,
    SELF_ASSESSMENT_VERSION,
    calculateSelfAssessmentSummary,
    type SelfAssessmentScoredAnswer,
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

type ApiResult = {
    success?: boolean
    error?: string
    registration_id?: string
    already_registered?: boolean
    summary?: SelfAssessmentSummary
}

type ProgressResult = {
    success?: boolean
    error?: string
    registration_id?: string
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
    return `pilger:self-assessment:${SELF_ASSESSMENT_VERSION}:${eventSlug}`
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

function reportFileBaseName(name: string, eventSlug: string) {
    const raw = name.trim() || eventSlug || 'corretor'
    return raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'perfil-corretor-ideal'
}

function recommendationForAnswer(answer: SelfAssessmentScoredAnswer) {
    const title = answer.title.toLowerCase()

    if (title.includes('crm')) {
        return {
            diagnosis: 'A oportunidade pode estar escapando por falta de registro, proximo passo e data clara.',
            action: 'Atualize todos os leads ativos no CRM e defina uma unica proxima acao para cada contato.',
            cadence: '15 minutos no fim de cada dia util.',
            metric: '100% das oportunidades com responsavel, data e proximo passo.',
        }
    }

    if (title.includes('conteudo') || title.includes('influenciador')) {
        return {
            diagnosis: 'Sua autoridade digital ainda pode gerar mais demanda e lembranca de mercado.',
            action: 'Grave uma peca curta por dia respondendo uma duvida real de comprador, vendedor ou investidor.',
            cadence: '5 publicacoes por semana.',
            metric: '20 conteudos publicados em 30 dias.',
        }
    }

    if (title.includes('foco') || title.includes('rotina') || title.includes('disciplina') || title.includes('procrast')) {
        return {
            diagnosis: 'O risco principal esta na dispersao entre intencao, prioridade e execucao comercial.',
            action: 'Escolha tres prioridades do dia e bloqueie dois periodos sem interrupcao para executar.',
            cadence: 'Todos os dias, antes do primeiro atendimento.',
            metric: '80% das prioridades concluidas por semana.',
        }
    }

    if (title.includes('vender') || title.includes('closer') || title.includes('atendimento')) {
        return {
            diagnosis: 'A venda pode melhorar quando a conversa termina com direcao mais objetiva.',
            action: 'Ao final de cada conversa, valide necessidade, objeção principal e proximo passo combinado.',
            cadence: 'Em todos os atendimentos da semana.',
            metric: 'Proximo passo registrado em 90% dos atendimentos.',
        }
    }

    if (title.includes('mercado') || title.includes('captar')) {
        return {
            diagnosis: 'Existe espaco para ganhar mais seguranca com produto, regiao e oportunidade.',
            action: 'Mapeie ofertas, precos e diferenciais de uma regiao por dia e transforme em argumento comercial.',
            cadence: '30 minutos por dia util.',
            metric: '5 regioes ou nichos revisados por semana.',
        }
    }

    if (title.includes('escuta') || title.includes('pessoas') || title.includes('comunic')) {
        return {
            diagnosis: 'A qualidade da conversa melhora quando o cliente se sente lido antes de ser conduzido.',
            action: 'Use tres perguntas de aprofundamento antes de apresentar solucao ou opiniao.',
            cadence: 'Em todo primeiro atendimento.',
            metric: 'Resumo de dor, desejo e momento registrado em cada lead.',
        }
    }

    return {
        diagnosis: `Este ponto aparece como prioridade porque recebeu ${answer.score}/10 na sua autoavaliacao.`,
        action: `Crie um ritual simples para praticar ${answer.title.toLowerCase()} com intencao comercial.`,
        cadence: 'Revisao duas vezes por semana.',
        metric: `Aumentar ${answer.title.toLowerCase()} em pelo menos 2 pontos na proxima avaliacao.`,
    }
}

function buildReportText(
    form: FormState,
    result: SelfAssessmentSummary,
    eventTitle: string,
    generatedAt: string,
) {
    const blocks = result.block_scores.map(block => `${block.label}: ${block.percentage}%`).join('\n')
    const strengths = result.strengths.map(item => `- ${item.title}: ${item.score}/10`).join('\n')
    const improvements = result.improvements.map(item => `- ${item.title}: ${item.score}/10`).join('\n')
    const priorities = [...result.answers]
        .sort((a, b) => a.score - b.score)
        .slice(0, 4)
        .map((item, index) => {
            const rec = recommendationForAnswer(item)
            return [
                `${index + 1}. ${item.title} (${item.score}/10)`,
                `Diagnostico: ${rec.diagnosis}`,
                `Acao pratica: ${rec.action}`,
                `Cadencia: ${rec.cadence}`,
                `Indicador: ${rec.metric}`,
            ].join('\n')
        })
        .join('\n\n')
    const answers = result.answers
        .map(item => `${item.block_label} | ${item.title}: ${item.score}/10 | ${item.criteria.join(', ')}`)
        .join('\n')

    return [
        'RELATORIO - PERFIL DO CORRETOR IDEAL',
        `Gerado em: ${generatedAt}`,
        `Evento: ${eventTitle}`,
        `Nome: ${form.full_name}`,
        `WhatsApp: ${form.phone}`,
        `E-mail: ${form.email}`,
        '',
        `Resultado geral: ${result.score_percent}/100`,
        `Classificacao: ${result.classification_label}`,
        result.classification_description,
        '',
        'DIMENSOES',
        blocks,
        '',
        'PONTOS FORTES',
        strengths,
        '',
        'PONTOS PARA EVOLUIR',
        improvements,
        '',
        'PRIORIDADES DE CURTO PRAZO',
        priorities,
        '',
        'DETALHAMENTO DAS RESPOSTAS',
        answers,
    ].join('\n')
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
    const [progressSaving, setProgressSaving] = useState(false)
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

    const reportGeneratedAt = useMemo(() => (
        stage === 'result'
            ? new Date().toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })
            : ''
    ), [stage])

    const priorityPlan = useMemo(() => (
        result
            ? [...result.answers]
                .sort((a, b) => a.score - b.score)
                .slice(0, 4)
                .map(answer => ({ answer, ...recommendationForAnswer(answer) }))
            : []
    ), [result])

    const answersByBlock = useMemo(() => (
        result
            ? result.block_scores.map(block => ({
                ...block,
                answers: result.answers.filter(answer => answer.block === block.block),
            }))
            : []
    ), [result])

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

    const buildAssessmentPayload = (sourceAnswers: Record<string, number>, completedQuestionId?: string) => ({
        ...form,
        phone: form.phone.replace(/\D/g, ''),
        consent_whatsapp: true,
        completed_question_id: completedQuestionId,
        answers: SELF_ASSESSMENT_QUESTIONS
            .filter(question => sourceAnswers[question.id] !== undefined)
            .map(question => ({
                question_id: question.id,
                score: sourceAnswers[question.id],
            })),
        tracking: getTrackingPayload(),
    })

    const syncAssessmentProgress = async (sourceAnswers: Record<string, number>, completedQuestionId?: string) => {
        const response = await fetch(`/api/eventos/${eventSlug}/self-assessment/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildAssessmentPayload(sourceAnswers, completedQuestionId)),
        })
        const data = await response.json() as ProgressResult
        if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível salvar seu progresso.')
        return data
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
            setProgressSaving(true)
            setError(null)
            try {
                await syncAssessmentProgress(answers, currentQuestion.id)
                setCurrentIndex(index => index + 1)
            } catch (err: any) {
                setError(err?.message || 'Não foi possível salvar seu progresso.')
            } finally {
                setProgressSaving(false)
            }
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
                body: JSON.stringify(buildAssessmentPayload(answers, currentQuestion.id)),
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

    const printReport = () => {
        if (!result) return
        trackEvent('event_self_assessment_report_printed', {
            event_slug: eventSlug,
            event_title: eventTitle,
            assessment: 'perfil_corretor_ideal',
            score_percent: result.score_percent,
            classification: result.classification_key,
        }).catch(() => {})
        window.print()
    }

    const downloadReport = () => {
        if (!result) return
        const content = buildReportText(form, result, eventTitle, reportGeneratedAt)
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${reportFileBaseName(form.full_name, eventSlug)}-perfil-corretor-ideal.txt`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)

        trackEvent('event_self_assessment_report_downloaded', {
            event_slug: eventSlug,
            event_title: eventTitle,
            assessment: 'perfil_corretor_ideal',
            score_percent: result.score_percent,
            classification: result.classification_key,
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
                                <span>{SELF_ASSESSMENT_QUESTIONS.length} perguntas</span>
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

                                <div className="assessment-optional-grid">
                                    <label>
                                        CRECI <span>opcional</span>
                                        <input
                                            value={form.creci}
                                            onChange={event => updateForm('creci', event.target.value)}
                                            placeholder="Ex: 12345-F"
                                        />
                                    </label>
                                    <label>
                                        UF <span>opcional</span>
                                        <input
                                            value={form.creci_state}
                                            onChange={event => updateForm('creci_state', event.target.value.toUpperCase().slice(0, 2))}
                                            placeholder="SC"
                                            maxLength={2}
                                        />
                                    </label>
                                    <label className="assessment-city-field">
                                        Cidade <span>opcional</span>
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
                                    <button type="button" className="assessment-primary" onClick={goNext} disabled={loading || progressSaving}>
                                        {loading || progressSaving ? <Loader2 className="spin" size={18} /> : currentIndex === SELF_ASSESSMENT_QUESTIONS.length - 1 ? <Send size={18} /> : <ArrowRight size={18} />}
                                        {currentIndex === SELF_ASSESSMENT_QUESTIONS.length - 1 ? 'Gerar relatório' : 'Próxima'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {stage === 'result' && result && (
                            <div className="assessment-result">
                                <div className="assessment-result-summary">
                                    <div className="assessment-result-badge">
                                        <Trophy size={30} />
                                    </div>
                                    <span>Resultado registrado</span>
                                    <h2>{result.score_percent}/100</h2>
                                    <strong>{result.classification_label}</strong>
                                    <p>{result.classification_description}</p>
                                </div>

                                <div className="assessment-result-dashboard">
                                    <div className="assessment-report-toolbar">
                                        <div>
                                            <span>Relatório individual</span>
                                            <strong>{form.full_name}</strong>
                                            <small>Gerado em {reportGeneratedAt}</small>
                                        </div>
                                        <div className="assessment-report-actions">
                                            <button type="button" onClick={printReport}>
                                                <Printer size={17} />
                                                Imprimir relatório
                                            </button>
                                            <button type="button" onClick={downloadReport}>
                                                <Download size={17} />
                                                Baixar relatório
                                            </button>
                                        </div>
                                    </div>

                                    <div className="assessment-diagnostic-card">
                                        <FileText size={28} />
                                        <div>
                                            <span>Leitura do perfil</span>
                                            <h3>{result.classification_label}</h3>
                                            <p>
                                                Seu resultado mostra {result.score_percent}% de aderência ao Perfil do Corretor Ideal.
                                                A leitura abaixo transforma suas respostas em diagnóstico, prioridades práticas e
                                                indicadores simples para os próximos 30 dias.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="assessment-whatsapp-note">
                                        <MessageCircle size={24} />
                                        <div>
                                            <strong>Você também vai receber uma análise em áudio no WhatsApp.</strong>
                                            <p>
                                                O agente global vai enviar uma leitura com a voz do Guilherme sobre sua nota,
                                                seus pontos de melhoria e o próximo passo recomendado.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="assessment-blocks">
                                        {result.block_scores.map(block => (
                                            <div key={block.block}>
                                                <span>{block.label}</span>
                                                <strong>{block.percentage}%</strong>
                                            </div>
                                        ))}
                                    </div>
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

                                <section className="assessment-plan-section">
                                    <div className="assessment-report-heading">
                                        <span>Plano individual</span>
                                        <h3>Prioridades de curto prazo</h3>
                                        <p>Ações observáveis, cadência e indicador para transformar resposta em execução.</p>
                                    </div>
                                    <div className="assessment-priority-grid">
                                        {priorityPlan.map((item, index) => (
                                            <article key={item.answer.question_id} className="assessment-priority-card">
                                                <div>
                                                    <Target size={18} />
                                                    <span>{String(index + 1).padStart(2, '0')}</span>
                                                </div>
                                                <h4>{item.answer.title}</h4>
                                                <p><strong>Diagnóstico</strong>{item.diagnosis}</p>
                                                <p><strong>Ação prática</strong>{item.action}</p>
                                                <dl>
                                                    <div>
                                                        <dt>Cadência</dt>
                                                        <dd>{item.cadence}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Indicador</dt>
                                                        <dd>{item.metric}</dd>
                                                    </div>
                                                </dl>
                                            </article>
                                        ))}
                                    </div>
                                </section>

                                <section className="assessment-answer-report">
                                    <div className="assessment-report-heading">
                                        <span>Detalhamento</span>
                                        <h3>Todas as respostas da avaliação</h3>
                                        <p>Use este quadro para revisar onde está forte, onde precisa ganhar método e o que acompanhar na próxima rodada.</p>
                                    </div>
                                    {answersByBlock.map(block => (
                                        <div key={block.block} className="assessment-answer-block">
                                            <div>
                                                <h4>{block.label}</h4>
                                                <strong>{block.percentage}%</strong>
                                            </div>
                                            <div className="assessment-answer-table">
                                                {block.answers.map(answer => (
                                                    <div key={answer.question_id}>
                                                        <span>{answer.title}</span>
                                                        <small>{answer.criteria.join(' / ')}</small>
                                                        <strong>{answer.score}/10</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </section>

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
                .assessment-result-summary > span {
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
                .assessment-optional-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 86px;
                    gap: 12px;
                }
                .assessment-city-field {
                    grid-column: 1 / -1;
                }
                .assessment-form label span {
                    color: #94a3b8;
                    font-size: 0.64rem;
                    font-weight: 850;
                    letter-spacing: 0.04em;
                    text-transform: none;
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
                    background: linear-gradient(135deg, #f2cc78, #c8932f);
                    color: #120d08;
                    box-shadow: 0 18px 38px rgba(184, 123, 37, 0.22);
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
                    grid-template-columns: minmax(220px, 0.76fr) minmax(0, 1.24fr);
                    align-items: stretch;
                    gap: 16px;
                    text-align: left;
                }
                .assessment-result-summary,
                .assessment-result-dashboard {
                    width: 100%;
                    min-width: 0;
                }
                .assessment-result-summary {
                    display: grid;
                    align-content: center;
                    justify-items: start;
                    gap: 10px;
                    border: 1px solid rgba(231, 194, 101, 0.22);
                    border-radius: 8px;
                    background:
                        linear-gradient(135deg, rgba(231, 194, 101, 0.1), rgba(66, 211, 146, 0.06)),
                        rgba(255, 255, 255, 0.05);
                    padding: clamp(16px, 2.8vw, 22px);
                }
                .assessment-result-dashboard {
                    display: grid;
                    gap: 12px;
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
                    max-width: 100%;
                    font-size: 4rem;
                    line-height: 0.95;
                    white-space: nowrap;
                }
                .assessment-result-summary > strong {
                    color: #bbf7d0;
                    font-size: 1.16rem;
                }
                .assessment-result-summary > p {
                    margin: 0;
                    color: rgba(255, 248, 236, 0.7);
                    line-height: 1.6;
                }
                .assessment-report-toolbar {
                    width: 100%;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 14px;
                    align-items: center;
                    border: 1px solid rgba(231, 194, 101, 0.28);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.06);
                    padding: 14px;
                    text-align: left;
                }
                .assessment-report-toolbar > div:first-child {
                    display: grid;
                    gap: 4px;
                }
                .assessment-report-toolbar span,
                .assessment-report-heading span,
                .assessment-diagnostic-card span {
                    color: #e7c265;
                    font-size: 0.68rem;
                    font-weight: 950;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .assessment-report-toolbar strong {
                    color: #fff8ec;
                    font-size: 1rem;
                }
                .assessment-report-toolbar small {
                    color: rgba(255, 248, 236, 0.58);
                    font-size: 0.76rem;
                    font-weight: 700;
                }
                .assessment-report-actions {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }
                .assessment-report-actions button {
                    min-height: 42px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.14);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.06);
                    color: #fff8ec;
                    padding: 0 14px;
                    font-size: 0.82rem;
                    font-weight: 900;
                    cursor: pointer;
                }
                .assessment-diagnostic-card,
                .assessment-whatsapp-note,
                .assessment-plan-section,
                .assessment-answer-report {
                    width: 100%;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.055);
                    text-align: left;
                }
                .assessment-diagnostic-card,
                .assessment-whatsapp-note {
                    display: grid;
                    grid-template-columns: 44px minmax(0, 1fr);
                    gap: 14px;
                    align-items: start;
                    padding: 16px;
                }
                .assessment-diagnostic-card svg,
                .assessment-whatsapp-note svg {
                    display: block;
                    color: #e7c265;
                }
                .assessment-diagnostic-card h3 {
                    margin: 6px 0 8px;
                    color: #fff8ec;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.35rem, 3vw, 1.9rem);
                    line-height: 1.1;
                    letter-spacing: 0;
                }
                .assessment-diagnostic-card p,
                .assessment-whatsapp-note p,
                .assessment-report-heading p,
                .assessment-priority-card p,
                .assessment-answer-table small {
                    margin: 0;
                    color: rgba(255, 248, 236, 0.68);
                    font-size: 0.88rem;
                    line-height: 1.52;
                }
                .assessment-whatsapp-note {
                    border-color: rgba(66, 211, 146, 0.24);
                    background: rgba(66, 211, 146, 0.08);
                }
                .assessment-whatsapp-note strong {
                    display: block;
                    margin-bottom: 5px;
                    color: #bbf7d0;
                    font-size: 0.96rem;
                }
                .assessment-plan-section,
                .assessment-answer-report {
                    display: grid;
                    gap: 14px;
                    padding: 16px;
                }
                .assessment-report-heading {
                    display: grid;
                    gap: 6px;
                }
                .assessment-report-heading h3 {
                    margin: 0;
                    color: #fff8ec;
                    font-size: 1.08rem;
                }
                .assessment-priority-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                }
                .assessment-priority-card {
                    display: grid;
                    gap: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    background: rgba(8, 13, 17, 0.38);
                    padding: 14px;
                }
                .assessment-priority-card > div:first-child {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #e7c265;
                    font-weight: 950;
                }
                .assessment-priority-card h4 {
                    margin: 0;
                    color: #fff8ec;
                    font-size: 1rem;
                }
                .assessment-priority-card p strong {
                    display: block;
                    margin-bottom: 2px;
                    color: #e7c265;
                    font-size: 0.66rem;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .assessment-priority-card dl {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                    margin: 0;
                }
                .assessment-priority-card dl div {
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 9px;
                }
                .assessment-priority-card dt {
                    color: rgba(255, 248, 236, 0.52);
                    font-size: 0.66rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }
                .assessment-priority-card dd {
                    margin: 4px 0 0;
                    color: rgba(255, 248, 236, 0.82);
                    font-size: 0.82rem;
                    line-height: 1.35;
                }
                .assessment-answer-block {
                    display: grid;
                    gap: 10px;
                }
                .assessment-answer-block > div:first-child {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: center;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    padding-bottom: 8px;
                }
                .assessment-answer-block h4 {
                    margin: 0;
                    color: #fff8ec;
                    font-size: 0.98rem;
                }
                .assessment-answer-block > div:first-child strong {
                    color: #e7c265;
                    font-size: 1rem;
                }
                .assessment-answer-table {
                    display: grid;
                    gap: 7px;
                }
                .assessment-answer-table > div {
                    display: grid;
                    grid-template-columns: minmax(140px, 0.8fr) minmax(0, 1fr) 62px;
                    gap: 10px;
                    align-items: center;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    padding: 9px 10px;
                }
                .assessment-answer-table span {
                    color: #fff8ec;
                    font-size: 0.86rem;
                    font-weight: 850;
                }
                .assessment-answer-table strong {
                    color: #e7c265;
                    font-size: 0.92rem;
                    text-align: right;
                }
                .assessment-book-offer {
                    width: min(760px, 100%);
                    display: grid;
                    gap: 14px;
                    padding: 18px;
                    border: 1px solid rgba(231, 194, 101, 0.32);
                    border-radius: 8px;
                    background:
                        radial-gradient(circle at 100% 0%, rgba(231, 194, 101, 0.22), transparent 38%),
                        rgba(10, 15, 18, 0.86);
                    color: #fff8ec;
                    box-shadow: 0 18px 45px rgba(12, 16, 20, 0.18);
                    text-align: left;
                }
                .assessment-book-offer.unlocked {
                    border-color: rgba(66, 211, 146, 0.42);
                    background:
                        radial-gradient(circle at 100% 0%, rgba(66, 211, 146, 0.18), transparent 36%),
                        rgba(10, 15, 18, 0.86);
                }
                .assessment-book-showcase {
                    display: grid;
                    grid-template-columns: 118px minmax(0, 1fr);
                    gap: 18px;
                    align-items: start;
                }
                .assessment-book-cover {
                    border: 1px solid rgba(231, 194, 101, 0.34);
                    border-radius: 8px;
                    background: linear-gradient(180deg, rgba(231, 194, 101, 0.18), rgba(255, 255, 255, 0.04));
                    padding: 7px;
                }
                .assessment-book-cover img {
                    display: block;
                    width: 100%;
                    height: auto;
                    border-radius: 5px;
                }
                .assessment-book-copy {
                    display: grid;
                    gap: 10px;
                }
                .assessment-book-offer span {
                    color: #f4cc72;
                    font-size: 0.7rem;
                    font-weight: 950;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .assessment-book-offer h3 {
                    margin: 0;
                    color: #fff8ec;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.45rem, 4vw, 2rem);
                    line-height: 1.05;
                    letter-spacing: 0;
                }
                .assessment-book-offer p {
                    max-width: 620px;
                    margin: 0;
                    color: rgba(255, 248, 236, 0.72);
                    font-size: 0.92rem;
                    line-height: 1.5;
                }
                .assessment-book-price {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                    margin-top: 2px;
                }
                .assessment-book-price div {
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.055);
                    padding: 10px 12px;
                }
                .assessment-book-price small,
                .assessment-discount-unlocked small {
                    display: block;
                    color: rgba(255, 248, 236, 0.58);
                    font-size: 0.72rem;
                    font-weight: 800;
                    line-height: 1.35;
                }
                .assessment-book-price strong {
                    display: block;
                    margin-top: 3px;
                    color: #fff8ec;
                    font-size: 1.08rem;
                }
                .assessment-book-bullets {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 7px;
                }
                .assessment-book-bullets span {
                    min-height: 30px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    border: 1px solid rgba(231, 194, 101, 0.24);
                    border-radius: 999px;
                    background: rgba(231, 194, 101, 0.08);
                    color: rgba(255, 248, 236, 0.78);
                    padding: 0 10px;
                    font-size: 0.72rem;
                    letter-spacing: 0;
                    text-transform: none;
                }
                .assessment-book-bullets svg {
                    color: #42d392;
                }
                .assessment-book-actions {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    gap: 10px;
                }
                .assessment-discount-button {
                    min-height: 48px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: 1px solid rgba(231, 194, 101, 0.32);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.07);
                    color: #fff8ec;
                    padding: 0 18px;
                    font-size: 0.86rem;
                    font-weight: 950;
                    cursor: pointer;
                }
                .assessment-discount-flow {
                    display: grid;
                    gap: 12px;
                    border-top: 1px solid rgba(255, 255, 255, 0.11);
                    margin-top: 2px;
                    padding-top: 14px;
                }
                .assessment-discount-steps {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                }
                .assessment-discount-steps div {
                    display: grid;
                    grid-template-columns: 28px minmax(0, 1fr);
                    gap: 8px;
                    align-items: center;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 10px;
                }
                .assessment-discount-steps strong {
                    width: 28px;
                    height: 28px;
                    display: grid;
                    place-items: center;
                    border-radius: 50%;
                    background: rgba(231, 194, 101, 0.18);
                    color: #f4cc72;
                    font-size: 0.82rem;
                }
                .assessment-discount-steps span {
                    color: rgba(255, 248, 236, 0.68);
                    font-size: 0.74rem;
                    letter-spacing: 0;
                    line-height: 1.35;
                    text-transform: none;
                }
                .assessment-proof-actions {
                    display: grid;
                    grid-template-columns: minmax(0, 0.78fr) minmax(0, 1fr);
                    gap: 10px;
                }
                .assessment-vote-button,
                .assessment-proof-upload,
                .assessment-discount-unlocked a {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 48px;
                    padding: 0 18px;
                    border-radius: 8px;
                    font-size: 0.86rem;
                    font-weight: 950;
                    text-decoration: none;
                }
                .assessment-vote-button,
                .assessment-discount-unlocked a {
                    background: linear-gradient(135deg, #f4cc72, #d59a2f);
                    color: #1a1206;
                    box-shadow: 0 14px 30px rgba(213, 154, 47, 0.22);
                }
                .assessment-proof-upload {
                    position: relative;
                    flex-wrap: wrap;
                    border: 1px dashed rgba(231, 194, 101, 0.42);
                    background: rgba(255, 255, 255, 0.06);
                    color: #fff8ec;
                    cursor: pointer;
                    text-align: center;
                }
                .assessment-proof-upload input {
                    position: absolute;
                    inset: 0;
                    opacity: 0;
                    cursor: pointer;
                }
                .assessment-proof-upload small {
                    width: 100%;
                    overflow: hidden;
                    color: rgba(255, 248, 236, 0.56);
                    font-size: 0.7rem;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .assessment-proof-message {
                    border: 1px solid rgba(148, 163, 184, 0.24);
                    border-radius: 8px;
                    background: rgba(148, 163, 184, 0.1);
                    color: rgba(255, 248, 236, 0.78);
                    padding: 11px 12px;
                    font-size: 0.88rem;
                    line-height: 1.42;
                    text-align: left;
                }
                .assessment-proof-message.approved {
                    border-color: rgba(34, 197, 94, 0.3);
                    background: rgba(34, 197, 94, 0.12);
                    color: #bbf7d0;
                }
                .assessment-proof-message.rejected,
                .assessment-proof-message.review {
                    border-color: rgba(248, 113, 113, 0.32);
                    background: rgba(248, 113, 113, 0.1);
                    color: #fecaca;
                }
                .assessment-discount-unlocked {
                    display: grid;
                    grid-template-columns: 34px minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 12px;
                    border: 1px solid rgba(34, 197, 94, 0.28);
                    border-radius: 8px;
                    background: rgba(34, 197, 94, 0.1);
                    padding: 12px;
                    color: #bbf7d0;
                }
                .assessment-discount-unlocked strong {
                    display: block;
                    color: #fff8ec;
                    font-size: 1.1rem;
                }
                .assessment-blocks {
                    width: 100%;
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
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
                    grid-column: 1 / -1;
                    width: 100%;
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                    text-align: left;
                }
                .assessment-plan-section,
                .assessment-answer-report,
                .assessment-result > .assessment-secondary {
                    grid-column: 1 / -1;
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
                    .assessment-result {
                        grid-template-columns: 1fr;
                    }
                    .assessment-result-summary {
                        grid-template-columns: 76px minmax(0, 1fr);
                        align-content: start;
                        align-items: center;
                    }
                    .assessment-result-badge {
                        grid-row: 1 / 4;
                    }
                    .assessment-result-summary > p {
                        grid-column: 1 / -1;
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
                        white-space: normal;
                    }
                    .assessment-question h2 {
                        font-size: clamp(1.04rem, 4.2vw, 1.22rem);
                        line-height: 1.12;
                        white-space: normal;
                    }
                    .assessment-panel,
                    .assessment-side {
                        padding: 14px;
                    }
                    .assessment-form-grid,
                    .assessment-scale-labels,
                    .assessment-result-grid,
                    .assessment-blocks {
                        grid-template-columns: 1fr;
                    }
                    .assessment-form-grid.three {
                        grid-template-columns: 1fr;
                    }
                    .assessment-optional-grid {
                        grid-template-columns: minmax(0, 1fr) 74px;
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
                        min-height: 64px;
                        padding: 9px 10px;
                    }
                    .assessment-side-event {
                        align-content: center;
                    }
                    .assessment-side-mark,
                    .assessment-side-score {
                        grid-template-columns: 1fr;
                        justify-items: center;
                        text-align: center;
                    }
                    .assessment-side-mark svg,
                    .assessment-side-score svg {
                        width: 18px;
                        height: 18px;
                    }
                    .assessment-side span {
                        font-size: 0.55rem;
                        line-height: 1.15;
                        overflow-wrap: anywhere;
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
                    .assessment-report-toolbar,
                    .assessment-diagnostic-card,
                    .assessment-whatsapp-note,
                    .assessment-priority-grid,
                    .assessment-priority-card dl,
                    .assessment-answer-table > div {
                        grid-template-columns: 1fr;
                    }
                    .assessment-report-actions {
                        display: grid;
                        grid-template-columns: 1fr;
                        justify-content: stretch;
                    }
                    .assessment-result-summary {
                        grid-template-columns: 62px minmax(0, 1fr);
                        gap: 8px 12px;
                        padding: 14px;
                    }
                    .assessment-result-badge {
                        width: 58px;
                        height: 58px;
                    }
                    .assessment-result h2 {
                        font-size: 3.1rem;
                    }
                    .assessment-diagnostic-card,
                    .assessment-whatsapp-note {
                        grid-template-columns: 36px minmax(0, 1fr);
                        gap: 12px;
                        padding: 14px;
                    }
                    .assessment-report-actions button {
                        min-height: 46px;
                    }
                    .assessment-answer-table strong {
                        text-align: left;
                    }
                    .assessment-report-heading h3 {
                        font-size: 1rem;
                    }
                }
                .assessment-page {
                    color: #172033;
                    background:
                        linear-gradient(130deg, rgba(250, 247, 239, 0.98), rgba(243, 239, 229, 0.96) 46%, rgba(236, 244, 241, 0.97)),
                        var(--assessment-bg) center / cover fixed no-repeat;
                    font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                }
                .assessment-kicker,
                .assessment-section-title span,
                .assessment-question-top span,
                .assessment-result-summary > span {
                    color: #9a6817;
                }
                .assessment-heading h1,
                .assessment-section-title h2,
                .assessment-question h2,
                .assessment-result h2,
                .assessment-result-grid h3 {
                    color: #172033;
                    font-family: 'Montserrat', Inter, -apple-system, BlinkMacSystemFont, sans-serif;
                    font-weight: 850;
                }
                .assessment-heading p,
                .assessment-question p,
                .assessment-result-summary > p {
                    color: #475569;
                }
                .assessment-side,
                .assessment-panel {
                    border-color: rgba(154, 104, 23, 0.2);
                    background:
                        linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 244, 234, 0.88));
                    box-shadow:
                        0 26px 72px rgba(70, 50, 20, 0.13),
                        inset 0 1px 0 rgba(255, 255, 255, 0.88);
                }
                .assessment-side-event,
                .assessment-side-mark,
                .assessment-side-score,
                .assessment-result-summary,
                .assessment-blocks div,
                .assessment-result-grid > div {
                    border-color: rgba(154, 104, 23, 0.18);
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(250, 246, 238, 0.82));
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
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
                    background: linear-gradient(90deg, #c8932f, #2f8f7f);
                }
                .assessment-form label {
                    color: #475569;
                }
                .assessment-form input {
                    border-color: rgba(100, 116, 139, 0.24);
                    background: rgba(255, 255, 255, 0.96);
                    color: #111827;
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
                }
                .assessment-form input::placeholder {
                    color: #94a3b8;
                }
                .assessment-type button,
                .assessment-secondary,
                .assessment-score-grid button {
                    border-color: rgba(100, 116, 139, 0.22);
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(247, 243, 234, 0.84));
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
                .assessment-result-summary > strong {
                    color: #047857;
                }
                .assessment-result-grid p {
                    color: #475569;
                }
                .assessment-report-toolbar,
                .assessment-diagnostic-card,
                .assessment-plan-section,
                .assessment-answer-report {
                    border-color: rgba(154, 104, 23, 0.18);
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(250, 246, 238, 0.82));
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
                }
                .assessment-whatsapp-note {
                    border-color: rgba(47, 143, 127, 0.22);
                    background: linear-gradient(135deg, rgba(240, 253, 250, 0.9), rgba(255, 255, 255, 0.82));
                }
                .assessment-report-toolbar span,
                .assessment-report-heading span,
                .assessment-diagnostic-card span,
                .assessment-priority-card p strong {
                    color: #9a6817;
                }
                .assessment-report-toolbar strong,
                .assessment-diagnostic-card h3,
                .assessment-report-heading h3,
                .assessment-priority-card h4,
                .assessment-answer-block h4,
                .assessment-answer-table span {
                    color: #172033;
                }
                .assessment-report-toolbar small,
                .assessment-diagnostic-card p,
                .assessment-report-heading p,
                .assessment-priority-card p,
                .assessment-priority-card dd,
                .assessment-answer-table small {
                    color: #475569;
                }
                .assessment-report-actions button,
                .assessment-priority-card,
                .assessment-priority-card dl div,
                .assessment-answer-table > div {
                    border-color: rgba(154, 104, 23, 0.16);
                    background: rgba(255, 255, 255, 0.72);
                    color: #172033;
                }
                .assessment-priority-card > div:first-child,
                .assessment-answer-block > div:first-child strong,
                .assessment-answer-table strong {
                    color: #b57a1c;
                }
                .assessment-priority-card dt {
                    color: #64748b;
                }
                .assessment-whatsapp-note strong {
                    color: #047857;
                }
                .assessment-book-offer {
                    border-color: rgba(154, 104, 23, 0.22);
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 244, 234, 0.86));
                    color: #172033;
                    box-shadow:
                        0 24px 58px rgba(70, 50, 20, 0.13),
                        inset 0 1px 0 rgba(255, 255, 255, 0.78);
                }
                .assessment-book-offer.unlocked {
                    border-color: rgba(34, 197, 94, 0.28);
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(236, 253, 245, 0.78));
                }
                .assessment-book-cover,
                .assessment-book-price div,
                .assessment-discount-steps div {
                    border-color: rgba(154, 104, 23, 0.18);
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(250, 246, 238, 0.75));
                }
                .assessment-book-offer span {
                    color: #9a6817;
                }
                .assessment-book-offer h3,
                .assessment-book-price strong,
                .assessment-discount-unlocked strong {
                    color: #172033;
                }
                .assessment-book-offer p {
                    color: #475569;
                }
                .assessment-book-price small,
                .assessment-discount-steps span,
                .assessment-discount-unlocked small {
                    color: #64748b;
                }
                .assessment-book-bullets span {
                    border-color: rgba(200, 147, 47, 0.22);
                    background: rgba(248, 211, 120, 0.2);
                    color: #334155;
                }
                .assessment-discount-button {
                    border-color: rgba(154, 104, 23, 0.24);
                    background: rgba(255, 255, 255, 0.72);
                    color: #172033;
                }
                .assessment-discount-flow {
                    border-top-color: rgba(154, 104, 23, 0.16);
                }
                .assessment-discount-steps strong {
                    background: rgba(248, 211, 120, 0.34);
                    color: #9a6817;
                }
                .assessment-proof-upload {
                    border-color: rgba(154, 104, 23, 0.28);
                    background: rgba(255, 255, 255, 0.72);
                    color: #172033;
                }
                .assessment-proof-upload small {
                    color: #64748b;
                }
                .assessment-proof-message {
                    color: #475569;
                }
                .assessment-proof-message.approved {
                    color: #047857;
                }
                .assessment-proof-message.rejected,
                .assessment-proof-message.review {
                    color: #b91c1c;
                }
                .assessment-discount-unlocked {
                    background: rgba(220, 252, 231, 0.78);
                    color: #047857;
                }
                @media print {
                    .assessment-page {
                        color: #111827 !important;
                        background: #fff !important;
                    }
                    .assessment-stage {
                        width: 100%;
                        padding: 0;
                    }
                    .assessment-heading,
                    .assessment-side,
                    .assessment-report-actions,
                    .assessment-result-badge,
                    .assessment-result > .assessment-secondary {
                        display: none !important;
                    }
                    .assessment-layout {
                        display: block;
                    }
                    .assessment-panel {
                        border: 0;
                        box-shadow: none;
                        background: #fff;
                        padding: 0;
                    }
                    .assessment-result {
                        display: block;
                        text-align: left;
                    }
                    .assessment-result-summary {
                        display: block;
                        border: 0 !important;
                        background: transparent !important;
                        box-shadow: none !important;
                        padding: 0;
                    }
                    .assessment-result-summary > span,
                    .assessment-report-toolbar span,
                    .assessment-report-heading span,
                    .assessment-diagnostic-card span {
                        color: #8a5a13 !important;
                    }
                    .assessment-result h2 {
                        margin: 8px 0;
                        font-size: 52px;
                    }
                    .assessment-result-summary > strong,
                    .assessment-result-summary > p,
                    .assessment-result-summary,
                    .assessment-report-toolbar,
                    .assessment-diagnostic-card,
                    .assessment-whatsapp-note,
                    .assessment-blocks,
                    .assessment-result-grid,
                    .assessment-plan-section,
                    .assessment-answer-report {
                        break-inside: avoid;
                    }
                    .assessment-report-toolbar,
                    .assessment-diagnostic-card,
                    .assessment-whatsapp-note,
                    .assessment-plan-section,
                    .assessment-answer-report,
                    .assessment-blocks div,
                    .assessment-result-grid > div,
                    .assessment-priority-card,
                    .assessment-answer-table > div {
                        border-color: #d8c6a5 !important;
                        background: #fff !important;
                        box-shadow: none !important;
                    }
                    .assessment-whatsapp-note {
                        display: none;
                    }
                    .assessment-blocks,
                    .assessment-result-grid,
                    .assessment-priority-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                    .assessment-answer-table > div {
                        grid-template-columns: minmax(130px, 0.8fr) minmax(0, 1fr) 58px;
                    }
                }
            `}</style>
        </main>
    )
}
