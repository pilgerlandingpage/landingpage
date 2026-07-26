import { saveAppConfig } from '@/lib/admin/app-config'
import {
  enqueueBehavioralPropertyRecommendations,
  processDueEditorialDistribution,
} from '@/lib/editorial-distribution'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from './client'

async function saveCronState(values: Record<string, string>) {
  const supabase = createAdminClient()
  await Promise.all(
    Object.entries(values).map(([key, value]) => saveAppConfig(supabase, key, value).catch(() => {}))
  )
}

export const editorialDistributionCron = inngest.createFunction(
  { id: 'editorial-distribution-cron', name: 'Editorial - distribuicao e recomendacoes' },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const checkedAt = new Date().toISOString()

    await step.run('mark-editorial-distribution-started', async () => {
      await saveCronState({
        editorial_distribution_cron_last_checked_at: checkedAt,
        editorial_distribution_cron_last_reason: 'processing_inngest',
      })
    })

    const recommendationResult = await step.run('enqueue-behavioral-property-recommendations', async () => {
      const supabase = createAdminClient()
      try {
        return await enqueueBehavioralPropertyRecommendations(supabase)
      } catch (error: any) {
        console.warn('[editorial-distribution-inngest] recommendation enqueue failed:', error)
        return {
          queued: false,
          skipped: true,
          reason: 'recommendation_error',
          error: String(error?.message || error).slice(0, 500),
        }
      }
    })

    const result = await step.run('process-due-editorial-distribution', async () => {
      const supabase = createAdminClient()
      return processDueEditorialDistribution(supabase, 20)
    })

    const combinedResult = {
      ...result,
      recommendations: recommendationResult,
    }

    await step.run('save-editorial-distribution-result', async () => {
      const reason = String((result as any).reason || 'skipped')
      await saveCronState({
        editorial_distribution_cron_last_reason: result.skipped ? reason : 'ran_inngest',
        editorial_distribution_cron_last_run_at: new Date().toISOString(),
        editorial_distribution_cron_last_result: JSON.stringify(combinedResult).slice(0, 2000),
      })
    })

    return combinedResult
  }
)

export const editorialDistributionFunctions = [
  editorialDistributionCron,
]
