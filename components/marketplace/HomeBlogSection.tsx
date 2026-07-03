import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BookOpen, CalendarDays, Eye, Newspaper } from 'lucide-react'
import { pickPublicBlogSummary } from '@/lib/blog/types'
import { blogViewLabel, formatBlogViewCount } from '@/lib/blog/views'

export type HomeBlogPost = {
    id: string
    title: string
    slug: string
    excerpt?: string | null
    cover_image_url?: string | null
    category?: string | null
    meta_description?: string | null
    generated_by?: string | null
    created_at?: string | null
    published_at?: string | null
    tags?: string[] | null
    view_count?: number | null
}

const fallbackImage = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/fundo%20imobiliaria.jpeg'

function formatDate(value?: string | null) {
    if (!value) return ''
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function postSummary(post: HomeBlogPost) {
    return pickPublicBlogSummary(post) || 'Leitura de mercado para entender melhor bairros, liquidez, investimento e escolhas de alto padrão no litoral.'
}

function normalizeClassifier(value?: string | null) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function isNewsPost(post: HomeBlogPost) {
    const category = normalizeClassifier(post.category)
    const generatedBy = normalizeClassifier(post.generated_by)
    const tags = Array.isArray(post.tags) ? post.tags.map(normalizeClassifier) : []
    return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
}

function postHref(post: HomeBlogPost) {
    return `/${isNewsPost(post) ? 'noticias' : 'blog'}/${post.slug}`
}

function postTypeLabel(post: HomeBlogPost) {
    return isNewsPost(post) ? 'Notícia' : 'Blog'
}

function postCtaLabel(post: HomeBlogPost) {
    return isNewsPost(post) ? 'Ler notícia' : 'Ler artigo'
}

function postEyebrow(post: HomeBlogPost) {
    const type = postTypeLabel(post)
    const category = String(post.category || '').trim()
    if (!category) return type
    const normalizedCategory = normalizeClassifier(category)
    if (
        normalizedCategory === normalizeClassifier(type)
        || normalizedCategory.includes('noticia')
        || normalizedCategory === 'blog'
    ) {
        return type
    }

    return `${type} / ${category}`
}

function postViewCount(post: HomeBlogPost) {
    const count = Number(post.view_count)
    return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0
}

export default function HomeBlogSection({ posts }: { posts: HomeBlogPost[] }) {
    if (!posts.length) return null

    const featured = posts[0]
    const sidePosts = posts.slice(1, 4)

    return (
        <section className="home-blog-section" aria-labelledby="home-blog-title">
            <div className="home-blog-inner">
                <div className="home-blog-header">
                    <div>
                        <span className="home-blog-kicker">Blog + Notícias Pilger</span>
                        <h2 id="home-blog-title">Leitura de mercado antes da visita.</h2>
                        <p>
                            <span className="home-blog-copy-full">
                                Artigos e notícias sobre bairros, investimento, liquidez e escolhas de alto padrão no litoral catarinense.
                            </span>
                            <span className="home-blog-copy-short">
                                Artigos e notícias para escolher melhor no litoral catarinense.
                            </span>
                        </p>
                    </div>
                    <div className="home-blog-actions">
                        <Link href="/blog" className="home-blog-link">
                            <BookOpen size={16} />
                            Ver blog
                        </Link>
                        <Link href="/noticias" className="home-blog-link home-blog-link-secondary">
                            <Newspaper size={16} />
                            Notícias
                        </Link>
                    </div>
                </div>

                <div className="home-blog-grid">
                    <Link href={postHref(featured)} className="home-blog-featured">
                        <span className="home-blog-featured-media">
                            <Image
                                src={featured.cover_image_url || fallbackImage}
                                alt={featured.title}
                                fill
                                sizes="(max-width: 900px) calc(100vw - 40px), 52vw"
                            />
                        </span>
                        <span className="home-blog-featured-copy">
                            <small>{postEyebrow(featured)}</small>
                            <strong>{featured.title}</strong>
                            <em>{postSummary(featured)}</em>
                            <span className="home-blog-meta">
                                <span className="home-blog-meta-info">
                                    {formatDate(featured.published_at || featured.created_at) ? (
                                        <span>
                                            <CalendarDays size={14} />
                                            {formatDate(featured.published_at || featured.created_at)}
                                        </span>
                                    ) : null}
                                    <span aria-label={blogViewLabel(postViewCount(featured))}>
                                        <Eye size={14} />
                                        {formatBlogViewCount(postViewCount(featured))}
                                    </span>
                                </span>
                                <b>
                                    {postCtaLabel(featured)}
                                    <ArrowRight size={14} />
                                </b>
                            </span>
                        </span>
                    </Link>

                    {sidePosts.length > 0 && (
                        <div className="home-blog-list">
                            {sidePosts.map(post => (
                                <Link href={postHref(post)} className="home-blog-card" key={post.id}>
                                    <span className="home-blog-card-media">
                                        <Image
                                            src={post.cover_image_url || fallbackImage}
                                            alt={post.title}
                                            fill
                                            sizes="(max-width: 900px) 94px, 132px"
                                        />
                                    </span>
                                    <span className="home-blog-card-copy">
                                        <small>{postEyebrow(post)}</small>
                                        <strong>{post.title}</strong>
                                        <span className="home-blog-card-meta">
                                            {formatDate(post.published_at || post.created_at) ? (
                                                <em>{formatDate(post.published_at || post.created_at)}</em>
                                            ) : null}
                                            <span aria-label={blogViewLabel(postViewCount(post))}>
                                                <Eye size={13} />
                                                {formatBlogViewCount(postViewCount(post))}
                                            </span>
                                        </span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .home-blog-section {
                    position: relative;
                    overflow: hidden;
                    padding: clamp(36px, 5vw, 64px) 20px;
                    background:
                        radial-gradient(circle at 88% 12%, rgba(216,185,121,0.13), transparent 32%),
                        linear-gradient(180deg, #f8f5ee 0%, #fffaf1 100%);
                    color: #17130f;
                }
                .home-blog-inner {
                    width: 100%;
                    max-width: 1320px;
                    margin: 0 auto;
                }
                .home-blog-header {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 24px;
                    margin-bottom: 18px;
                }
                .home-blog-header > div:first-child {
                    flex: 1;
                    min-width: 0;
                }
                .home-blog-kicker,
                .home-blog-featured small,
                .home-blog-card small {
                    display: inline-flex;
                    color: #b8945f;
                    font: 950 0.68rem/1 'Inter', sans-serif;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }
                .home-blog-header h2 {
                    max-width: 860px;
                    margin: 8px 0 0;
                    color: #17130f;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.5rem, 2.1vw, 2.35rem);
                    font-weight: 700;
                    line-height: 1.08;
                    letter-spacing: 0;
                }
                .home-blog-header p {
                    max-width: 900px;
                    margin: 12px 0 0;
                    color: #6d6255;
                    font-size: 0.84rem;
                    font-weight: 600;
                    line-height: 1.45;
                }
                .home-blog-copy-short {
                    display: none;
                }
                @media (min-width: 1100px) {
                    .home-blog-header h2,
                    .home-blog-header p {
                        white-space: nowrap;
                    }
                }
                .home-blog-actions {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 8px;
                    flex-shrink: 0;
                }
                .home-blog-link {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    min-height: 38px;
                    padding: 0 14px;
                    border: 1px solid rgba(23,19,15,0.1);
                    border-radius: 999px;
                    background: #17130f;
                    color: #fff8ea !important;
                    font: 950 0.68rem/1 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    text-decoration: none;
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                .home-blog-link-secondary {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    border-color: rgba(184,148,95,0.28);
                    color: #11100e !important;
                }
                .home-blog-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(360px, 0.56fr);
                    gap: 18px;
                    align-items: stretch;
                }
                .home-blog-featured,
                .home-blog-card {
                    min-width: 0;
                    color: inherit;
                    text-decoration: none;
                }
                .home-blog-featured {
                    display: grid;
                    grid-template-columns: minmax(0, 0.95fr) minmax(290px, 0.62fr);
                    overflow: hidden;
                    border: 1px solid rgba(31,27,21,0.1);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.82);
                    box-shadow: 0 18px 44px rgba(43,34,21,0.11);
                }
                .home-blog-featured-media,
                .home-blog-card-media {
                    position: relative;
                    display: block;
                    min-width: 0;
                    overflow: hidden;
                    background: #17130f;
                }
                .home-blog-featured-media {
                    min-height: 320px;
                }
                .home-blog-featured-media img,
                .home-blog-card-media img {
                    object-fit: cover;
                    transition: transform 0.45s ease;
                }
                .home-blog-featured:hover img,
                .home-blog-card:hover img {
                    transform: scale(1.04);
                }
                .home-blog-featured-copy {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0;
                    padding: clamp(22px, 3vw, 34px);
                }
                .home-blog-featured-copy strong {
                    display: -webkit-box;
                    margin: 12px 0 12px;
                    overflow: hidden;
                    color: #17130f;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.35rem, 2.25vw, 2.35rem);
                    font-weight: 700;
                    line-height: 1.05;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 3;
                }
                .home-blog-featured-copy em {
                    display: -webkit-box;
                    overflow: hidden;
                    color: #6d6255;
                    font-size: 0.92rem;
                    font-style: normal;
                    font-weight: 560;
                    line-height: 1.55;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 4;
                }
                .home-blog-meta {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-top: 22px;
                    color: #7a6e60;
                    font-size: 0.76rem;
                    font-weight: 850;
                    line-height: 1.2;
                }
                .home-blog-meta-info {
                    display: inline-flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 10px;
                    min-width: 0;
                }
                .home-blog-meta-info span,
                .home-blog-card-meta span {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    white-space: nowrap;
                }
                .home-blog-meta b {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: #17130f;
                    font-size: 0.68rem;
                    font-weight: 950;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                .home-blog-list {
                    display: grid;
                    gap: 10px;
                }
                .home-blog-card {
                    display: grid;
                    grid-template-columns: 132px minmax(0, 1fr);
                    overflow: hidden;
                    border: 1px solid rgba(31,27,21,0.09);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.76);
                    transition: transform 0.2s ease, border-color 0.2s ease;
                }
                .home-blog-card:hover {
                    border-color: rgba(184,148,95,0.34);
                    transform: translateY(-2px);
                }
                .home-blog-card-media {
                    min-height: 120px;
                }
                .home-blog-card-copy {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0;
                    padding: 14px 16px;
                }
                .home-blog-card small {
                    font-size: 0.55rem;
                    letter-spacing: 0.11em;
                }
                .home-blog-card strong {
                    display: -webkit-box;
                    margin: 8px 0;
                    overflow: hidden;
                    color: #17130f;
                    font-size: 0.95rem;
                    font-weight: 850;
                    line-height: 1.24;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                }
                .home-blog-card em {
                    color: #8a7c6b;
                    font-size: 0.72rem;
                    font-style: normal;
                    font-weight: 800;
                }
                .home-blog-card-meta {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 9px;
                    color: #8a7c6b;
                    font-size: 0.72rem;
                    font-weight: 800;
                }
                @media (max-width: 980px) {
                    .home-blog-header {
                        align-items: flex-start;
                        flex-direction: column;
                    }
                    .home-blog-actions {
                        justify-content: flex-start;
                    }
                    .home-blog-grid,
                    .home-blog-featured {
                        grid-template-columns: 1fr;
                    }
                    .home-blog-featured-media {
                        min-height: 230px;
                    }
                    .home-blog-list {
                        grid-template-columns: 1fr;
                    }
                }
                @media (max-width: 560px) {
                    .home-blog-section {
                        padding: 34px 14px;
                    }
                    .home-blog-header h2 {
                        font-size: clamp(1rem, 4.7vw, 1.16rem);
                        line-height: 1.08;
                        white-space: nowrap;
                    }
                    .home-blog-header p {
                        max-width: 100%;
                        font-size: clamp(0.61rem, 2.65vw, 0.68rem);
                        line-height: 1.35;
                        white-space: nowrap;
                    }
                    .home-blog-copy-full {
                        display: none;
                    }
                    .home-blog-copy-short {
                        display: inline;
                    }
                    .home-blog-actions {
                        width: 100%;
                        flex-wrap: wrap;
                    }
                    .home-blog-featured-copy {
                        padding: 20px 18px;
                    }
                    .home-blog-meta {
                        align-items: flex-start;
                        flex-direction: column;
                    }
                    .home-blog-card {
                        grid-template-columns: 94px minmax(0, 1fr);
                    }
                    .home-blog-card-media {
                        min-height: 112px;
                    }
                    .home-blog-card-copy {
                        padding: 12px 13px;
                    }
                    .home-blog-card strong {
                        font-size: 0.84rem;
                    }
                }
            `}</style>
        </section>
    )
}
