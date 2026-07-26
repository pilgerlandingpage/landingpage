import { NextRequest, NextResponse } from 'next/server'
import {
  deleteCommentDmCampaign,
  listCommentDmAutomation,
  saveCommentDmCampaign,
} from '@/lib/social/meta-comment-dm-automation'

export const dynamic = 'force-dynamic'

function parseLimit(value: string | null, fallback = 60) {
  const parsed = Number(value || fallback)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), 1000)
}

export async function GET(request: NextRequest) {
  try {
    const result = await listCommentDmAutomation(parseLimit(request.nextUrl.searchParams.get('limit')))
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Error listing comment DM campaigns:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao listar campanhas de Direct.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const campaign = await saveCommentDmCampaign(body || {})
    return NextResponse.json({ success: true, campaign })
  } catch (error) {
    console.error('Error saving comment DM campaign:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao salvar campanha de Direct.' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const campaignId = String(body.id || request.nextUrl.searchParams.get('id') || '').trim()
    const campaign = await deleteCommentDmCampaign(campaignId)
    return NextResponse.json({ success: true, campaign })
  } catch (error) {
    console.error('Error deleting comment DM campaign:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao excluir campanha de Direct.' },
      { status: 500 },
    )
  }
}
