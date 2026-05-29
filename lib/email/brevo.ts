import { createClient } from '@supabase/supabase-js'

type BrevoConfig = {
  apiKey: string
  senderName: string
  senderEmail: string
  replyToEmail?: string
}

type BrevoRecipient = {
  email: string
  name?: string
}

type SendBrevoEmailParams = {
  to: BrevoRecipient[]
  subject: string
  htmlContent: string
  textContent?: string
  sender?: BrevoRecipient
  replyTo?: BrevoRecipient
}

function parseJsonText(text: string) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

async function loadConfigFromAppConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return {}

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['brevo_api_key', 'brevo_sender_name', 'brevo_sender_email', 'brevo_reply_to_email'])

  return Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')])) as Record<string, string>
}

export async function getBrevoConfig(): Promise<BrevoConfig> {
  const appConfig = await loadConfigFromAppConfig()
  const config = {
    apiKey: (appConfig.brevo_api_key || process.env.BREVO_API_KEY || '').trim(),
    senderName: (appConfig.brevo_sender_name || process.env.BREVO_SENDER_NAME || 'Guilherme Pilger').trim(),
    senderEmail: (appConfig.brevo_sender_email || process.env.BREVO_SENDER_EMAIL || '').trim(),
    replyToEmail: (appConfig.brevo_reply_to_email || process.env.BREVO_REPLY_TO_EMAIL || '').trim(),
  }

  if (!config.apiKey) throw new Error('Brevo nao configurado: API Key ausente.')
  if (!config.senderEmail) throw new Error('Brevo nao configurado: e-mail do remetente ausente.')
  return config
}

export async function sendBrevoEmail(params: SendBrevoEmailParams) {
  const config = await getBrevoConfig()
  const sender = params.sender || { name: config.senderName, email: config.senderEmail }
  const replyTo = params.replyTo || (config.replyToEmail ? { email: config.replyToEmail } : undefined)

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: params.to,
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent,
      replyTo,
    }),
  })

  const text = await response.text()
  const data = parseJsonText(text)
  if (!response.ok) {
    const message = data?.message || data?.error || response.statusText
    throw new Error(`Brevo erro ${response.status}: ${message}`)
  }
  return data
}
