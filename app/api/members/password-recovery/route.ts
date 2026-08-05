import { NextRequest, NextResponse } from 'next/server'
import { buildAuthActionBridgeLink, getLoginRedirectUrl } from '@/lib/app-url'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadCommerceConfig, normalizeBrazilPhone } from '@/lib/commerce/checkout'
import { dispatchCommerceMessage } from '@/lib/commerce/transactional-messages'

export const dynamic = 'force-dynamic'

const GENERIC_SUCCESS_MESSAGE =
  'Se os dados conferirem, enviaremos um link seguro pelo WhatsApp cadastrado.'

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function onlyDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function dispatchError(result: unknown) {
  if (!result || typeof result !== 'object' || !('error' in result)) return undefined
  return (result as { error?: unknown }).error
}

function safeMemberNextPath(value: unknown) {
  const selected = text(value, '/membros')
  return selected.startsWith('/membros') ? selected : '/membros'
}

function buildPhoneVariants(value: unknown) {
  const digits = onlyDigits(value)
  const variants = new Set<string>()
  if (!digits) return variants

  const add = (phone: string) => {
    const cleaned = onlyDigits(phone)
    if (!cleaned) return
    variants.add(cleaned)

    const noLeadingZero = cleaned.replace(/^0+/, '')
    if (noLeadingZero) variants.add(noLeadingZero)

    if (cleaned.startsWith('55') && cleaned.length > 2) variants.add(cleaned.slice(2))
    if (!cleaned.startsWith('55') && (cleaned.length === 10 || cleaned.length === 11)) variants.add(`55${cleaned}`)
  }

  add(digits)

  for (const candidate of [...variants]) {
    const local = candidate.startsWith('55') ? candidate.slice(2) : candidate
    if (local.length === 11 && local[2] === '9') add(`${candidate.startsWith('55') ? '55' : ''}${local.slice(0, 2)}${local.slice(3)}`)
    if (local.length === 10) add(`${candidate.startsWith('55') ? '55' : ''}${local.slice(0, 2)}9${local.slice(2)}`)
  }

  return variants
}

function phoneMatches(inputPhone: unknown, registeredPhone: unknown) {
  const inputVariants = buildPhoneVariants(inputPhone)
  const registeredVariants = buildPhoneVariants(registeredPhone)
  if (!inputVariants.size || !registeredVariants.size) return false

  for (const phone of inputVariants) {
    if (registeredVariants.has(phone)) return true
  }
  return false
}

function recoveryRedirectPath(nextPath: string) {
  return `/membros/entrar?password_reset=1&next=${encodeURIComponent(nextPath)}`
}

function firstAccessRedirectPath(nextPath: string) {
  return `/membros/entrar?first_access=1&next=${encodeURIComponent(nextPath)}`
}

async function loadMemberBundle(admin: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  const { data: members, error: memberError } = await admin
    .from('member_accounts')
    .select('*')
    .eq('email', email)
    .order('updated_at', { ascending: false })
    .limit(5)

  if (memberError) throw memberError
  let member = (members || []).find((item: any) => item.status === 'active') || (members || [])[0] || null

  let customer = null
  if (member?.customer_id) {
    const { data, error } = await admin
      .from('commerce_customers')
      .select('*')
      .eq('id', member.customer_id)
      .maybeSingle()
    if (error) throw error
    customer = data
  }

  if (!customer) {
    const { data, error } = await admin
      .from('commerce_customers')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    if (error) throw error
    customer = data
  }

  if (!member && customer?.id) {
    const { data, error } = await admin
      .from('member_accounts')
      .select('*')
      .eq('customer_id', customer.id)
      .maybeSingle()
    if (error) throw error
    member = data
  }

  return { member, customer }
}

async function isApprovedOfficialTemplate(admin: ReturnType<typeof createSupabaseAdminClient>, templateKey: string) {
  const { data: template, error: templateError } = await admin
    .from('message_templates')
    .select('metadata')
    .eq('business_unit', 'education')
    .eq('channel', 'whatsapp')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .maybeSingle()

  if (templateError) throw templateError
  const metadata = template?.metadata && typeof template.metadata === 'object' ? template.metadata as Record<string, any> : {}
  const meta = metadata.meta_whatsapp && typeof metadata.meta_whatsapp === 'object'
    ? metadata.meta_whatsapp as Record<string, any>
    : {}
  const templateName = text(meta.template_name || meta.templateName || metadata.meta_whatsapp_template_name)
  const language = text(meta.template_language || meta.templateLanguage, 'pt_BR')
  if (!templateName) return false

  const { data: official, error: officialError } = await admin
    .from('meta_whatsapp_templates')
    .select('status')
    .eq('name', templateName)
    .eq('language', language)
    .maybeSingle()

  if (officialError) throw officialError
  return String(official?.status || '').toUpperCase() === 'APPROVED'
}

function duplicateUserError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as any)?.message || error || '')
  return /already|registered|exists|duplicate|unique/i.test(message)
}

async function generateMemberPasswordLink(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>
  member: Record<string, any>
  customer: Record<string, any> | null
  email: string
  origin: string
  nextPath: string
}) {
  const { admin, member, customer, email, origin, nextPath } = params
  const memberName = text(member.name || customer?.name, 'Membro Pilger')
  const hasAuthUser = Boolean(text(member.auth_user_id))
  let flow: 'first_access' | 'password_reset' = hasAuthUser ? 'password_reset' : 'first_access'
  let redirectPath = hasAuthUser ? recoveryRedirectPath(nextPath) : firstAccessRedirectPath(nextPath)

  let result: any
  if (hasAuthUser) {
    result = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: getLoginRedirectUrl(redirectPath, origin),
      },
    })
  } else {
    result = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: getLoginRedirectUrl(redirectPath, origin),
        data: {
          name: memberName,
          account_type: 'member',
          member_account_id: member.id,
        },
      },
    })
  }

  if (result.error && !hasAuthUser && duplicateUserError(result.error)) {
    flow = 'password_reset'
    redirectPath = recoveryRedirectPath(nextPath)
    result = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: getLoginRedirectUrl(redirectPath, origin),
      },
    })
  }

  if (result.error) throw result.error

  const authUserId = text(result.data?.user?.id || member.auth_user_id)
  const rawLink = text(result.data?.properties?.action_link)
  if (!rawLink) throw new Error('missing_action_link')

  if (authUserId && authUserId !== member.auth_user_id) {
    await admin
      .from('member_accounts')
      .update({
        auth_user_id: authUserId,
        metadata: {
          ...(member.metadata && typeof member.metadata === 'object' ? member.metadata : {}),
          auth_link_generated_at: new Date().toISOString(),
          auth_link_flow: flow,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.id)
  }

  return {
    flow,
    link: buildAuthActionBridgeLink(rawLink, flow, origin, redirectPath),
    authUserId,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = text(body?.email).toLowerCase()
    const phone = text(body?.phone)
    const nextPath = safeMemberNextPath(body?.next)

    if (!email || !isValidEmail(email) || !phone) {
      return NextResponse.json({ success: false, message: 'Informe o e-mail e o WhatsApp usados na compra.' }, { status: 400 })
    }

    const admin = createSupabaseAdminClient()
    const { member, customer } = await loadMemberBundle(admin, email)
    const registeredPhone = text(customer?.phone_e164 || customer?.phone)

    if (!member || member.status !== 'active' || !registeredPhone || !phoneMatches(phone, registeredPhone)) {
      return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE })
    }

    const access = await generateMemberPasswordLink({
      admin,
      member,
      customer,
      email,
      origin: request.nextUrl.origin,
      nextPath,
    })

    const config = await loadCommerceConfig()
    const messageCustomer = {
      id: customer?.id || member.customer_id || null,
      name: text(member.name || customer?.name, 'Membro Pilger'),
      email,
      phone: registeredPhone,
      phone_e164: normalizeBrazilPhone(registeredPhone),
      whatsapp_opt_in: customer?.whatsapp_opt_in === true,
    }
    const variables = {
      nome: messageCustomer.name,
      produto: 'area de membros Guilherme Pilger',
      access_link: access.link,
      recovery_url: access.link,
      member_area_url: config.memberAreaUrl,
    }

    const recoveryTemplateApproved = await isApprovedOfficialTemplate(admin, 'member_password_recovery_whatsapp')
    const primary = recoveryTemplateApproved
      ? await dispatchCommerceMessage({
          supabase: admin,
          templateKey: 'member_password_recovery_whatsapp',
          channel: 'whatsapp',
          customer: messageCustomer,
          variables,
        }).catch((error: any) => ({ sent: false, error: error?.message || String(error) }))
      : { sent: false, skipped: true, reason: 'official_template_not_approved' }

    const fallback = primary?.sent
      ? primary
      : await dispatchCommerceMessage({
          supabase: admin,
          templateKey: 'member_first_access_whatsapp',
          channel: 'whatsapp',
          customer: messageCustomer,
          variables,
        }).catch((error: any) => ({ sent: false, error: error?.message || String(error) }))

    if (!fallback?.sent) {
      console.error('[Members Password Recovery] WhatsApp send failed:', dispatchError(fallback) || dispatchError(primary) || fallback)
      return NextResponse.json(
        { success: false, message: 'Dados confirmados, mas nao foi possivel enviar o link pelo WhatsApp agora.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, message: GENERIC_SUCCESS_MESSAGE })
  } catch (error) {
    console.error('[Members Password Recovery] failed:', error)
    return NextResponse.json({ success: false, message: 'Nao foi possivel iniciar a recuperacao agora.' }, { status: 500 })
  }
}
