'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Award, BadgeCheck, Eye, Search, Sparkles } from 'lucide-react'

const authorityStats = [
    {
        icon: Eye,
        value: '1M+',
        label: 'visualizações mensais',
    },
    {
        icon: Award,
        value: 'Top 3',
        label: 'estrategistas CRECI',
    },
    {
        icon: Sparkles,
        value: '2008',
        label: 'mercado imobiliário',
    },
]

export default function AboutGuilhermeSection() {
    return (
        <section id="sobre-guilherme" className="about-section" aria-labelledby="about-guilherme-title">
            <div className="about-inner">
                <div className="about-media" aria-label="Guilherme Pilger em destaque">
                    <Image
                        src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png"
                        alt="Guilherme Pilger"
                        className="about-photo"
                        fill
                        sizes="(max-width: 760px) 560px, 720px"
                        quality={88}
                        loading="lazy"
                        style={{
                            objectFit: 'cover',
                            objectPosition: '50% 38%',
                            transform: 'scale(var(--about-photo-scale, 1.34)) translateY(var(--about-photo-shift-y, 0px))',
                            transformOrigin: '50% var(--about-photo-origin-y, 38%)',
                            filter: 'saturate(1.04) contrast(1.03)',
                        }}
                    />
                    <div className="about-nameplate">
                        <strong>Guilherme Pilger</strong>
                        <span>CRECI/SC 6772-J</span>
                    </div>
                </div>

                <div className="about-copy">
                    <span className="about-kicker">Sobre o Guilherme</span>
                    <h2 id="about-guilherme-title">Curadoria imobiliária com presença de mercado.</h2>
                    <p className="about-lead">
                        Guilherme Pilger une audiência, leitura local e atendimento consultivo para selecionar imóveis
                        de alto padrão com clareza de preço, liquidez e desejo.
                    </p>

                    <div className="about-stats" aria-label="Indicadores de autoridade de Guilherme Pilger">
                        {authorityStats.map(({ icon: Icon, value, label }) => (
                            <div className="about-stat" key={label}>
                                <Icon size={15} aria-hidden="true" />
                                <strong>{value}</strong>
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="about-insight">
                        <BadgeCheck size={17} aria-hidden="true" />
                        <p>
                            <strong>Mais que vitrine.</strong> Cada seleção precisa fazer sentido para quem busca
                            patrimônio, estilo de vida e uma decisão bem acompanhada.
                        </p>
                    </div>

                    <div className="about-actions">
                        <Link href="/busca" className="about-primary">
                            <Search size={15} aria-hidden="true" />
                            Ver curadoria
                        </Link>
                        <Link href="/sobre" className="about-secondary">
                            Conhecer trajetória
                            <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .about-section {
                    position: relative;
                    margin-top: 30px;
                    overflow: hidden;
                    background:
                        linear-gradient(105deg, #181613 0%, #211f1a 48%, #171511 100%),
                        #1c1a16;
                    color: #fff8ea;
                    border-top: 1px solid rgba(216, 185, 121, 0.14);
                    border-bottom: 1px solid rgba(216, 185, 121, 0.12);
                    box-sizing: border-box;
                }
                .about-section::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(90deg, rgba(255, 248, 234, 0.045), rgba(255, 248, 234, 0) 32%),
                        linear-gradient(180deg, rgba(216, 185, 121, 0.09), rgba(216, 185, 121, 0) 36%);
                    pointer-events: none;
                }
                .about-inner {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
                    gap: clamp(24px, 4vw, 56px);
                    align-items: center;
                    width: min(100%, 1320px);
                    margin: 0 auto;
                    padding: clamp(22px, 3vw, 32px) clamp(18px, 5vw, 62px);
                    box-sizing: border-box;
                }
                .about-media {
                    position: relative;
                    display: flex;
                    --about-photo-scale: 1.34;
                    --about-photo-shift-y: 0px;
                    --about-photo-origin-y: 38%;
                    height: 260px;
                    min-height: 0;
                    align-items: flex-end;
                    justify-content: center;
                    overflow: hidden;
                    border: 1px solid rgba(216, 185, 121, 0.18);
                    border-radius: 8px;
                    background:
                        linear-gradient(180deg, rgba(255, 248, 234, 0.04), rgba(255, 248, 234, 0.015)),
                        rgba(7, 6, 5, 0.2);
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
                }
                .about-media::after {
                    content: '';
                    position: absolute;
                    left: 18px;
                    right: 18px;
                    bottom: 0;
                    height: 1px;
                    background: linear-gradient(
                        90deg,
                        rgba(216, 185, 121, 0),
                        rgba(216, 185, 121, 0.78),
                        rgba(216, 185, 121, 0)
                    );
                }
                :global(.about-photo) {
                    z-index: 1;
                }
                .about-nameplate {
                    position: absolute;
                    right: 12px;
                    bottom: 12px;
                    z-index: 2;
                    display: grid;
                    gap: 2px;
                    max-width: 178px;
                    padding: 9px 10px;
                    border: 1px solid rgba(216, 185, 121, 0.25);
                    border-radius: 8px;
                    background: rgba(17, 15, 12, 0.84);
                    color: #fff8ea;
                    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.22);
                    box-sizing: border-box;
                }
                .about-nameplate strong {
                    font-size: 0.78rem;
                    line-height: 1.1;
                }
                .about-nameplate span {
                    color: rgba(255, 248, 234, 0.62);
                    font-size: 0.62rem;
                    font-weight: 800;
                    line-height: 1.1;
                    text-transform: uppercase;
                }
                .about-copy {
                    min-width: 0;
                    max-width: 780px;
                    box-sizing: border-box;
                }
                .about-kicker {
                    display: inline-flex;
                    margin-bottom: 8px;
                    color: #d8b979;
                    font: 900 0.68rem/1 var(--font-sans), Inter, sans-serif;
                    letter-spacing: 0;
                    text-transform: uppercase;
                }
                .about-copy h2 {
                    max-width: 720px;
                    margin: 0;
                    color: #fff8ea;
                    font-family: var(--font-serif), 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.7rem, 2.4vw, 2.85rem);
                    font-weight: 700;
                    letter-spacing: 0;
                    line-height: 1.04;
                }
                .about-lead {
                    max-width: 700px;
                    margin: 12px 0 0;
                    color: rgba(255, 248, 234, 0.72);
                    font-size: 0.92rem;
                    font-weight: 520;
                    line-height: 1.58;
                }
                .about-stats {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                    max-width: 690px;
                    margin-top: 16px;
                }
                .about-stat {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    grid-template-areas:
                        'icon value'
                        'icon label';
                    align-items: center;
                    column-gap: 8px;
                    min-height: 58px;
                    padding: 10px 12px;
                    border: 1px solid rgba(216, 185, 121, 0.18);
                    border-radius: 8px;
                    background: rgba(255, 248, 234, 0.055);
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
                    box-sizing: border-box;
                }
                .about-stat svg {
                    grid-area: icon;
                    color: #d8b979;
                }
                .about-stat strong {
                    grid-area: value;
                    color: #fff8ea;
                    font-family: var(--font-serif), 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.08rem, 1.35vw, 1.46rem);
                    line-height: 1;
                }
                .about-stat span {
                    grid-area: label;
                    color: rgba(255, 248, 234, 0.62);
                    font-size: 0.58rem;
                    font-weight: 820;
                    line-height: 1.18;
                    text-transform: uppercase;
                }
                .about-insight {
                    display: flex;
                    gap: 9px;
                    align-items: flex-start;
                    max-width: 690px;
                    margin-top: 12px;
                    padding: 11px 12px;
                    border-left: 3px solid #d8b979;
                    border-radius: 0 8px 8px 0;
                    background: rgba(255, 248, 234, 0.055);
                    box-sizing: border-box;
                }
                .about-insight svg {
                    flex: 0 0 auto;
                    margin-top: 2px;
                    color: #d8b979;
                }
                .about-insight p {
                    margin: 0;
                    color: rgba(255, 248, 234, 0.75);
                    font-size: 0.84rem;
                    line-height: 1.48;
                }
                .about-insight strong {
                    color: #fff8ea;
                }
                .about-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 9px;
                    margin-top: 14px;
                }
                :global(.about-primary),
                :global(.about-secondary) {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    min-height: 38px;
                    padding: 0 14px;
                    border-radius: 999px;
                    font-size: 0.66rem;
                    font-weight: 950;
                    line-height: 1;
                    text-decoration: none;
                    text-transform: uppercase;
                    box-sizing: border-box;
                    transition:
                        transform 160ms ease,
                        box-shadow 160ms ease,
                        border-color 160ms ease,
                        background 160ms ease;
                }
                :global(.about-primary) {
                    background: linear-gradient(135deg, #f1d493, #c99a4e);
                    color: #19130b;
                    box-shadow: 0 12px 24px rgba(201, 154, 78, 0.22);
                }
                :global(.about-secondary) {
                    border: 1px solid rgba(255, 248, 234, 0.18);
                    background: rgba(255, 248, 234, 0.055);
                    color: #fff8ea;
                }
                :global(.about-primary:hover),
                :global(.about-secondary:hover) {
                    transform: translateY(-1px);
                }
                :global(.about-primary:hover) {
                    box-shadow: 0 16px 30px rgba(201, 154, 78, 0.3);
                }
                :global(.about-secondary:hover) {
                    border-color: rgba(216, 185, 121, 0.34);
                    background: rgba(255, 248, 234, 0.085);
                }
                @media (max-width: 980px) {
                    .about-inner {
                        grid-template-columns: minmax(190px, 240px) minmax(0, 1fr);
                        gap: 22px;
                    }
                    .about-media {
                        height: 225px;
                    }
                    .about-stats {
                        grid-template-columns: 1fr;
                    }
                    .about-stat {
                        min-height: 52px;
                    }
                }
                @media (max-width: 760px) {
                    .about-section {
                        margin-top: 24px;
                        width: 100%;
                        max-width: 100vw;
                    }
                    .about-inner {
                        grid-template-columns: 1fr;
                        gap: 18px;
                        width: min(100vw, 390px);
                        max-width: 390px;
                        margin: 0;
                        padding: 24px 18px 28px;
                        overflow: hidden;
                    }
                    .about-media {
                        --about-photo-scale: 1.16;
                        --about-photo-shift-y: 18px;
                        --about-photo-origin-y: 30%;
                        justify-self: center;
                        width: min(320px, calc(100vw - 36px));
                        max-width: calc(100vw - 36px);
                        height: 220px;
                        margin: 0 auto;
                    }
                    .about-nameplate {
                        right: 10px;
                        bottom: 10px;
                    }
                    .about-copy {
                        width: 100%;
                        max-width: none;
                        min-width: 0;
                    }
                    .about-copy h2 {
                        max-width: 100%;
                        font-size: clamp(1.42rem, 6.4vw, 1.85rem);
                        overflow-wrap: anywhere;
                    }
                    .about-lead {
                        max-width: 100%;
                        font-size: 0.88rem;
                        overflow-wrap: anywhere;
                    }
                    .about-stats,
                    .about-insight,
                    .about-actions {
                        width: 100%;
                        max-width: 100%;
                    }
                    .about-actions {
                        display: grid;
                    }
                    :global(.about-primary),
                    :global(.about-secondary) {
                        width: 100%;
                    }
                }
            `}</style>
        </section>
    )
}
