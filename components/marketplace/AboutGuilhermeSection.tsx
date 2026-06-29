'use client'

import Image from 'next/image'
import { BadgeCheck, Camera, Crown, TrendingUp } from 'lucide-react'

const AUTHORITY_BADGES = [
    { icon: Crown, label: 'Especialista em luxo' },
    { icon: Camera, label: 'Presença online' },
    { icon: TrendingUp, label: 'Leitura de mercado' },
    { icon: BadgeCheck, label: 'CRECI/SC 6772-J' },
]

export default function AboutGuilhermeSection() {
    return (
        <section id="sobre-guilherme" className="about-section">
            <div className="about-inner">
                <div className="about-media">
                    <Image
                        src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png"
                        alt="Guilherme Pilger"
                        className="about-photo"
                        width={1920}
                        height={1080}
                        sizes="(max-width: 860px) 146vw, 1144px"
                        quality={72}
                        loading="lazy"
                    />
                </div>

                <div className="about-copy">
                    <span className="about-kicker">Sobre o Guilherme</span>
                    <h2>Curadoria de alto padrão com visão de mercado.</h2>
                    <p className="about-lead">
                        Guilherme Pilger filtra oportunidades, lê o movimento do litoral e mostra
                        o que realmente faz sentido antes da visita.
                    </p>

                    <div className="about-quote">
                        Menos volume. Mais contexto para decidir com segurança.
                    </div>

                    <div className="about-badges">
                        {AUTHORITY_BADGES.map((badge) => {
                            const Icon = badge.icon
                            return (
                                <span key={badge.label}>
                                    <Icon size={14} />
                                    {badge.label}
                                </span>
                            )
                        })}
                    </div>

                </div>
            </div>

            <style jsx>{`
                .about-section {
                    position: relative;
                    margin-top: 44px;
                    overflow: hidden;
                    background:
                        radial-gradient(circle at 22% 10%, rgba(223,193,142,0.08), transparent 36%),
                        linear-gradient(135deg, #242321 0%, #222221 100%);
                    color: #fff8ea;
                }
                .about-section::before {
                    content: 'GUILHERME PILGER';
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    color: rgba(255,255,255,0.028);
                    font-family: 'Inter', sans-serif;
                    font-size: clamp(4rem, 16vw, 16rem);
                    font-weight: 950;
                    letter-spacing: 0.08em;
                    white-space: nowrap;
                    pointer-events: none;
                }
                .about-inner {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: minmax(879px, 1.08fr) minmax(0, 0.92fr);
                    gap: clamp(20px, 3vw, 42px);
                    align-items: center;
                    width: 100%;
                    max-width: 1820px;
                    margin: 0 auto;
                    padding: clamp(30px, 3.6vw, 52px) clamp(20px, 4vw, 44px) 0;
                }
                .about-media {
                    position: relative;
                    align-self: end;
                    min-height: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: visible;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none;
                    isolation: isolate;
                }
                .about-media::before,
                .about-media::after {
                    display: none;
                }
                :global(.about-photo) {
                    position: relative;
                    z-index: 1;
                    display: block;
                    width: min(104%, 1190px);
                    height: auto;
                    max-width: 104%;
                    max-height: clamp(845px, 72vw, 1294px);
                    object-fit: contain;
                    object-position: center bottom;
                    transform: none;
                    transform-origin: center center;
                    filter: saturate(0.98) contrast(1.03) drop-shadow(0 18px 30px rgba(0,0,0,0.2));
                }
                .about-copy {
                    min-width: 0;
                    width: 100%;
                    max-width: 650px;
                    overflow-wrap: anywhere;
                }
                .about-kicker {
                    display: inline-flex;
                    margin-bottom: 10px;
                    color: #d8b979;
                    font: 950 0.66rem/1 'Inter', sans-serif;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }
                .about-copy h2 {
                    margin: 0 0 12px;
                    color: #fff8ea;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.65rem, 2.65vw, 2.55rem);
                    font-weight: 700;
                    line-height: 1.02;
                    letter-spacing: 0;
                }
                .about-lead {
                    max-width: 610px;
                    margin: 0;
                    color: rgba(255,255,255,0.72);
                    font-size: clamp(0.82rem, 0.9vw, 0.9rem);
                    font-weight: 520;
                    line-height: 1.55;
                }
                .about-quote {
                    margin-top: 14px;
                    padding: 13px 16px;
                    max-width: 100%;
                    border-left: 3px solid #d8b979;
                    border-radius: 0 14px 14px 0;
                    background: rgba(255,255,255,0.045);
                    color: #f5ead4;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(0.9rem, 1.18vw, 1.04rem);
                    font-weight: 600;
                    line-height: 1.3;
                }
                .about-badges {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, max-content));
                    gap: 6px;
                    align-items: center;
                    margin-top: 14px;
                }
                .about-badges span {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    min-height: 24px;
                    padding: 0 8px;
                    border: 1px solid rgba(223,193,142,0.18);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.055);
                    color: #ead8b5;
                    font-size: 0.55rem;
                    font-weight: 900;
                    letter-spacing: 0.045em;
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                @media (max-width: 860px) {
                    .about-section {
                        overflow-x: hidden;
                    }
                    .about-inner {
                        grid-template-columns: 1fr;
                        gap: 18px;
                        width: 100%;
                        max-width: 100%;
                        padding: 28px 18px 44px;
                        overflow: hidden;
                    }
                    .about-media {
                        min-height: 0;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        overflow: visible;
                    }
                    :global(.about-photo) {
                        width: min(100%, 550px);
                        height: auto;
                        max-width: 100%;
                        max-height: 600px;
                        margin: 0 auto;
                        transform: scale(1.3);
                        transform-origin: center center;
                    }
                    .about-copy {
                        min-width: 0;
                        width: 100%;
                        max-width: 100%;
                        padding: 0;
                        overflow: hidden;
                    }
                    .about-copy h2 {
                        max-width: 100%;
                        font-size: clamp(1.55rem, 7vw, 2.05rem);
                        overflow-wrap: anywhere;
                    }
                    .about-lead,
                    .about-quote {
                        max-width: 100%;
                        overflow-wrap: anywhere;
                    }
                    .about-badges {
                        width: 100%;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 6px;
                    }
                    .about-badges span {
                        justify-content: center;
                        gap: 5px;
                        min-height: 25px;
                        padding: 0 7px;
                        font-size: 0.51rem;
                        letter-spacing: 0.035em;
                    }
                    .about-badges span :global(svg) {
                        display: block;
                        width: 11px;
                        height: 11px;
                        flex: 0 0 auto;
                    }
                }
                @media (min-width: 861px) and (max-width: 1180px) {
                    .about-inner {
                        grid-template-columns: minmax(709px, 0.98fr) minmax(0, 1.02fr);
                        max-width: 1480px;
                    }
                    :global(.about-photo) {
                        width: min(100%, 913px);
                        max-height: 946px;
                    }
                }
            `}</style>
        </section>
    )
}
