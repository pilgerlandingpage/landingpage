import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
    Award,
    BookOpen,
    Compass,
    Handshake,
    Instagram,
    MessageCircle,
    PlayCircle,
    Search,
    ShieldCheck,
    Star,
    TrendingUp,
    Users,
    Youtube,
} from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'

const heroImage = '/images/eventos/guilherme-pilger.png'
const videoUrl = 'https://www.youtube.com/embed/qGHFMngGlg0'

export const metadata: Metadata = {
    title: 'Sobre Guilherme Pilger | Imobiliaria em Balneario Camboriu',
    description: 'Conheca a historia de Guilherme Pilger, corretor de imoveis desde 2008, especialista em alto padrao em Balneario Camboriu, Praia Brava e Itapema.',
    alternates: {
        canonical: '/sobre',
    },
    openGraph: {
        title: 'Sobre Guilherme Pilger | Imobiliaria em Balneario Camboriu',
        description: 'Historia, curriculo, video e equipe da Imobiliaria Guilherme Pilger no litoral catarinense.',
        url: '/sobre',
        type: 'website',
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Sobre Guilherme Pilger',
        description: 'Historia, curriculo, video e equipe da Imobiliaria Guilherme Pilger.',
        images: [DEFAULT_OG_IMAGE],
    },
}

const credentials = [
    {
        icon: Award,
        title: 'Desde 2008',
        text: 'Atuacao continua no mercado imobiliario, com foco em venda, compra e avaliacao de imoveis de alto padrao.',
    },
    {
        icon: ShieldCheck,
        title: 'Reconhecimento CRECI RS',
        text: 'Premiado por uma das tres melhores estrategias de venda de imoveis, levando metodo e disciplina para a operacao.',
    },
    {
        icon: Users,
        title: 'Conecta Imobi',
        text: 'Convidado como case de sucesso em eventos do setor, incluindo Conecta Imobi 2019 e 2022.',
    },
    {
        icon: BookOpen,
        title: 'A Chave da Venda',
        text: 'Coautor do best-seller A Chave da Venda de Imoveis, obra voltada a performance comercial imobiliaria.',
    },
]

const pillars = [
    {
        icon: Handshake,
        title: 'Compromisso inabalavel',
        text: 'A equipe atua com clareza, constancia e responsabilidade para criar lares felizes e atender necessidades especificas de cada cliente.',
    },
    {
        icon: Star,
        title: 'Especializacao e paixao',
        text: 'O trabalho combina conhecimento de bairros, construtoras, liquidez e padrao de vida para encontrar o imovel alinhado ao sonho do cliente.',
    },
    {
        icon: Compass,
        title: 'Abordagem centrada no cliente',
        text: 'Cada jornada imobiliaria e tratada como unica, da primeira conversa ate a entrega das chaves, com solucao sob medida.',
    },
    {
        icon: TrendingUp,
        title: 'Inovacao que faz diferenca',
        text: 'Marketing, conteudo, tecnologia e visibilidade digital ajudam a posicionar oportunidades e acelerar boas decisoes.',
    },
]

const team = [
    ['Guilherme Pilger', 'CRECI 39.724-F', 'Direcao comercial'],
    ['Matheus Goncalves', 'CRECI 68.334-F', 'Corretor especialista'],
    ['Drieli Schlickmann', 'CRECI 38.545', 'Corretora especialista'],
    ['Emily Nicole', 'CRECI 70.037-F', 'Corretora especialista'],
    ['Monica Noronha Macedo', 'CRECI 55.733', 'Corretora especialista'],
    ['Reginaldo Sa Barreto', 'CRECI 20.904', 'Corretor especialista'],
    ['Comercial Guilherme Pilger', 'CRECI 6772-J', 'Atendimento comercial'],
    ['Beitiner Bergmann', 'CRECI 75.366', 'Corretor especialista'],
    ['Luciana Coelho', 'CRECI 20.911', 'Corretora especialista'],
]

export default function SobrePage() {
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: '/sobre',
            name: 'Sobre Guilherme Pilger',
            description: 'Historia, curriculo e equipe da Imobiliaria Guilherme Pilger.',
            type: 'AboutPage',
            image: absoluteUrl(heroImage),
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Sobre', url: '/sobre' },
        ]),
        {
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            name: 'Guilherme Pilger Corretor de Imoveis',
            description: 'Video institucional com a historia e posicionamento da Imobiliaria Guilherme Pilger.',
            thumbnailUrl: 'https://i.ytimg.com/vi/qGHFMngGlg0/hqdefault.jpg',
            embedUrl: videoUrl,
            url: 'https://youtu.be/qGHFMngGlg0',
        },
    ]

    return (
        <>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <main className="about-page">
                <section className="about-hero">
                    <div className="about-hero-copy">
                        <span className="about-kicker">Imobiliaria em Balneario Camboriu</span>
                        <h1>Guilherme Pilger</h1>
                        <p>
                            Uma operacao imobiliaria construida para compradores, vendedores e investidores que buscam alto padrao com criterio, visao de mercado e atendimento consultivo.
                        </p>
                        <div className="about-actions">
                            <WhatsAppCaptureLink
                                phone="5547992528080"
                                message="Ola! Quero falar com a equipe Guilherme Pilger."
                                slug="sobre"
                                template="about-hero-whatsapp"
                                className="about-primary"
                            >
                                <MessageCircle size={18} />
                                Falar com especialista
                            </WhatsAppCaptureLink>
                            <Link href="/busca" className="about-secondary"><Search size={17} /> Ver imoveis</Link>
                        </div>
                        <div className="about-stats" aria-label="Indicadores de autoridade">
                            <strong><span>2008</span>inicio da trajetoria</strong>
                            <strong><span>1M+</span>visualizacoes nas redes</strong>
                            <strong><span>3</span>regioes foco</strong>
                        </div>
                    </div>
                    <div className="about-hero-media">
                        <Image src={heroImage} alt="Guilherme Pilger em atendimento imobiliario premium" fill priority sizes="(max-width: 900px) 100vw, 45vw" />
                        <div className="about-hero-badge">
                            <ShieldCheck size={18} />
                            <span>CRECI/SC 6772-J</span>
                        </div>
                    </div>
                </section>

                <section className="about-story">
                    <div>
                        <span className="about-kicker">Breve curriculo</span>
                        <h2>Da venda consultiva a uma marca imobiliaria de alto padrao.</h2>
                    </div>
                    <div className="about-story-text">
                        <p>
                            Trabalhar em uma regiao prospera, proxima do mar e cercada por imoveis de alto padrao sempre foi o sonho que guiou Guilherme Pilger. A trajetoria comecou no mercado imobiliario em 2008 e amadureceu com uma leitura cada vez mais precisa sobre avaliacao, compra, venda e posicionamento de imoveis.
                        </p>
                        <p>
                            Ao longo dessa jornada, Guilherme foi reconhecido pelo CRECI RS, apresentou estrategias em eventos como Conecta Imobi, tornou-se coautor do livro <strong>A Chave da Venda de Imoveis</strong> e consolidou uma operacao focada em Balneario Camboriu, Praia Brava e Itapema.
                        </p>
                        <p>
                            A missao da imobiliaria e ajudar cada cliente a encontrar o imovel perfeito com transparencia, repertorio local, estrategia de negociacao e suporte personalizado antes, durante e depois da decisao.
                        </p>
                    </div>
                </section>

                <section className="about-video-band">
                    <div className="about-video-copy">
                        <PlayCircle size={36} />
                        <span className="about-kicker">Video institucional</span>
                        <h2>Conheca a visao por tras da Imobiliaria Guilherme Pilger.</h2>
                        <p>O video do site antigo foi trazido para a nova experiencia para manter a historia, a autoridade e o contato humano no centro da pagina.</p>
                    </div>
                    <div className="about-video-frame">
                        <iframe
                            src={videoUrl}
                            title="Video sobre Guilherme Pilger"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    </div>
                </section>

                <section className="about-credentials" aria-label="Credenciais">
                    {credentials.map(item => {
                        const Icon = item.icon
                        return (
                            <article key={item.title}>
                                <Icon size={22} />
                                <h3>{item.title}</h3>
                                <p>{item.text}</p>
                            </article>
                        )
                    })}
                </section>

                <section className="about-pillars">
                    <div className="about-section-head">
                        <span className="about-kicker">Por que escolher</span>
                        <h2>Uma imobiliaria que vende com estrategia e acompanha a decisao.</h2>
                        <p>
                            A proposta nao e apenas apresentar propriedades. E construir uma parceria duradoura, com leitura de mercado, selecao criteriosa e clareza nos proximos passos.
                        </p>
                    </div>
                    <div className="about-pillar-grid">
                        {pillars.map(item => {
                            const Icon = item.icon
                            return (
                                <article key={item.title}>
                                    <Icon size={22} />
                                    <h3>{item.title}</h3>
                                    <p>{item.text}</p>
                                </article>
                            )
                        })}
                    </div>
                </section>

                <section className="about-proof">
                    <div className="about-testimonial">
                        <div className="about-stars" aria-label="Avaliacao 4.6 de 5">
                            {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={16} fill="currentColor" />)}
                            <span>4,6 / 5</span>
                        </div>
                        <blockquote>
                            A forma de trabalho do Guilherme Pilger e realmente inovadora. Quando eu buscava um imovel para minha familia, ele entendeu minhas necessidades e apresentou uma opcao que eu sequer tinha cogitado. Comprei na primeira visita.
                        </blockquote>
                        <strong>Raul Bergesch</strong>
                    </div>
                    <div className="about-social-proof">
                        <h2>Presenca digital que amplia a visibilidade dos imoveis.</h2>
                        <div>
                            <span><Instagram size={20} /> Instagram <strong>187 mil seguidores</strong></span>
                            <span><Youtube size={20} /> YouTube <strong>119 mil inscritos</strong></span>
                            <span><TrendingUp size={20} /> TikTok <strong>210 mil seguidores</strong></span>
                        </div>
                    </div>
                </section>

                <section className="about-team">
                    <div className="about-section-head">
                        <span className="about-kicker">Corretores</span>
                        <h2>Equipe conectada ao alto padrao do litoral.</h2>
                    </div>
                    <div className="about-team-grid">
                        {team.map(([name, creci, role]) => (
                            <article key={name}>
                                <div>{name.split(' ').slice(0, 2).map(part => part[0]).join('')}</div>
                                <h3>{name}</h3>
                                <span>{creci}</span>
                                <p>{role}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="about-final">
                    <div>
                        <span className="about-kicker">Proximo passo</span>
                        <h2>Conte o que voce procura. A curadoria comeca pela conversa certa.</h2>
                    </div>
                    <WhatsAppCaptureLink
                        phone="5547992528080"
                        message="Ola! Vi a pagina sobre o Guilherme Pilger e quero uma curadoria de imoveis."
                        slug="sobre"
                        template="about-final-whatsapp"
                        className="about-final-button"
                    >
                        <MessageCircle size={18} />
                        Iniciar atendimento
                    </WhatsAppCaptureLink>
                </section>
            </main>
            <Footer />

            <style>{`
                .about-page { background: #f8f3ea; color: #181512; font-family: var(--font-sans); }
                .about-hero { align-items: stretch; background: #171310; color: #fff8ea; display: grid; gap: 34px; grid-template-columns: minmax(0, 1fr) minmax(360px, 520px); min-height: 760px; padding: 150px 7vw 76px; }
                .about-hero-copy { align-self: center; max-width: 850px; }
                .about-kicker { color: #c99a4e; display: inline-flex; font-size: .72rem; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
                .about-hero h1, .about-story h2, .about-video-copy h2, .about-section-head h2, .about-social-proof h2, .about-final h2 { font-family: var(--font-serif); letter-spacing: 0; margin: 0; }
                .about-hero h1 { font-size: clamp(3.6rem, 9vw, 9rem); line-height: .86; margin-top: 12px; }
                .about-hero p { color: rgba(255,255,255,.73); font-size: clamp(1rem, 1.7vw, 1.24rem); line-height: 1.7; max-width: 720px; }
                .about-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
                .about-primary, .about-secondary, .about-final-button { align-items: center; border-radius: 999px; display: inline-flex; font-size: .78rem; font-weight: 950; gap: 8px; justify-content: center; min-height: 48px; padding: 0 18px; text-decoration: none; text-transform: uppercase; white-space: nowrap; }
                .about-primary, .about-final-button { background: #0c8a50; color: #fff !important; box-shadow: 0 18px 34px rgba(12,138,80,.25); }
                .about-secondary { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); color: #fff8ea; }
                .about-stats { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 44px; max-width: 720px; }
                .about-stats strong { border-top: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.62); display: grid; font-size: .72rem; gap: 4px; padding-top: 14px; text-transform: uppercase; }
                .about-stats span { color: #fff8ea; font-family: var(--font-serif); font-size: 2.2rem; line-height: 1; text-transform: none; }
                .about-hero-media { border-radius: 24px; min-height: 520px; overflow: hidden; position: relative; }
                .about-hero-media img { object-fit: cover; }
                .about-hero-media::after { background: linear-gradient(180deg, transparent 48%, rgba(0,0,0,.58)); content: ''; inset: 0; position: absolute; }
                .about-hero-badge { align-items: center; background: rgba(255,248,234,.92); border-radius: 999px; bottom: 20px; color: #171310; display: inline-flex; font-size: .75rem; font-weight: 950; gap: 8px; left: 20px; min-height: 40px; padding: 0 14px; position: absolute; z-index: 1; }
                .about-story { display: grid; gap: 42px; grid-template-columns: minmax(280px, 430px) minmax(0, 1fr); padding: 78px 7vw 54px; }
                .about-story h2 { color: #211b15; font-size: clamp(2.2rem, 4vw, 4rem); line-height: .98; margin-top: 10px; }
                .about-story-text { color: #4d443b; display: grid; gap: 16px; font-size: 1rem; line-height: 1.78; }
                .about-story-text p { margin: 0; }
                .about-video-band { align-items: center; background: #fffdf8; display: grid; gap: 34px; grid-template-columns: minmax(260px, 420px) minmax(0, 1fr); padding: 66px 7vw; }
                .about-video-copy { display: grid; gap: 14px; }
                .about-video-copy svg { color: #b8843e; }
                .about-video-copy h2 { color: #211b15; font-size: clamp(2rem, 3.5vw, 3.6rem); line-height: 1; }
                .about-video-copy p { color: #655a50; line-height: 1.7; margin: 0; }
                .about-video-frame { aspect-ratio: 16 / 9; background: #0f0d0a; border-radius: 20px; box-shadow: 0 24px 70px rgba(45,34,20,.18); overflow: hidden; }
                .about-video-frame iframe { border: 0; height: 100%; width: 100%; }
                .about-credentials { display: grid; gap: 18px; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 60px 7vw; }
                .about-credentials article, .about-pillar-grid article, .about-team article { background: #fffaf2; border: 1px solid rgba(184,132,62,.18); border-radius: 14px; box-shadow: 0 18px 42px rgba(63,45,23,.06); padding: 24px; }
                .about-credentials svg, .about-pillar-grid svg { color: #b8843e; }
                .about-credentials h3, .about-pillar-grid h3, .about-team h3 { color: #211b15; font-family: var(--font-serif); font-size: 1.5rem; line-height: 1.05; margin: 16px 0 8px; }
                .about-credentials p, .about-pillar-grid p, .about-team p { color: #655a50; line-height: 1.65; margin: 0; }
                .about-pillars { padding: 40px 7vw 70px; }
                .about-section-head { max-width: 840px; }
                .about-section-head h2 { color: #211b15; font-size: clamp(2.2rem, 4vw, 4.4rem); line-height: .98; margin-top: 10px; }
                .about-section-head p { color: #655a50; line-height: 1.7; margin: 16px 0 0; }
                .about-pillar-grid { display: grid; gap: 18px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 34px; }
                .about-proof { align-items: stretch; background: #1d1813; color: #fff8ea; display: grid; gap: 24px; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); padding: 70px 7vw; }
                .about-testimonial, .about-social-proof { border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 28px; }
                .about-stars { align-items: center; color: #d6aa58; display: flex; gap: 3px; margin-bottom: 18px; }
                .about-stars span { color: rgba(255,255,255,.7); font-size: .78rem; font-weight: 900; margin-left: 8px; }
                .about-testimonial blockquote { color: rgba(255,255,255,.78); font-size: 1rem; line-height: 1.75; margin: 0 0 18px; }
                .about-testimonial strong { color: #fff8ea; text-transform: uppercase; }
                .about-social-proof h2 { font-size: clamp(2rem, 3.2vw, 3.5rem); line-height: 1; }
                .about-social-proof div { display: grid; gap: 12px; margin-top: 24px; }
                .about-social-proof span { align-items: center; background: rgba(255,255,255,.06); border-radius: 12px; color: rgba(255,255,255,.72); display: flex; gap: 10px; min-height: 52px; padding: 0 14px; }
                .about-social-proof strong { color: #fff8ea; margin-left: auto; text-transform: uppercase; }
                .about-team { padding: 76px 7vw; }
                .about-team-grid { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 34px; }
                .about-team article { min-height: 180px; }
                .about-team article > div { align-items: center; background: #211b15; border-radius: 50%; color: #d6aa58; display: flex; font-family: var(--font-serif); font-size: 1.25rem; height: 58px; justify-content: center; width: 58px; }
                .about-team span { color: #9c773b; display: block; font-size: .72rem; font-weight: 950; letter-spacing: .08em; margin-bottom: 8px; text-transform: uppercase; }
                .about-final { align-items: center; background: #fffdf8; display: flex; gap: 28px; justify-content: space-between; padding: 62px 7vw; }
                .about-final h2 { color: #211b15; font-size: clamp(2rem, 3.6vw, 4rem); line-height: 1; margin-top: 10px; max-width: 840px; }
                @media (max-width: 1050px) {
                    .about-hero, .about-story, .about-video-band, .about-proof { grid-template-columns: 1fr; }
                    .about-hero { padding-top: 120px; }
                    .about-hero-media { min-height: 430px; }
                    .about-credentials, .about-pillar-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (max-width: 720px) {
                    .about-hero { min-height: auto; padding: 104px 20px 44px; }
                    .about-hero h1 { font-size: clamp(3.2rem, 18vw, 5rem); }
                    .about-actions, .about-final { display: grid; }
                    .about-primary, .about-secondary, .about-final-button { width: 100%; }
                    .about-stats, .about-credentials, .about-pillar-grid, .about-team-grid { grid-template-columns: 1fr; }
                    .about-story, .about-video-band, .about-pillars, .about-proof, .about-team, .about-final { padding-left: 20px; padding-right: 20px; }
                    .about-social-proof span { align-items: flex-start; display: grid; gap: 6px; padding: 14px; }
                    .about-social-proof strong { margin-left: 0; }
                }
            `}</style>
        </>
    )
}
