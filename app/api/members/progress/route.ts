import { NextRequest, NextResponse } from 'next/server'
import { isActiveEntitlement, resolveMemberSession } from '@/lib/members/access'

export const dynamic = 'force-dynamic'

const PROGRESS_STATUS = new Set(['not_started', 'in_progress', 'completed'])

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

async function requireActiveMemberProduct(params: {
  admin: any
  memberId: string
  productId: string
}) {
  const { data: entitlement, error } = await params.admin
    .from('member_entitlements')
    .select('*')
    .eq('member_account_id', params.memberId)
    .eq('product_id', params.productId)
    .eq('status', 'active')
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return isActiveEntitlement(entitlement) ? entitlement : null
}

export async function GET(request: NextRequest) {
  try {
    const productId = text(request.nextUrl.searchParams.get('product_id'))
    if (!productId) {
      return NextResponse.json({ success: false, message: 'Produto não informado.' }, { status: 400 })
    }

    const { user, member, admin } = await resolveMemberSession()
    if (!user || !member || member.status !== 'active') {
      return NextResponse.json({ success: false, message: 'Acesso não autenticado.' }, { status: 401 })
    }

    const entitlement = await requireActiveMemberProduct({ admin, memberId: member.id, productId })
    if (!entitlement) {
      return NextResponse.json({ success: false, message: 'Produto não liberado para este membro.' }, { status: 403 })
    }

    const { data, error } = await admin
      .from('member_content_progress')
      .select('*')
      .eq('member_account_id', member.id)
      .eq('product_id', productId)

    if (error) throw error
    return NextResponse.json({ success: true, progress: data || [] })
  } catch (error) {
    console.error('[Members Progress] GET failed:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao carregar progresso.',
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const contentId = text(body?.product_content_id || body?.content_id)
    if (!contentId) {
      return NextResponse.json({ success: false, message: 'Conteúdo não informado.' }, { status: 400 })
    }

    const { user, member, admin } = await resolveMemberSession()
    if (!user || !member || member.status !== 'active') {
      return NextResponse.json({ success: false, message: 'Acesso não autenticado.' }, { status: 401 })
    }

    const { data: content, error: contentError } = await admin
      .from('commerce_product_contents')
      .select('id, product_id, is_active')
      .eq('id', contentId)
      .maybeSingle()

    if (contentError) throw contentError
    if (!content || content.is_active !== true) {
      return NextResponse.json({ success: false, message: 'Conteúdo não encontrado.' }, { status: 404 })
    }

    const entitlement = await requireActiveMemberProduct({
      admin,
      memberId: member.id,
      productId: content.product_id,
    })

    if (!entitlement) {
      return NextResponse.json({ success: false, message: 'Produto não liberado para este membro.' }, { status: 403 })
    }

    const rawStatus = text(body?.status, 'in_progress')
    const status = PROGRESS_STATUS.has(rawStatus) ? rawStatus : 'in_progress'
    const progressPercent = status === 'completed'
      ? 100
      : clamp(numberValue(body?.progress_percent, status === 'in_progress' ? 1 : 0), 0, 99)
    const lastPositionSeconds = Math.max(0, Math.round(numberValue(body?.last_position_seconds, 0)))
    const now = new Date().toISOString()

    const { data, error } = await admin
      .from('member_content_progress')
      .upsert([{
        member_account_id: member.id,
        product_id: content.product_id,
        product_content_id: content.id,
        status,
        progress_percent: progressPercent,
        last_position_seconds: lastPositionSeconds,
        completed_at: status === 'completed' ? now : null,
        updated_at: now,
      }], {
        onConflict: 'member_account_id,product_content_id',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, progress: data })
  } catch (error) {
    console.error('[Members Progress] POST failed:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao salvar progresso.',
    }, { status: 500 })
  }
}
