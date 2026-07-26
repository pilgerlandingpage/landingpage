'use client'

import React, { MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
    ArrowRight,
    BookOpen,
    BriefcaseBusiness,
    Check,
    CircleDollarSign,
    Compass,
    Layers,
    PenLine,
    Quote,
    ShieldCheck,
    Target,
    TrendingUp,
    Users,
} from 'lucide-react'
import LandingPageLogic from '@/components/landing/LandingPageLogic'
import { trackEvent } from '@/lib/tracking/client'
import {
    corretorNota8Content,
    corretorNota8Offer,
    corretorNota8ProfileAssessmentOffer,
    type ProductStat,
    type ProductTestimonial,
    type ProductTextItem,
} from '@/lib/products/corretor-nota-8-content'
import { TemplateProps } from './types'

type CheckoutPlacement = 'nav' | 'offer' | 'final'

const PRODUCT_HERO_BACKGROUND = '/images/products/corretor-nota-8-hero-bg-optimized.jpg'
const PRODUCT_HERO_PERSON = '/images/products/corretor-nota-8-guilherme-hero-optimized.jpg'
const PRODUCT_AUTHOR_IMAGE = '/images/products/corretor-nota-8-guilherme-author-optimized.jpg'

function record(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function text(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function ptBrText(value: string) {
    return value
        .replace(/\bMETODO\b/g, 'MÉTODO')
        .replace(/\bMetodo\b/g, 'Método')
        .replace(/\bmetodo\b/g, 'método')
        .replace(/\bBENEFICIOS\b/g, 'BENEFÍCIOS')
        .replace(/\bBeneficios\b/g, 'Benefícios')
        .replace(/\bbeneficio\b/g, 'benefício')
        .replace(/\bVOCE\b/g, 'VOCÊ')
        .replace(/\bvoce\b/g, 'você')
        .replace(/\bVoce\b/g, 'Você')
        .replace(/\bNAO\b/g, 'NÃO')
        .replace(/\bnao\b/g, 'não')
        .replace(/\bNao\b/g, 'Não')
        .replace(/\bPADRAO\b/g, 'PADRÃO')
        .replace(/\bpadrao\b/g, 'padrão')
        .replace(/\bPRECO\b/g, 'PREÇO')
        .replace(/\bpreco\b/g, 'preço')
        .replace(/\bCRITERIO\b/g, 'CRITÉRIO')
        .replace(/\bcriterio\b/g, 'critério')
        .replace(/\bcriterios\b/g, 'critérios')
        .replace(/\bsequencia\b/g, 'sequência')
        .replace(/\bpresenca\b/g, 'presença')
        .replace(/\burgencia\b/g, 'urgência')
        .replace(/\brepertorio\b/g, 'repertório')
        .replace(/\bseguranca\b/g, 'segurança')
        .replace(/\bregiao\b/g, 'região')
        .replace(/\bopcao\b/g, 'opção')
        .replace(/\bdiagnostico\b/g, 'diagnóstico')
        .replace(/\brecomendacao\b/g, 'recomendação')
        .replace(/\bproximos\b/g, 'próximos')
        .replace(/\bmotivacao\b/g, 'motivação')
        .replace(/\bDIRECAO\b/g, 'DIREÇÃO')
        .replace(/\bDirecao\b/g, 'Direção')
        .replace(/\bEXECUCAO\b/g, 'EXECUÇÃO')
        .replace(/\bExecucao\b/g, 'Execução')
        .replace(/\bexecucao\b/g, 'execução')
        .replace(/\bcomunicacao\b/g, 'comunicação')
        .replace(/\bReputacao\b/g, 'Reputação')
        .replace(/\bConteudo\b/g, 'Conteúdo')
        .replace(/\bconteudo\b/g, 'conteúdo')
        .replace(/\bimobiliario\b/g, 'imobiliário')
        .replace(/\bautoavaliacao\b/g, 'autoavaliação')
        .replace(/\bRaciocinio\b/g, 'Raciocínio')
        .replace(/\bPrincipios\b/g, 'Princípios')
        .replace(/\bprincipios\b/g, 'princípios')
        .replace(/\bpratico\b/g, 'prático')
        .replace(/\bconstancia\b/g, 'constância')
        .replace(/\brelacoes\b/g, 'relações')
        .replace(/\bfisico\b/g, 'físico')
        .replace(/\bTambem\b/g, 'Também')
        .replace(/\bcomecando\b/g, 'começando')
        .replace(/\batuacao\b/g, 'atuação')
        .replace(/\baplicavel\b/g, 'aplicável')
        .replace(/\bformulas\b/g, 'fórmulas')
        .replace(/\bprofissao\b/g, 'profissão')
        .replace(/\bPROXIMO\b/g, 'PRÓXIMO')
        .replace(/\bProximo\b/g, 'Próximo')
        .replace(/\bpossivel\b/g, 'possível')
        .replace(/\bPAGINA\b/g, 'PÁGINA')
        .replace(/\bPagina\b/g, 'Página')
        .replace(/\bpagina\b/g, 'página')
        .replace(/\bIMOVEIS\b/g, 'IMÓVEIS')
        .replace(/\bimoveis\b/g, 'imóveis')
        .replace(/\bIMOVEL\b/g, 'IMÓVEL')
        .replace(/\bimovel\b/g, 'imóvel')
        .replace(/\bDescricao\b/g, 'Descrição')
        .replace(/\bdescricao\b/g, 'descrição')
        .replace(/\bConheca\b/g, 'Conheça')
        .replace(/\bconfira este imóvel\b/g, 'Confira este imóvel')
        .replace(/\bPara quem e\b/g, 'Para quem é')
        .replace(/\bO produto e\b/g, 'O produto é')
        .replace(/\bA proposta e\b/g, 'A proposta é')
        .replace(/\bproposta e\b/g, 'proposta é')
        .replace(/\bformato confirmado para esta oferta e\b/g, 'formato confirmado para esta oferta é')
        .replace(/\bpreço oficial confirmado e\b/g, 'preço oficial confirmado é')
        .replace(/\besta abaixo\b/g, 'está abaixo')
        .replace(/\besta começando\b/g, 'está começando')
}

function commercialText(value: unknown, fallback = '') {
    const cleaned = text(value)
    if (!cleaned || /^consulte/i.test(cleaned)) return fallback
    return cleaned
}

function isProfileAssessmentOfferParam(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '') === corretorNota8ProfileAssessmentOffer.source
}

function initialProfileAssessmentOfferActive() {
    if (typeof window === 'undefined') return false

    const params = new URLSearchParams(window.location.search)
    const offer = params.get('oferta') || params.get('offer') || params.get('campanha') || params.get('campaign') || ''
    return isProfileAssessmentOfferParam(offer)
}

function formatCurrencyCents(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Math.max(0, cents) / 100)
}

function normalizeTextItems(value: unknown, fallback: ProductTextItem[]) {
    if (!Array.isArray(value)) return fallback

    const items = value
        .map(item => {
            if (typeof item === 'string') return { title: ptBrText(text(item)), description: '' }
            const itemRecord = record(item)
            return {
                title: ptBrText(text(itemRecord.title ?? itemRecord.question ?? itemRecord.name)),
                description: ptBrText(text(itemRecord.description ?? itemRecord.answer ?? itemRecord.body)),
            }
        })
        .filter(item => item.title || item.description)

    if (!items.length) return fallback
    if (fallback.length && items.every(item => !item.description)) return fallback
    return items
}

function normalizeOptionalTestimonials(value: unknown): ProductTestimonial[] {
    if (!Array.isArray(value)) return []

    return value
        .map(item => {
            const itemRecord = record(item)
            return {
                quote: ptBrText(text(itemRecord.quote ?? itemRecord.text ?? itemRecord.description)),
                name: text(itemRecord.name ?? itemRecord.author),
                role: ptBrText(text(itemRecord.role ?? itemRecord.title)),
            }
        })
        .filter(item => item.quote && item.name)
}

function normalizeOptionalStats(value: unknown): ProductStat[] {
    if (!Array.isArray(value)) return []

    return value
        .map(item => {
            const itemRecord = record(item)
            return {
                value: text(itemRecord.value),
                label: ptBrText(text(itemRecord.label)),
            }
        })
        .filter(item => item.value && item.label)
}

function ProductCheckoutLink({
    href,
    slug,
    landingPageId,
    label,
    placement,
    className,
    children,
}: {
    href: string
    slug: string
    landingPageId: string
    label: string
    placement: CheckoutPlacement
    className: string
    children: React.ReactNode
}) {
    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
        void trackEvent('product_cta_clicked', {
            landing_page_slug: slug,
            landing_page_id: landingPageId,
            product: 'corretor-nota-8',
            cta_label: label,
            cta_position: placement,
            checkout_url: href || null,
        })

        if (!href) {
            event.preventDefault()
            document.getElementById('oferta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    return (
        <a className={className} href={href || '#oferta'} onClick={onClick}>
            {children}
        </a>
    )
}

function LandingHeader({
    productName,
    checkoutUrl,
    slug,
    landingPageId,
}: {
    productName: string
    checkoutUrl: string
    slug: string
    landingPageId: string
}) {
    return (
        <header className="product-sales-nav">
            <a className="product-sales-brand" href="#top" aria-label={productName}>
                <BookOpen size={19} />
                <span>{productName}</span>
            </a>
            <nav aria-label="Seções da página">
                <a href="#metodo">Método</a>
                <a href="#beneficios">Benefícios</a>
                <a href="#conteudo">O livro</a>
                <a href="#autor">Autor</a>
            </nav>
            <ProductCheckoutLink
                href={checkoutUrl}
                slug={slug}
                landingPageId={landingPageId}
                label="Ver oferta"
                placement="nav"
                className="product-sales-nav-cta"
            >
                <CircleDollarSign size={15} />
                <span>Oferta</span>
            </ProductCheckoutLink>
        </header>
    )
}

function HeroSection({
    productName,
    subtitle,
    description,
    coverImage,
    badge,
}: {
    productName: string
    subtitle: string
    description: string
    coverImage: string
    badge: string
}) {
    return (
        <section className="product-sales-hero" id="top">
            <img src={PRODUCT_HERO_BACKGROUND} alt="" aria-hidden="true" className="product-sales-hero-bg-image" />
            <img src={PRODUCT_HERO_PERSON} alt="" aria-hidden="true" className="product-sales-hero-person-image" />
            <div className="product-sales-hero-shade" aria-hidden="true" />
            <div className="product-sales-container product-sales-hero-grid">
                <div className="product-sales-copy">
                    <span className="product-sales-kicker">{badge}</span>
                    <p className="product-sales-offer-line">Método comercial para corretores de alto padrão</p>
                    <div className="product-sales-mobile-book" aria-hidden="true">
                        <div className="product-sales-book-stage">
                            <img src={coverImage} alt="" className="product-sales-book" />
                        </div>
                    </div>
                    <h1>{productName}</h1>
                    <p className="product-sales-subtitle">{subtitle}</p>
                    <p className="product-sales-description">{description}</p>
                    <div className="product-sales-actions">
                        <a className="product-sales-primary product-sales-hero-buy" href="#valor">
                            <span>Quero garantir meu exemplar</span>
                            <ArrowRight size={17} />
                        </a>
                        <a className="product-sales-secondary product-sales-method-cta" href="#metodo">
                            <span>Ver o método</span>
                            <ArrowRight size={17} />
                        </a>
                    </div>
                    <div className="product-sales-hero-proof" aria-label="Destaques do produto">
                        <span>Livro digital</span>
                        <span>Acesso imediato</span>
                        <span>Método Pilger</span>
                    </div>
                </div>

                <div className="product-sales-book-wrap" aria-label={`Capa do livro ${productName}`}>
                    <div className="product-sales-book-stage">
                        <img src={coverImage} alt={`Capa do livro ${productName}`} className="product-sales-book" />
                    </div>
                    <div className="product-sales-book-caption">
                        <span>Livro digital</span>
                        <strong>Para vender com mais critério</strong>
                    </div>
                </div>
            </div>
        </section>
    )
}

function TrustStrip({ items }: { items: string[] }) {
    return (
        <section className="product-sales-trust-strip" aria-label="Informações principais da oferta">
            <div className="product-sales-container">
                {items.map((item, index) => (
                    <div key={`${item}-${index}`}>
                        <Check size={16} />
                        <span>{item}</span>
                    </div>
                ))}
            </div>
        </section>
    )
}

function MethodSection({ items, coverImage }: { items: ProductTextItem[]; coverImage: string }) {
    const icons = [Compass, BriefcaseBusiness, ShieldCheck, Users, PenLine]
    const carouselRef = useRef<HTMLDivElement>(null)
    const [carouselPaused, setCarouselPaused] = useState(false)
    const methodImages = [PRODUCT_HERO_BACKGROUND, PRODUCT_HERO_PERSON, PRODUCT_AUTHOR_IMAGE, coverImage, PRODUCT_HERO_BACKGROUND]

    useEffect(() => {
        if (carouselPaused) return

        const carousel = carouselRef.current
        if (!carousel) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        const interval = window.setInterval(() => {
            if (!window.matchMedia('(max-width: 620px)').matches) return

            const maxScroll = carousel.scrollWidth - carousel.clientWidth
            if (maxScroll <= 0) return

            const nextScroll = carousel.scrollLeft + 1
            carousel.scrollLeft = nextScroll >= maxScroll - 1 ? 0 : nextScroll
        }, 28)

        return () => window.clearInterval(interval)
    }, [carouselPaused])

    return (
        <section className="product-sales-section product-sales-method" id="metodo">
            <div className="product-sales-container product-sales-section-head">
                <span className="product-sales-section-label">O que você vai aprender?</span>
                <h2>As 5 dimensões que elevam sua postura comercial.</h2>
            </div>

            <div
                className="product-sales-container product-sales-method-grid"
                ref={carouselRef}
                onClick={() => setCarouselPaused(true)}
                onPointerDown={() => setCarouselPaused(true)}
                onFocus={() => setCarouselPaused(true)}
            >
                {items.slice(0, 5).map((item, index) => {
                    const Icon = icons[index] || Check
                    const image = methodImages[index] || coverImage
                    return (
                        <article key={`${item.title}-${index}`}>
                            <div className="product-sales-method-thumb">
                                <img src={image} alt="" aria-hidden="true" />
                                <span>Etapa {String(index + 1).padStart(2, '0')}</span>
                            </div>
                            <div className="product-sales-method-body">
                                <Icon size={20} />
                                <h3>{item.title}</h3>
                                <p>{item.description}</p>
                            </div>
                        </article>
                    )
                })}
            </div>
        </section>
    )
}

function BenefitsSection({ items, coverImage }: { items: ProductTextItem[]; coverImage: string }) {
    const icons = [Target, Layers, TrendingUp]

    return (
        <section className="product-sales-section product-sales-learning" id="beneficios">
            <div className="product-sales-container product-sales-learning-grid">
                <div className="product-sales-learning-art">
                    <img src={coverImage} alt="Capa do livro Corretor Nota 8" />
                    <div className="product-sales-board" aria-hidden="true">
                        {Array.from({ length: 16 }).map((_, index) => <span key={index} />)}
                    </div>
                </div>
                <div className="product-sales-learning-copy">
                    <span className="product-sales-section-label">O que você vai aprender</span>
                    <h2>O benefício não é decorar frases. É pensar como um corretor mais estratégico.</h2>
                    <div className="product-sales-benefit-list">
                        {items.map((item, index) => {
                            const Icon = icons[index] || Check
                            return (
                                <article key={`${item.title}-${index}`}>
                                    <span><Icon size={20} /></span>
                                    <div>
                                        <h3>{item.title}</h3>
                                        <p>{item.description}</p>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                </div>
            </div>
        </section>
    )
}

function ProblemSection({ items }: { items: ProductTextItem[] }) {
    return (
        <section className="product-sales-section product-sales-problem" id="problema">
            <div className="product-sales-container product-sales-editorial-grid">
                <div>
                    <span className="product-sales-section-label">Por que isso importa</span>
                    <h2>O alto padrão não perdoa uma atuação comum.</h2>
                </div>
                <p>
                    O Corretor Nota 8 organiza critério, postura, relacionamento, execução e disciplina para quem quer
                    deixar de depender apenas de improviso comercial.
                </p>
            </div>

            <div className="product-sales-container product-sales-problem-grid">
                {items.map((item, index) => (
                    <article key={`${item.title}-${index}`}>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                    </article>
                ))}
            </div>
        </section>
    )
}

function BookContentSection({ items }: { items: ProductTextItem[] }) {
    return (
        <section className="product-sales-section product-sales-content" id="conteudo">
            <div className="product-sales-container product-sales-book-content">
                <div>
                    <span className="product-sales-section-label">O que você recebe</span>
                    <h2>Um livro digital para consultar enquanto ajusta sua rotina comercial.</h2>
                    <p>
                        Conteúdo direto, aplicável e conectado ao dia a dia do corretor que quer elevar sua atuação sem
                        cair em fórmulas vazias.
                    </p>
                </div>
                <div className="product-sales-included-list">
                    {items.map((item, index) => (
                        <article key={`${item.title}-${index}`}>
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <div>
                                <h3>{item.title}</h3>
                                <p>{item.description}</p>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    )
}

function AuthorSection({
    author,
    authorBio,
    authorQuote,
    stats,
}: {
    author: string
    authorBio: string
    authorQuote: string
    stats: ProductStat[]
}) {
    return (
        <section className="product-sales-section product-sales-author" id="autor">
            <div className="product-sales-container product-sales-author-grid">
                <div className="product-sales-author-card">
                    <img src={PRODUCT_AUTHOR_IMAGE} alt="" aria-hidden="true" />
                    <Quote size={32} />
                    <p>{authorQuote}</p>
                </div>
                <div>
                    <span className="product-sales-section-label">Autor</span>
                    <h2>{author}</h2>
                    <p>{authorBio}</p>
                    {stats.length > 0 && (
                        <div className="product-sales-stats">
                            {stats.slice(0, 3).map(item => (
                                <div key={`${item.value}-${item.label}`}>
                                    <strong>{item.value}</strong>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

function TestimonialsSection({ testimonials }: { testimonials: ProductTestimonial[] }) {
    if (!testimonials.length) return null

    return (
        <section className="product-sales-section product-sales-testimonial-section" id="depoimentos">
            <div className="product-sales-container product-sales-testimonials">
                {testimonials.slice(0, 3).map((item, index) => (
                    <article key={`${item.name}-${index}`}>
                        <p>&ldquo;{item.quote}&rdquo;</p>
                        <div>
                            <span>{item.name.slice(0, 2).toUpperCase()}</span>
                            <div>
                                <strong>{item.name}</strong>
                                {item.role && <small>{item.role}</small>}
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    )
}

function OfferSection({
    price,
    profileAssessmentPrice,
    isProfileAssessmentOffer,
    checkoutUrl,
    slug,
    landingPageId,
}: {
    price: string
    profileAssessmentPrice: string
    isProfileAssessmentOffer: boolean
    checkoutUrl: string
    slug: string
    landingPageId: string
}) {
    return (
        <section className="product-sales-section product-sales-offer" id="oferta">
            <div className="product-sales-container product-sales-offer-grid">
                <div>
                    <span className="product-sales-section-label">Oferta</span>
                    <h2>Agora sim: garanta o Corretor Nota 8.</h2>
                    <p>
                        Leve o livro digital de Guilherme Pilger e use a metodologia Nota 8 para revisar posicionamento,
                        autoridade, relacionamento e disciplina comercial.
                    </p>
                </div>
                <aside className="product-sales-offer-box" aria-label="Resumo da oferta">
                    <span className="product-sales-offer-format">{corretorNota8Offer.format}</span>
                    <div className="product-sales-price-panel" id="valor">
                        {isProfileAssessmentOffer ? (
                            <>
                                <span>De</span>
                                <strong className="product-sales-price-original">{price}</strong>
                                <span>Oferta especial apos voto validado</span>
                                <strong>{profileAssessmentPrice}</strong>
                                <small>Valor promocional direto no checkout.</small>
                            </>
                        ) : (
                            <>
                                <span>Investimento</span>
                                <strong>{price}</strong>
                            </>
                        )}
                    </div>
                    <ul>
                        <li><Check size={16} /> Livro digital Corretor Nota 8</li>
                        <li><Check size={16} /> Produto de Guilherme Pilger</li>
                        <li><Check size={16} /> Método para autoavaliação comercial</li>
                    </ul>
                    <ProductCheckoutLink
                        href={checkoutUrl}
                        slug={slug}
                        landingPageId={landingPageId}
                        label={corretorNota8Offer.primaryCtaLabel}
                        placement="offer"
                        className="product-sales-primary product-sales-primary-full"
                    >
                        <span>{corretorNota8Offer.primaryCtaLabel}</span>
                        <ArrowRight size={17} />
                    </ProductCheckoutLink>
                </aside>
            </div>
        </section>
    )
}

function FaqSection({ items }: { items: ProductTextItem[] }) {
    return (
        <section className="product-sales-section product-sales-faq" id="faq">
            <div className="product-sales-container product-sales-faq-grid">
                <div>
                    <span className="product-sales-section-label">Perguntas frequentes</span>
                    <h2>Antes de garantir o seu exemplar.</h2>
                </div>
                <div className="product-sales-faq-list">
                    {items.slice(0, 7).map((item, index) => (
                        <article key={`${item.title}-${index}`}>
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    )
}

function FinalCtaSection({
    checkoutUrl,
    slug,
    landingPageId,
}: {
    checkoutUrl: string
    slug: string
    landingPageId: string
}) {
    return (
        <section className="product-sales-final">
            <div className="product-sales-container">
                <span className="product-sales-section-label">Próximo passo</span>
                <h2>Use o Nota 8 como ponto de virada na sua postura comercial.</h2>
                <p>
                    O livro foi feito para quem quer tratar a corretagem como profissão de método,
                    não como uma sequência de tentativas soltas.
                </p>
                <ProductCheckoutLink
                    href={checkoutUrl}
                    slug={slug}
                    landingPageId={landingPageId}
                    label={corretorNota8Offer.primaryCtaLabel}
                    placement="final"
                    className="product-sales-primary"
                >
                    <span>{corretorNota8Offer.primaryCtaLabel}</span>
                    <ArrowRight size={17} />
                </ProductCheckoutLink>
            </div>
        </section>
    )
}

function LandingFooter({ productName, author }: { productName: string; author: string }) {
    return (
        <footer className="product-sales-footer">
            <div className="product-sales-container">
                <strong>{productName}</strong>
                <span>Produto de {author}</span>
            </div>
        </footer>
    )
}

export default function ProductSalesTemplate({ data, content, slug, landingPageId, agentName, greetingMessage }: TemplateProps) {
    const product = record(content?.product)
    const checkoutUrl = text(product.checkout_url ?? content?.checkout_url, corretorNota8Offer.checkoutUrl)
    const [profileAssessmentOfferActive] = useState(initialProfileAssessmentOfferActive)
    const productName = ptBrText(text(product.name, data.title || corretorNota8Offer.productName))
    const subtitle = ptBrText(text(product.subtitle, corretorNota8Content.subtitle))
    const description = ptBrText(text(content?.custom_description ?? product.description ?? data.description, corretorNota8Content.description))
    const coverImage = text(product.cover_image ?? content?.custom_hero_image ?? data.heroImage, corretorNota8Content.coverImage)
    const price = commercialText(product.price ?? content?.custom_price ?? data.price, corretorNota8Offer.priceDisplay)
    const author = text(product.author, corretorNota8Offer.author)
    const badge = ptBrText(text(product.badge, corretorNota8Content.badge))
    const authorBio = ptBrText(text(product.author_bio ?? content?.author_bio, corretorNota8Content.authorBio))
    const authorQuote = ptBrText(text(product.author_quote ?? content?.author_quote, corretorNota8Content.authorQuote))

    const trustItems = useMemo(() => {
        const custom = Array.isArray(product.trust_items) ? product.trust_items.map(item => ptBrText(text(item))).filter(Boolean) : []
        return custom.length ? custom : corretorNota8Content.trustItems
    }, [product.trust_items])
    const problems = useMemo(() => normalizeTextItems(product.problems, corretorNota8Content.problems), [product.problems])
    const benefits = useMemo(() => normalizeTextItems(product.benefits ?? content?.custom_features, corretorNota8Content.benefits), [product.benefits, content?.custom_features])
    const dimensions = useMemo(() => normalizeTextItems(product.dimensions ?? product.modules, corretorNota8Content.dimensions), [product.dimensions, product.modules])
    const included = useMemo(() => normalizeTextItems(product.included ?? product.book_contents, corretorNota8Content.included), [product.included, product.book_contents])
    const testimonials = useMemo(() => normalizeOptionalTestimonials(product.testimonials), [product.testimonials])
    const faq = useMemo(() => normalizeTextItems(product.faq, corretorNota8Content.faq), [product.faq])
    const stats = useMemo(() => normalizeOptionalStats(product.stats), [product.stats])
    const profileAssessmentPrice = formatCurrencyCents(corretorNota8ProfileAssessmentOffer.priceInCents)
    const effectiveCheckoutUrl = useMemo(() => {
        const baseUrl = profileAssessmentOfferActive
            ? corretorNota8ProfileAssessmentOffer.checkoutUrl
            : checkoutUrl
        if (!baseUrl) return ''

        try {
            const url = new URL(baseUrl, window.location.origin)
            if (profileAssessmentOfferActive) {
                url.searchParams.set('origem', 'whatsapp-perfil-corretor')
                url.searchParams.set('oferta', corretorNota8ProfileAssessmentOffer.source)
            }
            return `${url.pathname}${url.search}${url.hash}`
        } catch {
            if (!profileAssessmentOfferActive) return baseUrl
            const separator = baseUrl.includes('?') ? '&' : '?'
            return `${baseUrl}${separator}origem=whatsapp-perfil-corretor&oferta=${encodeURIComponent(corretorNota8ProfileAssessmentOffer.source)}`
        }
    }, [checkoutUrl, profileAssessmentOfferActive])

    return (
        <main className="product-sales-page">
            <LandingPageLogic
                slug={slug}
                landingPageId={landingPageId}
                agentName={agentName}
                greetingMessage={greetingMessage}
                pageContext="product-sales"
            />

            <LandingHeader productName={productName} checkoutUrl={effectiveCheckoutUrl} slug={slug} landingPageId={landingPageId} />
            <HeroSection
                productName={productName}
                subtitle={subtitle}
                description={description}
                coverImage={coverImage}
                badge={badge}
            />
            <TrustStrip items={trustItems} />
            <MethodSection items={dimensions} coverImage={coverImage} />
            <BenefitsSection items={benefits} coverImage={coverImage} />
            <ProblemSection items={problems} />
            <BookContentSection items={included} />
            <AuthorSection author={author} authorBio={authorBio} authorQuote={authorQuote} stats={stats} />
            <TestimonialsSection testimonials={testimonials} />
            <OfferSection
                price={price}
                profileAssessmentPrice={profileAssessmentPrice}
                isProfileAssessmentOffer={profileAssessmentOfferActive}
                checkoutUrl={effectiveCheckoutUrl}
                slug={slug}
                landingPageId={landingPageId}
            />
            <FaqSection items={faq} />
            <FinalCtaSection checkoutUrl={effectiveCheckoutUrl} slug={slug} landingPageId={landingPageId} />
            <LandingFooter productName={productName} author={author} />

            <style jsx global>{`
                .product-sales-page {
                    --ps-black: #02080a;
                    --ps-panel: #061116;
                    --ps-panel-soft: #0b1b22;
                    --ps-gold: #d9a64c;
                    --ps-gold-bright: #f0b95a;
                    --ps-cream: #f7f1e5;
                    --ps-muted: rgba(247, 241, 229, 0.68);
                    --ps-border: rgba(214, 163, 76, 0.18);
                    min-height: 100vh;
                    background: var(--ps-black);
                    color: var(--ps-cream);
                    font-family: Montserrat, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    letter-spacing: 0;
                }

                .product-sales-page :global(*) {
                    box-sizing: border-box;
                    letter-spacing: 0;
                }

                .product-sales-container {
                    width: min(1160px, calc(100% - 40px));
                    margin: 0 auto;
                }

                .product-sales-nav {
                    position: sticky;
                    top: 0;
                    z-index: 40;
                    min-height: 54px;
                    display: grid;
                    grid-template-columns: minmax(160px, 1fr) auto minmax(112px, 1fr);
                    align-items: center;
                    gap: 16px;
                    padding: 0 max(20px, calc((100vw - 1160px) / 2));
                    border-bottom: 1px solid var(--ps-border);
                    background: rgba(2, 4, 7, 0.94);
                    backdrop-filter: blur(14px);
                }

                .product-sales-brand,
                .product-sales-nav a,
                .product-sales-primary,
                .product-sales-secondary,
                .product-sales-nav-cta {
                    text-decoration: none;
                }

                .product-sales-brand {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    color: var(--ps-gold);
                    font-family: "Playfair Display", Georgia, serif;
                    font-size: 16px;
                    font-weight: 700;
                }

                .product-sales-nav nav {
                    display: flex;
                    align-items: center;
                    gap: 18px;
                }

                .product-sales-nav nav a {
                    color: rgba(247, 241, 229, 0.76);
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .product-sales-nav a:hover {
                    color: var(--ps-gold-bright);
                }

                .product-sales-nav-cta {
                    justify-self: end;
                    min-height: 32px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: 1px solid rgba(214, 163, 76, 0.72);
                    border-radius: 6px;
                    padding: 0 12px;
                    background: var(--ps-gold);
                    color: #080604;
                    font-size: 10px;
                    font-weight: 950;
                    text-transform: uppercase;
                }

                .product-sales-hero {
                    position: relative;
                    min-height: 690px;
                    display: flex;
                    align-items: center;
                    overflow: hidden;
                    border-bottom: 1px solid rgba(217, 166, 76, 0.28);
                    background: #02080a;
                }

                .product-sales-hero::after {
                    content: "";
                    position: absolute;
                    inset: auto 0 0;
                    z-index: 0;
                    height: 190px;
                    background: linear-gradient(180deg, rgba(2, 8, 10, 0), #02080a 92%);
                    pointer-events: none;
                }

                .product-sales-hero-bg-image {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center right;
                    opacity: 0.78;
                    filter: saturate(1.08) contrast(1.08);
                }

                .product-sales-hero-person-image {
                    position: absolute;
                    right: max(-8px, calc((100vw - 1160px) / 2 + 6px));
                    bottom: -10px;
                    z-index: 1;
                    width: min(36vw, 450px);
                    height: min(94%, 640px);
                    object-fit: cover;
                    object-position: center top;
                    opacity: 0.58;
                    filter: grayscale(0.18) saturate(0.78) contrast(1.08);
                    -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 14%, #000 76%, transparent 100%);
                    mask-image: linear-gradient(90deg, transparent 0%, #000 14%, #000 76%, transparent 100%);
                    pointer-events: none;
                }

                .product-sales-hero-shade {
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(circle at 74% 40%, rgba(217, 166, 76, 0.22), rgba(2, 8, 10, 0) 36%),
                        linear-gradient(90deg, rgba(2, 8, 10, 0.98) 0%, rgba(2, 8, 10, 0.9) 34%, rgba(2, 8, 10, 0.48) 72%, rgba(2, 8, 10, 0.7) 100%),
                        linear-gradient(180deg, rgba(2, 8, 10, 0.05), #02080a 100%);
                }

                .product-sales-hero-grid {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: minmax(0, 0.95fr) minmax(260px, 380px);
                    align-items: center;
                    gap: 78px;
                    padding: 76px 0 68px;
                }

                .product-sales-copy {
                    max-width: 500px;
                }

                .product-sales-kicker,
                .product-sales-section-label {
                    display: inline-flex;
                    align-items: center;
                    min-height: 22px;
                    margin-bottom: 12px;
                    border: 1px solid rgba(214, 163, 76, 0.56);
                    border-radius: 5px;
                    color: var(--ps-gold-bright);
                    padding: 0 8px;
                    font-size: 9px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .product-sales-offer-line {
                    margin: 0 0 10px;
                    color: rgba(247, 241, 229, 0.72);
                    font-size: 10px;
                    font-weight: 850;
                    text-transform: uppercase;
                }

                .product-sales-copy h1 {
                    margin: 0;
                    font-family: "Playfair Display", Georgia, serif;
                    font-weight: 800;
                    line-height: 1.02;
                    text-transform: uppercase;
                }

                .product-sales-section h2,
                .product-sales-final h2,
                .product-sales-author h2 {
                    margin: 0;
                    font-family: Montserrat, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    font-weight: 800;
                    line-height: 1.18;
                }

                .product-sales-copy h1 {
                    max-width: 500px;
                    color: #ffffff;
                    font-size: 54px;
                }

                .product-sales-subtitle {
                    max-width: 500px;
                    margin: 16px 0 0;
                    color: var(--ps-gold-bright);
                    font-family: "Playfair Display", Georgia, serif;
                    font-size: 20px;
                    line-height: 1.32;
                }

                .product-sales-description {
                    max-width: 460px;
                    margin: 16px 0 0;
                    color: var(--ps-muted);
                    font-size: 14px;
                    line-height: 1.64;
                }

                .product-sales-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-top: 26px;
                }

                .product-sales-primary,
                .product-sales-secondary {
                    min-height: 36px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border-radius: 5px;
                    padding: 0 17px;
                    font-size: 9.5px;
                    font-weight: 950;
                    text-transform: uppercase;
                }

                .product-sales-primary {
                    border: 1px solid var(--ps-gold);
                    background: var(--ps-gold);
                    color: #080604;
                    box-shadow: 0 18px 34px rgba(214, 122, 28, 0.18);
                }

                .product-sales-hero-buy {
                    animation: product-sales-pulse 1.85s ease-in-out infinite;
                    box-shadow: 0 18px 34px rgba(214, 122, 28, 0.2), 0 0 0 0 rgba(240, 185, 90, 0.34);
                }

                @keyframes product-sales-pulse {
                    0% {
                        transform: translateY(0) scale(1);
                        box-shadow: 0 18px 34px rgba(214, 122, 28, 0.2), 0 0 0 0 rgba(240, 185, 90, 0.34);
                    }

                    55% {
                        transform: translateY(-1px) scale(1.025);
                        box-shadow: 0 20px 42px rgba(214, 122, 28, 0.28), 0 0 0 9px rgba(240, 185, 90, 0);
                    }

                    100% {
                        transform: translateY(0) scale(1);
                        box-shadow: 0 18px 34px rgba(214, 122, 28, 0.2), 0 0 0 0 rgba(240, 185, 90, 0);
                    }
                }

                .product-sales-primary:hover,
                .product-sales-nav-cta:hover {
                    background: var(--ps-gold-bright);
                    border-color: var(--ps-gold-bright);
                    color: #080604;
                }

                .product-sales-secondary {
                    border: 1px solid rgba(247, 241, 229, 0.22);
                    color: var(--ps-cream);
                }

                .product-sales-secondary:hover {
                    border-color: var(--ps-gold);
                    color: var(--ps-gold-bright);
                }

                .product-sales-hero-proof {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 9px;
                    margin-top: 18px;
                }

                .product-sales-hero-proof span {
                    display: inline-flex;
                    min-height: 24px;
                    align-items: center;
                    border: 1px solid rgba(217, 166, 76, 0.22);
                    border-radius: 5px;
                    background: rgba(255, 255, 255, 0.045);
                    color: rgba(247, 241, 229, 0.78);
                    padding: 0 9px;
                    font-size: 9.5px;
                    font-weight: 850;
                    text-transform: uppercase;
                }

                .product-sales-book-wrap {
                    justify-self: end;
                    position: relative;
                    z-index: 2;
                    width: min(100%, 335px);
                    display: grid;
                    gap: 12px;
                    transform: translateX(-34px);
                }

                .product-sales-mobile-book {
                    display: none;
                }

                .product-sales-book-stage {
                    border: 1px solid rgba(214, 163, 76, 0.35);
                    border-radius: 8px;
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.035);
                    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.62), 0 0 46px rgba(217, 166, 76, 0.16);
                }

                .product-sales-book {
                    width: 100%;
                    display: block;
                    aspect-ratio: 0.74;
                    object-fit: cover;
                    border-radius: 5px;
                    border: 1px solid rgba(214, 163, 76, 0.34);
                    box-shadow: 12px 0 0 #111722;
                }

                .product-sales-book-caption {
                    display: grid;
                    gap: 3px;
                    border-left: 2px solid var(--ps-gold);
                    padding-left: 14px;
                }

                .product-sales-book-caption span {
                    color: var(--ps-gold-bright);
                    font-size: 9.5px;
                    font-weight: 950;
                    text-transform: uppercase;
                }

                .product-sales-book-caption strong {
                    color: rgba(247, 241, 229, 0.84);
                    font-size: 11.5px;
                    font-weight: 800;
                }

                .product-sales-trust-strip {
                    border-top: 1px solid rgba(217, 166, 76, 0.2);
                    border-bottom: 1px solid rgba(217, 166, 76, 0.2);
                    background: #061116;
                }

                .product-sales-trust-strip .product-sales-container {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                .product-sales-trust-strip .product-sales-container > div {
                    min-height: 54px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border-left: 1px solid rgba(217, 166, 76, 0.12);
                    color: rgba(247, 241, 229, 0.82);
                    font-size: 10.5px;
                    font-weight: 800;
                    text-align: center;
                }

                .product-sales-trust-strip .product-sales-container > div:last-child {
                    border-right: 1px solid rgba(214, 163, 76, 0.12);
                }

                .product-sales-trust-strip svg {
                    color: var(--ps-gold);
                    flex: 0 0 auto;
                }

                .product-sales-section {
                    padding: 64px 0;
                    background: var(--ps-black);
                }

                .product-sales-section-head {
                    max-width: 720px;
                    text-align: center;
                }

                .product-sales-section h2,
                .product-sales-final h2,
                .product-sales-author h2 {
                    color: #ffffff;
                    font-size: 24px;
                }

                .product-sales-method {
                    position: relative;
                    overflow: hidden;
                    padding: 30px 0 34px;
                    border-top: 1px solid rgba(2, 8, 10, 0.6);
                    border-bottom: 1px solid rgba(2, 8, 10, 0.62);
                    background:
                        linear-gradient(90deg, rgba(2, 8, 10, 0.16), transparent 16%, transparent 84%, rgba(2, 8, 10, 0.16)),
                        linear-gradient(180deg, #e6b65e 0%, #d7a04b 100%);
                    color: #061116;
                }

                .product-sales-method .product-sales-section-head {
                    max-width: 720px;
                }

                .product-sales-method .product-sales-section-label {
                    border-color: rgba(2, 8, 10, 0.26);
                    background: rgba(2, 8, 10, 0.08);
                    color: #061116;
                }

                .product-sales-method h2 {
                    color: #061116;
                    font-size: 20px;
                }

                .product-sales-method-grid {
                    display: flex;
                    gap: 12px;
                    margin-top: 28px;
                    overflow-x: auto;
                    padding-bottom: 4px;
                    scrollbar-width: thin;
                    scroll-snap-type: x mandatory;
                    -webkit-overflow-scrolling: touch;
                }

                .product-sales-method-grid article {
                    flex: 0 0 214px;
                    scroll-snap-align: start;
                    overflow: hidden;
                    border: 1px solid rgba(2, 8, 10, 0.28);
                    border-radius: 5px;
                    background: #061116;
                    box-shadow: 0 16px 30px rgba(2, 8, 10, 0.18);
                }

                .product-sales-method-thumb {
                    position: relative;
                    min-height: 86px;
                    aspect-ratio: 1.78;
                    overflow: hidden;
                    background:
                        linear-gradient(90deg, rgba(217, 166, 76, 0.12), transparent),
                        #091b23;
                }

                .product-sales-method-thumb img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                    object-position: center;
                    opacity: 0.46;
                    filter: saturate(0.78) contrast(1.08);
                }

                .product-sales-method-thumb::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    display: block;
                    background: linear-gradient(180deg, rgba(6, 17, 22, 0.18), rgba(6, 17, 22, 0.92));
                }

                .product-sales-method-thumb span {
                    position: absolute;
                    left: 13px;
                    bottom: 13px;
                    z-index: 1;
                    color: var(--ps-gold-bright);
                    font-size: 10px;
                    font-weight: 950;
                    text-transform: uppercase;
                }

                .product-sales-method-body {
                    display: grid;
                    gap: 8px;
                    padding: 14px;
                }

                .product-sales-method-body svg,
                .product-sales-benefit-list article > span {
                    color: var(--ps-gold);
                }

                .product-sales-method-body h3,
                .product-sales-benefit-list h3,
                .product-sales-problem-grid h3,
                .product-sales-included-list h3,
                .product-sales-faq h3 {
                    margin: 0;
                    color: #ffffff;
                    font-family: Montserrat, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    font-size: 15px;
                    line-height: 1.2;
                }

                .product-sales-method-body p,
                .product-sales-benefit-list p,
                .product-sales-problem-grid p,
                .product-sales-included-list p,
                .product-sales-book-content > div > p,
                .product-sales-editorial-grid > p,
                .product-sales-author p,
                .product-sales-offer-grid > div > p,
                .product-sales-faq article p,
                .product-sales-testimonials p {
                    margin: 0;
                    color: var(--ps-muted);
                    font-size: 12px;
                    line-height: 1.58;
                }

                .product-sales-learning,
                .product-sales-content,
                .product-sales-faq {
                    background: #041015;
                }

                .product-sales-learning {
                    position: relative;
                    overflow: hidden;
                    background:
                        linear-gradient(90deg, #041015 0%, rgba(4, 16, 21, 0.92) 46%, rgba(4, 16, 21, 0.98) 100%),
                        url("/images/products/corretor-nota-8-guilherme-hero-optimized.jpg") left bottom / auto 108% no-repeat,
                        #041015;
                }

                .product-sales-learning::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at 18% 76%, rgba(217, 166, 76, 0.2), transparent 28%);
                    opacity: 0.75;
                    pointer-events: none;
                }

                .product-sales-learning > .product-sales-container {
                    position: relative;
                    z-index: 1;
                }

                .product-sales-author {
                    position: relative;
                    overflow: hidden;
                    background: #041015;
                }

                .product-sales-author::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(90deg, #041015 0%, rgba(4, 16, 21, 0.82) 42%, rgba(4, 16, 21, 0.96) 100%),
                        url("/images/products/corretor-nota-8-guilherme-author-optimized.jpg") right center / auto 112% no-repeat;
                    opacity: 0.68;
                    pointer-events: none;
                }

                .product-sales-author > .product-sales-container {
                    position: relative;
                    z-index: 1;
                }

                .product-sales-learning-grid,
                .product-sales-editorial-grid,
                .product-sales-book-content,
                .product-sales-author-grid,
                .product-sales-offer-grid,
                .product-sales-faq-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
                    gap: 56px;
                    align-items: center;
                }

                .product-sales-learning-art {
                    position: relative;
                    min-height: 390px;
                    display: grid;
                    place-items: center;
                }

                .product-sales-learning-art > img {
                    position: relative;
                    z-index: 1;
                    width: min(74%, 300px);
                    border-radius: 6px;
                    border: 1px solid rgba(214, 163, 76, 0.34);
                    box-shadow: 0 34px 80px rgba(0, 0, 0, 0.58), 0 0 46px rgba(217, 166, 76, 0.14);
                }

                .product-sales-board {
                    position: absolute;
                    inset: auto 0 10px 10%;
                    width: min(76%, 330px);
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    transform: perspective(700px) rotateX(58deg) rotateZ(-10deg);
                    opacity: 0.5;
                }

                .product-sales-board span {
                    aspect-ratio: 1;
                    border: 1px solid rgba(214, 163, 76, 0.16);
                    background: rgba(247, 241, 229, 0.05);
                }

                .product-sales-board span:nth-child(odd) {
                    background: rgba(214, 163, 76, 0.16);
                }

                .product-sales-learning-copy h2 {
                    max-width: 640px;
                    margin-bottom: 22px;
                }

                .product-sales-benefit-list {
                    display: grid;
                    gap: 12px;
                }

                .product-sales-benefit-list article {
                    display: grid;
                    grid-template-columns: 38px 1fr;
                    gap: 12px;
                    align-items: start;
                    border: 1px solid rgba(217, 166, 76, 0.2);
                    border-radius: 5px;
                    background: rgba(2, 8, 10, 0.72);
                    backdrop-filter: blur(8px);
                    padding: 14px;
                }

                .product-sales-benefit-list article > span {
                    width: 34px;
                    height: 34px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 5px;
                    background: rgba(217, 166, 76, 0.14);
                }

                .product-sales-problem {
                    position: relative;
                    overflow: hidden;
                    background:
                        linear-gradient(180deg, rgba(2, 8, 10, 0.88), #02080a 78%),
                        url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") center / cover no-repeat,
                        #02080a;
                }

                .product-sales-problem > .product-sales-container {
                    position: relative;
                    z-index: 1;
                }

                .product-sales-editorial-grid {
                    align-items: start;
                }

                .product-sales-problem-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 14px;
                    margin-top: 28px;
                }

                .product-sales-problem-grid article {
                    min-height: 170px;
                    border: 1px solid rgba(217, 166, 76, 0.18);
                    border-radius: 5px;
                    background: rgba(6, 17, 22, 0.78);
                    backdrop-filter: blur(6px);
                    padding: 18px;
                }

                .product-sales-problem-grid article > span,
                .product-sales-included-list article > span {
                    display: block;
                    margin-bottom: 18px;
                    color: var(--ps-gold);
                    font-size: 10px;
                    font-weight: 950;
                }

                .product-sales-content {
                    position: relative;
                    overflow: hidden;
                    background:
                        linear-gradient(90deg, #041015 0%, rgba(4, 16, 21, 0.96) 52%, rgba(4, 16, 21, 0.72) 100%),
                        url("/images/products/corretor-nota-8-guilherme-author-optimized.jpg") right center / auto 110% no-repeat,
                        #041015;
                }

                .product-sales-content > .product-sales-container {
                    position: relative;
                    z-index: 1;
                }

                .product-sales-included-list {
                    display: grid;
                    border-top: 1px solid rgba(214, 163, 76, 0.16);
                    border-bottom: 1px solid rgba(214, 163, 76, 0.16);
                }

                .product-sales-included-list article {
                    display: grid;
                    grid-template-columns: 46px 1fr;
                    gap: 14px;
                    padding: 18px 0;
                    border-bottom: 1px solid rgba(214, 163, 76, 0.12);
                }

                .product-sales-included-list article:last-child {
                    border-bottom: 0;
                }

                .product-sales-author-card {
                    position: relative;
                    min-height: 430px;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    overflow: hidden;
                    border: 1px solid rgba(217, 166, 76, 0.34);
                    border-radius: 5px;
                    background: #061116;
                    padding: 30px;
                    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.34);
                }

                .product-sales-author-card::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(180deg, rgba(4, 16, 21, 0.08), rgba(4, 16, 21, 0.78) 68%, #041015 100%),
                        radial-gradient(circle at 50% 26%, rgba(217, 166, 76, 0.18), transparent 36%);
                    pointer-events: none;
                }

                .product-sales-author-card img {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: center top;
                    opacity: 0.62;
                    filter: saturate(0.82) contrast(1.05);
                }

                .product-sales-author-card svg,
                .product-sales-author-card p {
                    position: relative;
                    z-index: 2;
                }

                .product-sales-author-card p {
                    max-width: 360px;
                    margin: 16px 0 0;
                    color: var(--ps-gold-bright);
                    font-family: "Playfair Display", Georgia, serif;
                    font-size: 24px;
                    font-style: italic;
                    line-height: 1.24;
                }

                .product-sales-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 18px;
                    margin-top: 24px;
                }

                .product-sales-stats div {
                    min-width: 120px;
                    border-top: 2px solid var(--ps-gold);
                    padding-top: 10px;
                }

                .product-sales-stats strong {
                    display: block;
                    color: #ffffff;
                    font-size: 21px;
                    font-weight: 950;
                }

                .product-sales-stats span {
                    color: var(--ps-muted);
                    font-size: 10px;
                    font-weight: 850;
                    text-transform: uppercase;
                }

                .product-sales-testimonial-section {
                    background: #020407;
                }

                .product-sales-testimonials {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 14px;
                }

                .product-sales-testimonials article {
                    border: 1px solid rgba(214, 163, 76, 0.16);
                    border-left: 4px solid var(--ps-gold);
                    border-radius: 8px;
                    background: #080c12;
                    padding: 20px;
                }

                .product-sales-testimonials article > div {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-top: 20px;
                }

                .product-sales-testimonials article > div > span {
                    width: 34px;
                    height: 34px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    background: rgba(214, 163, 76, 0.14);
                    color: var(--ps-gold-bright);
                    font-weight: 950;
                }

                .product-sales-testimonials strong,
                .product-sales-testimonials small {
                    display: block;
                }

                .product-sales-testimonials strong {
                    color: #ffffff;
                }

                .product-sales-testimonials small {
                    color: var(--ps-gold);
                    font-size: 10px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .product-sales-offer {
                    border-top: 1px solid rgba(217, 166, 76, 0.24);
                    border-bottom: 1px solid rgba(217, 166, 76, 0.24);
                    background:
                        linear-gradient(180deg, rgba(217, 166, 76, 0.08), rgba(2, 8, 10, 0) 28%),
                        #02080a;
                }

                .product-sales-offer-box {
                    position: relative;
                    overflow: hidden;
                    display: grid;
                    gap: 16px;
                    border: 1px solid rgba(217, 166, 76, 0.42);
                    border-radius: 5px;
                    background:
                        radial-gradient(circle at 88% 12%, rgba(214, 163, 76, 0.16), transparent 34%),
                        linear-gradient(145deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.015)),
                        #061116;
                    color: var(--ps-cream);
                    padding: 30px;
                    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.46), 0 0 54px rgba(217, 166, 76, 0.1);
                }

                .product-sales-offer-format {
                    width: fit-content;
                    border: 1px solid rgba(214, 163, 76, 0.42);
                    border-radius: 5px;
                    color: var(--ps-gold-bright);
                    padding: 5px 8px;
                    font-size: 10px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .product-sales-price-panel {
                    display: grid;
                    gap: 7px;
                    scroll-margin-top: 82px;
                    border-top: 1px solid rgba(214, 163, 76, 0.18);
                    border-bottom: 1px solid rgba(214, 163, 76, 0.18);
                    padding: 18px 0;
                }

                .product-sales-price-panel span {
                    color: rgba(247, 241, 229, 0.66);
                    font-size: 10px;
                    font-weight: 850;
                    text-transform: uppercase;
                }

                .product-sales-price-panel strong {
                    color: var(--ps-gold-bright);
                    font-family: "Playfair Display", Georgia, serif;
                    font-size: 38px;
                    font-weight: 950;
                    line-height: 1;
                }

                .product-sales-price-panel .product-sales-price-original {
                    color: rgba(247, 241, 229, 0.52);
                    font-size: 24px;
                    text-decoration: line-through;
                    text-decoration-thickness: 2px;
                }

                .product-sales-price-panel small {
                    color: rgba(247, 241, 229, 0.68);
                    font-size: 11px;
                    font-weight: 800;
                    line-height: 1.4;
                }

                .product-sales-offer-box ul {
                    display: grid;
                    gap: 10px;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }

                .product-sales-offer-box li {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    color: rgba(247, 241, 229, 0.78);
                    font-size: 12.5px;
                    font-weight: 800;
                }

                .product-sales-offer-box li svg {
                    color: var(--ps-gold);
                    flex: 0 0 auto;
                }

                .product-sales-primary-full {
                    width: 100%;
                }

                .product-sales-faq-list {
                    display: grid;
                    gap: 12px;
                }

                .product-sales-faq article {
                    border: 1px solid rgba(214, 163, 76, 0.14);
                    border-radius: 8px;
                    background: #080c12;
                    padding: 18px;
                }

                .product-sales-final {
                    padding: 72px 0;
                    background: #020407;
                    text-align: center;
                }

                .product-sales-final .product-sales-container {
                    max-width: 700px;
                    display: grid;
                    justify-items: center;
                    gap: 18px;
                }

                .product-sales-final p {
                    max-width: 620px;
                    margin: 0;
                    color: var(--ps-muted);
                    font-size: 13px;
                    line-height: 1.6;
                }

                .product-sales-footer {
                    padding: 28px 0;
                    border-top: 1px solid rgba(214, 163, 76, 0.12);
                    background: #020407;
                    color: rgba(247, 241, 229, 0.58);
                }

                .product-sales-footer .product-sales-container {
                    display: flex;
                    justify-content: space-between;
                    gap: 18px;
                }

                .product-sales-footer strong {
                    color: var(--ps-gold);
                    font-family: "Playfair Display", Georgia, serif;
                }

                @media (prefers-reduced-motion: reduce) {
                    .product-sales-hero-buy {
                        animation: none;
                    }
                }

                @media (max-width: 1100px) {
                    .product-sales-method-grid {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                }

                @media (max-width: 920px) {
                    .product-sales-nav {
                        grid-template-columns: 1fr auto;
                    }

                    .product-sales-nav nav {
                        display: none;
                    }

                    .product-sales-hero-grid,
                    .product-sales-learning-grid,
                    .product-sales-editorial-grid,
                    .product-sales-book-content,
                    .product-sales-author-grid,
                    .product-sales-offer-grid,
                    .product-sales-faq-grid {
                        grid-template-columns: 1fr;
                        gap: 42px;
                    }

                    .product-sales-book-wrap {
                        justify-self: center;
                        width: min(68vw, 260px);
                        transform: none;
                    }

                    .product-sales-hero-person-image {
                        display: none;
                    }

                    .product-sales-copy h1 {
                        font-size: 42px;
                    }

                    .product-sales-subtitle {
                        font-size: 18px;
                    }

                    .product-sales-section h2,
                    .product-sales-final h2,
                    .product-sales-author h2 {
                        font-size: 23px;
                    }

                    .product-sales-method-grid,
                    .product-sales-problem-grid,
                    .product-sales-testimonials {
                        grid-template-columns: 1fr;
                    }

                    .product-sales-learning-art {
                        min-height: 310px;
                    }
                }

                @media (max-width: 620px) {
                    .product-sales-container {
                        width: min(100% - 28px, 1160px);
                    }

                    .product-sales-nav {
                        min-height: 52px;
                        padding: 0 14px;
                    }

                    .product-sales-brand span {
                        max-width: 132px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .product-sales-nav-cta {
                        min-height: 30px;
                        padding: 0 10px;
                    }

                    .product-sales-nav-cta svg {
                        display: none;
                    }

                    .product-sales-hero {
                        min-height: calc(100svh - 52px);
                        align-items: flex-start;
                    }

                    .product-sales-hero-grid {
                        min-height: calc(100svh - 52px);
                        display: grid;
                        align-content: start;
                        justify-items: center;
                        gap: 0;
                        padding: 24px 0 36px;
                        text-align: center;
                    }

                    .product-sales-hero-bg-image {
                        opacity: 0.68;
                        object-position: 83% bottom;
                        transform: scale(1.08);
                    }

                    .product-sales-hero-person-image {
                        display: block;
                        right: -18vw;
                        top: 64px;
                        bottom: auto;
                        width: 86vw;
                        height: 44svh;
                        opacity: 0.24;
                        object-position: center top;
                        -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 52%, transparent 100%);
                        mask-image: linear-gradient(180deg, #000 0%, #000 52%, transparent 100%);
                    }

                    .product-sales-hero-shade {
                        background:
                            radial-gradient(circle at 84% 70%, rgba(217, 166, 76, 0.24), rgba(2, 8, 10, 0) 38%),
                            linear-gradient(90deg, rgba(2, 8, 10, 0.94) 0%, rgba(2, 8, 10, 0.86) 52%, rgba(2, 8, 10, 0.6) 100%),
                            linear-gradient(180deg, rgba(2, 8, 10, 0.06), rgba(2, 8, 10, 0.68) 55%, #02080a 100%);
                    }

                    .product-sales-copy {
                        max-width: 100%;
                        display: grid;
                        justify-items: center;
                    }

                    .product-sales-copy h1 {
                        max-width: 330px;
                        font-size: 36px;
                        line-height: 0.98;
                    }

                    .product-sales-kicker,
                    .product-sales-section-label {
                        min-height: 20px;
                        margin-bottom: 9px;
                        font-size: 8.5px;
                    }

                    .product-sales-offer-line {
                        margin-bottom: 9px;
                        font-size: 9px;
                    }

                    .product-sales-mobile-book {
                        position: relative;
                        z-index: 2;
                        width: min(58vw, 215px);
                        display: grid;
                        margin: 28px auto 16px;
                    }

                    .product-sales-copy > .product-sales-mobile-book .product-sales-book-stage {
                        padding: 8px;
                        border-color: rgba(214, 163, 76, 0.55);
                        background: rgba(255, 255, 255, 0.045);
                    }

                    .product-sales-subtitle {
                        max-width: 340px;
                        margin-top: 11px;
                        font-size: 16px;
                        line-height: 1.28;
                    }

                    .product-sales-description {
                        max-width: 338px;
                        margin-top: 12px;
                        font-size: 12.5px;
                        line-height: 1.55;
                    }

                    .product-sales-actions {
                        width: 100%;
                        display: grid;
                        justify-items: center;
                        margin-top: 18px;
                        gap: 9px;
                    }

                    .product-sales-primary,
                    .product-sales-secondary {
                        width: 100%;
                        min-height: 42px;
                        padding: 0 14px;
                        font-size: 10px;
                    }

                    .product-sales-method-cta {
                        width: auto;
                        min-height: 30px;
                        padding: 0 12px;
                        border-color: rgba(247, 241, 229, 0.18);
                        background: rgba(2, 8, 10, 0.36);
                        color: rgba(247, 241, 229, 0.76);
                        font-size: 8.5px;
                        opacity: 0.88;
                    }

                    .product-sales-method-cta svg {
                        width: 13px;
                        height: 13px;
                    }

                    .product-sales-book-wrap {
                        display: none;
                    }

                    .product-sales-book-stage {
                        padding: 10px;
                    }

                    .product-sales-book {
                        box-shadow: 9px 0 0 #111722, 0 18px 42px rgba(0, 0, 0, 0.5);
                    }

                    .product-sales-book-caption {
                        padding-left: 10px;
                    }

                    .product-sales-hero-proof {
                        justify-content: center;
                        margin-top: 14px;
                    }

                    .product-sales-hero-proof span {
                        min-height: 22px;
                        font-size: 8px;
                    }

                    .product-sales-trust-strip .product-sales-container {
                        grid-template-columns: 1fr;
                    }

                    .product-sales-trust-strip .product-sales-container > div {
                        min-height: 46px;
                        justify-content: flex-start;
                        border-right: 1px solid rgba(214, 163, 76, 0.12);
                    }

                    .product-sales-section {
                        padding: 48px 0;
                    }

                    .product-sales-method {
                        padding: 28px 0 30px;
                    }

                    .product-sales-method .product-sales-container {
                        width: min(100% - 22px, 1160px);
                    }

                    .product-sales-method h2 {
                        font-size: 17px;
                        line-height: 1.18;
                    }

                    .product-sales-method-grid {
                        margin-top: 20px;
                        padding: 0 0 6px;
                    }

                    .product-sales-method-grid article {
                        flex-basis: min(73vw, 260px);
                        scroll-snap-align: center;
                    }

                    .product-sales-method-thumb {
                        min-height: 94px;
                    }

                    .product-sales-learning {
                        background:
                            linear-gradient(180deg, rgba(4, 16, 21, 0.88) 0%, #041015 42%, #041015 100%),
                            url("/images/products/corretor-nota-8-guilherme-hero-optimized.jpg") center top / 100% auto no-repeat,
                            #041015;
                    }

                    .product-sales-learning-grid,
                    .product-sales-book-content,
                    .product-sales-author-grid,
                    .product-sales-offer-grid,
                    .product-sales-faq-grid {
                        gap: 28px;
                    }

                    .product-sales-section h2,
                    .product-sales-final h2,
                    .product-sales-author h2 {
                        font-size: 21px;
                        line-height: 1.2;
                    }

                    .product-sales-method-body h3,
                    .product-sales-benefit-list h3,
                    .product-sales-problem-grid h3,
                    .product-sales-included-list h3,
                    .product-sales-faq h3 {
                        font-size: 14.5px;
                    }

                    .product-sales-method-body,
                    .product-sales-benefit-list article,
                    .product-sales-problem-grid article,
                    .product-sales-offer-box,
                    .product-sales-faq article {
                        padding: 16px;
                    }

                    .product-sales-offer-grid {
                        text-align: center;
                    }

                    .product-sales-offer-format {
                        justify-self: center;
                    }

                    .product-sales-price-panel {
                        justify-items: center;
                    }

                    .product-sales-learning-art {
                        min-height: 260px;
                    }

                    .product-sales-learning-art > img {
                        width: min(58%, 190px);
                    }

                    .product-sales-benefit-list article,
                    .product-sales-included-list article {
                        grid-template-columns: 1fr;
                    }

                    .product-sales-author-card {
                        min-height: 280px;
                        padding: 22px;
                    }

                    .product-sales-author-card p {
                        font-size: 20px;
                    }

                    .product-sales-price-panel strong {
                        font-size: 34px;
                    }

                    .product-sales-footer .product-sales-container {
                        flex-direction: column;
                    }
                }
            `}</style>
        </main>
    )
}
