import { createAdminClient } from '@/lib/supabase/server'
import { processMetaWhatsAppContactListValidationBatch } from '@/lib/meta/whatsapp-contact-list-validation'
import { processMetaWhatsAppCampaignBatch } from '@/lib/meta/whatsapp-campaigns'
import { inngest } from './client'

const DEFAULT_META_WHATSAPP_BATCH_SIZE = 50
const META_WHATSAPP_BATCH_COOLDOWN = '60s'

function minutesUntil(value?: string | null) {
  if (!value) return 0
  const target = new Date(value).getTime()
  if (!Number.isFinite(target)) return 0
  return Math.max(0, Math.ceil((target - Date.now()) / 60000))
}

async function loadCampaignSchedule(campaignId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('meta_whatsapp_campaigns')
    .select('id, status, scheduled_for')
    .eq('id', campaignId)
    .maybeSingle()

  if (error) throw error
  return data
}

export const metaWhatsAppCampaignCreated = inngest.createFunction(
  { id: 'meta-whatsapp-campaign-created', name: 'Meta WhatsApp - campanha criada' },
  { event: 'meta-whatsapp/campaign-created' },
  async ({ event, step }) => {
    const campaignId = event.data.campaign_id

    const campaign = await step.run('load-meta-whatsapp-campaign', async () => {
      return loadCampaignSchedule(campaignId)
    })

    if (!campaign) return { skipped: true, reason: 'campaign_not_found' }
    if (['paused', 'cancelled', 'completed', 'failed'].includes(String(campaign.status))) {
      return { skipped: true, reason: `campaign_${campaign.status}` }
    }

    const waitMinutes = minutesUntil(campaign.scheduled_for)
    if (waitMinutes > 0) {
      await step.sleep('wait-meta-whatsapp-schedule', `${waitMinutes}m`)
    }

    await step.sendEvent('send-meta-whatsapp-first-batch', {
      name: 'meta-whatsapp/send-batch',
      data: {
        campaign_id: campaignId,
        batch_number: 1,
        batch_size: event.data.batch_size || DEFAULT_META_WHATSAPP_BATCH_SIZE,
        reason: event.data.reason || 'campaign_created',
      },
    })

    return { queued: true, campaign_id: campaignId }
  }
)

export const metaWhatsAppSendBatch = inngest.createFunction(
  { id: 'meta-whatsapp-send-batch', name: 'Meta WhatsApp - enviar lote' },
  { event: 'meta-whatsapp/send-batch' },
  async ({ event, step }) => {
    const batchNumber = Number(event.data.batch_number || 1)
    const batchSize = Number(event.data.batch_size || DEFAULT_META_WHATSAPP_BATCH_SIZE)

    const result = await step.run(`send-meta-whatsapp-batch-${batchNumber}`, async () => {
      return processMetaWhatsAppCampaignBatch({
        campaignId: event.data.campaign_id,
        batchSize,
      })
    })

    if (result.hasMore) {
      await step.sleep(`meta-whatsapp-batch-cooldown-${batchNumber}`, META_WHATSAPP_BATCH_COOLDOWN)
      await step.sendEvent(`send-meta-whatsapp-next-batch-${batchNumber + 1}`, {
        name: 'meta-whatsapp/send-batch',
        data: {
          campaign_id: event.data.campaign_id,
          batch_number: batchNumber + 1,
          batch_size: batchSize,
          reason: 'batch_has_more',
        },
      })
    }

    return result
  }
)

export const metaWhatsAppDueCampaignCron = inngest.createFunction(
  { id: 'meta-whatsapp-due-campaign-cron', name: 'Meta WhatsApp - campanhas pendentes' },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const dueCampaigns = await step.run('load-due-meta-whatsapp-campaigns', async () => {
      const supabase = createAdminClient()
      const now = Date.now()
      const { data, error } = await supabase
        .from('meta_whatsapp_campaigns')
        .select('id, status, scheduled_for')
        .in('status', ['queued', 'scheduled', 'sending'])
        .order('scheduled_for', { ascending: true, nullsFirst: true })
        .limit(60)

      if (error) throw error
      return (data || [])
        .filter((campaign: any) => !campaign.scheduled_for || new Date(campaign.scheduled_for).getTime() <= now)
        .slice(0, 20)
    })

    for (const campaign of dueCampaigns) {
      await step.sendEvent(`send-due-meta-whatsapp-${campaign.id}`, {
        name: 'meta-whatsapp/send-batch',
        data: {
          campaign_id: campaign.id,
          batch_number: 1,
          batch_size: DEFAULT_META_WHATSAPP_BATCH_SIZE,
          reason: 'cron_due_campaign',
        },
      })
    }

    return { queued: dueCampaigns.length }
  }
)

export const metaWhatsAppContactListValidate = inngest.createFunction(
  { id: 'meta-whatsapp-contact-list-validate', name: 'Meta WhatsApp - validar lista de contatos' },
  { event: 'meta-whatsapp/contact-list-validate' },
  async ({ event, step }) => {
    const batchNumber = Number(event.data.batch_number || 1)
    const batchSize = Math.min(250, Math.max(10, Number(event.data.batch_size || 100)))

    const result = await step.run(`validate-meta-whatsapp-contact-list-${batchNumber}`, async () => {
      return processMetaWhatsAppContactListValidationBatch({
        listId: event.data.list_id,
        runId: event.data.run_id,
        batchNumber,
        batchSize,
        force: Boolean(event.data.force),
        instanceToken: event.data.instance_token || null,
      })
    })

    if (result.hasMore && result.status !== 'stale') {
      await step.sleep(`meta-whatsapp-contact-list-validate-cooldown-${batchNumber}`, '20s')
      await step.sendEvent(`validate-meta-whatsapp-contact-list-next-${batchNumber + 1}`, {
        name: 'meta-whatsapp/contact-list-validate',
        data: {
          list_id: event.data.list_id,
          run_id: event.data.run_id,
          batch_number: batchNumber + 1,
          batch_size: batchSize,
          force: Boolean(event.data.force),
          instance_token: event.data.instance_token || null,
          reason: 'contact_list_validation_has_more',
        },
      })
    }

    return result
  }
)

export const metaWhatsAppCampaignFunctions = [
  metaWhatsAppCampaignCreated,
  metaWhatsAppSendBatch,
  metaWhatsAppDueCampaignCron,
  metaWhatsAppContactListValidate,
]
