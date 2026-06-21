import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
    ArrowRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    Compass,
    Handshake,
    LineChart,
    MapPin,
    MessageCircle,
    Search,
    ShieldCheck,
    Target,
} from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'

const heroImage = '/images/eventos/guilherme-pilger.png'

export const metadata: Metadata = {
    title: 'Consultoria Imobiliária Personalizada | Guilherme Pilger',
    description: 'Consultoria imobiliária personalizada para compra, venda e investimento em imóveis de alto padrão em Balneário Camboriú, Praia Brava e Itapema.',
    alternates: {
        canonical: '/consultoria-imobiliaria-personalizada',
    },
    openGraph: {
        title: 'Consultoria Imobiliária Personalizada | Guilherme Pilger',
        description: 'Estratégia, avaliação, negociação e acompanhamento para decisões imobiliárias no litoral catarinense.',
        url: '/consultoria-imobiliaria-personalizada',
        type: 'website',
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Consultoria Imobiliária Personalizada',
        description: 'Estratégia, avaliação, negociação e acompanhamento para decisões imobiliárias.',
        images: [DEFAULT_OG_IMAGE],
    },
}

const elements = [
    {
        icon: BarChart3,
        title: 'Avaliação de propriedades',
        text: 'Análise de localização, tamanho, condições do imóvel, infraestrutura disponível, liquidez e tendências de mercado para entender valor e potencial de valorização.',
    },
    {
        icon: Handshake,
        title: 'Estratégias de negociação',
        text: 'Definição de metas realistas, leitura das melhores oportunidades e condução da negociação para buscar o melhor acordo possível.',
    },
    {
        icon: Compass,
        title: 'Gerenciamento de portfólio',
        text: 'Acompanhamento contínuo de propriedades, diversificação de investimentos e redução de riscos em diferentes momentos do mercado.',
    },
]

const processSteps = [
    {
        icon: Target,
        title: 'Identificação das necessidades',
        text: 'A consultoria começa entendendo expectativas, prioridade de localização, tamanho, valor, objetivo da compra ou venda e perfil de investimento.',
    },
    {
        icon: LineChart,
        title: 'Desenvolvimento do plano de ação',
        text: 'Com base nos dados coletados, a equipe estrutura uma busca ou estratégia comercial eficiente, filtrando oportunidades e riscos.',
    },
    {
        icon: CheckCircle2,
        title: 'Implementação e acompanhamento',
        text: 'A decisão é acompanhada até o fim do processo, com segurança, clareza, negociação e suporte para a escolha certa.',
    },
]

const benefits = [
    {
        icon: LineChart,
        title: 'Maximização do retorno',
        text: 'Análises aprofundadas ajudam a identificar oportunidades e estratégias com maior potencial de rentabilidade.',
    },
    {
        icon: ShieldCheck,
        title: 'Minimização do risco financeiro',
        text: 'A experiência regional reduz exposição a decisões mal precificadas, burocracias complexas ou escolhas desalinhadas ao mercado.',
    },
    {
        icon: Clock3,
        title: 'Otimização do tempo',
        text: 'A curadoria economiza tempo ao separar rapidamente os imóveis mais adequados ao perfil e ao objetivo do cliente.',
    },
]

export default function ConsultoriaPage() {
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: '/consultoria-imobiliaria-personalizada',
            name: 'Consultoria Imobiliária Personalizada',
            description: 'Consultoria para compra, venda e investimento em imóveis de alto padrão.',
            type: 'WebPage',
            image: absoluteUrl(heroImage),
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Consultoria Imobiliária Personalizada', url: '/consultoria-imobiliaria-personalizada' },
        ]),
        {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Consultoria Imobiliária Personalizada',
            provider: { '@id': `${absoluteUrl('/')}#organization` },
            areaServed: ['Balneário Camboriú', 'Praia Brava', 'Itapema'],
            serviceType: 'Consultoria imobiliária',
            url: absoluteUrl('/consultoria-imobiliaria-personalizada'),
        },
    ]

    return (
        <>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <main className="consult-page">
                <section className="consult-hero">
                    <div className="consult-hero-copy">
                        <span className="consult-kicker">Soluções eficientes para seu investimento</span>
                        <h1>Consultoria Imobiliária Personalizada</h1>
                        <p>
                            Uma abordagem mais ampla e estratégica para compra, venda e investimento em imóveis de alto padrão. O foco é analisar mercado, trâmites, riscos e oportunidades para que a decisão seja tomada com segurança.
                        </p>
                        <div className="consult-actions">
                            <WhatsAppCaptureLink
                                phone="5547992528080"
                                message="Olá! Quero entender a consultoria imobiliária personalizada."
                                slug="consultoria"
                                template="consultoria-hero-whatsapp"
                                className="consult-primary"
                            >
                                <MessageCircle size={18} />
                                Solicitar consultoria
                            </WhatsAppCaptureLink>
                            <Link href="/busca" className="consult-secondary"><Search size={17} /> Ver oportunidades</Link>
                        </div>
                    </div>
                    <div className="consult-hero-media">
                        <Image src={heroImage} alt="Atendimento consultivo Guilherme Pilger" fill priority sizes="(max-width: 920px) 100vw, 42vw" />
                    </div>
                </section>

                <section className="consult-intro">
                    <div>
                        <span className="consult-kicker">Entendendo a consultoria</span>
                        <h2>Mais que intermediar: interpretar o mercado antes da decisão.</h2>
                    </div>
                    <div className="consult-intro-text">
                        <p>
                            A Consultoria Imobiliária Personalizada se diferencia do trabalho de um corretor comum por analisar minuciosamente o mercado imobiliário e focar nos trâmites específicos de cada negócio.
                        </p>
                        <p>
                            Durante seus anos de atuação desde 2008, Guilherme Pilger desenvolveu estratégias reconhecidas pelo CRECI RS e apresentadas em eventos como Conecta Imobi 2019 e 2022. Essa experiência é aplicada para orientar compradores, vendedores e investidores em Balneário Camboriú, Praia Brava e Itapema.
                        </p>
                        <p>
                            O objetivo é atender necessidades específicas, considerando perfil, interesse, demanda, contexto econômico, cenário de mercado e condições reais de negociação.
                        </p>
                    </div>
                </section>

                <section className="consult-importance">
                    <div className="consult-importance-card">
                        <MapPin size={22} />
                        <h2>Importância da consultoria imobiliária personalizada</h2>
                        <p>
                            Além de auxiliar na identificação das melhores oportunidades, a consultoria aborda questões relacionadas ao mercado e ao perfil de interesse. A atuação local permite avaliar cenários, bairros, padrões de construtoras e oportunidades com maior precisão.
                        </p>
                    </div>
                    <div className="consult-importance-card">
                        <ShieldCheck size={22} />
                        <h2>Uma escolha com menos improviso</h2>
                        <p>
                            A abordagem personalizada leva em conta expectativas individuais e evita que o cliente perca tempo com imóveis fora de perfil ou negocie sem informação suficiente.
                        </p>
                    </div>
                </section>

                <section className="consult-section">
                    <div className="consult-section-head">
                        <span className="consult-kicker">Elementos da consultoria</span>
                        <h2>Os três pilares que sustentam uma decisão imobiliária melhor.</h2>
                    </div>
                    <div className="consult-card-grid">
                        {elements.map(item => {
                            const Icon = item.icon
                            return (
                                <article key={item.title}>
                                    <Icon size={23} />
                                    <h3>{item.title}</h3>
                                    <p>{item.text}</p>
                                </article>
                            )
                        })}
                    </div>
                </section>

                <section className="consult-process">
                    <div className="consult-section-head">
                        <span className="consult-kicker">Processo</span>
                        <h2>Da primeira conversa ao acompanhamento da escolha.</h2>
                    </div>
                    <div className="consult-process-list">
                        {processSteps.map((item, index) => {
                            const Icon = item.icon
                            return (
                                <article key={item.title}>
                                    <span>{String(index + 1).padStart(2, '0')}</span>
                                    <Icon size={24} />
                                    <div>
                                        <h3>{item.title}</h3>
                                        <p>{item.text}</p>
                                    </div>
                                    <ArrowRight size={20} />
                                </article>
                            )
                        })}
                    </div>
                </section>

                <section className="consult-section consult-benefits">
                    <div className="consult-section-head">
                        <span className="consult-kicker">Benefícios</span>
                        <h2>Mais retorno, menos risco e uma busca mais objetiva.</h2>
                    </div>
                    <div className="consult-card-grid">
                        {benefits.map(item => {
                            const Icon = item.icon
                            return (
                                <article key={item.title}>
                                    <Icon size={23} />
                                    <h3>{item.title}</h3>
                                    <p>{item.text}</p>
                                </article>
                            )
                        })}
                    </div>
                </section>

                <section className="consult-final">
                    <div>
                        <span className="consult-kicker">Consultoria com método</span>
                        <h2>Antes de comprar, vender ou investir, alinhe estratégia, valor e timing.</h2>
                        <p>A conversa inicial ajuda a entender se a consultoria faz sentido para o seu momento e qual caminho deve ser priorizado.</p>
                    </div>
                    <WhatsAppCaptureLink
                        phone="5547992528080"
                        message="Olá! Quero iniciar uma consultoria imobiliária personalizada."
                        slug="consultoria"
                        template="consultoria-final-whatsapp"
                        className="consult-final-button"
                    >
                        <MessageCircle size={18} />
                        Começar pelo WhatsApp
                    </WhatsAppCaptureLink>
                </section>
            </main>
            <Footer />

            <style>{`
                .consult-page { background: #f8f3ea; color: #181512; font-family: var(--font-sans); }
                .consult-hero { align-items: stretch; background: #171310; color: #fff8ea; display: grid; gap: 38px; grid-template-columns: minmax(0, 1.08fr) minmax(340px, .72fr); min-height: 690px; padding: 150px 7vw 74px; }
                .consult-hero-copy { align-self: center; max-width: 900px; }
                .consult-kicker { color: #c99a4e; display: inline-flex; font-size: .72rem; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
                .consult-hero h1, .consult-intro h2, .consult-importance h2, .consult-section-head h2, .consult-final h2 { font-family: var(--font-serif); letter-spacing: 0; margin: 0; }
                .consult-hero h1 { font-size: clamp(3rem, 7.6vw, 7.2rem); line-height: .9; margin-top: 12px; max-width: 980px; }
                .consult-hero p { color: rgba(255,255,255,.73); font-size: clamp(1rem, 1.55vw, 1.2rem); line-height: 1.72; max-width: 790px; }
                .consult-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
                .consult-primary, .consult-secondary, .consult-final-button { align-items: center; border-radius: 999px; display: inline-flex; font-size: .78rem; font-weight: 950; gap: 8px; justify-content: center; min-height: 48px; padding: 0 18px; text-decoration: none; text-transform: uppercase; white-space: nowrap; }
                .consult-primary, .consult-final-button { background: #0c8a50; color: #fff !important; box-shadow: 0 18px 34px rgba(12,138,80,.25); }
                .consult-secondary { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); color: #fff8ea; }
                .consult-hero-media { border-radius: 24px; min-height: 500px; overflow: hidden; position: relative; }
                .consult-hero-media img { object-fit: cover; }
                .consult-hero-media::after { background: linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.38)); content: ''; inset: 0; position: absolute; }
                .consult-intro { display: grid; gap: 42px; grid-template-columns: minmax(280px, 460px) minmax(0, 1fr); padding: 76px 7vw 54px; }
                .consult-intro h2, .consult-section-head h2, .consult-final h2 { color: #211b15; font-size: clamp(2.15rem, 4vw, 4.2rem); line-height: .98; margin-top: 10px; }
                .consult-intro-text { color: #4d443b; display: grid; gap: 16px; font-size: 1rem; line-height: 1.78; }
                .consult-intro-text p { margin: 0; }
                .consult-importance { background: #fffdf8; display: grid; gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 54px 7vw; }
                .consult-importance-card { border: 1px solid rgba(184,132,62,.18); border-radius: 16px; padding: 28px; }
                .consult-importance-card svg { color: #b8843e; }
                .consult-importance h2 { color: #211b15; font-size: clamp(1.8rem, 2.8vw, 3rem); line-height: 1.02; margin-top: 16px; }
                .consult-importance p, .consult-section-head p, .consult-final p { color: #655a50; line-height: 1.7; margin: 14px 0 0; }
                .consult-section { padding: 72px 7vw; }
                .consult-section-head { max-width: 900px; }
                .consult-card-grid { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 34px; }
                .consult-card-grid article { background: #fffaf2; border: 1px solid rgba(184,132,62,.18); border-radius: 14px; box-shadow: 0 18px 42px rgba(63,45,23,.06); padding: 26px; }
                .consult-card-grid svg { color: #b8843e; }
                .consult-card-grid h3 { color: #211b15; font-family: var(--font-serif); font-size: 1.55rem; line-height: 1.06; margin: 18px 0 10px; }
                .consult-card-grid p { color: #655a50; line-height: 1.7; margin: 0; }
                .consult-process { background: #1d1813; color: #fff8ea; padding: 72px 7vw; }
                .consult-process .consult-section-head h2 { color: #fff8ea; }
                .consult-process-list { display: grid; gap: 14px; margin-top: 34px; }
                .consult-process-list article { align-items: center; border: 1px solid rgba(255,255,255,.13); border-radius: 16px; display: grid; gap: 18px; grid-template-columns: 56px 38px minmax(0, 1fr) 24px; padding: 22px; }
                .consult-process-list article > span { color: #d6aa58; font-family: var(--font-serif); font-size: 1.8rem; line-height: 1; }
                .consult-process-list svg { color: #d6aa58; }
                .consult-process-list h3 { color: #fff8ea; font-family: var(--font-serif); font-size: 1.7rem; line-height: 1.05; margin: 0 0 7px; }
                .consult-process-list p { color: rgba(255,255,255,.68); line-height: 1.65; margin: 0; }
                .consult-benefits { background: #f8f3ea; }
                .consult-final { align-items: center; background: #fffdf8; display: flex; gap: 28px; justify-content: space-between; padding: 64px 7vw; }
                .consult-final > div { max-width: 900px; }
                @media (max-width: 1050px) {
                    .consult-hero, .consult-intro, .consult-importance { grid-template-columns: 1fr; }
                    .consult-hero { padding-top: 120px; }
                    .consult-card-grid { grid-template-columns: 1fr; }
                }
                @media (max-width: 720px) {
                    .consult-hero { min-height: auto; padding: 104px 20px 44px; }
                    .consult-hero h1 { font-size: clamp(2.8rem, 14vw, 4.6rem); }
                    .consult-actions, .consult-final { display: grid; }
                    .consult-primary, .consult-secondary, .consult-final-button { width: 100%; }
                    .consult-hero-media { min-height: 360px; }
                    .consult-intro, .consult-importance, .consult-section, .consult-process, .consult-final { padding-left: 20px; padding-right: 20px; }
                    .consult-process-list article { align-items: start; grid-template-columns: 1fr; }
                    .consult-process-list article > svg:last-child { display: none; }
                }
            `}</style>
        </>
    )
}
