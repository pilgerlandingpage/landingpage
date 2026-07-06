'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { BookOpen, Building2, CalendarDays, ChevronDown, Facebook, Home, Instagram, KeyRound, MapPin, Menu, MessageCircle, Newspaper, Search, X, Youtube } from 'lucide-react'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import { replaceItajaiWithPraiaBrava } from '@/lib/locations/display'

type MenuLink = {
    label: string
    href: string
    count?: string
    accent?: boolean
}

type MenuSection = {
    title?: string
    count?: string
    links: MenuLink[]
}

type HeaderInstagramPost = {
    id: string
    caption?: string | null
    media_url?: string | null
    thumbnail_url?: string | null
    permalink?: string | null
}

type DevelopmentMenuPage = {
    slug: string
    name: string
    locationName?: string
    priceRange?: string
    availableUnitsCount?: number | null
}

const TiktokIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
)

function busca(params: Record<string, string | number>) {
    return `/busca?${new URLSearchParams(
        Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = String(value)
            return acc
        }, {})
    ).toString()}`
}

const saleSections: MenuSection[] = [
    {
        title: 'IMÓVEIS À VENDA',
        count: '1.382',
        links: [
            { label: 'Todos', href: busca({ status: 'active' }), count: '1.382', accent: true },
            { label: 'Apartamentos', href: busca({ type: 'apartamento' }), count: '1.006' },
            { label: 'Casas', href: busca({ type: 'casa' }), count: '143' },
            { label: 'Terrenos', href: busca({ type: 'terreno' }), count: '65' },
            { label: 'Comerciais', href: busca({ type: 'comercial' }), count: '25' },
        ],
    },
    {
        title: 'CONSTRUTORAS',
        links: [
            { label: 'Embraed', href: busca({ q: 'Embraed' }), count: '42' },
            { label: 'FG Empreendimentos', href: busca({ q: 'FG' }), count: '66' },
            { label: 'Dallo', href: busca({ q: 'Dallo' }), count: '16' },
            { label: 'Cechinel Incorporadora', href: busca({ q: 'Cechinel' }), count: '15' },
        ],
    },
]

const apartmentSections: MenuSection[] = [
    {
        title: 'APARTAMENTOS',
        count: '1.006',
        links: [
            { label: 'Todos os apartamentos', href: busca({ type: 'apartamento' }), accent: true },
            { label: '1 dormitório', href: busca({ type: 'apartamento', bedrooms: 1 }) },
            { label: '2 dormitórios', href: busca({ type: 'apartamento', bedrooms: 2 }) },
            { label: '3 dormitórios', href: busca({ type: 'apartamento', bedrooms: 3 }) },
            { label: '4 ou mais dormitórios', href: busca({ type: 'apartamento', bedroomsMin: 4 }) },
            { label: 'Apartamentos garden', href: busca({ subtype: 'garden' }) },
            { label: 'Coberturas', href: busca({ subtype: 'cobertura' }) },
            { label: 'Duplex / Triplex', href: busca({ subtype: 'duplex' }) },
            { label: 'Lofts', href: busca({ subtype: 'loft' }) },
        ],
    },
    {
        title: 'APS COM SUÍTE',
        links: [
            { label: '1 suíte', href: busca({ type: 'apartamento', suites: 1 }) },
            { label: '2 suítes', href: busca({ type: 'apartamento', suites: 2 }) },
            { label: '3 suítes', href: busca({ type: 'apartamento', suites: 3 }) },
            { label: '4 ou mais suítes', href: busca({ type: 'apartamento', suitesMin: 4 }) },
        ],
    },
]

const houseSections: MenuSection[] = [
    {
        title: 'CASAS',
        count: '143',
        links: [
            { label: 'Todas as casas', href: busca({ type: 'casa' }), accent: true },
            { label: '3 dormitórios', href: busca({ type: 'casa', bedrooms: 3 }) },
            { label: '4 dormitórios', href: busca({ type: 'casa', bedrooms: 4 }) },
            { label: '5 ou mais dormitórios', href: busca({ type: 'casa', bedroomsMin: 5 }) },
            { label: 'Sobrados', href: busca({ subtype: 'sobrado' }) },
            { label: 'Casas em condomínio', href: busca({ subtype: 'condominio' }) },
        ],
    },
    {
        title: 'TERRENOS',
        count: '65',
        links: [
            { label: 'Todos os terrenos', href: busca({ type: 'terreno' }), accent: true },
            { label: 'Terrenos em condomínio', href: busca({ subtype: 'terreno-condominio' }) },
            { label: 'Terreno comercial', href: busca({ subtype: 'terreno-comercial' }) },
        ],
    },
]

const locationSections: MenuSection[] = [
    {
        links: [
            { label: 'Balneário Camboriú', href: busca({ city: 'Balneário Camboriú' }), count: '631' },
            { label: 'Praia Brava', href: busca({ city: 'Praia Brava' }), count: '307' },
            { label: 'Itapema', href: busca({ city: 'Itapema' }), count: '210' },
            { label: 'Porto Belo', href: busca({ city: 'Porto Belo' }), count: '147' },
            { label: 'Camboriú', href: busca({ city: 'Camboriú' }), count: '41' },
        ],
    },
    {
        links: [
            { label: 'Lançamentos', href: busca({ tag: 'lancamento' }) },
            { label: 'Em construção', href: busca({ tag: 'em-construcao' }) },
            { label: 'Pronto para morar', href: busca({ tag: 'pronto' }) },
            { label: 'Frente para o mar', href: busca({ tag: 'frente-mar' }) },
            { label: 'Quadra do mar', href: busca({ tag: 'quadra-mar' }) },
        ],
    },
]

const rentLinks: MenuLink[] = [
    { label: 'Aluguel anual', href: busca({ offer: 'rent' }), count: '4', accent: true },
    { label: 'Comerciais para aluguel', href: busca({ offer: 'rent', type: 'comercial' }), count: '4' },
]

function DesktopSection({ section }: { section: MenuSection }) {
    return (
        <div className="gh-mega-section">
            {section.title && (
                <h4>
                    {section.title}
                    {section.count && <span className="gh-count">{section.count}</span>}
                </h4>
            )}
            <ul>
                {section.links.map(link => (
                    <li key={`${link.label}-${link.href}`}>
                        <Link href={link.href} className={link.accent ? 'gh-accent' : undefined}>
                            › {replaceItajaiWithPraiaBrava(link.label)}
                            {link.count && <span className="gh-count">{link.count}</span>}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function MobileLink({ link, onClose }: { link: MenuLink; onClose: () => void }) {
    return (
        <Link href={link.href} className={link.accent ? 'gh-accent' : undefined} onClick={onClose}>
            {replaceItajaiWithPraiaBrava(link.label)}
            {link.count && <span>{link.count}</span>}
        </Link>
    )
}

export default function GlobalHeader() {
    const pathname = usePathname()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [openAccordion, setOpenAccordion] = useState<string | null>(null)
    const [searchOpen, setSearchOpen] = useState(false)
    const [mobileInstagramPosts, setMobileInstagramPosts] = useState<HeaderInstagramPost[]>([])
    const [developmentPages, setDevelopmentPages] = useState<DevelopmentMenuPage[]>([])
    const searchRef = useRef<HTMLLIElement>(null)

    const closeMobileMenu = () => {
        setMobileMenuOpen(false)
        setOpenAccordion(null)
    }

    const handleMobileHomeClick = () => {
        closeMobileMenu()
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    }

    const toggleAccordion = (val: string) => {
        setOpenAccordion(openAccordion === val ? null : val)
    }

    useEffect(() => {
        const handleExternalMenuOpen = () => {
            setSearchOpen(false)
            setMobileMenuOpen(true)
        }

        window.addEventListener('pilger:open-global-menu', handleExternalMenuOpen)
        return () => window.removeEventListener('pilger:open-global-menu', handleExternalMenuOpen)
    }, [])

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false)
            }
        }
        if (searchOpen) document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [searchOpen])

    useEffect(() => {
        let cancelled = false

        fetch('/api/public/developments')
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (cancelled) return
                const pages = Array.isArray(data?.developments) ? data.developments : []
                setDevelopmentPages(pages.slice(0, 12))
            })
            .catch(() => null)

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!mobileMenuOpen || mobileInstagramPosts.length) return

        let cancelled = false
        fetch('/api/instagram?limit=6')
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (cancelled) return
                const posts = Array.isArray(data?.media) ? data.media : []
                setMobileInstagramPosts(posts.slice(0, 6))
            })
            .catch(() => null)

        return () => {
            cancelled = true
        }
    }, [mobileMenuOpen, mobileInstagramPosts.length])

    return (
        <>
            <header className={`gh-wrap ${pathname === '/busca' ? 'gh-home-mobile' : ''}`}>
                <div className="gh-topbar">
                    <div>CRECI/SC 6772-J - Guilherme Pilger Corretor de Imóveis</div>
                    <div className="gh-topbar-right">
                        <WhatsAppCaptureLink
                            phone="5547992528080"
                            message="Olá! Quero falar com um especialista."
                            slug="home"
                            template="global-header-topbar"
                            className="gh-topbar-whatsapp"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Fale Conosco
                        </WhatsAppCaptureLink>
                        <Link href="/favoritos">Favoritos</Link>
                        <Link href="/busca">Busca rápida</Link>
                        <div className="gh-topbar-socials">
                            <a href="https://www.instagram.com/guilhermepilger" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={14} /></a>
                            <a href="https://www.facebook.com/guilherme.pilger/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook size={14} /></a>
                            <a href="https://www.youtube.com/@guilhermepilger" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Youtube size={14} /></a>
                            <a href="https://www.tiktok.com/@guilhermepilgeroficial" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><TiktokIcon size={14} /></a>
                        </div>
                    </div>
                </div>

                <div className="gh-main">
                    <Link href="/" className="gh-logo">
                        <span className="gh-logo-name">GUILHERME PILGER</span>
                        <span className="gh-logo-sub">CRECI/SC 6772-J</span>
                    </Link>

                    <ul className="gh-desktop-nav">
                        <li className="gh-menu-item">
                            <Link href="/" className="gh-menu-label" aria-label="Home"><Home size={18} color="currentColor" /></Link>
                        </li>

                        {developmentPages.length > 0 && (
                            <li className="gh-menu-item">
                                <span className="gh-menu-label">EMPREENDIMENTOS</span>
                                <div className="gh-dropdown gh-developments-dropdown">
                                    <Link href="/#empreendimentos" className="gh-development-link gh-development-overview">
                                        <strong>Todos os empreendimentos</strong>
                                        <span>Ver vitrine na pagina inicial</span>
                                    </Link>
                                    {developmentPages.map(development => (
                                        <Link key={development.slug} href={`/${development.slug}`} className="gh-development-link">
                                            <strong>{development.name}</strong>
                                            <span>{development.locationName || development.priceRange || 'Empreendimento Guilherme Pilger'}</span>
                                        </Link>
                                    ))}
                                </div>
                            </li>
                        )}

                        <li className="gh-menu-item">
                            <span className="gh-menu-label">A IMOBILIÁRIA ▾</span>
                            <div className="gh-dropdown gh-dropdown-narrow">
                                <Link href="/sobre">Sobre a Pilger</Link>
                                <Link href="/busca?city=Balne%C3%A1rio+Cambori%C3%BA">Imobiliária em Balneário Camboriú</Link>
                                <Link href="/consultoria-imobiliaria-personalizada">Consultoria imobiliária personalizada</Link>
                            </div>
                        </li>

                        <li className="gh-menu-item">
                            <span className="gh-menu-label">VENDAS ▾</span>
                            <div className="gh-mega">
                                <div className="gh-mega-grid">
                                    <div>{saleSections.map(section => <DesktopSection key={section.title} section={section} />)}</div>
                                    <div>{apartmentSections.map(section => <DesktopSection key={section.title} section={section} />)}</div>
                                    <div>{houseSections.map(section => <DesktopSection key={section.title} section={section} />)}</div>
                                    <div>{locationSections.map((section, index) => <DesktopSection key={index} section={section} />)}</div>
                                </div>
                            </div>
                        </li>

                        <li className="gh-menu-item">
                            <span className="gh-menu-label">ALUGUEL ▾</span>
                            <div className="gh-dropdown gh-dropdown-narrow">
                                {rentLinks.map(link => (
                                    <Link key={link.href} href={link.href} className={link.accent ? 'gh-accent' : undefined}>
                                        › {replaceItajaiWithPraiaBrava(link.label)}
                                        {link.count && <span className="gh-count">{link.count}</span>}
                                    </Link>
                                ))}
                            </div>
                        </li>

                        <li className="gh-menu-item">
                            <Link href="/noticias" className="gh-menu-label">NOTÍCIAS</Link>
                        </li>

                        <li className="gh-menu-item">
                            <Link href="/blog" className="gh-menu-label">BLOG</Link>
                        </li>

                        <li className="gh-menu-item">
                            <Link href="/eventos" className="gh-menu-label">EVENTOS</Link>
                        </li>

                        <li className="gh-menu-item">
                            <WhatsAppCaptureLink
                                phone="5547992528080"
                                message="Olá! Gostaria de falar com um especialista."
                                slug="menu-desktop"
                                template="global-header-contato"
                                className="gh-menu-label"
                            >
                                CONTATO
                            </WhatsAppCaptureLink>
                        </li>

                        <li className="gh-menu-item" ref={searchRef}>
                            <button className="gh-search-trigger" onClick={() => setSearchOpen(!searchOpen)} aria-label="Abrir busca">
                                <Search size={18} color="currentColor" />
                            </button>
                            {searchOpen && (
                                <div className="gh-search-panel">
                                    <h4>Pesquisa rápida</h4>
                                    <form className="gh-search-form" action="/busca" method="get">
                                        <input type="text" name="q" placeholder="Digite cidade, bairro, tipo ou código..." autoFocus />
                                        <button type="submit">Buscar</button>
                                    </form>
                                </div>
                            )}
                        </li>
                    </ul>

                    <div className="gh-mobile-actions">
                        <button
                            className="gh-burger"
                            onClick={() => setMobileMenuOpen(open => !open)}
                            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                            aria-expanded={mobileMenuOpen}
                        >
                            {mobileMenuOpen ? <X size={28} color="#b8942f" /> : <Menu size={28} color="#b8942f" />}
                        </button>
                    </div>
                </div>
            </header>

            {mobileMenuOpen && (
                <div className="gh-mobile-overlay" onClick={closeMobileMenu}>
                    <div className="gh-mobile-panel" onClick={e => e.stopPropagation()}>
                        <div className="gh-mobile-header">
                            <div className="gh-mobile-brand">
                                <strong>GUILHERME PILGER</strong>
                                <small>CRECI/SC 6772-J</small>
                            </div>
                            <button onClick={closeMobileMenu} aria-label="Fechar menu">
                                <X size={24} color="#b8942f" />
                            </button>
                        </div>
                        <div className="gh-mobile-links">
                            <Link href="/" className="gh-mobile-nav-item" onClick={handleMobileHomeClick}>
                                <span className="gh-mobile-link-main"><Home size={17} strokeWidth={1.75} /><span>Home</span></span>
                            </Link>
                            <Link href="/busca" className="gh-mobile-nav-item gh-accent" onClick={closeMobileMenu}>
                                <span className="gh-mobile-link-main"><Search size={17} strokeWidth={1.75} /><span>Pesquisar imoveis</span></span>
                            </Link>

                            {developmentPages.length > 0 && (
                                <>
                                    <button className="gh-mobile-nav-item" onClick={() => toggleAccordion('empreendimentos')} aria-expanded={openAccordion === 'empreendimentos'}>
                                        <span className="gh-mobile-link-main"><Building2 size={17} strokeWidth={1.75} /><span>Empreendimentos</span></span>
                                        <ChevronDown className="gh-mobile-chevron" size={15} strokeWidth={1.75} />
                                    </button>
                                    {openAccordion === 'empreendimentos' && (
                                        <div className="gh-mobile-sub gh-mobile-developments-sub">
                                            <Link href="/#empreendimentos" className="gh-mobile-development-link gh-accent" onClick={closeMobileMenu}>
                                                <strong>Todos os empreendimentos</strong>
                                                <small>Ver vitrine na home</small>
                                            </Link>
                                            {developmentPages.map(development => (
                                                <Link key={development.slug} href={`/${development.slug}`} className="gh-mobile-development-link" onClick={closeMobileMenu}>
                                                    <strong>{development.name}</strong>
                                                    <small>{development.locationName || 'Guilherme Pilger'}</small>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            <button className="gh-mobile-nav-item" onClick={() => toggleAccordion('imobiliaria')} aria-expanded={openAccordion === 'imobiliaria'}>
                                <span className="gh-mobile-link-main"><Building2 size={17} strokeWidth={1.75} /><span>A imobiliária</span></span>
                                <ChevronDown className="gh-mobile-chevron" size={15} strokeWidth={1.75} />
                            </button>
                            {openAccordion === 'imobiliaria' && (
                                <div className="gh-mobile-sub">
                                    <Link href="/sobre" onClick={closeMobileMenu}>Sobre a Pilger</Link>
                                    <Link href="/consultoria-imobiliaria-personalizada" onClick={closeMobileMenu}>Consultoria imobiliária</Link>
                                </div>
                            )}

                            <button className="gh-mobile-nav-item" onClick={() => toggleAccordion('vendas')} aria-expanded={openAccordion === 'vendas'}>
                                <span className="gh-mobile-link-main"><Building2 size={17} strokeWidth={1.75} /><span>Vendas</span></span>
                                <ChevronDown className="gh-mobile-chevron" size={15} strokeWidth={1.75} />
                            </button>
                            {openAccordion === 'vendas' && (
                                <div className="gh-mobile-sub">
                                    {[...saleSections[0].links, ...apartmentSections[0].links.slice(5), ...houseSections[0].links.slice(4), ...locationSections[1].links].map(link => (
                                        <MobileLink key={`${link.label}-${link.href}`} link={link} onClose={closeMobileMenu} />
                                    ))}
                                    <Link href="/busca" className="gh-accent" onClick={closeMobileMenu}>Busca avançada</Link>
                                </div>
                            )}

                            <button className="gh-mobile-nav-item" onClick={() => toggleAccordion('localidades')} aria-expanded={openAccordion === 'localidades'}>
                                <span className="gh-mobile-link-main"><MapPin size={17} strokeWidth={1.75} /><span>Localidades</span></span>
                                <ChevronDown className="gh-mobile-chevron" size={15} strokeWidth={1.75} />
                            </button>
                            {openAccordion === 'localidades' && (
                                <div className="gh-mobile-sub">
                                    {locationSections[0].links.map(link => (
                                        <MobileLink key={link.href} link={link} onClose={closeMobileMenu} />
                                    ))}
                                </div>
                            )}

                            <button className="gh-mobile-nav-item" onClick={() => toggleAccordion('aluguel')} aria-expanded={openAccordion === 'aluguel'}>
                                <span className="gh-mobile-link-main"><KeyRound size={17} strokeWidth={1.75} /><span>Aluguel</span></span>
                                <ChevronDown className="gh-mobile-chevron" size={15} strokeWidth={1.75} />
                            </button>
                            {openAccordion === 'aluguel' && (
                                <div className="gh-mobile-sub">
                                    {rentLinks.map(link => <MobileLink key={link.href} link={link} onClose={closeMobileMenu} />)}
                                </div>
                            )}

                            <Link href="/noticias" className="gh-mobile-nav-item" onClick={closeMobileMenu}>
                                <span className="gh-mobile-link-main"><Newspaper size={17} strokeWidth={1.75} /><span>Notícias</span></span>
                            </Link>
                            <Link href="/blog" className="gh-mobile-nav-item" onClick={closeMobileMenu}>
                                <span className="gh-mobile-link-main"><BookOpen size={17} strokeWidth={1.75} /><span>Blog</span></span>
                            </Link>
                            <Link href="/eventos" className="gh-mobile-nav-item" onClick={closeMobileMenu}>
                                <span className="gh-mobile-link-main"><CalendarDays size={17} strokeWidth={1.75} /><span>Eventos</span></span>
                            </Link>
                            <WhatsAppCaptureLink
                                phone="5547992528080"
                                message="Olá! Gostaria de falar com um especialista."
                                slug="menu-mobile"
                                template="global-header-contato"
                                className="gh-mobile-nav-item"
                                onClick={closeMobileMenu as any}
                            >
                                <span className="gh-mobile-link-main"><MessageCircle size={17} strokeWidth={1.75} /><span>Contato</span></span>
                            </WhatsAppCaptureLink>
                            <div className="gh-mobile-instagram">
                                <div className="gh-mobile-instagram-head">
                                    <span>Últimos no Instagram</span>
                                    <a href="https://www.instagram.com/guilhermepilger" target="_blank" rel="noopener noreferrer" onClick={closeMobileMenu}>Ver perfil</a>
                                </div>
                                {mobileInstagramPosts.length > 0 ? (
                                    <div className="gh-mobile-instagram-grid">
                                        {mobileInstagramPosts.map(post => {
                                            const image = post.thumbnail_url || post.media_url
                                            const caption = (post.caption || 'Conteúdo Guilherme Pilger').split('\n')[0]
                                            return (
                                                <a
                                                    key={post.id}
                                                    href={post.permalink || 'https://www.instagram.com/guilhermepilger'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={closeMobileMenu}
                                                    className="gh-mobile-instagram-card"
                                                    aria-label={caption}
                                                >
                                                    {image ? <img src={image} alt={caption} /> : <span className="gh-mobile-instagram-fallback">Instagram</span>}
                                                </a>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <a
                                        href="https://www.instagram.com/guilhermepilger"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={closeMobileMenu}
                                        className="gh-mobile-instagram-empty"
                                    >
                                        <Instagram size={18} />
                                        Acompanhar bastidores, tours e oportunidades no Instagram
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
