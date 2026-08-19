'use client'

import Image from 'next/image'

const GUILHERME_2023_IMAGE =
    'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/guilherme2023.png'

export default function AboutGuilhermeSection() {
    return (
        <section id="sobre-guilherme" className="about-section" aria-labelledby="about-guilherme-title">
            <div className="about-inner">
                <div className="about-visual" aria-label="Guilherme Pilger corretor de imóveis">
                    <Image
                        src={GUILHERME_2023_IMAGE}
                        alt="Guilherme Pilger corretor de imóveis"
                        className="about-signature-photo"
                        width={780}
                        height={366}
                        sizes="(max-width: 760px) calc(100vw - 44px), 640px"
                        quality={88}
                        loading="lazy"
                        unoptimized
                    />
                </div>

                <div className="about-copy">
                    <h2 id="about-guilherme-title">
                        Uma forma irreverente de apresentar os melhores imóveis do litoral Catarinense.
                    </h2>
                    <p className="about-lead">
                        <strong>Guilherme Pilger</strong> está entre os principais players do mercado imobiliário
                        brasileiro. Eleito pelo CRECI como um dos 3 melhores estrategistas na venda de imóveis,
                        Guilherme é um dos corretores com maior visibilidade do Sul do país com mais de 1 milhão de
                        visualizações mensais em suas redes sociais.
                    </p>
                    <p className="about-lead">
                        Como dono de uma das imobiliárias de Balneário Camboriú que mais crescem, a expertise de mercado
                        está entre as suas maiores habilidades, principalmente na venda de propriedades imobiliárias que
                        requerem atendimento especializado.
                    </p>
                </div>
            </div>

            <style jsx>{`
                .about-section {
                    position: relative;
                    margin-top: 32px;
                    overflow: hidden;
                    background:
                        linear-gradient(90deg, rgba(13, 13, 13, 0.94), rgba(20, 20, 20, 0.92)),
                        #171717;
                    color: #ffffff;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    box-sizing: border-box;
                }

                .about-section::before {
                    content: '';
                    position: absolute;
                    inset: -80px;
                    opacity: 0.28;
                    background-image:
                        linear-gradient(26deg, transparent 0 42%, rgba(255, 255, 255, 0.12) 42.4% 42.9%, transparent 43.3%),
                        linear-gradient(116deg, transparent 0 46%, rgba(255, 255, 255, 0.1) 46.4% 46.9%, transparent 47.3%),
                        linear-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.055) 1px, transparent 1px);
                    background-size: 560px 360px, 620px 420px, 72px 72px, 72px 72px;
                    transform: rotate(-6deg) scale(1.08);
                    pointer-events: none;
                }

                .about-section::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(circle at 44% 40%, rgba(255, 255, 255, 0.055), transparent 30%),
                        linear-gradient(90deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.32));
                    pointer-events: none;
                }

                .about-inner {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: minmax(420px, 0.98fr) minmax(420px, 0.82fr);
                    gap: clamp(34px, 5vw, 74px);
                    align-items: center;
                    width: min(100%, 1390px);
                    margin: 0 auto;
                    padding: clamp(42px, 4.4vw, 56px) clamp(22px, 5vw, 62px);
                    box-sizing: border-box;
                }

                .about-visual {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 0;
                }

                :global(.about-signature-photo) {
                    display: block;
                    width: min(100%, 680px);
                    height: auto;
                    max-width: 100%;
                    object-fit: contain;
                    filter: drop-shadow(0 22px 42px rgba(0, 0, 0, 0.26));
                }

                .about-copy {
                    min-width: 0;
                    max-width: 560px;
                }

                .about-copy h2 {
                    margin: 0;
                    color: #ffffff;
                    font-family: var(--font-sans), Inter, sans-serif;
                    font-size: clamp(1.34rem, 1.55vw, 1.62rem);
                    font-weight: 850;
                    letter-spacing: 0;
                    line-height: 1.32;
                }

                .about-lead {
                    margin: 20px 0 0;
                    color: rgba(255, 255, 255, 0.9);
                    font-size: clamp(0.86rem, 0.9vw, 0.94rem);
                    font-weight: 520;
                    line-height: 1.68;
                    text-align: left;
                }

                .about-lead + .about-lead {
                    margin-top: 20px;
                }

                .about-lead strong {
                    color: #ffffff;
                    font-weight: 900;
                }

                @media (max-width: 1060px) {
                    .about-inner {
                        grid-template-columns: 1fr;
                        gap: 26px;
                        max-width: 760px;
                    }

                    .about-copy {
                        max-width: 100%;
                    }
                }

                @media (max-width: 760px) {
                    .about-section {
                        margin-top: 24px;
                    }

                    .about-inner {
                        gap: 18px;
                        width: 100%;
                        padding: 24px 16px 38px;
                    }

                    .about-visual {
                        justify-content: center;
                    }

                    :global(.about-signature-photo) {
                        width: min(100%, 320px);
                    }

                    .about-copy h2 {
                        font-size: clamp(1.18rem, 5vw, 1.42rem);
                        line-height: 1.24;
                    }

                    .about-lead {
                        margin-top: 14px;
                        font-size: 0.82rem;
                        line-height: 1.5;
                    }

                    .about-lead + .about-lead {
                        margin-top: 12px;
                    }
                }

                @media (max-width: 420px) {
                    .about-inner {
                        padding-left: 16px;
                        padding-right: 16px;
                    }

                    .about-lead {
                        text-align: left;
                    }
                }
            `}</style>
        </section>
    )
}
