import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { generateNewsArticleDraft } from '@/lib/blog/agent'
import { notifyBlogReviewReady } from '@/lib/blog/review-notifications'
import { getAvailableBlogSlug } from '@/lib/blog/types'
import { getAgentEcosystemContext, recordEcosystemEvent, saveEcosystemSnapshot } from '@/lib/intelligence/ecosystem'
import { createAdminClient } from '@/lib/supabase/server'

type RunNewsAgentOptions = {
  topic?: string
  origin?: string | null
  source?: string
  contextAugmentation?: Record<string, unknown> | null
}

export async function runNewsAgentDraft(options: RunNewsAgentOptions = {}) {
  const supabase = createAdminClient()
  const source = options.source || 'news_agent'

  await markAgentStarted(supabase, 'news_agent')

  try {
    const draft = await generateNewsArticleDraft(options.topic, {
      contextAugmentation: options.contextAugmentation,
    })
    const slug = await getAvailableBlogSlug(supabase, draft.slug || draft.title)
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        ...draft,
        slug,
        status: 'under_review',
        published_at: null,
      })
      .select('*')
      .single()

    if (error || !post) throw new Error(error?.message || 'Nao foi possivel salvar a noticia do agente.')

    const intelligence = await (async () => {
      try {
        const occurredAt = new Date().toISOString()
        const event = await recordEcosystemEvent({
          supabase,
          eventType: 'news_draft_created',
          actorType: 'agent',
          entityType: 'blog_post',
          entityId: post.id,
          source: 'news-intelligence',
          label: post.title,
          importanceScore: 70,
          occurredAt,
          metadata: {
            slug: post.slug,
            status: post.status,
            category: post.category,
            primary_keyword: post.primary_keyword,
            origin: options.origin || null,
            context_source: options.contextAugmentation ? 'lara_benchmark_handoff' : null,
          },
        })
        const context = await getAgentEcosystemContext({ supabase, agent: 'news', days: 30 })
        const saved = await saveEcosystemSnapshot({
          supabase,
          agent: 'news',
          scope: 'global',
          createdBy: 'news-intelligence',
          context: {
            ...context,
            executive_summary: [
              `Clara Edicao Noticias criou uma noticia para revisao: "${post.title}".`,
              context.executive_summary || '',
            ].filter(Boolean).join(' '),
            signals: {
              ...(context.signals || {}),
              latest_news_draft: {
                id: post.id,
                title: post.title,
                slug: post.slug,
                status: post.status,
                category: post.category,
                primary_keyword: post.primary_keyword,
                source: options.contextAugmentation ? 'lara_benchmark_handoff' : source,
                created_at: post.created_at,
              },
            },
          },
        })

        return {
          event: event.skipped ? null : event.event,
          snapshot: saved.skipped ? null : saved.snapshot,
          skipped: Boolean(event.skipped || saved.skipped),
        }
      } catch (error: any) {
        console.warn('[News Agent] intelligence record failed:', error?.message || error)
        return { event: null, snapshot: null, error: error?.message || String(error) }
      }
    })()

    const notification = await notifyBlogReviewReady({
      supabase,
      post,
      origin: options.origin || null,
    })

    const result = {
      skipped: false,
      source,
      post: {
        id: post.id,
        title: post.title,
        status: post.status,
        category: post.category,
      },
      intelligence,
      notification,
    }

    await markAgentCompleted(supabase, 'news_agent', result)
    return result
  } catch (error) {
    await markAgentFailed(supabase, 'news_agent', error).catch(() => {})
    throw error
  }
}
