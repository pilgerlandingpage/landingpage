import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, Newspaper, Search } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import { createAdminClient } from '@/lib/supabase/server'
import { pickPublicBlogSummary, type BlogPost } from '@/lib/blog/types'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, itemListJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'

export const metadata: Metadata = {
    title: 'Notícias | Guilherme Pilger',
    description: 'Notícias e leituras rápidas sobre mercado imobiliário de alto padrão no litoral catarinense.',
    alternates: {
        canonical: '/noticias',
    },
    openGraph: {
        title: 'Notícias | Guilherme Pilger',
        description: 'Notícias e leituras rápidas sobre mercado imobiliário de alto padrão no litoral catarinense.',
        url: '/noticias',
        type: 'website',
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Notícias | Guilherme Pilger',
        description: 'Notícias e leituras rápidas sobre mercado imobiliário de alto padrão no litoral catarinense.',
        images: [DEFAULT_OG_IMAGE],
    },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NEWS_LIST_SELECT = [
    'id',
    'title',
    'slug',
    'excerpt',
    'cover_image_url',
    'category',
    'tags',
    'meta_description',
    'generated_by',
    'created_at',
    'updated_at',
    'published_at',
].join(',')

function normalize(value?: string | null) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function isNewsPost(post: BlogPost) {
    const category = normalize(post.category)
    const tags = Array.isArray(post.tags) ? post.tags.map(normalize) : []
    const generatedBy = normalize(post.generated_by)
    return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
}

async function getNewsPosts() {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('blog_posts')
        .select(NEWS_LIST_SELECT)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(80)

    if (error) {
        console.warn('[Noticias] public list unavailable:', error.message)
        return []
    }

    return ((data || []) as BlogPost[]).filter(isNewsPost)
}

function formatDate(value?: string | null) {
    if (!value) return ''
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
}

export default async function NoticiasPage() {
    const posts = await getNewsPosts()
    const featured = posts[0]
    const rest = posts.slice(1)
    const fallbackCover = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/fundo%20imobiliaria.jpeg'
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: '/noticias',
            name: 'Notícias Guilherme Pilger',
            description: 'Notícias e leituras rápidas sobre mercado imobiliário de alto padrão no litoral catarinense.',
            type: 'CollectionPage',
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Notícias', url: '/noticias' },
        ]),
        itemListJsonLd({
            name: 'Notícias Guilherme Pilger',
            description: 'Notícias e leituras rápidas sobre mercado imobiliário de alto padrão no litoral catarinense.',
            path: '/noticias',
            items: posts.slice(0, 12).map(post => ({
                type: 'NewsArticle',
                name: post.title,
                url: `/noticias/${post.slug}`,
                description: pickPublicBlogSummary(post) || undefined,
                image: post.cover_image_url || fallbackCover,
            })),
        }),
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            '@id': `${absoluteUrl('/noticias')}#collection`,
            name: 'Notícias Guilherme Pilger',
            url: absoluteUrl('/noticias'),
            description: 'Notícias e leituras rápidas sobre mercado imobiliário de alto padrão no litoral catarinense.',
            publisher: {
                '@id': `${absoluteUrl('/')}#organization`,
            },
            inLanguage: 'pt-BR',
            mainEntity: {
                '@type': 'ItemList',
                itemListElement: posts.slice(0, 12).map((post, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    item: {
                        '@type': 'NewsArticle',
                        headline: post.title,
                        url: absoluteUrl(`/noticias/${post.slug}`),
                        image: post.cover_image_url || fallbackCover,
                        datePublished: post.published_at || post.created_at,
                        dateModified: post.updated_at,
                    },
                })),
            },
        },
    ]

    return (
        <>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <main className="news-page">
                <section className="news-hero">
                    <div>
                        <span>Radar de Mercado</span>
                        <h1>Notícias para comprar melhor no litoral.</h1>
                    </div>
                    <p>Atualizações de mercado, lançamentos, movimentos de construtoras e sinais que ajudam o comprador a decidir com mais contexto.</p>
                </section>

                {featured ? (
                    <section className="news-featured">
                        <Link href={`/noticias/${featured.slug}`} className="news-featured-media" style={{ backgroundImage: `url(${featured.cover_image_url || fallbackCover})` }} />
                        <div>
                            <span>Notícia em destaque</span>
                            <h2><Link href={`/noticias/${featured.slug}`}>{featured.title}</Link></h2>
                            <p>{pickPublicBlogSummary(featured)}</p>
                            <div className="news-meta"><CalendarDays size={15} /> {formatDate(featured.published_at || featured.created_at)}</div>
                        </div>
                    </section>
                ) : (
                    <section className="news-empty">
                        <Newspaper size={25} />
                        <h2>Notícias em preparação</h2>
                        <p>O agente editor vai publicar aqui os alertas aprovados de mercado, lançamentos e oportunidades.</p>
                        <Link href="/blog"><Search size={16} /> Ver blog</Link>
                    </section>
                )}

                {rest.length > 0 && (
                    <section className="news-grid">
                        {rest.map(post => (
                            <article className="news-card" key={post.id}>
                                <Link href={`/noticias/${post.slug}`} className="news-card-media" style={{ backgroundImage: `url(${post.cover_image_url || fallbackCover})` }} />
                                <div>
                                    <span>{post.category || 'Notícias'}</span>
                                    <h2><Link href={`/noticias/${post.slug}`}>{post.title}</Link></h2>
                                    <p>{pickPublicBlogSummary(post)}</p>
                                    <div className="news-meta"><CalendarDays size={14} /> {formatDate(post.published_at || post.created_at)}</div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </main>
            <Footer />

            <style>{`
                .news-page { background: #faf7f1; color: #171512; }
                .news-hero { align-items: end; background: linear-gradient(135deg, #17120d, #33281c); color: #fff8ea; display: grid; gap: 24px; grid-template-columns: minmax(0, 1fr) minmax(300px, .45fr); padding: 148px 7vw 64px; }
                .news-hero span, .news-featured span, .news-card span { color: #d7b674; display: block; font-size: .72rem; font-weight: 950; letter-spacing: .16em; margin-bottom: 12px; text-transform: uppercase; }
                .news-hero h1 { font-family: var(--font-serif); font-size: clamp(2rem, 4.2vw, 3.8rem); line-height: 1; margin: 0; max-width: 820px; }
                .news-hero p { color: rgba(255,255,255,.72); line-height: 1.65; margin: 0; }
                .news-featured { display: grid; gap: 30px; grid-template-columns: minmax(0, .85fr) minmax(0, 1fr); padding: 48px 7vw 34px; }
                .news-featured-media, .news-card-media { background-position: center; background-size: cover; border-radius: 18px; display: block; min-height: 360px; }
                .news-featured h2 { font-family: var(--font-serif); font-size: clamp(1.55rem, 2.8vw, 2.55rem); line-height: 1.08; margin: 0 0 16px; }
                .news-featured a, .news-card a { color: inherit; text-decoration: none; }
                .news-featured p, .news-card p { color: #6e6358; line-height: 1.65; }
                .news-meta { align-items: center; color: #8b7d6b; display: flex; gap: 8px; font-size: .82rem; font-weight: 850; margin-top: 16px; }
                .news-grid { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 20px 7vw 72px; }
                .news-card { background: #fff; border: 1px solid rgba(201,169,110,.2); border-radius: 16px; overflow: hidden; }
                .news-card-media { border-radius: 0; min-height: 220px; }
                .news-card div:last-child { padding: 20px; }
                .news-card h2 { font-size: 1.06rem; line-height: 1.25; margin: 0 0 10px; }
                .news-empty { align-items: center; display: grid; justify-items: center; min-height: 390px; padding: 72px 7vw; text-align: center; }
                .news-empty h2 { font-family: var(--font-serif); font-size: 2.15rem; margin: 14px 0 4px; }
                .news-empty p { color: #756a5f; max-width: 560px; }
                .news-empty a { align-items: center; background: #c9a96e; border-radius: 999px; color: #111; display: inline-flex; font-weight: 950; gap: 8px; margin-top: 12px; padding: 12px 16px; text-decoration: none; text-transform: uppercase; }
                @media (max-width: 900px) {
                    .news-hero, .news-featured, .news-grid { grid-template-columns: 1fr; }
                    .news-hero { padding-top: 110px; }
                    .news-hero h1 { font-size: 2rem; }
                    .news-featured h2 { font-size: 1.55rem; }
                    .news-featured-media { min-height: 270px; }
                }
            `}</style>
        </>
    )
}
