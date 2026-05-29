import type { Metadata } from 'next'
import Link from 'next/link'
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Search, ShieldCheck } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'

export const metadata: Metadata = {
    title: 'Contato | Guilherme Pilger',
    description: 'Fale com a equipe Guilherme Pilger para curadoria de imóveis de alto padrão em Santa Catarina. Atendimento personalizado para imóveis acima de R$ 4 milhões no litoral catarinense.',
    alternates: {
        canonical: '/contato',
    },
    openGraph: {
        title: 'Contato | Guilherme Pilger',
        description: 'Fale com a equipe Guilherme Pilger para curadoria de imóveis de alto padrão em Santa Catarina. Atendimento personalizado para imóveis acima de R$ 4 milhões no litoral catarinense.',
        url: '/contato',
        type: 'website',
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Contato | Guilherme Pilger',
        description: 'Fale com a equipe Guilherme Pilger para curadoria de imóveis de alto padrão em Santa Catarina. Atendimento personalizado para imóveis acima de R$ 4 milhões no litoral catarinense.',
        images: [DEFAULT_OG_IMAGE],
    },
}

const TiktokIcon = ({ size = 18 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
)

export default function ContatoPage() {
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: '/contato',
            name: 'Contato Guilherme Pilger',
            description: 'Atendimento para curadoria de imoveis de alto padrao em Santa Catarina.',
            type: 'ContactPage',
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Contato', url: '/contato' },
        ]),
        {
            '@context': 'https://schema.org',
            '@type': 'ContactPage',
            name: 'Contato Guilherme Pilger',
            url: absoluteUrl('/contato'),
            description: 'Atendimento para curadoria de imoveis de alto padrao em Santa Catarina.',
        },
    ]

    return (
        <>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <main className="contact-page">
                <section className="contact-hero">
                    <div>
                        <span>Pilger Luxury Search</span>
                        <h1>Fale com quem entende o alto padrao do litoral.</h1>
                        <p>Conte o que voce procura e receba uma curadoria objetiva: oportunidades, bairros, construtoras, liquidez e proximos passos.</p>
                        <div className="contact-actions">
                            <WhatsAppCaptureLink
                                phone="5547992528080"
                                message="Ola! Vim pela pagina de contato e quero falar com um especialista."
                                slug="contato"
                                template="contact-page-primary"
                                className="contact-primary"
                            >
                                <MessageCircle size={18} />
                                Falar no WhatsApp
                            </WhatsAppCaptureLink>
                            <Link href="/busca" className="contact-secondary"><Search size={17} /> Buscar imoveis</Link>
                        </div>
                    </div>
                    <aside className="contact-card">
                        <span>Atendimento premium</span>
                        <strong>Guilherme Pilger</strong>
                        <p>CRECI/SC 6772-J</p>
                        <div><MapPin size={16} /> Balneario Camboriu / SC</div>
                        <div><ShieldCheck size={16} /> Curadoria para compra, venda e posicionamento de mercado.</div>
                    </aside>
                </section>

                <section className="contact-grid">
                    <article>
                        <MessageCircle size={20} />
                        <h2>WhatsApp</h2>
                        <p>Canal principal para compradores, vendedores e parceiros.</p>
                        <WhatsAppCaptureLink
                            phone="5547992528080"
                            message="Ola! Quero falar com a equipe Pilger."
                            slug="contato"
                            template="contact-page-card"
                        >
                            Chamar especialista
                        </WhatsAppCaptureLink>
                    </article>
                    <article>
                        <Mail size={20} />
                        <h2>E-mail</h2>
                        <p>Use para propostas, documentos e alinhamentos formais.</p>
                        <a href="mailto:contato@guilhermepilger.ai">contato@guilhermepilger.ai</a>
                    </article>
                    <article>
                        <Instagram size={20} />
                        <h2>Redes sociais</h2>
                        <p>Acompanhe bastidores, tours, leituras de mercado e novas oportunidades.</p>
                        <div className="contact-socials">
                            <a href="https://www.instagram.com/guilhermepilger" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
                            <a href="https://www.facebook.com/guilherme.pilger/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook size={18} /></a>
                            <a href="https://www.tiktok.com/@guilhermepilgeroficial" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><TiktokIcon /></a>
                        </div>
                    </article>
                </section>
            </main>
            <Footer />

            <style>{`
                .contact-page { background: #faf7f1; color: #171512; }
                .contact-hero { align-items: end; background: linear-gradient(135deg, #17120d, #32281d); color: #fff8ea; display: grid; gap: 34px; grid-template-columns: minmax(0, 1fr) 360px; padding: 148px 7vw 72px; }
                .contact-hero span { color: #d7b674; display: block; font-size: .72rem; font-weight: 950; letter-spacing: .16em; margin-bottom: 12px; text-transform: uppercase; }
                .contact-hero h1 { font-family: var(--font-serif); font-size: clamp(2.4rem, 5.8vw, 5.2rem); line-height: .94; margin: 0; max-width: 920px; }
                .contact-hero p { color: rgba(255,255,255,.72); font-size: 1rem; line-height: 1.65; max-width: 720px; }
                .contact-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
                .contact-primary, .contact-secondary { align-items: center; border-radius: 999px; display: inline-flex; font-size: .78rem; font-weight: 950; gap: 8px; min-height: 46px; padding: 0 18px; text-decoration: none; text-transform: uppercase; }
                .contact-primary { background: #25d366; color: #fff !important; box-shadow: 0 16px 30px rgba(37,211,102,.2); }
                .contact-secondary { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); color: #fff8ea; }
                .contact-card { background: rgba(255,255,255,.08); border: 1px solid rgba(215,182,116,.28); border-radius: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.2); display: grid; gap: 12px; padding: 24px; }
                .contact-card strong { display: block; font-family: var(--font-serif); font-size: 2rem; line-height: 1; }
                .contact-card p { margin: 0; }
                .contact-card div { align-items: center; color: rgba(255,255,255,.74); display: flex; gap: 9px; line-height: 1.45; }
                .contact-grid { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 54px 7vw 74px; }
                .contact-grid article { background: #fff; border: 1px solid rgba(201,169,110,.22); border-radius: 16px; box-shadow: 0 18px 44px rgba(48,38,25,.06); display: grid; gap: 12px; padding: 24px; }
                .contact-grid article > svg { color: #b8945f; }
                .contact-grid h2 { font-family: var(--font-serif); font-size: 1.7rem; line-height: 1; margin: 0; }
                .contact-grid p { color: #71665b; line-height: 1.6; margin: 0; }
                .contact-grid a { color: #8a6530; font-weight: 900; text-decoration: none; }
                .contact-socials { display: flex; gap: 10px; }
                .contact-socials a { align-items: center; border: 1px solid rgba(184,148,95,.24); border-radius: 999px; display: inline-flex; height: 40px; justify-content: center; width: 40px; }
                @media (max-width: 920px) {
                    .contact-hero, .contact-grid { grid-template-columns: 1fr; }
                    .contact-hero { padding-top: 110px; }
                    .contact-card { max-width: 100%; }
                    .contact-primary, .contact-secondary { justify-content: center; width: 100%; }
                }
            `}</style>
        </>
    )
}
