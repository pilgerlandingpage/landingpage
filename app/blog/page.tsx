import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, Newspaper, Search } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
import { pickPublicBlogSummary, type BlogPost } from '@/lib/blog/types'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE, isNewsLikeContent } from '@/lib/seo/json-ld'

export const metadata: Metadata = {
    title: 'Blog | Imobiliaria Guilherme Pilger',
    description: 'Conteúdos sobre mercado imobiliário premium, investimento, bairros e oportunidades no litoral catarinense.',
    alternates: {
        canonical: '/blog',
    },
    openGraph: {
        title: 'Blog | Imobiliaria Guilherme Pilger',
        description: 'Conteúdos sobre mercado imobiliário premium, investimento, bairros e oportunidades no litoral catarinense.',
        url: '/blog',
        type: 'website',
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Blog | Imobiliaria Guilherme Pilger',
        description: 'Conteúdos sobre mercado imobiliário premium, investimento, bairros e oportunidades no litoral catarinense.',
        images: [DEFAULT_OG_IMAGE],
    },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BLOG_LIST_SELECT = [
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

async function getPublishedPosts() {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('blog_posts')
            .select(BLOG_LIST_SELECT)
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .limit(120)
            .abortSignal(createSupabaseAbortSignal())

        if (error) {
            console.warn('[Blog] public list unavailable:', summarizeSupabaseError(error))
            return []
        }

        return ((data || []) as BlogPost[]).filter(post => !isNewsLikeContent(post)).slice(0, 60)
    } catch (error) {
        console.warn('[Blog] public list unavailable:', summarizeSupabaseError(error))
        return []
    }
}

function formatDate(value?: string | null) {
    if (!value) return ''
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
}

export default async function BlogPage() {
    const posts = await getPublishedPosts()
    const featured = posts[0]
    const rest = posts.slice(1)
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: '/blog',
            name: 'Blog Guilherme Pilger',
            description: 'Conteúdos sobre mercado imobiliário premium, investimento, bairros e oportunidades no litoral catarinense.',
            type: 'CollectionPage',
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Blog', url: '/blog' },
        ]),
        {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            '@id': `${absoluteUrl('/blog')}#blog`,
            name: 'Blog Guilherme Pilger',
            url: absoluteUrl('/blog'),
            description: 'Conteúdos sobre mercado imobiliário premium, investimento, bairros e oportunidades no litoral catarinense.',
            publisher: {
                '@id': `${absoluteUrl('/')}#organization`,
            },
            inLanguage: 'pt-BR',
            blogPost: posts.slice(0, 12).map(post => ({
                '@type': 'BlogPosting',
                headline: post.title,
                url: absoluteUrl(`/blog/${post.slug}`),
                datePublished: post.published_at || post.created_at,
                dateModified: post.updated_at,
                image: post.cover_image_url || DEFAULT_OG_IMAGE,
            })),
        },
    ]

    return (
        <>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <main className="blog-index">
                <section className="blog-hero">
                    <span>Inteligência imobiliária Pilger</span>
                    <h1>Blog de mercado, investimento e luxo no litoral catarinense</h1>
                    <p>Artigos criados a partir de dados reais do ecossistema Pilger: buscas, leads, radar de mercado, tráfego e estoque de oportunidades.</p>
                </section>

                {featured ? (
                    <section className="blog-featured">
                        <Link href={`/blog/${featured.slug}`} className="blog-featured-media" style={{ backgroundImage: `url(${featured.cover_image_url || 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/fundo%20imobiliaria.jpeg'})` }} />
                        <div>
                            <span>{featured.category || 'Mercado imobiliário'}</span>
                            <h2><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
                            <p>{pickPublicBlogSummary(featured)}</p>
                            <div className="blog-card-meta"><CalendarDays size={15} /> {formatDate(featured.published_at || featured.created_at)}</div>
                            <Link href={`/blog/${featured.slug}`} className="blog-read">Ler artigo</Link>
                        </div>
                    </section>
                ) : (
                    <section className="blog-empty">
                        <Search size={24} />
                        <h2>Blog em preparação</h2>
                        <p>Os primeiros artigos aprovados pelo Marketing aparecerão aqui.</p>
                    </section>
                )}

                {rest.length > 0 && (
                    <section className="blog-grid">
                        {rest.map(post => (
                            <article className="blog-card" key={post.id}>
                                <Link href={`/blog/${post.slug}`} className="blog-card-media" style={{ backgroundImage: `url(${post.cover_image_url || 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/fundo%20imobiliaria.jpeg'})` }} />
                                <div>
                                    <span>{post.category || 'Mercado imobiliário'}</span>
                                    <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
                                    <p>{pickPublicBlogSummary(post)}</p>
                                    <div className="blog-card-meta"><CalendarDays size={14} /> {formatDate(post.published_at || post.created_at)}</div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}

                <section className="blog-crosslink">
                    <div>
                        <span>Radar de mercado</span>
                        <h2>Noticias para acompanhar o que esta mudando no litoral.</h2>
                        <p>Veja atualizacoes sobre lancamentos, infraestrutura, construtoras e sinais que ajudam a ler o momento antes de decidir.</p>
                    </div>
                    <Link href="/noticias"><Newspaper size={17} /> Ver noticias</Link>
                </section>
            </main>
            <Footer />

            <style>{`
                .blog-index { background: #f7f3eb; color: #171512; }
                .blog-hero { background: linear-gradient(135deg, #16110d, #31281e); color: #fff; padding: 150px 7vw 70px; }
                .blog-hero span, .blog-featured span, .blog-card span { color: #c9a96e; display: block; font-size: .72rem; font-weight: 900; letter-spacing: .15em; margin-bottom: 12px; text-transform: uppercase; }
                .blog-hero h1 { font-family: var(--font-serif); font-size: clamp(2rem, 4.2vw, 3.8rem); line-height: 1; margin: 0; max-width: 880px; }
                .blog-hero p { color: rgba(255,255,255,.7); font-size: 1.05rem; line-height: 1.6; max-width: 760px; }
                .blog-featured { align-items: stretch; display: grid; gap: 34px; grid-template-columns: minmax(0, .9fr) minmax(0, 1fr); padding: 56px 7vw; }
                .blog-featured-media, .blog-card-media { background-position: center; background-size: cover; border-radius: 18px; display: block; min-height: 390px; }
                .blog-featured h2 { font-family: var(--font-serif); font-size: clamp(1.55rem, 2.8vw, 2.6rem); line-height: 1.08; margin: 0 0 18px; }
                .blog-featured a, .blog-card a { color: inherit; text-decoration: none; }
                .blog-featured p, .blog-card p { color: #6f6558; line-height: 1.65; }
                .blog-card-meta { align-items: center; color: #8b7d6b; display: flex; gap: 8px; font-size: .84rem; font-weight: 800; margin-top: 16px; }
                .blog-read { background: #c9a96e; border-radius: 999px; color: #111 !important; display: inline-flex; font-weight: 900; margin-top: 24px; padding: 13px 18px; text-transform: uppercase; }
                .blog-grid { display: grid; gap: 22px; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 0 7vw 70px; }
                .blog-card { background: #fff; border: 1px solid rgba(201,169,110,.2); border-radius: 18px; overflow: hidden; }
                .blog-card-media { border-radius: 0; min-height: 230px; }
                .blog-card div:last-child { padding: 22px; }
                .blog-card h2 { font-size: 1.08rem; line-height: 1.25; margin: 0 0 10px; }
                .blog-empty { align-items: center; display: grid; justify-items: center; min-height: 340px; padding: 70px 7vw; text-align: center; }
                .blog-empty h2 { font-family: var(--font-serif); font-size: 2rem; margin: 14px 0 4px; }
                .blog-empty p { color: #756a5f; }
                .blog-crosslink { align-items: center; background: #171512; color: #fff8ea; display: grid; gap: 28px; grid-template-columns: minmax(0, 1fr) auto; margin: 0 7vw 70px; padding: 34px 38px; }
                .blog-crosslink span { color: #c9a96e; display: block; font-size: .72rem; font-weight: 950; letter-spacing: .15em; margin-bottom: 10px; text-transform: uppercase; }
                .blog-crosslink h2 { font-family: var(--font-serif); font-size: clamp(1.45rem, 2.4vw, 2.45rem); line-height: 1.05; margin: 0; max-width: 760px; }
                .blog-crosslink p { color: rgba(255,248,234,.68); line-height: 1.6; margin: 12px 0 0; max-width: 720px; }
                .blog-crosslink a { align-items: center; background: #c9a96e; border-radius: 999px; color: #111; display: inline-flex; font-weight: 950; gap: 8px; justify-self: end; padding: 13px 18px; text-decoration: none; text-transform: uppercase; white-space: nowrap; }
                @media (max-width: 900px) {
                    .blog-hero { padding-top: 110px; }
                    .blog-hero h1 { font-size: 2rem; }
                    .blog-featured h2 { font-size: 1.55rem; }
                    .blog-featured, .blog-grid { grid-template-columns: 1fr; }
                    .blog-featured-media { min-height: 280px; }
                    .blog-crosslink { grid-template-columns: 1fr; margin: 0 7vw 52px; padding: 28px 24px; }
                    .blog-crosslink a { justify-self: start; }
                }
            `}</style>
        </>
    )
}
