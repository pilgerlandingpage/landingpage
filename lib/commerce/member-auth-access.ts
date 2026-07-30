import { buildAuthActionBridgeLink, getLoginRedirectUrl } from '@/lib/app-url'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type MemberAccessParams = {
  member: Record<string, any>
  customer: Record<string, any>
  origin?: string | null
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function isDuplicateUserError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as any)?.message || error || '')
  return /already|registered|exists|duplicate|unique/i.test(message)
}

function memberRedirectPath() {
  return '/membros/entrar?first_access=1&next=/membros'
}

async function generateRecoveryLink(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>
  email: string
  origin?: string | null
}) {
  return params.admin.auth.admin.generateLink({
    type: 'recovery',
    email: params.email,
    options: {
      redirectTo: getLoginRedirectUrl(memberRedirectPath(), params.origin),
    },
  })
}

export async function ensureMemberAuthAccess(params: MemberAccessParams) {
  const email = text(params.member.email || params.customer.email).toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { created: false, access_link: '', auth_user_id: text(params.member.auth_user_id), reason: 'missing_email' }
  }

  const admin = createSupabaseAdminClient()
  const memberName = text(params.member.name || params.customer.name, 'Membro Pilger')
  const redirectTo = getLoginRedirectUrl(memberRedirectPath(), params.origin)
  let linkData: any = null
  let linkError: any = null
  let created = false

  if (!params.member.auth_user_id) {
    const result = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo,
        data: {
          name: memberName,
          account_type: 'member',
          member_account_id: params.member.id,
        },
      },
    })

    linkData = result.data
    linkError = result.error
    created = !result.error

    if (result.error && isDuplicateUserError(result.error)) {
      const recoveryResult = await generateRecoveryLink({ admin, email, origin: params.origin })
      linkData = recoveryResult.data
      linkError = recoveryResult.error
      created = false
    }
  } else {
    const recoveryResult = await generateRecoveryLink({ admin, email, origin: params.origin })
    linkData = recoveryResult.data
    linkError = recoveryResult.error
  }

  if (linkError) {
    return {
      created: false,
      access_link: '',
      auth_user_id: text(params.member.auth_user_id),
      reason: linkError.message || 'link_generation_failed',
    }
  }

  const authUserId = text(linkData?.user?.id || params.member.auth_user_id)
  const rawLink = text(linkData?.properties?.action_link)
  const accessLink = rawLink
    ? buildAuthActionBridgeLink(rawLink, 'first_access', params.origin, memberRedirectPath())
    : ''

  if (authUserId && authUserId !== params.member.auth_user_id) {
    await admin
      .from('member_accounts')
      .update({
        auth_user_id: authUserId,
        metadata: {
          ...(params.member.metadata && typeof params.member.metadata === 'object' ? params.member.metadata : {}),
          auth_link_generated_at: new Date().toISOString(),
          auth_link_flow: created ? 'invite' : 'recovery',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.member.id)
  }

  return {
    created,
    access_link: accessLink,
    auth_user_id: authUserId,
    reason: accessLink ? null : 'missing_action_link',
  }
}
