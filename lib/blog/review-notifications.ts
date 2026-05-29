import { getPublicAppUrl } from '@/lib/app-url'
import {
    getSectorNotificationDeliveries,
    resolveSectorWhatsappInstance,
} from '@/lib/notifications/sector-recipients'
import { sendMenuMessage, sendWhatsAppMessage } from '@/lib/uazapi'

type SupabaseAdmin = {
    from: (table: string) => any
}

type BlogReviewNotificationParams = {
    supabase: SupabaseAdmin
    post: Record<string, any>
    origin?: string | null
    actorName?: string | null
}

function isNewsPost(post: Record<string, any>) {
    const category = String(post.category || '').toLowerCase()
    const tags = Array.isArray(post.tags) ? post.tags.map(tag => String(tag).toLowerCase()) : []
    return category.includes('noticia') || tags.some(tag => tag.includes('noticia')) || post.generated_by === 'news-intelligence'
}

export async function notifyBlogReviewReady({ supabase, post, origin }: BlogReviewNotificationParams) {
    try {
        const newsPost = isNewsPost(post)
        let deliveries = await getSectorNotificationDeliveries(supabase, 'marketing', {
            eventType: newsPost ? 'news_review' : 'blog_review',
        })
        if (newsPost && deliveries.length === 0) {
            deliveries = await getSectorNotificationDeliveries(supabase, 'marketing', { eventType: 'blog_review' })
        }
        if (!deliveries.length) return { sent: false, skipped: true, reason: `Setor Marketing sem envolvidos para ${newsPost ? 'noticia' : 'blog'} em analise.` }
        const instanceToken = await resolveSectorWhatsappInstance(supabase)
        if (!instanceToken) {
            return { sent: false, skipped: true, reason: 'Nenhuma instancia WhatsApp global conectada.' }
        }

        const reviewPath = newsPost ? '/admin/noticias' : '/admin/blog'
        const reviewUrl = `${getPublicAppUrl(origin)}${reviewPath}?review=${encodeURIComponent(String(post.id || ''))}`
        let sentCount = 0
        let errorCount = 0

        for (const delivery of deliveries) {
            const recipient = delivery.recipient
            const message = [
                newsPost ? '*Nova noticia aguardando analise*' : '*Novo artigo de blog aguardando analise*',
                '',
                `Setor: ${recipient?.label || 'Marketing'}`,
                `Responsavel: ${delivery.member?.name || recipient?.responsible_name || 'Marketing'}`,
                '',
                `${newsPost ? 'Noticia' : 'Artigo'}: ${post.title || 'Sem titulo'}`,
                `Palavra-chave: ${post.primary_keyword || 'Nao informada'}`,
                `Status: ${post.status || 'em analise'}`,
                '',
                newsPost
                    ? 'A Clara Edicao Noticias concluiu um rascunho com base em pesquisas e sinais publicos. Revise fontes e contexto antes de publicar.'
                    : 'A Isadora Edicao Blog concluiu um rascunho com base nos dados do ecossistema. Revise antes de publicar.',
            ].join('\n')

            try {
                await sendMenuMessage({
                    phone: delivery.phone,
                    text: message,
                    type: 'button',
                    choices: [`Revisar ${newsPost ? 'noticia' : 'artigo'}|url:${reviewUrl}`],
                    footerText: 'Pilger Marketing',
                    instanceToken,
                })
                sentCount += 1
            } catch (buttonError) {
                console.warn('[Blog Review Notification] button send failed, falling back to text:', buttonError)
                try {
                    await sendWhatsAppMessage({
                    phone: delivery.phone,
                    message: `${message}\n\nRevisar ${newsPost ? 'noticia' : 'artigo'}: ${reviewUrl}`,
                    instanceToken,
                })
                    sentCount += 1
                } catch (textError) {
                    errorCount += 1
                    console.error('[Blog Review Notification] text fallback failed:', textError)
                }
            }
        }

        return { sent: sentCount > 0, sent_count: sentCount, error_count: errorCount }
    } catch (error: any) {
        console.error('[Blog Review Notification] failed:', error)
        return { sent: false, error: error?.message || String(error) }
    }
}

export async function notifyBlogPublished({ supabase, post, origin, actorName }: BlogReviewNotificationParams) {
    try {
        const newsPost = isNewsPost(post)
        let deliveries = await getSectorNotificationDeliveries(supabase, 'marketing', {
            eventType: newsPost ? 'news_published' : 'blog_published',
            includeDiretoria: true,
        })
        if (newsPost && deliveries.length === 0) {
            deliveries = await getSectorNotificationDeliveries(supabase, 'marketing', {
                eventType: 'blog_published',
                includeDiretoria: true,
            })
        }
        if (!deliveries.length) return { sent: false, skipped: true, reason: `Nenhum envolvido configurado para ${newsPost ? 'noticia' : 'blog'} publicado.` }

        const instanceToken = await resolveSectorWhatsappInstance(supabase)
        if (!instanceToken) {
            return { sent: false, skipped: true, reason: 'Nenhuma instancia WhatsApp global conectada.' }
        }

        const slug = String(post.slug || '').trim()
        const blogUrl = `${getPublicAppUrl(origin)}/blog${slug ? `/${encodeURIComponent(slug)}` : ''}`
        const publishedBy = String(actorName || post.published_by || post.updated_by || 'Pilger Admin').trim()
        const message = [
            newsPost ? '*Nova noticia no ar*' : '*Novo blog no ar*',
            '',
            `${newsPost ? 'Noticia' : 'Artigo'}: ${post.title || 'Sem titulo'}`,
            `Publicado por: ${publishedBy}`,
            `Categoria: ${post.category || (newsPost ? 'Noticias' : 'Blog')}`,
            '',
            'A pagina ja pode ser compartilhada com leads, corretores e equipe.',
        ].join('\n')

        let sentCount = 0
        let errorCount = 0
        for (const delivery of deliveries) {
            try {
                await sendMenuMessage({
                    phone: delivery.phone,
                    text: message,
                    type: 'button',
                    choices: [`Ver ${newsPost ? 'noticia' : 'blog'}|url:${blogUrl}`],
                    footerText: newsPost ? 'Pilger Noticias' : 'Pilger Blog',
                    instanceToken,
                })
                sentCount += 1
            } catch (buttonError) {
                console.warn('[Blog Published Notification] button send failed, falling back to text:', buttonError)
                try {
                    await sendWhatsAppMessage({
                    phone: delivery.phone,
                    message: `${message}\n\nVer ${newsPost ? 'noticia' : 'blog'}: ${blogUrl}`,
                    instanceToken,
                })
                    sentCount += 1
                } catch (textError) {
                    errorCount += 1
                    console.error('[Blog Published Notification] text fallback failed:', textError)
                }
            }
        }

        return { sent: sentCount > 0, sent_count: sentCount, error_count: errorCount }
    } catch (error: any) {
        console.error('[Blog Published Notification] failed:', error)
        return { sent: false, error: error?.message || String(error) }
    }
}
