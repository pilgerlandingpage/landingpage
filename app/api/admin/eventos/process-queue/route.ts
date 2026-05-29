import { NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import { processDueEventMessages } from '@/lib/events/messages'

export const dynamic = 'force-dynamic'

export async function POST() {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const results = await processDueEventMessages(ctx.admin, 30)
        return NextResponse.json({ success: true, results })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao processar fila.' }, { status: 500 })
    }
}
