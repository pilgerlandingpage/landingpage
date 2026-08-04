'use client'

import Link from 'next/link'
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react'
import { useEffect, useState } from 'react'
import GoogleReviewsSection from '@/components/marketplace/GoogleReviewsSection'
import type { HomepageGoogleReviews } from '@/lib/google-reviews'

type FooterProps = {
    showGoogleReviews?: boolean
}

const FOOTER_ADDRESS_LINES = [
    'Av. Carlos Drummond de Andrade, 33 - Loja 01',
    'Praia Brava - SC, 88306-800',
]
const FOOTER_MAPS_URL = 'https://www.google.com/maps/place/Guilherme+Pilger+-+Corretor+de+Im%C3%B3veis+em+Balne%C3%A1rio+Cambori%C3%BA/@-26.9567381,-48.6323929,17z/data=!3m1!4b1!4m6!3m5!1s0x94d8b735d07f8eed:0x977061312fa0d66a!8m2!3d-26.9567429!4d-48.629818!16s%2Fg%2F11t0m5dvqv?entry=ttu&g_ep=EgoyMDI2MDcyOS4wIKXMDSoASAFQAw%3D%3D'
const FOOTER_PHONE_HREF = 'tel:+554788271085'
const FOOTER_PHONE_LABEL = '(47) 8827-1085'
const FOOTER_EMAIL = 'contato@guilhermepilger.com.br'

const navLinks = [
    ['Imóveis', '/imoveis'],
    ['Lançamentos', '/busca?tag=lancamento'],
    ['Regiões', '/imoveis'],
    ['Conteúdo', '/blog'],
    ['Sobre', '/sobre'],
    ['Contato', '/contato'],
]

const regionLinks = [
    ['Balneário Camboriú', '/imoveis/balneario-camboriu'],
    ['Itapema', '/imoveis/itapema'],
    ['Itajaí', '/imoveis/itajai'],
    ['Praia Brava', '/imoveis/praia-brava'],
    ['Camboriú', '/busca?city=Camboriu'],
    ['Porto Belo', '/busca?city=Porto+Belo'],
]

const socialLinks = [
    ['IG', 'https://www.instagram.com/guilhermepilger'],
    ['FB', 'https://www.facebook.com/guilherme.pilger/'],
    ['YT', 'https://www.youtube.com/@guilhermepilger'],
    ['IN', 'https://www.linkedin.com'],
]

function useFooterGoogleReviews(enabled: boolean) {
    const [reviews, setReviews] = useState<HomepageGoogleReviews | null>(null)

    useEffect(() => {
        if (!enabled) return

        let active = true

        fetch('/api/public/google-reviews')
            .then(response => response.ok ? response.json() : null)
            .then(payload => {
                if (active) setReviews(payload?.data || null)
            })
            .catch(() => {
                if (active) setReviews(null)
            })

        return () => {
            active = false
        }
    }, [enabled])

    return reviews
}

export default function Footer({ showGoogleReviews = true }: FooterProps) {
    const googleReviews = useFooterGoogleReviews(showGoogleReviews)

    return (
        <>
            {showGoogleReviews && <GoogleReviewsSection data={googleReviews} />}

            <footer className="site-footer">
                <div className="footer-inner">
                    <section className="footer-base" aria-label="Nossa base na Praia Brava">
                        <div>
                            <h2>Nossa base na Praia Brava</h2>
                            <p>{FOOTER_ADDRESS_LINES[0]}<br />{FOOTER_ADDRESS_LINES[1]}</p>
                            <a href={FOOTER_MAPS_URL} target="_blank" rel="noopener noreferrer">
                                <MapPin size={15} />
                                Abrir rota no mapa
                            </a>
                        </div>
                        <img src="/images/eventos/fundo-imobiliaria.jpeg" alt="Base Guilherme Pilger na Praia Brava" loading="lazy" />
                    </section>

                    <section className="footer-brand" aria-label="Guilherme Pilger">
                        <strong>GUILHERME<br />PILGER</strong>
                        <p>Excelência em imóveis de alto padrão no litoral catarinense.</p>
                        <div className="footer-socials" aria-label="Redes sociais">
                            {socialLinks.map(([label, href]) => (
                                <a href={href} target="_blank" rel="noopener noreferrer" key={label}>{label}</a>
                            ))}
                        </div>
                    </section>

                    <nav className="footer-nav" aria-label="Navegue">
                        <h3>Navegue</h3>
                        {navLinks.map(([label, href]) => (
                            <Link href={href} key={`${label}-${href}`}>{label}</Link>
                        ))}
                    </nav>

                    <nav className="footer-nav" aria-label="Regiões atendidas">
                        <h3>Regiões atendidas</h3>
                        {regionLinks.map(([label, href]) => (
                            <Link href={href} key={`${label}-${href}`}>{label}</Link>
                        ))}
                    </nav>

                    <section className="footer-contact" aria-label="Atendimento">
                        <h3>Atendimento</h3>
                        <a href={FOOTER_PHONE_HREF}>
                            <Phone size={15} />
                            {FOOTER_PHONE_LABEL}
                        </a>
                        <a href={`mailto:${FOOTER_EMAIL}`}>
                            <Mail size={15} />
                            {FOOTER_EMAIL}
                        </a>
                        <p>Seg a Sex: 9h às 18h<br />Sáb: 9h às 13h</p>
                    </section>
                </div>

                <div className="footer-bottom">
                    <span>© 2026 Guilherme Pilger. Todos os direitos reservados.</span>
                    <Link href="/politica-de-privacidade">Política de Privacidade</Link>
                    <Link href="/termos-de-servico">Termos de Uso</Link>
                    <span>Desenvolvido com coração para você</span>
                </div>

                <style jsx>{`
                    .site-footer {
                        position: relative;
                        overflow: hidden;
                        margin-top: 0;
                        padding: 46px 0 24px;
                        background: #0b0b0b;
                        color: rgba(255, 255, 255, 0.72);
                        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    }

                    .footer-inner,
                    .footer-bottom {
                        width: min(calc(100% - clamp(48px, 6vw, 118px)), 1700px);
                        margin: 0 auto;
                    }

                    .footer-inner {
                        display: grid;
                        grid-template-columns: minmax(280px, 1.15fr) minmax(230px, 0.9fr) repeat(3, minmax(150px, 0.62fr));
                        gap: clamp(28px, 4vw, 64px);
                        align-items: start;
                        padding-bottom: 34px;
                    }

                    .site-footer h2,
                    .site-footer h3,
                    .site-footer p {
                        margin: 0;
                    }

                    .site-footer h2 {
                        color: #fff;
                        font-family: Georgia, 'Times New Roman', serif;
                        font-size: 1.06rem;
                        line-height: 1.2;
                    }

                    .site-footer h3 {
                        margin-bottom: 12px;
                        color: #fff;
                        font-size: 0.78rem;
                        font-weight: 850;
                    }

                    .footer-base {
                        display: grid;
                        grid-template-columns: minmax(0, 1fr) 150px;
                        gap: 22px;
                        align-items: end;
                    }

                    .footer-base p,
                    .footer-brand p,
                    .footer-contact p {
                        margin-top: 12px;
                        color: rgba(255, 255, 255, 0.66);
                        font-size: 0.78rem;
                        line-height: 1.5;
                    }

                    .footer-base a,
                    .footer-contact a,
                    .footer-nav a {
                        color: rgba(255, 255, 255, 0.78) !important;
                        text-decoration: none;
                    }

                    .footer-base a,
                    .footer-contact a {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        margin-top: 14px;
                        color: #d7b26c !important;
                        font-size: 0.76rem;
                        font-weight: 750;
                    }

                    .footer-base img {
                        width: 150px;
                        aspect-ratio: 4 / 3;
                        object-fit: cover;
                        border-radius: 4px;
                    }

                    .footer-brand strong {
                        display: block;
                        color: #d4a24d;
                        font-family: Georgia, 'Times New Roman', serif;
                        font-size: 1.65rem;
                        font-weight: 700;
                        line-height: 0.92;
                        letter-spacing: 0.08em;
                    }

                    .footer-socials {
                        display: flex;
                        gap: 12px;
                        margin-top: 18px;
                    }

                    .footer-socials a {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 26px;
                        height: 26px;
                        color: rgba(255, 255, 255, 0.8) !important;
                        font-size: 0.62rem;
                        font-weight: 850;
                        text-decoration: none;
                    }

                    .footer-nav {
                        display: grid;
                        align-content: start;
                    }

                    .footer-nav a {
                        margin-top: 7px;
                        font-size: 0.78rem;
                        line-height: 1.35;
                    }

                    .footer-contact a {
                        margin-top: 0;
                        margin-bottom: 10px;
                        color: rgba(255, 255, 255, 0.82) !important;
                        font-size: 0.78rem;
                    }

                    .footer-contact svg {
                        flex: 0 0 auto;
                    }

                    .footer-bottom {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 20px;
                        padding-top: 22px;
                        border-top: 1px solid rgba(255, 255, 255, 0.12);
                        color: rgba(255, 255, 255, 0.52);
                        font-size: 0.72rem;
                    }

                    .footer-bottom a {
                        color: rgba(255, 255, 255, 0.62) !important;
                        text-decoration: none;
                    }

                    @media (max-width: 1440px) {
                        .footer-inner,
                        .footer-bottom {
                            width: min(calc(100% - 52px), 1420px);
                        }
                    }

                    @media (max-width: 1180px) {
                        .footer-inner {
                            grid-template-columns: repeat(2, minmax(0, 1fr));
                        }

                        .footer-base,
                        .footer-brand {
                            grid-column: auto;
                        }
                    }

                    @media (max-width: 760px) {
                        .site-footer {
                            padding: 36px 0 calc(96px + env(safe-area-inset-bottom));
                        }

                        .footer-inner,
                        .footer-bottom {
                            width: calc(100% - 32px);
                        }

                        .footer-inner {
                            grid-template-columns: 1fr;
                        }

                        .footer-base {
                            grid-template-columns: 1fr;
                        }

                        .footer-base img {
                            width: min(260px, 100%);
                        }

                        .footer-bottom {
                            align-items: flex-start;
                            flex-direction: column;
                        }
                    }
                `}</style>
            </footer>
        </>
    )
}
