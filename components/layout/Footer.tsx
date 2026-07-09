'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Building2, ChevronLeft, ChevronRight, Facebook, Instagram, MapPin, Navigation, Youtube } from 'lucide-react'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import type { HomepageGoogleReviews } from '@/lib/google-reviews'

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

const FOOTER_OFFICE_FALLBACK_ADDRESS = 'Av. Carlos Drummond de Andrade, 33 - Loja 01 - Praia Brava, Itajaí - SC, 88306-800'
const FOOTER_OFFICE_FALLBACK_MAPS_URL = `https://www.google.com/maps/search/${encodeURIComponent(FOOTER_OFFICE_FALLBACK_ADDRESS)}`
const FOOTER_OFFICE_FALLBACK_PHOTO = '/images/eventos/fundo-imobiliaria.jpeg'

function FooterGooglePlaceShowcase() {
    const [place, setPlace] = useState<HomepageGoogleReviews | null>(null)
    const [hasLoadedPlace, setHasLoadedPlace] = useState(false)
    const galleryTrackRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        let active = true

        fetch('/api/public/google-reviews')
            .then(response => response.ok ? response.json() : null)
            .then(payload => {
                if (!active) return
                setPlace(payload?.data || null)
            })
            .catch(() => {
                if (active) setPlace(null)
            })
            .finally(() => {
                if (active) setHasLoadedPlace(true)
            })

        return () => {
            active = false
        }
    }, [])

    const photos = place?.photos || []
    const visiblePhotos = photos.length
        ? photos
        : hasLoadedPlace
            ? [{
                id: 'footer-office-fallback-photo',
                imageUri: FOOTER_OFFICE_FALLBACK_PHOTO,
                googleMapsUri: FOOTER_OFFICE_FALLBACK_MAPS_URL,
            }]
            : []
    const address = place?.formattedAddress || FOOTER_OFFICE_FALLBACK_ADDRESS
    const mapsUrl = place?.googleMapsUri || FOOTER_OFFICE_FALLBACK_MAPS_URL
    const locationLabel = place?.shortFormattedAddress || 'Praia Brava, Itajaí - SC'
    const photoSlots = useMemo(() => Array.from({ length: 3 }), [])
    const isGalleryLoading = !hasLoadedPlace && visiblePhotos.length === 0
    const shouldShowGalleryControls = visiblePhotos.length > 1

    const scrollGallery = (direction: 'previous' | 'next') => {
        const track = galleryTrackRef.current
        if (!track) return

        const distance = Math.max(260, track.clientWidth * 0.72)
        track.scrollBy({
            left: direction === 'next' ? distance : -distance,
            behavior: 'smooth',
        })
    }

    return (
        <>
        <div className="footer-office">
            <div className="footer-office-copy">
                <span className="footer-kicker">Imobiliária no Google</span>
                <h2>Conheça a base da Pilger na Praia Brava.</h2>

                <div className="footer-office-address">
                    <span className="footer-office-icon"><Building2 size={18} /></span>
                    <div>
                        <strong>{place?.placeName || 'Imobiliária Guilherme Pilger'}</strong>
                        <small><MapPin size={13} /> {locationLabel}</small>
                        <p>{address}</p>
                    </div>
                </div>

                <div className="footer-office-actions">
                    <a className="footer-maps-button" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                        <Navigation size={16} />
                        Ver rota no Google
                        <ArrowUpRight size={14} />
                    </a>
                </div>
            </div>

            <div className={`footer-office-gallery${visiblePhotos.length ? ' has-photos' : ''}${visiblePhotos.length === 1 ? ' is-single-photo' : ''}`} aria-label="Fotos da imobiliária no Google">
                <div className="footer-office-gallery-head">
                    <span>{visiblePhotos.length > 1 ? `${visiblePhotos.length} fotos do Google` : 'Foto da base Pilger'}</span>
                    {shouldShowGalleryControls && (
                        <div className="footer-office-gallery-controls" aria-label="Navegar pelas fotos da imobiliária">
                            <button type="button" onClick={() => scrollGallery('previous')} aria-label="Foto anterior">
                                <ChevronLeft size={17} />
                            </button>
                            <button type="button" onClick={() => scrollGallery('next')} aria-label="Próxima foto">
                                <ChevronRight size={17} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="footer-office-carousel" ref={galleryTrackRef} tabIndex={0}>
                {(isGalleryLoading ? photoSlots : visiblePhotos).map((_, index) => {
                    const photo = visiblePhotos[index]

                    if (!photo) {
                        return (
                            <span className="footer-office-photo is-loading" key={`footer-office-placeholder-${index}`}>
                                <span>Google</span>
                            </span>
                        )
                    }

                    return (
                        <a
                            className="footer-office-photo"
                            href={photo.googleMapsUri || mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            key={photo.id}
                        >
                            <img
                                src={photo.imageUri}
                                alt={`Foto da ${place?.placeName || 'imobiliária'} no Google`}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                            />
                            <span>{photos.length ? 'Google' : 'Imobiliária'}</span>
                        </a>
                    )
                })}
                </div>
            </div>
        </div>
        <style jsx>{`
            .footer-office {
                position: relative;
                z-index: 1;
                display: grid;
                grid-template-columns: minmax(320px, 0.9fr) minmax(360px, 1.1fr);
                gap: clamp(22px, 4vw, 48px);
                align-items: center;
                max-width: 1320px;
                margin: 0 auto;
                padding: clamp(34px, 5vw, 58px) clamp(20px, 4vw, 44px);
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .footer-office-copy h2 {
                max-width: none;
                margin: 8px 0 0;
                color: #fff8ea;
                font-family: 'Playfair Display', Georgia, serif;
                font-size: clamp(1.72rem, 1.65vw, 1.95rem);
                line-height: 1.06;
                letter-spacing: 0;
                white-space: nowrap;
            }
            .footer-office-address {
                display: grid;
                grid-template-columns: 42px minmax(0, 1fr);
                gap: 12px;
                max-width: 600px;
                margin-top: 20px;
                padding: 14px;
                border: 1px solid rgba(223,193,142,0.14);
                border-radius: 8px;
                background: rgba(255,255,255,0.045);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
            }
            .footer-office-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 42px;
                height: 42px;
                border-radius: 8px;
                background: rgba(216,185,121,0.13);
                color: #d8b979;
            }
            .footer-office-address strong {
                display: block;
                color: #fff8ea;
                font-size: 0.94rem;
                font-weight: 900;
                line-height: 1.2;
            }
            .footer-office-address small {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                margin-top: 4px;
                color: #dcc89f;
                font-size: 0.72rem;
                font-weight: 850;
                letter-spacing: 0.04em;
                text-transform: uppercase;
            }
            .footer-office-address p {
                margin: 8px 0 0;
                color: rgba(255,255,255,0.72);
                font-size: 0.86rem;
                line-height: 1.45;
            }
            .footer-office-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 18px;
            }
            .footer-maps-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                min-height: 42px;
                padding: 0 15px;
                border-radius: 999px;
                font-size: 0.72rem;
                font-weight: 950;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                white-space: nowrap;
            }
            .footer-maps-button {
                border: 1px solid rgba(223,193,142,0.26);
                background: rgba(255,255,255,0.06);
                color: #fff8ea !important;
            }
            .footer-office-gallery {
                display: grid;
                gap: 12px;
                min-width: 0;
            }
            .footer-office-gallery-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                min-height: 34px;
            }
            .footer-office-gallery-head > span {
                color: rgba(255,248,234,0.78);
                font-size: 0.72rem;
                font-weight: 900;
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }
            .footer-office-gallery-controls {
                display: inline-flex;
                gap: 8px;
            }
            .footer-office-gallery-controls button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 34px;
                height: 34px;
                border: 1px solid rgba(223,193,142,0.22);
                border-radius: 999px;
                background: rgba(255,255,255,0.06);
                color: #fff8ea;
                cursor: pointer;
                transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
            }
            .footer-office-gallery-controls button:hover {
                border-color: rgba(223,193,142,0.42);
                background: rgba(255,255,255,0.12);
                transform: translateY(-1px);
            }
            .footer-office-carousel {
                display: flex;
                gap: 12px;
                min-width: 0;
                overflow-x: auto;
                overflow-y: hidden;
                padding: 2px 2px 16px;
                scroll-behavior: smooth;
                scroll-padding-left: 2px;
                scroll-snap-type: x mandatory;
                scrollbar-color: rgba(223,193,142,0.42) rgba(255,255,255,0.08);
            }
            .footer-office-carousel:focus-visible {
                outline: 2px solid rgba(223,193,142,0.5);
                outline-offset: 4px;
            }
            .footer-office-gallery.is-single-photo .footer-office-carousel {
                justify-content: center;
            }
            .footer-office-photo {
                position: relative;
                display: block;
                flex: 0 0 clamp(236px, 29vw, 342px);
                aspect-ratio: 4 / 3;
                min-width: 0;
                overflow: hidden;
                border-radius: 8px;
                background:
                    linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
                    #1b1917;
                border: 1px solid rgba(255,255,255,0.08);
                box-shadow: 0 18px 40px rgba(0,0,0,0.24);
                scroll-snap-align: start;
            }
            .footer-office-photo img {
                width: 100%;
                height: 100%;
                display: block;
                object-fit: cover;
                transition: transform 0.45s ease;
            }
            .footer-office-photo:hover img {
                transform: scale(1.045);
            }
            .footer-office-photo > span {
                position: absolute;
                left: 10px;
                bottom: 10px;
                z-index: 1;
                display: inline-flex;
                min-height: 24px;
                align-items: center;
                padding: 0 9px;
                border-radius: 999px;
                background: rgba(10,10,9,0.72);
                color: #fff8ea;
                font-size: 0.62rem;
                font-weight: 950;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                backdrop-filter: blur(8px);
            }
            .footer-office-photo.is-loading {
                display: flex;
                align-items: flex-end;
            }
            .footer-office-photo.is-loading::before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(110deg, rgba(255,255,255,0.04), rgba(216,185,121,0.1), rgba(255,255,255,0.04));
                animation: footerOfficeLoading 1.8s ease-in-out infinite;
            }
            @keyframes footerOfficeLoading {
                0%, 100% { opacity: 0.42; transform: translateX(-8%); }
                50% { opacity: 0.88; transform: translateX(8%); }
            }
            @media (max-width: 900px) {
                .footer-office {
                    grid-template-columns: 1fr;
                }
                .footer-office-photo {
                    flex-basis: clamp(230px, 44vw, 320px);
                }
            }
            @media (max-width: 560px) {
                .footer-office {
                    padding: 32px 16px;
                }
                .footer-office-copy h2 {
                    font-size: clamp(1.65rem, 8vw, 2.1rem);
                    white-space: normal;
                }
                .footer-office-address {
                    grid-template-columns: 1fr;
                }
                .footer-office-actions {
                    display: grid;
                }
                .footer-maps-button {
                    width: 100%;
                }
                .footer-office-gallery-head {
                    align-items: stretch;
                    flex-direction: column;
                }
                .footer-office-gallery-controls {
                    align-self: flex-start;
                }
                .footer-office-photo {
                    flex-basis: min(82vw, 310px);
                }
            }
        `}</style>
        </>
    )
}

export default function Footer() {
    return (
        <footer className="site-footer">
            <FooterGooglePlaceShowcase />
            <div className="footer-main">
                <div className="footer-brand">
                    <Link href="/" className="footer-logo">
                        <span className="footer-logo-name">GUILHERME PILGER</span>
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
                    <Link href="/consultoria-imobiliaria-personalizada">Consultoria imobiliária</Link>
                    <Link href="/guias">Guias imobiliários</Link>
                    <Link href="/guias/imoveis-luxo-litoral-catarinense">Guia de imóveis de luxo</Link>
                    <Link href="/guias/imoveis-de-luxo-balneario-camboriu">Luxo em Balneário Camboriú</Link>
                    <Link href="/guias/apartamentos-frente-mar-balneario-camboriu">Frente mar em Balneário Camboriú</Link>
                    <Link href="/guias/coberturas-de-luxo-itapema">Coberturas em Itapema</Link>
                    <Link href="/guias/imoveis-de-luxo-praia-brava">Luxo na Praia Brava</Link>
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
                    <Link href="/politica-de-privacidade">Política de privacidade</Link>
                    <Link href="/termos-de-servico">Termos de serviço</Link>
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
