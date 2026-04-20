'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { Search, Facebook, Instagram, Youtube, Home, Menu, X } from 'lucide-react'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'

const TiktokIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
)

export default function GlobalHeader() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [openAccordion, setOpenAccordion] = useState<string | null>(null)
    const [searchOpen, setSearchOpen] = useState(false)
    const searchRef = useRef<HTMLLIElement>(null)

    const toggleAccordion = (val: string) => {
        setOpenAccordion(openAccordion === val ? null : val)
    }

    // Close search when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false)
            }
        }
        if (searchOpen) document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [searchOpen])

    return (
        <>
            <style>{`
                /* ====== GLOBAL HEADER ====== */
                .gh-wrap {
                    position: sticky;
                    top: 0;
                    z-index: 200;
                    width: 100%;
                    background: #fff;
                    box-shadow: 0 2px 12px rgba(184, 148, 95, 0.08);
                    font-family: 'Inter', -apple-system, sans-serif;
                }

                /* --- TOP BAR --- */
                .gh-topbar {
                    display: none;
                    height: 34px;
                    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
                    color: #8a8a8a;
                    font-size: 0.68rem;
                    font-weight: 500;
                    padding: 0 32px;
                    align-items: center;
                    justify-content: space-between;
                    letter-spacing: 0.02em;
                }
                @media (min-width: 768px) {
                    .gh-topbar { display: flex; }
                }
                .gh-topbar a {
                    color: #8a8a8a;
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: color 0.25s;
                }
                .gh-topbar a:hover { color: #d4b87a; }
                .gh-topbar-right {
                    display: flex;
                    align-items: center;
                    gap: 18px;
                }
                .gh-topbar-socials {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding-left: 14px;
                    border-left: 1px solid rgba(255,255,255,0.1);
                }

                /* --- MAIN NAV BAR --- */
                .gh-main {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    height: 68px;
                    padding: 0 20px;
                }
                @media (min-width: 768px) {
                    .gh-main { padding: 0 32px; }
                }

                .gh-logo {
                    display: flex;
                    flex-direction: column;
                    text-decoration: none;
                    transition: opacity 0.2s;
                }
                .gh-logo:hover { opacity: 0.8; }
                .gh-logo-name {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #5a5a5a;
                    letter-spacing: 0.06em;
                    line-height: 1.1;
                }
                .gh-logo-sub {
                    font-family: 'Inter', sans-serif;
                    font-size: 0.72rem;
                    color: #b8945f;
                    line-height: 1;
                    font-weight: 500;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }

                /* Desktop Nav */
                .gh-desktop-nav {
                    display: none;
                    align-items: center;
                    height: 100%;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                @media (min-width: 1200px) {
                    .gh-desktop-nav { display: flex; }
                }

                .gh-menu-item {
                    position: relative;
                    height: 100%;
                    display: flex;
                    align-items: center;
                }
                .gh-menu-item > .gh-menu-label {
                    padding: 0 16px;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    font-size: 0.75rem;
                    font-weight: 600;
                    letter-spacing: 0.08em;
                    color: #777;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    white-space: nowrap;
                    text-decoration: none;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                }
                .gh-menu-item:hover > .gh-menu-label,
                .gh-menu-item > .gh-menu-label:hover {
                    color: #b8945f;
                    background: rgba(184, 148, 95, 0.04);
                    border-bottom-color: #b8945f;
                }
                .gh-menu-item > .gh-menu-label a {
                    text-decoration: none;
                    color: inherit;
                    display: flex;
                    align-items: center;
                    height: 100%;
                }

                /* Dropdown panels */
                .gh-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    background: #fff;
                    border: 1px solid #f0ede8;
                    border-top: 2px solid #b8945f;
                    border-radius: 0 0 8px 8px;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(184,148,95,0.06);
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(4px);
                    transition: opacity 0.2s, visibility 0.2s, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 300;
                }
                .gh-menu-item:hover > .gh-dropdown {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                }
                .gh-dropdown-narrow { width: 300px; padding: 8px 0; }
                .gh-dropdown-narrow a {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 11px 22px;
                    font-size: 0.8rem;
                    color: #666;
                    text-decoration: none;
                    transition: all 0.2s;
                    border-left: 3px solid transparent;
                }
                .gh-dropdown-narrow a:hover {
                    background: #faf8f5;
                    color: #b8945f;
                    border-left-color: #b8945f;
                }

                /* Mega Menu */
                .gh-mega {
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%) translateY(4px);
                    width: 100vw;
                    max-width: 1400px;
                    background: #fff;
                    border-top: 2px solid #b8945f;
                    border-radius: 0 0 10px 10px;
                    box-shadow: 0 16px 48px rgba(0,0,0,0.1), 0 2px 8px rgba(184,148,95,0.06);
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.25s, visibility 0.25s, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 300;
                    padding: 28px 40px 32px;
                }
                .gh-menu-item:hover > .gh-mega {
                    opacity: 1;
                    visibility: visible;
                    transform: translateX(-50%) translateY(0);
                }
                .gh-mega-grid {
                    display: grid;
                    grid-template-columns: 1fr 1.3fr 1.3fr 1fr;
                    gap: 28px;
                }
                .gh-mega h4 {
                    font-family: 'Inter', sans-serif !important;
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin: 0 0 10px 0;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    padding-bottom: 6px;
                    border-bottom: 1px solid rgba(184, 148, 95, 0.15);
                }
                .gh-mega-section { margin-bottom: 18px; }
                .gh-mega ul {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                .gh-mega li { margin-bottom: 5px; }
                .gh-mega li a {
                    font-size: 0.76rem;
                    color: #777;
                    text-decoration: none;
                    transition: color 0.2s, padding-left 0.2s;
                    display: inline-block;
                }
                .gh-mega li a:hover {
                    color: #b8945f;
                    padding-left: 4px;
                }
                .gh-mega .gh-count {
                    color: #bbb;
                    font-size: 0.66rem;
                    margin-left: 3px;
                    font-weight: 400;
                }

                /* Media dropdown — news & blog */
                .gh-media-dropdown {
                    width: 380px;
                    padding: 0;
                    border-radius: 0 0 8px 8px;
                }
                .gh-media-dropdown.right-aligned {
                    left: auto;
                    right: 0;
                }
                .gh-media-item {
                    display: flex;
                    gap: 14px;
                    padding: 14px 18px;
                    border-bottom: 1px solid #f0ede8;
                    text-decoration: none;
                    transition: background 0.2s;
                }
                .gh-media-item:hover { background: #faf8f5; }
                .gh-media-img {
                    width: 90px;
                    height: 64px;
                    object-fit: cover;
                    flex-shrink: 0;
                    border-radius: 6px;
                    filter: grayscale(20%);
                    transition: filter 0.3s;
                }
                .gh-media-item:hover .gh-media-img { filter: grayscale(0%); }
                .gh-media-text {
                    font-size: 0.78rem;
                    color: #555;
                    font-weight: 500;
                    line-height: 1.45;
                }
                .gh-media-footer {
                    padding: 10px 18px;
                    text-align: right;
                    background: #faf8f5;
                    border-radius: 0 0 8px 8px;
                }
                .gh-media-footer a {
                    font-size: 0.72rem;
                    color: #b8945f;
                    text-decoration: none;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    transition: color 0.2s;
                }
                .gh-media-footer a:hover { color: #8a6d3b; }

                /* Search icon + dropdown */
                .gh-search-trigger {
                    padding: 0 14px;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    transition: all 0.25s;
                    position: relative;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                }
                .gh-search-trigger:hover {
                    color: #b8945f;
                    border-bottom-color: #b8945f;
                    background: rgba(184, 148, 95, 0.04);
                }
                .gh-search-panel {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    width: 400px;
                    background: #fff;
                    border: 1px solid #f0ede8;
                    border-top: 2px solid #b8945f;
                    border-radius: 0 0 10px 10px;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.1);
                    padding: 22px;
                    z-index: 300;
                }
                .gh-search-panel h4 {
                    font-family: 'Inter', sans-serif !important;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin: 0 0 14px 0;
                    letter-spacing: 0.03em;
                }
                .gh-search-form {
                    display: flex;
                    border: 1px solid #e8e5e0;
                    border-radius: 100px;
                    overflow: hidden;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
                    transition: border-color 0.3s, box-shadow 0.3s;
                }
                .gh-search-form:focus-within {
                    border-color: #b8945f;
                    box-shadow: 0 2px 12px rgba(184, 148, 95, 0.12);
                }
                .gh-search-form input {
                    flex: 1;
                    padding: 11px 18px;
                    border: none;
                    font-size: 0.85rem;
                    outline: none;
                    font-family: inherit;
                    color: #333;
                }
                .gh-search-form input::placeholder { color: #aaa; }
                .gh-search-form button {
                    padding: 11px 22px;
                    background: linear-gradient(135deg, #b8945f, #d4b87a);
                    color: #fff;
                    border: none;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 0.82rem;
                    transition: opacity 0.2s;
                    letter-spacing: 0.04em;
                }
                .gh-search-form button:hover { opacity: 0.9; }

                /* Mobile burger */
                .gh-burger {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    padding: 8px;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                .gh-burger:hover { color: #b8945f; }
                @media (min-width: 1200px) {
                    .gh-burger { display: none; }
                }

                /* Mobile overlay */
                .gh-mobile-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.45);
                    backdrop-filter: blur(2px);
                    z-index: 500;
                    display: flex;
                    justify-content: flex-end;
                }
                .gh-mobile-panel {
                    width: 85%;
                    max-width: 400px;
                    height: 100%;
                    background: #fff;
                    overflow-y: auto;
                    animation: ghSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: -8px 0 30px rgba(0,0,0,0.1);
                }
                @keyframes ghSlideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .gh-mobile-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 24px;
                    border-bottom: 2px solid #b8945f;
                    background: linear-gradient(135deg, rgba(184,148,95,0.04), rgba(184,148,95,0.01));
                }
                .gh-mobile-header span {
                    font-family: 'Playfair Display', serif;
                    font-weight: 700;
                    font-size: 1rem;
                    color: #5a5a5a;
                    letter-spacing: 0.08em;
                }
                .gh-mobile-header button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    transition: color 0.2s;
                }
                .gh-mobile-header button:hover { color: #b8945f; }
                .gh-mobile-links a,
                .gh-mobile-links button {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                    padding: 15px 24px;
                    border-bottom: 1px solid #f0ede8;
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: #555;
                    text-decoration: none;
                    background: none;
                    border-left: none;
                    border-right: none;
                    border-top: none;
                    cursor: pointer;
                    text-align: left;
                    font-family: inherit;
                    letter-spacing: 0.06em;
                    transition: color 0.2s, background 0.2s;
                }
                .gh-mobile-links a:hover,
                .gh-mobile-links button:hover {
                    color: #b8945f;
                    background: rgba(184, 148, 95, 0.03);
                }
                .gh-mobile-sub {
                    background: #faf8f5;
                    padding: 10px 24px 14px;
                    border-bottom: 1px solid #f0ede8;
                }
                .gh-mobile-sub a {
                    display: block;
                    padding: 8px 0;
                    font-size: 0.82rem;
                    font-weight: 500;
                    color: #777;
                    text-decoration: none;
                    border-bottom: 1px solid #eee;
                }
                .gh-mobile-sub a:last-child { border-bottom: none; }
                .gh-mobile-sub a.gh-accent {
                    color: #b8945f;
                    font-weight: 700;
                    border-bottom: none;
                    margin-top: 6px;
                }
            `}</style>

            <header className="gh-wrap">
                {/* === TOP BAR === */}
                <div className="gh-topbar">
                    <div>CRECI/SC 6772-J - Balneário Camboriú / SC</div>
                    <div className="gh-topbar-right">
                        <WhatsAppCaptureLink
                            phone="5547992528080"
                            message="Olá! Quero falar com um especialista."
                            slug="home"
                            template="global-header-topbar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            (47) 9.9252-8080
                        </WhatsAppCaptureLink>
                        <Link href="/favoritos">★ imóveis favoritos</Link>
                        <span style={{ cursor: 'pointer' }}>encontre rápido ▾</span>
                        <div className="gh-topbar-socials">
                            <a href="#"><Facebook size={14} /></a>
                            <a href="#"><Instagram size={14} /></a>
                            <a href="#"><Youtube size={14} /></a>
                            <a href="#"><TiktokIcon /></a>
                        </div>
                    </div>
                </div>

                {/* === MAIN NAV === */}
                <div className="gh-main">
                    {/* Logo */}
                    <Link href="/" className="gh-logo">
                        <span className="gh-logo-name">GUILHERME PILGER</span>
                        <span className="gh-logo-sub">Corretor de Imóveis</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <ul className="gh-desktop-nav">
                        {/* Home */}
                        <li className="gh-menu-item">
                            <Link href="/" className="gh-menu-label"><Home size={18} color="#333" /></Link>
                        </li>

                        {/* A IMOBILIÁRIA */}
                        <li className="gh-menu-item">
                            <span className="gh-menu-label">A IMOBILIÁRIA ▾</span>
                            <div className="gh-dropdown gh-dropdown-narrow">
                                <Link href="#">🏠 Imobiliária em Balneário Camboriú</Link>
                                <Link href="#">🏠 Consultoria Imobiliária Personalizada</Link>
                            </div>
                        </li>

                        {/* VENDAS (Mega Menu) */}
                        <li className="gh-menu-item">
                            <span className="gh-menu-label">VENDAS ▾</span>
                            <div className="gh-mega">
                                <div className="gh-mega-grid">
                                    {/* Col 1 */}
                                    <div>
                                        <div className="gh-mega-section">
                                            <h4>IMÓVEIS À VENDA <span className="gh-count">1.366</span></h4>
                                            <ul>
                                                <li><Link href="/busca?q=apartamento">› Apartamentos <span className="gh-count">1.146</span></Link></li>
                                                <li><Link href="/busca?q=casa">› Casas <span className="gh-count">134</span></Link></li>
                                                <li><Link href="/busca?q=terreno">› Terrenos <span className="gh-count">67</span></Link></li>
                                                <li><Link href="/busca?q=comercial">› Imóveis Comerciais <span className="gh-count">19</span></Link></li>
                                            </ul>
                                        </div>
                                        <div className="gh-mega-section">
                                            <h4>CONSTRUTORAS</h4>
                                            <ul>
                                                <li><Link href="#">› Cechinel Incorporadora <span className="gh-count">15</span></Link></li>
                                                <li><Link href="#">› Dallo <span className="gh-count">16</span></Link></li>
                                                <li><Link href="#">› Embraed <span className="gh-count">42</span></Link></li>
                                                <li><Link href="#">› FG Empreendimentos <span className="gh-count">66</span></Link></li>
                                                <li><Link href="#">› Outras Construtoras <span className="gh-count">498</span></Link></li>
                                            </ul>
                                        </div>
                                    </div>
                                    {/* Col 2 */}
                                    <div>
                                        <div className="gh-mega-section">
                                            <h4>APARTAMENTOS <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#aaa', fontSize: '0.75rem' }}>- todos</span> <span className="gh-count">1.146</span></h4>
                                            <ul>
                                                <li><Link href="#">› Apartamentos 1 Dormitório <span className="gh-count">30</span></Link></li>
                                                <li><Link href="#">› Apartamentos 2 Dormitórios <span className="gh-count">145</span></Link></li>
                                                <li><Link href="#">› Apartamentos 3 Dormitórios <span className="gh-count">466</span></Link></li>
                                                <li><Link href="#">› Apartamentos 4 ou + Dorms. <span className="gh-count">504</span></Link></li>
                                                <li><Link href="#">› Apartamentos Garden <span className="gh-count">9</span></Link></li>
                                                <li><Link href="#">› Coberturas <span className="gh-count">95</span></Link></li>
                                                <li><Link href="#">› Duplex / Triplex <span className="gh-count">48</span></Link></li>
                                                <li><Link href="#">› Diferenciados <span className="gh-count">76</span></Link></li>
                                                <li><Link href="#">› Mobiliados <span className="gh-count">311</span></Link></li>
                                                <li><Link href="#">› Lofts <span className="gh-count">5</span></Link></li>
                                            </ul>
                                        </div>
                                        <div className="gh-mega-section">
                                            <h4>APS COM SUÍTE <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#aaa', fontSize: '0.75rem' }}>- todos</span> <span className="gh-count">1.128</span></h4>
                                            <ul>
                                                <li><Link href="#">› Apartamentos 1 Suíte <span className="gh-count">143</span></Link></li>
                                                <li><Link href="#">› Apartamentos 2 Suítes <span className="gh-count">147</span></Link></li>
                                                <li><Link href="#">› Apartamentos 3 Suítes <span className="gh-count">387</span></Link></li>
                                                <li><Link href="#">› Apartamentos 4 ou + Suítes <span className="gh-count">451</span></Link></li>
                                            </ul>
                                        </div>
                                    </div>
                                    {/* Col 3 */}
                                    <div>
                                        <div className="gh-mega-section">
                                            <h4>CASAS <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#aaa', fontSize: '0.75rem' }}>- todos</span> <span className="gh-count">134</span></h4>
                                            <ul>
                                                <li><Link href="#">› Casas 3 Dormitórios <span className="gh-count">36</span></Link></li>
                                                <li><Link href="#">› Casas 4 Dormitórios <span className="gh-count">61</span></Link></li>
                                                <li><Link href="#">› Casas 5 ou + Dorms. <span className="gh-count">37</span></Link></li>
                                                <li><Link href="#">› Sobrados <span className="gh-count">2</span></Link></li>
                                                <li><Link href="#">› Casas em Condomínio <span className="gh-count">82</span></Link></li>
                                            </ul>
                                        </div>
                                        <div className="gh-mega-section">
                                            <h4>CASAS COM SUÍTE <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#aaa', fontSize: '0.75rem' }}>- todos</span> <span className="gh-count">132</span></h4>
                                            <ul>
                                                <li><Link href="#">› Casas 1 Suíte <span className="gh-count">9</span></Link></li>
                                                <li><Link href="#">› Casas 2 Suítes <span className="gh-count">2</span></Link></li>
                                                <li><Link href="#">› Casas 3 Suítes <span className="gh-count">34</span></Link></li>
                                                <li><Link href="#">› Casas 4 ou + Suítes <span className="gh-count">87</span></Link></li>
                                            </ul>
                                        </div>
                                        <div className="gh-mega-section">
                                            <h4>TERRENOS <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#aaa', fontSize: '0.75rem' }}>- todos</span> <span className="gh-count">67</span></h4>
                                            <ul>
                                                <li><Link href="#">› Terrenos em Condomínio <span className="gh-count">27</span></Link></li>
                                                <li><Link href="#">› Terrenos <span className="gh-count">39</span></Link></li>
                                                <li><Link href="#">› Terreno Comercial <span className="gh-count">1</span></Link></li>
                                            </ul>
                                        </div>
                                    </div>
                                    {/* Col 4 — Locations */}
                                    <div>
                                        <div className="gh-mega-section" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 16 }}>
                                            <ul>
                                                <li><Link href="#">› Balneário Camboriú <span className="gh-count">625</span></Link></li>
                                                <li><Link href="#">› Camboriú <span className="gh-count">39</span></Link></li>
                                                <li><Link href="#">› Itajaí <span className="gh-count">314</span></Link></li>
                                                <li><Link href="#">› Itapema <span className="gh-count">206</span></Link></li>
                                                <li><Link href="#">› Porto Belo <span className="gh-count">147</span></Link></li>
                                                <li><Link href="#" style={{ color: '#aaa', fontWeight: 600 }}>› + 12 cidades <span className="gh-count">35</span></Link></li>
                                            </ul>
                                        </div>
                                        <div className="gh-mega-section">
                                            <ul>
                                                <li><Link href="#">› Lançamento <span className="gh-count">134</span></Link></li>
                                                <li><Link href="#">› Em Construção <span className="gh-count">465</span></Link></li>
                                                <li><Link href="#">› Pronto para morar <span className="gh-count">733</span></Link></li>
                                            </ul>
                                        </div>
                                        <div className="gh-mega-section">
                                            <ul>
                                                <li><Link href="#">› Frente para o mar <span className="gh-count">190</span></Link></li>
                                                <li><Link href="#">› Quadra do Mar <span className="gh-count">123</span></Link></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>

                        {/* ALUGUEL */}
                        <li className="gh-menu-item">
                            <span className="gh-menu-label">ALUGUEL ▾</span>
                            <div className="gh-dropdown gh-dropdown-narrow">
                                <Link href="#" style={{ fontWeight: 700, borderBottom: '1px solid #f0f0f0' }}>📅 ALUGUEL ANUAL <span className="gh-count" style={{ marginLeft: 'auto' }}>4</span></Link>
                                <Link href="#">› Imóveis Comerciais <span className="gh-count" style={{ marginLeft: 'auto' }}>4</span></Link>
                            </div>
                        </li>

                        {/* NOTÍCIAS */}
                        <li className="gh-menu-item">
                            <span className="gh-menu-label">NOTÍCIAS ▾</span>
                            <div className="gh-dropdown gh-media-dropdown right-aligned">
                                <Link href="#" className="gh-media-item">
                                    <img src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png" className="gh-media-img" alt="News" />
                                    <span className="gh-media-text">A festa que parou a Praia Brava na última sexta-feira</span>
                                </Link>
                                <Link href="#" className="gh-media-item">
                                    <img src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png" className="gh-media-img" alt="News" />
                                    <span className="gh-media-text">Corretor de Imóveis em Balneário Camboriú Guilherme Pilger conquista seu segundo Best Seller</span>
                                </Link>
                                <Link href="#" className="gh-media-item">
                                    <img src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png" className="gh-media-img" alt="News" />
                                    <span className="gh-media-text">Memorare Apartments: O Futuro da Exclusividade no Centro da Cidade</span>
                                </Link>
                                <div className="gh-media-footer">
                                    <Link href="/noticias">📰 mais notícias</Link>
                                </div>
                            </div>
                        </li>

                        {/* BLOG */}
                        <li className="gh-menu-item">
                            <span className="gh-menu-label">BLOG ▾</span>
                            <div className="gh-dropdown gh-media-dropdown right-aligned">
                                <Link href="#" className="gh-media-item">
                                    <img src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png" className="gh-media-img" alt="Blog" />
                                    <span className="gh-media-text">Matéria do site LORENA destaca Guilherme Pilger como referência no mercado imobiliário de luxo</span>
                                </Link>
                                <Link href="#" className="gh-media-item">
                                    <img src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png" className="gh-media-img" alt="Blog" />
                                    <span className="gh-media-text">Um dia que entra para a história: Itapema inaugura o Píer O Porto, seu novo cartão-postal</span>
                                </Link>
                                <Link href="#" className="gh-media-item">
                                    <img src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png" className="gh-media-img" alt="Blog" />
                                    <span className="gh-media-text">Hard Rock Cafe sobre as águas: o novo marco do litoral catarinense</span>
                                </Link>
                                <div className="gh-media-footer">
                                    <Link href="/blog">↗ Ver Mais</Link>
                                </div>
                            </div>
                        </li>

                        {/* CONTATO */}
                        <li className="gh-menu-item">
                            <Link href="/contato" className="gh-menu-label">CONTATO</Link>
                        </li>

                        {/* SEARCH */}
                        <li className="gh-menu-item" ref={searchRef}>
                            <div className="gh-search-trigger" onClick={() => setSearchOpen(!searchOpen)}>
                                <Search size={18} color="#333" />
                            </div>
                            {searchOpen && (
                                <div className="gh-search-panel">
                                    <h4>Pesquisa rápida</h4>
                                    <form className="gh-search-form" action="/busca" method="get">
                                        <input type="text" name="q" placeholder="Digite uma cidade, bairro ou código..." autoFocus />
                                        <button type="submit">Buscar</button>
                                    </form>
                                </div>
                            )}
                        </li>
                    </ul>

                    {/* Mobile Burger */}
                    <button className="gh-burger" onClick={() => setMobileMenuOpen(true)}>
                        <Menu size={28} color="#333" />
                    </button>
                </div>
            </header>

            {/* === MOBILE MENU === */}
            {mobileMenuOpen && (
                <div className="gh-mobile-overlay" onClick={() => setMobileMenuOpen(false)}>
                    <div className="gh-mobile-panel" onClick={e => e.stopPropagation()}>
                        <div className="gh-mobile-header">
                            <span>MENU</span>
                            <button onClick={() => setMobileMenuOpen(false)}>
                                <X size={24} color="#666" />
                            </button>
                        </div>
                        <div className="gh-mobile-links">
                            <Link href="/" onClick={() => setMobileMenuOpen(false)}>HOME</Link>

                            <button onClick={() => toggleAccordion('imobiliaria')}>
                                A IMOBILIÁRIA <span>{openAccordion === 'imobiliaria' ? '▴' : '▾'}</span>
                            </button>
                            {openAccordion === 'imobiliaria' && (
                                <div className="gh-mobile-sub">
                                    <Link href="#" onClick={() => setMobileMenuOpen(false)}>Imobiliária em Balneário Camboriú</Link>
                                    <Link href="#" onClick={() => setMobileMenuOpen(false)}>Consultoria Imobiliária Personalizada</Link>
                                </div>
                            )}

                            <button onClick={() => toggleAccordion('vendas')}>
                                VENDAS <span>{openAccordion === 'vendas' ? '▴' : '▾'}</span>
                            </button>
                            {openAccordion === 'vendas' && (
                                <div className="gh-mobile-sub">
                                    <Link href="/busca?q=apartamento" onClick={() => setMobileMenuOpen(false)}>Apartamentos</Link>
                                    <Link href="/busca?q=casa" onClick={() => setMobileMenuOpen(false)}>Casas</Link>
                                    <Link href="/busca?q=terreno" onClick={() => setMobileMenuOpen(false)}>Terrenos</Link>
                                    <Link href="/busca?q=comercial" onClick={() => setMobileMenuOpen(false)}>Comerciais</Link>
                                    <Link href="/busca" className="gh-accent" onClick={() => setMobileMenuOpen(false)}>Busca Avançada</Link>
                                </div>
                            )}

                            <button onClick={() => toggleAccordion('aluguel')}>
                                ALUGUEL <span>{openAccordion === 'aluguel' ? '▴' : '▾'}</span>
                            </button>
                            {openAccordion === 'aluguel' && (
                                <div className="gh-mobile-sub">
                                    <Link href="#" onClick={() => setMobileMenuOpen(false)}>Aluguel Anual</Link>
                                    <Link href="#" onClick={() => setMobileMenuOpen(false)}>Imóveis Comerciais</Link>
                                </div>
                            )}

                            <Link href="#" onClick={() => setMobileMenuOpen(false)}>NOTÍCIAS</Link>
                            <Link href="#" onClick={() => setMobileMenuOpen(false)}>BLOG</Link>
                            <Link href="/contato" onClick={() => setMobileMenuOpen(false)}>CONTATO</Link>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
