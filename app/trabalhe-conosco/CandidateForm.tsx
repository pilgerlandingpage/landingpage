'use client'

import { useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, Send, ShieldCheck } from 'lucide-react'
import { getVisitorId, trackEvent } from '@/lib/tracking/client'
import styles from './TrabalheConosco.module.css'

type SubmitState = {
    status: 'idle' | 'success' | 'error'
    message: string
}

export default function CandidateForm() {
    const [brokerType, setBrokerType] = useState<'autonomo' | 'imobiliaria' | 'equipe'>('autonomo')
    const [loading, setLoading] = useState(false)
    const [started, setStarted] = useState(false)
    const [state, setState] = useState<SubmitState>({ status: 'idle', message: '' })

    const markStarted = () => {
        if (started) return
        setStarted(true)
        void trackEvent('broker_candidate_form_started', { section: 'trabalhe_conosco' })
    }

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setLoading(true)
        setState({ status: 'idle', message: '' })

        const form = event.currentTarget
        const formData = new FormData(form)
        const payload = {
            visitor_cookie_id: getVisitorId(),
            referrer: document.referrer,
            search_params: window.location.search,
            full_name: String(formData.get('full_name') || ''),
            email: String(formData.get('email') || ''),
            phone: String(formData.get('phone') || ''),
            broker_type: brokerType,
            current_company: String(formData.get('current_company') || ''),
            creci: String(formData.get('creci') || ''),
            creci_state: String(formData.get('creci_state') || ''),
            city: String(formData.get('city') || ''),
            state: String(formData.get('state') || ''),
            experience_years: String(formData.get('experience_years') || ''),
            market_focus: String(formData.get('market_focus') || ''),
            regions: String(formData.get('regions') || ''),
            specialties: String(formData.get('specialties') || ''),
            instagram: String(formData.get('instagram') || ''),
            linkedin: String(formData.get('linkedin') || ''),
            tiktok: String(formData.get('tiktok') || ''),
            youtube: String(formData.get('youtube') || ''),
            facebook: String(formData.get('facebook') || ''),
            website: String(formData.get('website') || ''),
            current_operation: String(formData.get('current_operation') || ''),
            availability: String(formData.get('availability') || ''),
            motivation: String(formData.get('motivation') || ''),
            consent_whatsapp: formData.get('consent_whatsapp') === 'on',
            consent_data_processing: formData.get('consent_data_processing') === 'on',
            source: 'trabalhe_conosco_page',
        }

        try {
            const response = await fetch('/api/trabalhe-conosco/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Nao foi possivel enviar seu cadastro.')

            void trackEvent('broker_candidate_form_submitted', {
                candidate_id: data.candidate?.id,
                potential_score: data.candidate?.potential_score,
                potential_level: data.candidate?.potential_level,
            })

            setState({
                status: 'success',
                message: data.already_registered
                    ? 'Seu cadastro foi atualizado. Nossa equipe acompanha seu perfil pelo painel.'
                    : 'Cadastro recebido. Em instantes voce recebe a confirmacao pelo WhatsApp.',
            })
            form.reset()
            setBrokerType('autonomo')
            setStarted(false)
        } catch (err: any) {
            setState({ status: 'error', message: err?.message || 'Nao foi possivel enviar seu cadastro.' })
        } finally {
            setLoading(false)
        }
    }

    if (state.status === 'success') {
        return (
            <div className={styles.success}>
                <CheckCircle2 size={42} />
                <h2>Cadastro recebido</h2>
                <p>{state.message}</p>
                <button type="button" onClick={() => setState({ status: 'idle', message: '' })}>
                    Enviar outro cadastro
                </button>
            </div>
        )
    }

    return (
        <form className={styles.form} onSubmit={submit} onFocus={markStarted}>
            <div className={styles.formHead}>
                <span>Cadastro profissional</span>
                <h2>Quero trabalhar com a Pilger</h2>
                <p>Preencha seus dados para nosso agente de recrutamento analisar o perfil e organizar o proximo contato.</p>
            </div>

            <label>
                Nome completo
                <input name="full_name" required autoComplete="name" placeholder="Seu nome" />
            </label>

            <div className={styles.formGrid}>
                <label>
                    E-mail
                    <input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" />
                </label>
                <label>
                    WhatsApp
                    <input name="phone" type="tel" required autoComplete="tel" placeholder="(47) 99999-9999" />
                </label>
            </div>

            <div className={styles.type} aria-label="Como voce atua hoje">
                {[
                    ['autonomo', 'Autonomo'],
                    ['imobiliaria', 'Imobiliaria'],
                    ['equipe', 'Equipe'],
                ].map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        className={brokerType === value ? styles.active : undefined}
                        aria-pressed={brokerType === value}
                        onClick={() => setBrokerType(value as any)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className={`${styles.formGrid} ${styles.formGridThree}`}>
                <label>
                    CRECI
                    <input name="creci" placeholder="Ex: 12345-F" />
                </label>
                <label>
                    UF CRECI
                    <input name="creci_state" maxLength={2} placeholder="SC" />
                </label>
                <label>
                    Anos de mercado
                    <input name="experience_years" type="number" min="0" max="60" placeholder="5" />
                </label>
            </div>

            <div className={styles.formGrid}>
                <label>
                    Cidade principal
                    <input name="city" required placeholder="Balneario Camboriu" />
                </label>
                <label>
                    Estado
                    <input name="state" maxLength={2} placeholder="SC" />
                </label>
            </div>

            <label>
                Empresa atual ou operacao
                <input name="current_company" placeholder="Imobiliaria, equipe ou autonomo" />
            </label>

            <div className={styles.formGrid}>
                <label>
                    Foco de mercado
                    <input name="market_focus" placeholder="Luxo, lancamentos, investidores..." />
                </label>
                <label>
                    Regioes onde atua
                    <input name="regions" placeholder="Praia Brava, BC, Itapema..." />
                </label>
            </div>

            <label>
                Especialidades
                <input name="specialties" placeholder="Captação, alto padrão, frente mar, construtoras..." />
            </label>

            <div className={styles.socialGrid}>
                <label>Instagram<input name="instagram" placeholder="https://instagram.com/..." /></label>
                <label>LinkedIn<input name="linkedin" placeholder="https://linkedin.com/in/..." /></label>
                <label>TikTok<input name="tiktok" placeholder="https://tiktok.com/@..." /></label>
                <label>YouTube<input name="youtube" placeholder="https://youtube.com/..." /></label>
                <label>Facebook<input name="facebook" placeholder="https://facebook.com/..." /></label>
                <label>Site ou portfolio<input name="website" placeholder="https://..." /></label>
            </div>

            <label>
                Como voce trabalha hoje?
                <textarea name="current_operation" rows={3} placeholder="Conte rapidamente como capta, atende e acompanha clientes." />
            </label>

            <label>
                Por que quer trabalhar conosco?
                <textarea name="motivation" rows={4} required placeholder="Fale sobre seu momento, objetivos e alinhamento com a Pilger." />
            </label>

            <label>
                Disponibilidade para conversar
                <input name="availability" placeholder="Ex: manhas, fim de tarde, segunda a sexta..." />
            </label>

            <div className={styles.consents}>
                <label>
                    <input name="consent_whatsapp" type="checkbox" required />
                    <span>Autorizo contato pelo WhatsApp sobre meu cadastro.</span>
                </label>
                <label>
                    <input name="consent_data_processing" type="checkbox" required />
                    <span>Autorizo a Pilger a analisar os dados informados e links profissionais enviados.</span>
                </label>
            </div>

            {state.status === 'error' && <div className={styles.error}>{state.message}</div>}

            <button className={styles.submit} type="submit" disabled={loading}>
                {loading ? <Loader2 className={styles.spin} size={18} /> : <Send size={18} />}
                Enviar cadastro
            </button>

            <div className={styles.security}>
                <ShieldCheck size={16} />
                O acompanhamento combina analise automatizada e decisao humana no painel administrativo.
            </div>
        </form>
    )
}
