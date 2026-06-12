'use client'

import Link from 'next/link'
import { Facebook, Instagram, MapPin, MessageCircle, Youtube } from 'lucide-react'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'

const TiktokIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
)

const propertyLinks = [
    ['Todos', '/imoveis'],
    ['Apartamentos', '/busca?type=apartamento'],
    ['Coberturas', '/imoveis/coberturas'],
    ['Frente mar', '/imoveis/frente-mar'],
    ['Lançamentos', '/busca?tag=lancamento'],
]

const cityLinks = [
    ['Balneário Camboriú', '/imoveis/balneario-camboriu'],
    ['Praia Brava', '/imoveis/praia-brava'],
    ['Itapema', '/imoveis/itapema'],
    ['Porto Belo', '/busca?city=Porto+Belo'],
]

export default function Footer() {
    return (
        <footer className="site-footer">
            <div className="footer-cta">
                <div>
                    <span className="footer-kicker">Pilger Luxury Search</span>
                    <h2>Quer comprar melhor no litoral catarinense?</h2>
                    <p>Fale com a equipe do Guilherme e receba uma curadoria de oportunidades alinhada ao seu momento.</p>
                </div>
                <WhatsAppCaptureLink
                    phone="5547992528080"
                    message="Olá! Vim pelo site e gostaria de uma curadoria de luxo."
                    slug="footer"
                    template="footer-premium-cta"
                    className="footer-cta-button"
                >
                    <MessageCircle size={18} />
                    Falar com especialista
                </WhatsAppCaptureLink>
            </div>

            <div className="footer-main">
                <div className="footer-brand">
                    <Link href="/" className="footer-logo">
                        <span className="footer-logo-name">GUILHERME PILGER</span>
                        <span className="footer-logo-sub">CRECI/SC 6772-J</span>
                    </Link>
                    <p className="footer-description">
                        Curadoria, conteúdo e negociação para alto padrão em Balneário Camboriú e litoral de Santa Catarina.
                    </p>
                    <div className="footer-meta">
                        <span>CRECI/SC 6772-J</span>
                        <span><MapPin size={13} /> Balneário Camboriú / SC</span>
                    </div>
                    <div className="footer-socials">
                        <a href="https://www.instagram.com/guilhermepilger" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={19} /></a>
                        <a href="https://www.facebook.com/guilherme.pilger/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook size={19} /></a>
                        <a href="https://www.youtube.com/@guilhermepilger" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Youtube size={19} /></a>
                        <a href="https://www.tiktok.com/@guilhermepilgeroficial" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><TiktokIcon /></a>
                    </div>
                </div>

                <nav className="footer-section" aria-label="Vitrine">
                    <h3>Vitrine</h3>
                    {propertyLinks.map(([label, href]) => (
                        <Link href={href} key={href}>{label}</Link>
                    ))}
                </nav>

                <nav className="footer-section" aria-label="Cidades">
                    <h3>Cidades</h3>
                    {cityLinks.map(([label, href]) => (
                        <Link href={href} key={href}>{label}</Link>
                    ))}
                </nav>

                <nav className="footer-section" aria-label="Institucional">
                    <h3>Marca Pilger</h3>
                    <Link href="/sobre">Sobre Guilherme Pilger</Link>
                    <Link href="/consultoria-imobiliaria-personalizada">Consultoria imobiliaria</Link>
                    <Link href="/blog">Blog</Link>
                    <Link href="/noticias">Notícias</Link>
                    <Link href="/eventos">Eventos</Link>
                    <WhatsAppCaptureLink
                        phone="5547992528080"
                        message="Olá! Quero falar com um especialista."
                        slug="footer"
                        template="footer-contato"
                    >
                        Contato
                    </WhatsAppCaptureLink>
                    <Link href="/busca">Busca premium</Link>
                    <Link href="/politica-de-privacidade">Politica de privacidade</Link>
                    <Link href="/termos-de-servico">Termos de servico</Link>
                </nav>
            </div>

            <div className="footer-bottom">
                <p>© 2026 Guilherme Pilger. Todos os direitos reservados.</p>
                <p>CRECI/SC 6772-J · Balneário Camboriú, SC</p>
            </div>

            <style jsx>{`
                .site-footer {
                    position: relative;
                    overflow: hidden;
                    background:
                        radial-gradient(circle at 10% 0%, rgba(223,193,142,0.14), transparent 30%),
                        linear-gradient(180deg, #151311 0%, #080807 100%);
                    color: rgba(255,255,255,0.66);
                    font-family: 'Inter', -apple-system, sans-serif;
                    margin-top: 0;
                }
                .site-footer::before {
                    content: 'PILGER';
                    position: absolute;
                    right: -3vw;
                    bottom: 5%;
                    color: rgba(255,255,255,0.035);
                    font-size: clamp(7rem, 20vw, 20rem);
                    font-weight: 950;
                    letter-spacing: 0.08em;
                    pointer-events: none;
                }
                .footer-cta {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 24px;
                    max-width: 1320px;
                    margin: 0 auto;
                    padding: clamp(34px, 5vw, 58px) clamp(20px, 4vw, 44px);
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                }
                .footer-kicker {
                    color: #d8b979;
                    font-size: 0.7rem;
                    font-weight: 950;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }
                .footer-cta h2 {
                    max-width: 760px;
                    margin: 8px 0 10px;
                    color: #fff8ea;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(2rem, 4vw, 4rem);
                    line-height: 1;
                    letter-spacing: 0;
                }
                .footer-cta p {
                    max-width: 620px;
                    margin: 0;
                    color: rgba(255,255,255,0.64);
                    font-size: 0.98rem;
                    line-height: 1.65;
                }
                :global(.footer-cta-button) {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 44px;
                    padding: 0 18px;
                    border-radius: 999px;
                    background: #087a3d;
                    color: #fff !important;
                    font-size: 0.76rem;
                    font-weight: 950;
                    letter-spacing: 0.09em;
                    text-transform: uppercase;
                    white-space: nowrap;
                    box-shadow: 0 16px 32px rgba(8,122,61,0.28);
                }
                .footer-main {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: minmax(260px, 1.4fr) repeat(3, minmax(160px, 1fr));
                    gap: clamp(24px, 4vw, 54px);
                    max-width: 1320px;
                    margin: 0 auto;
                    padding: clamp(34px, 5vw, 58px) clamp(20px, 4vw, 44px);
                }
                .footer-logo {
                    display: inline-flex;
                    flex-direction: column;
                }
                .footer-logo-name {
                    color: #fff8ea;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.4rem, 2vw, 2rem);
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    line-height: 1;
                }
                .footer-logo-sub {
                    margin-top: 5px;
                    color: #d8b979;
                    font-size: 0.68rem;
                    font-weight: 900;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }
                .footer-description {
                    max-width: 430px;
                    margin: 18px 0 0;
                    color: rgba(255,255,255,0.62);
                    font-size: 0.9rem;
                    line-height: 1.7;
                }
                .footer-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 18px;
                }
                .footer-meta span {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-height: 30px;
                    padding: 0 10px;
                    border: 1px solid rgba(223,193,142,0.16);
                    border-radius: 999px;
                    color: #dcc89f;
                    font-size: 0.66rem;
                    font-weight: 850;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }
                .footer-socials {
                    display: flex;
                    gap: 10px;
                    margin-top: 20px;
                }
                .footer-socials a {
                    display: grid;
                    place-items: center;
                    width: 38px;
                    height: 38px;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 50%;
                    background: rgba(255,255,255,0.04);
                    color: #fff8ea;
                    transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease;
                }
                .footer-socials a:hover {
                    transform: translateY(-2px);
                    border-color: rgba(223,193,142,0.34);
                    color: #d8b979;
                }
                .footer-section {
                    display: flex;
                    flex-direction: column;
                    gap: 9px;
                }
                .footer-section h3 {
                    margin: 0 0 6px;
                    color: #d8b979;
                    font-family: 'Inter', sans-serif;
                    font-size: 0.7rem;
                    font-weight: 950;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }
                .footer-section a {
                    color: rgba(255,255,255,0.62) !important;
                    font-size: 0.86rem;
                    font-weight: 650;
                    line-height: 1.55;
                    transition: color 0.18s ease, transform 0.18s ease;
                }
                .footer-section a:hover {
                    color: #fff8ea !important;
                    transform: translateX(3px);
                }
                .footer-bottom {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                    max-width: 1320px;
                    margin: 0 auto;
                    padding: 18px clamp(20px, 4vw, 44px) 24px;
                    border-top: 1px solid rgba(255,255,255,0.08);
                    color: rgba(255,255,255,0.38);
                    font-size: 0.72rem;
                    font-weight: 650;
                }
                .footer-bottom p {
                    margin: 0;
                }
                @media (max-width: 900px) {
                    .footer-cta {
                        display: block;
                    }
                    :global(.footer-cta-button) {
                        width: 100%;
                        margin-top: 22px;
                    }
                    .footer-main {
                        grid-template-columns: 1fr 1fr;
                    }
                    .footer-brand {
                        grid-column: 1 / -1;
                    }
                    .footer-bottom {
                        display: grid;
                        text-align: center;
                    }
                }
                @media (max-width: 560px) {
                    .footer-main {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </footer>
    )
}
