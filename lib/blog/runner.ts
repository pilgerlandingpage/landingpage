import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { getAgentEcosystemContext, recordEcosystemEvent, saveEcosystemSnapshot } from '@/lib/intelligence/ecosystem'
import { createAdminClient } from '@/lib/supabase/server'
import { registerEditorialVisualPlanUsage } from '@/lib/media/editorial-image-curator'
import { generateBlogArticleDraft } from './agent'
import { notifyBlogReviewReady } from './review-notifications'
import { getAvailableBlogSlug } from './types'

type RunBlogAgentOptions = {
  topic?: string
  origin?: string | null
  source?: string
  contextAugmentation?: Record<string, unknown> | null
}

export async function runBlogAgentDraft(options: RunBlogAgentOptions = {}) {
  const supabase = createAdminClient()
  const source = options.source || 'blog_agent'

  await markAgentStarted(supabase, 'blog_agent')

  try {
    const draft = await generateBlogArticleDraft(options.topic, {
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

    if (error || !post) throw new Error(error?.message || 'Nao foi possivel salvar o artigo do agente de blog.')

    await registerEditorialVisualPlanUsage(supabase, post).catch((mediaError: any) => {
      console.warn('[Blog Agent] editorial media usage register failed:', mediaError?.message || mediaError)
    })

    const intelligence = await (async () => {
      try {
        const occurredAt = new Date().toISOString()
        const event = await recordEcosystemEvent({
          supabase,
          eventType: 'blog_draft_created',
          actorType: 'agent',
          entityType: 'blog_post',
          entityId: post.id,
          source: 'blog-intelligence',
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
        const context = await getAgentEcosystemContext({ supabase, agent: 'blog', days: 30 })
        const saved = await saveEcosystemSnapshot({
          supabase,
          agent: 'blog',
          scope: 'global',
          createdBy: 'blog-intelligence',
          context: {
            ...context,
            executive_summary: [
              `Agente de Blog criou um artigo para revisao: "${post.title}".`,
              context.executive_summary || '',
            ].filter(Boolean).join(' '),
            signals: {
              ...(context.signals || {}),
              latest_blog_draft: {
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
        console.warn('[Blog Agent] intelligence record failed:', error?.message || error)
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
      },
      intelligence,
      notification,
    }

    await markAgentCompleted(supabase, 'blog_agent', result)
    return result
  } catch (error) {
    await markAgentFailed(supabase, 'blog_agent', error).catch(() => {})
    throw error
  }
}
