import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyPilgerGlobalManagerAccess } from '@/lib/whatsapp/pilger-admin-access'
import { runPilgerGlobalAutomation } from '@/lib/whatsapp/pilger-global-automation'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const access = await verifyPilgerGlobalManagerAccess()
    if (!access) return NextResponse.json({ success: false, error: 'Acesso negado.' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const supabase = createAdminClient()
    const result = await runPilgerGlobalAutomation(supabase, {
      force: body?.force === true,
      dryRun: body?.dry_run === true,
      origin: request.nextUrl.origin,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 },
    )
  }
}
