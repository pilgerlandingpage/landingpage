'use client'

import CandidateForm from './CandidateForm'
import styles from './TrabalheConosco.module.css'

export default function TrabalheConoscoClient() {
    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroBg} />
                <div className={styles.heroContent}>
                    <div className={styles.copy}>
                        <span>Trabalhe conosco</span>
                        <h1>Corretores que querem operar com inteligencia, curadoria e alto padrao.</h1>
                        <p>
                            A Pilger esta estruturando uma rede de profissionais alinhados com atendimento consultivo,
                            leitura de dados e presenca digital. Seu cadastro entra no painel interno e passa pela analise
                            do agente de recrutamento.
                        </p>
                        <div className={styles.proof}>
                            <strong>O que analisamos</strong>
                            <ul>
                                <li>Experiencia, CRECI e regioes de atuacao</li>
                                <li>Presenca digital e redes profissionais</li>
                                <li>Fit com alto padrao, lancamentos e atendimento consultivo</li>
                                <li>Interacoes futuras com o ecossistema Pilger</li>
                            </ul>
                        </div>
                    </div>
                    <CandidateForm />
                </div>
            </section>

            <section className={styles.flow}>
                <div>
                    <span>01</span>
                    <strong>Cadastro</strong>
                    <p>Voce informa dados profissionais, redes sociais e consentimentos.</p>
                </div>
                <div>
                    <span>02</span>
                    <strong>Agente</strong>
                    <p>O agente organiza os dados, calcula potencial e alimenta a inteligencia.</p>
                </div>
                <div>
                    <span>03</span>
                    <strong>Relacionamento</strong>
                    <p>Mensagens pelo WhatsApp mantem o candidato acompanhado pela equipe.</p>
                </div>
                <div>
                    <span>04</span>
                    <strong>Painel</strong>
                    <p>O admin acompanha status, score, visitas, mensagens e proximas acoes.</p>
                </div>
            </section>
        </main>
    )
}
