import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { createAdminClient } from '@/lib/supabase/server'
import { generateBlogArticleDraft } from './agent'
import { notifyBlogReviewReady } from './review-notifications'

type RunBlogAgentOptions = {
  topic?: string
  origin?: string | null
  source?: string
}

export async function runBlogAgentDraft(options: RunBlogAgentOptions = {}) {
  const supabase = createAdminClient()
  const source = options.source || 'blog_agent'

  await markAgentStarted(supabase, 'blog_agent')

  try {
    const draft = await generateBlogArticleDraft(options.topic)
    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        ...draft,
        status: 'under_review',
        published_at: null,
      })
      .select('*')
      .single()

    if (error || !post) throw new Error(error?.message || 'Nao foi possivel salvar o artigo do agente de blog.')

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
      notification,
    }

    await markAgentCompleted(supabase, 'blog_agent', result)
    return result
  } catch (error) {
    await markAgentFailed(supabase, 'blog_agent', error).catch(() => {})
    throw error
  }
}
