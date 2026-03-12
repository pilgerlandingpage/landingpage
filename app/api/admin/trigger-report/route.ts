import { NextResponse } from 'next/server'
import { generateDailyPilgerReport, generateWeeklyPilgerReport } from '@/lib/ai/pilger-ceo'

export async function POST(req: Request) {
  try {
    const { type } = await req.json()

    if (type === 'daily') {
      const result = await generateDailyPilgerReport()
      return NextResponse.json({ success: true, message: 'Relatório diário gerado com sucesso.', result })
    }

    if (type === 'weekly') {
      const result = await generateWeeklyPilgerReport()
      return NextResponse.json({ success: true, message: 'Diretriz semanal gerada com sucesso.', result })
    }

    return NextResponse.json({ success: false, message: 'Tipo de relatório inválido.' }, { status: 400 })
  } catch (error: any) {
    console.error('Trigger report error:', error)
    return NextResponse.json({ success: false, message: error.message || 'Erro interno ao gerar relatório.' }, { status: 500 })
  }
}
