'use client'

import { useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, MessageCircle, Send } from 'lucide-react'

export function EventFormAnchorButton() {
    const scrollToForm = () => {
        document.getElementById('cadastro')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    return (
        <button type="button" className="event-hero-cta" onClick={scrollToForm}>
            Confirmar minha presença
        </button>
    )
}

type ChoiceOption = {
    value: string
    label: string
}

const monthlyLeadOptions: ChoiceOption[] = [
    { value: 'ate_20', label: 'Ate 20' },
    { value: '21_50', label: '21 a 50' },
    { value: '51_100', label: '51 a 100' },
    { value: '100_plus', label: 'Mais de 100' },
]

const challengeOptions: ChoiceOption[] = [
    { value: 'captar_leads', label: 'Captar leads qualificados' },
    { value: 'responder_rapido', label: 'Responder leads com velocidade' },
    { value: 'organizar_followup', label: 'Organizar follow-up' },
    { value: 'gerar_conteudo', label: 'Gerar conteúdo' },
    { value: 'converter_visitas', label: 'Converter atendimentos em visitas' },
    { value: 'alto_ticket', label: 'Vender imóveis de maior ticket' },
]

const currentToolOptions: ChoiceOption[] = [
    { value: 'nao_uso', label: 'Não uso ferramenta' },
    { value: 'planilha_whatsapp', label: 'Planilha ou WhatsApp manual' },
    { value: 'crm_simples', label: 'CRM simples' },
    { value: 'crm_automacao', label: 'CRM com automação' },
    { value: 'sistema_proprio', label: 'Equipe ou sistema próprio' },
]

const timelineOptions: ChoiceOption[] = [
    { value: 'imediato', label: 'Imediatamente' },
    { value: '30_dias', label: 'Nos próximos 30 dias' },
    { value: '3_meses', label: 'Nos próximos 3 meses' },
    { value: 'estudando', label: 'Ainda estou estudando' },
]

const investmentOptions: ChoiceOption[] = [
    { value: 'nao_invisto', label: 'Não invisto' },
    { value: 'ate_500', label: 'Até R$ 500' },
    { value: '500_1500', label: 'R$ 500 a R$ 1.500' },
    { value: '1500_5000', label: 'R$ 1.500 a R$ 5.000' },
    { value: '5000_plus', label: 'Acima de R$ 5.000' },
]

const questionSteps = [
    { name: 'monthly_leads', label: 'Leads por mês', options: monthlyLeadOptions },
    { name: 'main_challenge', label: 'Qual seu principal desafio hoje?', options: challengeOptions, stacked: true },
    { name: 'current_tool', label: 'Como você organiza seus atendimentos hoje?', options: currentToolOptions, stacked: true },
    { name: 'improvement_timeline', label: 'Quando quer melhorar esse processo?', options: timelineOptions },
    { name: 'monthly_investment', label: 'Investimento mensal atual', options: investmentOptions },
]

type WhatsAppCta = {
    url: string
    text: string
    phone: string
    display_phone?: string
}

function ChoiceGroup({
    name,
    label,
    options,
    required = false,
    stacked = false,
    progress,
    selectedValue = '',
    onSelect,
    onBack,
}: {
    name: string
    label: string
    options: ChoiceOption[]
    required?: boolean
    stacked?: boolean
    progress?: string
    selectedValue?: string
    onSelect?: (name: string, value: string) => void
    onBack?: () => void
}) {
    return (
        <fieldset className={`event-choice-field progressive${stacked ? ' stacked' : ''}`}>
            <legend>
                <span>{label}</span>
                {progress && <small>{progress}</small>}
            </legend>
            <div className="event-choice-grid">
                {options.map(option => (
                    <label className="event-choice-option" key={`${name}-${option.value}`}>
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            required={required}
                            checked={selectedValue === option.value}
                            onChange={() => onSelect?.(name, option.value)}
                        />
                        <span className="event-choice-mark" aria-hidden="true" />
                        <span className="event-choice-text">{option.label}</span>
                    </label>
                ))}
            </div>
            {onBack && (
                <button type="button" className="event-choice-back" onClick={onBack}>
                    Voltar
                </button>
            )}
        </fieldset>
    )
}

export default function RegistrationForm({ slug }: { slug: string }) {
    const [brokerType, setBrokerType] = useState<'autonomo' | 'imobiliaria'>('autonomo')
    const [city, setCity] = useState('')
    const [choiceValues, setChoiceValues] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState<string | null>(null)
    const [whatsappCta, setWhatsappCta] = useState<WhatsAppCta | null>(null)
    const [error, setError] = useState<string | null>(null)

    const updateChoice = (name: string, value: string) => {
        setChoiceValues(prev => ({ ...prev, [name]: value }))
    }

    const hasCity = city.trim().length >= 2
    const currentStepIndex = hasCity ? questionSteps.findIndex(step => !choiceValues[step.name]) : -1
    const currentStep = currentStepIndex >= 0 ? questionSteps[currentStepIndex] : null
    const showDiagnosticIntro = hasCity
    const showFinalStep = hasCity && currentStepIndex === -1

    const goBackStep = () => {
        if (currentStepIndex <= 0) return
        setChoiceValues(prev => {
            const next = { ...prev }
            for (let index = currentStepIndex - 1; index < questionSteps.length; index += 1) {
                delete next[questionSteps[index].name]
            }
            return next
        })
    }

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!showFinalStep) {
            setError('Responda as 5 perguntas rapidas para liberar a confirmacao.')
            return
        }
        setLoading(true)
        setError(null)
        setSuccess(null)
        setWhatsappCta(null)

        const formData = new FormData(event.currentTarget)
        const payload = {
            full_name: String(formData.get('full_name') || ''),
            email: String(formData.get('email') || ''),
            phone: String(formData.get('phone') || ''),
            broker_type: brokerType,
            real_estate_name: String(formData.get('real_estate_name') || ''),
            creci: String(formData.get('creci') || ''),
            creci_state: String(formData.get('creci_state') || ''),
            city: String(formData.get('city') || ''),
            market_focus: '',
            monthly_leads: choiceValues.monthly_leads || '',
            commercial_role: brokerType === 'imobiliaria' ? 'corretor_imobiliaria' : 'autonomo',
            main_challenge: choiceValues.main_challenge || '',
            current_tool: choiceValues.current_tool || '',
            improvement_timeline: choiceValues.improvement_timeline || '',
            monthly_investment: choiceValues.monthly_investment || '',
            desired_result: '',
            automation_wish: String(formData.get('automation_wish') || ''),
            consent_whatsapp: formData.get('consent_whatsapp') === 'on',
        }

        try {
            const response = await fetch(`/api/eventos/${slug}/registrations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Não foi possível confirmar sua presença.')
            setWhatsappCta(data.whatsapp_cta || null)

            if (data.already_registered) {
                setSuccess('Seu cadastro já estava confirmado. Se quiser tirar dúvidas agora, inicie a conversa com nossa equipe pelo WhatsApp.')
            } else if (data.waitlisted) {
                setSuccess('Cadastro recebido. As vagas principais estão completas, então você entrou na lista de espera.')
            } else {
                setSuccess('Presença confirmada. Para falar com a equipe agora, toque no botão abaixo e inicie a conversa no WhatsApp.')
            }
            event.currentTarget.reset()
            setBrokerType('autonomo')
            setCity('')
            setChoiceValues({})
        } catch (err: any) {
            setError(err?.message || 'Não foi possível confirmar sua presença.')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="event-form-success">
                <CheckCircle2 size={38} />
                <h3>Confirmação recebida</h3>
                <p>{success}</p>
                {whatsappCta && (
                    <div className="event-whatsapp-cta">
                        <span>Tem alguma dúvida?</span>
                        <a href={whatsappCta.url} target="_blank" rel="noopener noreferrer">
                            <MessageCircle size={18} />
                            Falar no WhatsApp
                        </a>
                        <small>A conversa começa por você. A mensagem já vai pronta no seu WhatsApp.</small>
                    </div>
                )}
                {!whatsappCta && (
                    <div className="event-whatsapp-fallback">
                        A equipe recebeu seu cadastro. Se o WhatsApp estiver em manutenção, acompanhe as informações do evento por esta página.
                    </div>
                )}
                <button type="button" onClick={() => {
                    setSuccess(null)
                    setWhatsappCta(null)
                }}>Cadastrar outro profissional</button>
            </div>
        )
    }

    return (
        <form className="event-form" onSubmit={submit}>
            <div className="event-form-head">
                <span>Cadastro reservado</span>
                <h2>Confirme sua presença</h2>
                <p>Preencha seus dados profissionais e, ao finalizar, inicie a conversa com nossa equipe pelo WhatsApp.</p>
            </div>

            <label>
                Nome completo
                <input name="full_name" required autoComplete="name" placeholder="Seu nome" />
            </label>

            <div className="event-form-grid">
                <label>
                    E-mail
                    <input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" />
                </label>
                <label>
                    WhatsApp
                    <input name="phone" type="tel" required autoComplete="tel" placeholder="(47) 99999-9999" />
                </label>
            </div>

            <div className="event-type" aria-label="Tipo de corretor">
                <button
                    type="button"
                    aria-pressed={brokerType === 'autonomo'}
                    className={brokerType === 'autonomo' ? 'active' : ''}
                    onClick={() => setBrokerType('autonomo')}
                >
                    Autônomo
                </button>
                <button
                    type="button"
                    aria-pressed={brokerType === 'imobiliaria'}
                    className={brokerType === 'imobiliaria' ? 'active' : ''}
                    onClick={() => setBrokerType('imobiliaria')}
                >
                    Imobiliária
                </button>
            </div>

            {brokerType === 'imobiliaria' && (
                <label>
                    Nome da imobiliária
                    <input name="real_estate_name" placeholder="Nome da empresa" />
                </label>
            )}

            <div className="event-form-grid creci-grid">
                <label>
                    CRECI
                    <input name="creci" required placeholder="Ex: 12345-F" />
                </label>
                <label>
                    UF
                    <input name="creci_state" required maxLength={2} placeholder="SC" />
                </label>
            </div>

            <div className="event-form-grid">
                <label>
                    Cidade de atuação
                    <input
                        name="city"
                        required
                        value={city}
                        onChange={event => setCity(event.target.value)}
                        placeholder="Balneário Camboriú"
                    />
                </label>
            </div>

            {showDiagnosticIntro && (
                <div className="event-form-section progressive">
                    <span>Diagnóstico profissional</span>
                    <p>Responda 5 perguntas rápidas. Cada resposta libera a próxima etapa.</p>
                </div>
            )}

            {currentStep && (
                <ChoiceGroup
                    name={currentStep.name}
                    label={currentStep.label}
                    options={currentStep.options}
                    required
                    stacked={currentStep.stacked}
                    progress={`${currentStepIndex + 1}/5`}
                    selectedValue={choiceValues[currentStep.name]}
                    onSelect={updateChoice}
                    onBack={currentStepIndex > 0 ? goBackStep : undefined}
                />
            )}

            {error && <div className="event-form-error">{error}</div>}

            {showFinalStep && (
                <div className="event-final-step progressive">
                    <label>
                        Se pudesse automatizar uma parte do seu atendimento, qual seria?
                        <textarea name="automation_wish" rows={3} placeholder="Ex: responder leads, lembrar follow-up, organizar carteira..." />
                    </label>

                    <label className="event-consent">
                        <input name="consent_whatsapp" type="checkbox" required />
                        <span>Autorizo comunicações sobre este evento pelo WhatsApp e posso iniciar a conversa pelo botão após o cadastro.</span>
                    </label>

                    <button className="event-submit" type="submit" disabled={loading}>
                        {loading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                        Confirmar presença
                    </button>
                </div>
            )}
        </form>
    )
}
