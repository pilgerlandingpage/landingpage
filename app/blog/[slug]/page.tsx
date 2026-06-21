import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, MessageCircle } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
import { BLOG_AUTHOR_IMAGE_URL, BLOG_AUTHOR_NAME } from '@/lib/blog/author'
import { markdownToHtml } from '@/lib/blog/markdown'
import { getMostVisitedBlogProperties, type BlogPropertyRecommendation } from '@/lib/blog/properties'
import { pickPublicBlogSummary, type BlogPost } from '@/lib/blog/types'
import { JsonLd, articleJsonLd, breadcrumbJsonLd, faqPageJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE, isNewsLikeContent } from '@/lib/seo/json-ld'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BLOG_POST_SELECT = [
    'id',
    'title',
    'slug',
    'excerpt',
    'content_markdown',
    'status',
    'cover_image_url',
    'author_name',
    'category',
    'tags',
    'seo_title',
    'meta_description',
    'primary_keyword',
    'secondary_keywords',
    'local_entities',
    'aeo_questions',
    'internal_links',
    'generated_by',
    'created_at',
    'updated_at',
    'published_at',
].join(',')

async function getPost(slug: string) {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('blog_posts')
            .select(BLOG_POST_SELECT)
            .eq('slug', slug)
            .eq('status', 'published')
            .maybeSingle()
            .abortSignal(createSupabaseAbortSignal())

        if (error) {
            console.warn('[Blog] public post unavailable:', summarizeSupabaseError(error))
            return null
        }

        return data as BlogPost | null
    } catch (error) {
        console.warn('[Blog] public post unavailable:', summarizeSupabaseError(error))
        return null
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const post = await getPost(slug)
    if (!post) return { title: 'Artigo não encontrado | Blog' }
    const image = post.cover_image_url || DEFAULT_OG_IMAGE
    const contentPath = isNewsLikeContent(post) ? `/noticias/${post.slug}` : `/blog/${post.slug}`
    const description = pickPublicBlogSummary(post) || undefined

    return {
        title: post.seo_title || post.title,
        description,
        alternates: {
            canonical: contentPath,
        },
        openGraph: {
            title: post.seo_title || post.title,
            description,
            url: contentPath,
            type: 'article',
            images: [image],
        },
        twitter: {
            card: 'summary_large_image',
            title: post.seo_title || post.title,
            description,
            images: [image],
        },
    }
}

function formatDate(value?: string | null) {
    if (!value) return ''
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
}

function formatPrice(value?: number | null) {
    if (!value) return 'Sob consulta'
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(value)
}

function propertyHref(property: BlogPropertyRecommendation) {
    return property.landing_page_slug ? `/${property.landing_page_slug}` : propertyDetailsPath(property)
}

function propertyMeta(property: BlogPropertyRecommendation) {
    return [
        property.suites ? `${property.suites} suítes` : property.bedrooms ? `${property.bedrooms} dorm.` : '',
        property.area_m2 ? `${Number(property.area_m2).toLocaleString('pt-BR')} m²` : '',
        property.parking_spaces ? `${property.parking_spaces} vagas` : '',
    ].filter(Boolean).join(' · ')
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const post = await getPost(slug)
    if (!post) notFound()

    const supabase = createAdminClient()
    const mostVisitedProperties = await getMostVisitedBlogProperties(supabase, {
        limit: 3,
        days: 90,
        keywords: [
            post.primary_keyword,
            ...(post.secondary_keywords || []),
            ...(post.local_entities || []),
        ].filter(Boolean) as string[],
    }).catch(error => {
        console.warn('[Blog] most visited properties unavailable:', error?.message || error)
        return []
    })
    const authorName = BLOG_AUTHOR_NAME
    const cover = post.cover_image_url || 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/fundo%20imobiliaria.jpeg'
    const description = pickPublicBlogSummary(post) || undefined
    const isNews = isNewsLikeContent(post)
    const contentPath = isNews ? `/noticias/${post.slug}` : `/blog/${post.slug}`
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: contentPath,
            name: post.title,
            description,
            type: 'WebPage',
            image: cover,
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: isNews ? 'Notícias' : 'Blog', url: isNews ? '/noticias' : '/blog' },
            { name: post.title, url: contentPath },
        ]),
        articleJsonLd({
            post,
            authorName,
            authorImage: BLOG_AUTHOR_IMAGE_URL,
            forceNews: isNews,
            fallbackImage: cover,
        }),
        ...(post.aeo_questions?.length ? [faqPageJsonLd(post.aeo_questions)] : []),
    ]

    return (
        <>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <main className="blog-post-page">
                <section className="blog-post-hero">
                    <div>
                        <span>{post.category || 'Mercado imobiliario'}</span>
                        <h1>{post.title}</h1>
                        {description ? <p>{description}</p> : null}
                        <div className="blog-post-meta">
                            <CalendarDays size={15} />
                            {formatDate(post.published_at || post.created_at)}
                            {post.author_name ? ` · ${post.author_name}` : ''}
                        </div>
                    </div>
                    <div className="blog-post-cover" style={{ backgroundImage: `url(${cover})` }} />
                </section>

                <section className="blog-post-shell">
                    <article className="blog-post-content" dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content_markdown) }} />

                    <aside className="blog-post-aside">
                        <div className="blog-author-card">
                            <img src={BLOG_AUTHOR_IMAGE_URL} alt={authorName} />
                            <span>Autor do blog</span>
                            <h2>{authorName}</h2>
                            <p>Curadoria imobiliária, leitura de mercado e oportunidades premium no litoral catarinense.</p>
                        </div>

                        <div>
                            <h2>Fale com um especialista</h2>
                            <p>Transforme leitura de mercado em uma curadoria real de oportunidades.</p>
                            <WhatsAppCaptureLink
                                phone="5547992528080"
                                message={`Ola! Li o artigo "${post.title}" e quero falar com um especialista.`}
                                slug={`blog-${post.slug}`}
                                template="blog-article-cta"
                                className="blog-post-cta"
                            >
                                <MessageCircle size={17} />
                                Falar agora
                            </WhatsAppCaptureLink>
                        </div>

                        {mostVisitedProperties.length > 0 && (
                            <div className="blog-property-list">
                                <h2>Imóveis mais visitados</h2>
                                {mostVisitedProperties.map(property => (
                                    <Link href={propertyHref(property)} key={property.id} className="blog-property-card">
                                        <span
                                            className="blog-property-media"
                                            style={{ backgroundImage: `url(${property.featured_image || '/images/brava-concetto/20_CL_BC_LIVING_FINAL_01_ANG_02_EF_web.jpg'})` }}
                                        />
                                        <span className="blog-property-copy">
                                            <strong>{property.title}</strong>
                                            <em>{[property.neighborhood, property.city].filter(Boolean).join(' · ')}</em>
                                            <small>{propertyMeta(property) || property.property_type || 'Imóvel premium'}</small>
                                            <b>{formatPrice(property.price)}</b>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}

                        {post.internal_links?.length > 0 && (
                            <div>
                                <h2>Continue explorando</h2>
                                {post.internal_links.map(link => (
                                    <Link href={link.target || '/busca'} key={`${link.label}-${link.target}`}>{link.label}</Link>
                                ))}
                            </div>
                        )}

                        {post.aeo_questions?.length > 0 && (
                            <div>
                                <h2>Perguntas frequentes</h2>
                                {post.aeo_questions.slice(0, 5).map(item => (
                                    <details key={item.question}>
                                        <summary>{item.question}</summary>
                                        <p>{item.answer}</p>
                                    </details>
                                ))}
                            </div>
                        )}
                    </aside>
                </section>
            </main>
            <Footer />

            <style>{`
                .blog-post-page { background: #f7f3eb; color: #171512; }
                .blog-post-hero { align-items: end; background: linear-gradient(135deg, #17120d, #2b241c); color: #fff; display: grid; gap: 34px; grid-template-columns: minmax(0, 1fr) minmax(360px, .72fr); padding: 150px 7vw 60px; }
                .blog-post-hero span { color: #c9a96e; display: block; font-size: .72rem; font-weight: 900; letter-spacing: .15em; margin-bottom: 14px; text-transform: uppercase; }
                .blog-post-hero h1 { font-family: var(--font-serif); font-size: clamp(2rem, 4.3vw, 3.9rem); line-height: 1; margin: 0; }
                .blog-post-hero p { color: rgba(255,255,255,.72); font-size: 1.04rem; line-height: 1.6; max-width: 790px; }
                .blog-post-meta { align-items: center; color: rgba(255,255,255,.7); display: flex; gap: 8px; font-weight: 800; }
                .blog-post-cover { background-position: center; background-size: cover; border-radius: 20px; min-height: 430px; }
                .blog-post-shell { align-items: start; display: grid; gap: 38px; grid-template-columns: minmax(0, 1fr) 340px; padding: 58px 7vw; }
                .blog-post-content { background: #fff; border: 1px solid rgba(201,169,110,.18); border-radius: 18px; padding: clamp(24px, 5vw, 56px); }
                .blog-post-content h1, .blog-post-content h2, .blog-post-content h3 { color: #171512; font-family: var(--font-serif); line-height: 1.05; }
                .blog-post-content h1 { font-size: 2rem; }
                .blog-post-content h2 { font-size: 1.55rem; margin-top: 34px; }
                .blog-post-content h3 { font-size: 1.18rem; margin-top: 26px; }
                .blog-post-content p, .blog-post-content li { color: #50483e; font-size: 1rem; line-height: 1.82; }
                .blog-post-content a { color: #9b7635; font-weight: 800; }
                .blog-post-content .blog-inline-image { margin: 34px 0 12px; }
                .blog-post-content .blog-inline-image img { aspect-ratio: 16 / 9; border-radius: 18px; display: block; object-fit: cover; width: 100%; }
                .blog-post-aside { display: grid; gap: 16px; position: sticky; top: 96px; }
                .blog-post-aside > div { background: #fff; border: 1px solid rgba(201,169,110,.2); border-radius: 16px; display: grid; gap: 12px; padding: 20px; }
                .blog-post-aside h2 { font-size: 1.05rem; margin: 0; }
                .blog-post-aside p { color: #756a5f; line-height: 1.5; margin: 0; }
                .blog-post-aside a { color: #9b7635; font-weight: 900; text-decoration: none; }
                .blog-author-card { justify-items: center; text-align: center; }
                .blog-author-card img { aspect-ratio: 1 / 1; border: 3px solid rgba(201,169,110,.35); border-radius: 999px; height: 116px; object-fit: cover; width: 116px; }
                .blog-author-card span { color: #9b7635; font-size: .68rem; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
                .blog-author-card h2 { font-family: var(--font-serif); font-size: 1.45rem; }
                .blog-post-cta { align-items: center; background: #25d366; border-radius: 999px; color: #fff !important; display: inline-flex; font-weight: 900; gap: 8px; justify-content: center; padding: 12px 14px; }
                .blog-property-list { gap: 14px; }
                .blog-property-card { border-top: 1px solid rgba(201,169,110,.18); color: inherit !important; display: grid; gap: 10px; grid-template-columns: 92px minmax(0, 1fr); padding-top: 14px; }
                .blog-property-media { background-position: center; background-size: cover; border-radius: 10px; min-height: 78px; }
                .blog-property-copy { display: grid; gap: 4px; min-width: 0; }
                .blog-property-copy strong { color: #171512; display: -webkit-box; font-size: .9rem; line-height: 1.15; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
                .blog-property-copy em, .blog-property-copy small { color: #756a5f; font-size: .74rem; font-style: normal; font-weight: 700; line-height: 1.25; }
                .blog-property-copy b { color: #9b7635; font-size: .82rem; }
                details { border-top: 1px solid rgba(201,169,110,.18); padding-top: 10px; }
                summary { cursor: pointer; font-weight: 900; }
                @media (max-width: 980px) {
                    .blog-post-hero, .blog-post-shell { grid-template-columns: 1fr; }
                    .blog-post-hero { padding-top: 112px; }
                    .blog-post-hero h1 { font-size: 2rem; }
                    .blog-post-content h1 { font-size: 1.65rem; }
                    .blog-post-content h2 { font-size: 1.35rem; }
                    .blog-post-cover { min-height: 280px; }
                    .blog-post-aside { position: static; }
                }
            `}</style>
        </>
    )
}
