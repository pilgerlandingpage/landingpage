'use client'

import Link from 'next/link'
import { Instagram, Facebook, Youtube } from 'lucide-react'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'

const TiktokIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
)

export default function Footer() {
    return (
        <footer className="site-footer">
            <div className="footer-main">
                <div className="footer-grid">
                    {/* Brand */}
                    <div className="footer-brand">
                        <Link href="/" className="footer-logo">
                            <span className="footer-logo-name">GUILHERME PILGER</span>
                            <span className="footer-logo-sub">Corretor de Imóveis</span>
                        </Link>
                        <p className="footer-creci">CRECI/SC 6772-J</p>
                        <p className="footer-location">Balneário Camboriú, SC</p>

                        <WhatsAppCaptureLink
                            phone="5547992528080"
                            message="Olá! Vim pelo site e gostaria de mais informações."
                            slug="footer"
                            template="footer-cta"
                            className="footer-whatsapp-btn"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Fale com Especialista
                        </WhatsAppCaptureLink>

                        <div className="footer-socials">
                            <a href="https://www.instagram.com/guilhermepilger" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={20} /></a>
                            <a href="https://www.facebook.com/guilherme.pilger/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook size={20} /></a>
                            <a href="https://www.youtube.com/@guilhermepilger" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Youtube size={20} /></a>
                            <a href="https://www.tiktok.com/@guilhermepilgeroficial" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><TiktokIcon /></a>
                        </div>
                    </div>

                    {/* Imóveis */}
                    <div className="footer-section">
                        <h4>Imóveis</h4>
                        <Link href="/busca?status=active">Todos os imóveis</Link>
                        <Link href="/busca?type=apartamento">Apartamentos</Link>
                        <Link href="/busca?type=casa">Casas</Link>
                        <Link href="/busca?subtype=cobertura">Coberturas</Link>
                        <Link href="/busca?type=terreno">Terrenos</Link>
                        <Link href="/busca?tag=lancamento">Lançamentos</Link>
                    </div>

                    {/* Cidades */}
                    <div className="footer-section">
                        <h4>Cidades</h4>
                        <Link href="/busca?city=Balneário+Camboriú">Balneário Camboriú</Link>
                        <Link href="/busca?city=Itajaí">Itajaí</Link>
                        <Link href="/busca?city=Itapema">Itapema</Link>
                        <Link href="/busca?city=Porto+Belo">Porto Belo</Link>
                        <Link href="/busca?city=Camboriú">Camboriú</Link>
                    </div>

                    {/* Institucional */}
                    <div className="footer-section">
                        <h4>Institucional</h4>
                        <Link href="/sobre">Sobre a Pilger</Link>
                        <Link href="/contato">Contato</Link>
                        <Link href="/blog">Blog</Link>
                        <Link href="/noticias">Notícias</Link>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <p>© 2026 Guilherme Pilger Imóveis. Todos os direitos reservados.</p>
                <p>CRECI/SC 6772-J · Balneário Camboriú, SC</p>
            </div>

            <style jsx>{`
                .site-footer {
                    background: linear-gradient(180deg, #1a1a1a 0%, #111111 100%);
                    color: #999;
                    font-family: 'Inter', -apple-system, sans-serif;
                    font-size: 0.82rem;
                    margin-top: 40px;
                }
                .footer-main {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 48px 24px 32px;
                }
                .footer-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 32px;
                }
                @media (min-width: 550px) {
                    .footer-grid { grid-template-columns: 1fr 1fr; }
                }
                @media (min-width: 900px) {
                    .footer-grid { grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 40px; }
                    .footer-main { padding: 56px 40px 36px; }
                }

                /* Brand column */
                .footer-brand {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .footer-logo {
                    display: flex;
                    flex-direction: column;
                    margin-bottom: 4px;
                }
                .footer-logo-name {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #e8e5e0;
                    letter-spacing: 0.06em;
                    line-height: 1.1;
                }
                .footer-logo-sub {
                    font-size: 0.7rem;
                    color: #b8945f;
                    font-weight: 500;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .footer-creci {
                    color: #666;
                    font-size: 0.72rem;
                    margin: 0;
                }
                .footer-location {
                    color: #666;
                    font-size: 0.72rem;
                    margin: 0 0 8px 0;
                }
                .footer-whatsapp-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: #25D366;
                    color: white !important;
                    padding: 10px 20px;
                    border-radius: 50px;
                    font-weight: 600;
                    font-size: 0.78rem;
                    transition: all 0.3s;
                    width: fit-content;
                    margin: 4px 0;
                    box-shadow: 0 4px 14px rgba(37, 211, 102, 0.3);
                }
                .footer-whatsapp-btn:hover {
                    background: #20bd5a;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4);
                }
                .footer-socials {
                    display: flex;
                    gap: 14px;
                    margin-top: 8px;
                }
                .footer-socials a {
                    color: #666;
                    transition: color 0.2s, transform 0.2s;
                }
                .footer-socials a:hover {
                    color: #b8945f;
                    transform: translateY(-2px);
                }

                /* Sections */
                .footer-section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .footer-section h4 {
                    font-family: 'Inter', sans-serif;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #b8945f;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin: 0 0 4px 0;
                }
                .footer-section a {
                    color: #888 !important;
                    font-size: 0.8rem;
                    transition: color 0.2s;
                    line-height: 1.6;
                }
                .footer-section a:hover {
                    color: #e8e5e0 !important;
                }

                /* Bottom */
                .footer-bottom {
                    border-top: 1px solid rgba(255,255,255,0.06);
                    padding: 16px 24px;
                    text-align: center;
                    font-size: 0.7rem;
                    color: #555;
                }
                .footer-bottom p {
                    margin: 2px 0;
                }
                @media (min-width: 900px) {
                    .footer-bottom { padding: 16px 40px; }
                }
            `}</style>
        </footer>
    )
}
