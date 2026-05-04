'use client'

export default function AboutGuilhermeSection() {
    return (
        <section className="about-section">
            <div className="about-inner">
                {/* Left: Signature watermark + name block */}
                <div className="about-col about-col-left">
                    <div className="watermark-wrap">
                        <span className="watermark">Guilherme Pilger</span>
                    </div>
                    <h3 className="brand-name">GUILHERME PILGER</h3>
                    <p className="brand-role">Corretor de Imóveis</p>
                </div>

                {/* Center: Photo */}
                <div className="about-col about-col-center">
                    <img
                        src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png"
                        alt="Guilherme Pilger"
                        className="about-photo"
                    />
                </div>

                {/* Right: Bio */}
                <div className="about-col about-col-right">
                    <h4 className="bio-title">
                        Uma forma irreverente de apresentar os melhores imóveis do litoral Catarinense
                    </h4>
                    <p className="bio-body">
                        <strong>Guilherme Pilger</strong> está entre os principais players do mercado
                        imobiliário brasileiro. Eleito pelo CRECI como um dos 3 melhores estrategistas
                        na venda de imóveis, Guilherme é um dos corretores com maior visibilidade
                        do Sul do país com mais de 1 milhão de visualizações mensais em suas redes sociais.
                    </p>
                    <p className="bio-body">
                        Como dono de uma das imobiliárias de Balneário Camboriú que mais crescem,
                        a expertise de mercado está entre as suas maiores habilidades, principalmente
                        na venda de propriedades imobiliárias que requerem atendimento especializado.
                    </p>
                </div>
            </div>

            <style jsx>{`
                .about-section {
                    background-color: #1a1a1a;
                    background-image:
                        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
                    background-size: 60px 60px;
                    color: #fff;
                    margin-top: 40px;
                    overflow: hidden;
                }

                /* ---- MOBILE (default, stacked) ---- */
                .about-inner {
                    max-width: 1200px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 48px 24px 0;
                }

                .about-col-left {
                    text-align: center;
                    position: relative;
                    margin-bottom: 8px;
                }
                .watermark-wrap {
                    position: relative;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: visible;
                }
                .watermark {
                    font-family: 'Great Vibes', 'Dancing Script', cursive;
                    font-size: 4rem;
                    color: rgba(255,255,255,0.08);
                    white-space: nowrap;
                    transform: rotate(-4deg);
                    position: absolute;
                }
                .brand-name {
                    font-family: 'Inter', sans-serif;
                    font-size: 1.3rem;
                    font-weight: 700;
                    letter-spacing: 3px;
                    margin: 0;
                }
                .brand-role {
                    font-family: 'Inter', sans-serif;
                    font-size: 0.85rem;
                    color: #b8945f;
                    font-weight: 400;
                    font-style: italic;
                    margin: 4px 0 0;
                    letter-spacing: 0.5px;
                }

                .about-col-center {
                    display: flex;
                    justify-content: center;
                    align-items: flex-end;
                }
                .about-photo {
                    width: 280px;
                    height: auto;
                    object-fit: contain;
                    display: block;
                    filter: drop-shadow(0 8px 20px rgba(0,0,0,0.6));
                }

                .about-col-right {
                    text-align: center;
                    padding: 24px 0 48px;
                }
                .bio-title {
                    font-family: 'Inter', sans-serif;
                    font-size: 1.1rem;
                    font-weight: 700;
                    line-height: 1.5;
                    margin: 0 0 16px;
                }
                .bio-body {
                    font-family: 'Inter', sans-serif;
                    font-size: 0.85rem;
                    line-height: 1.7;
                    color: #bbb;
                    margin: 0 0 12px;
                }
                .bio-body:last-child {
                    margin-bottom: 0;
                }

                /* ---- DESKTOP (3-column side-by-side) ---- */
                @media (min-width: 900px) {
                    .about-inner {
                        flex-direction: row;
                        align-items: stretch;
                        padding: 0;
                        gap: 0;
                    }

                    .about-col-left {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        padding: 40px 20px;
                        margin-bottom: 0;
                    }
                    .watermark-wrap {
                        height: 80px;
                    }
                    .watermark {
                        font-size: 5.5rem;
                    }
                    .brand-name {
                        font-size: 1.4rem;
                    }

                    .about-col-center {
                        flex: 0 0 280px;
                        align-self: flex-end;
                    }
                    .about-photo {
                        width: 280px;
                    }

                    .about-col-right {
                        flex: 1.2;
                        text-align: left;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        padding: 40px 40px 40px 30px;
                    }
                    .bio-title {
                        font-size: 1.15rem;
                    }
                    .bio-body {
                        font-size: 0.82rem;
                    }
                }

                @media (min-width: 1200px) {
                    .about-col-center {
                        flex: 0 0 340px;
                    }
                    .about-photo {
                        width: 340px;
                    }
                    .watermark {
                        font-size: 7rem;
                    }
                    .brand-name {
                        font-size: 1.6rem;
                    }
                }
            `}</style>
        </section>
    )
}
