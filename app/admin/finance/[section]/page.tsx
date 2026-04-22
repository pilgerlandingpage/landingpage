import FinancePage from '../page'

type SectionPageProps = {
    params: Promise<{ section: string }> | { section: string }
}

const allowedSections = new Set([
    'cadastros',
    'categorias',
    'subcategorias',
    'pagamentos',
    'favorecidos',
    'novo-lancamento',
    'lancamentos',
])

export default async function FinanceSectionPage({ params }: SectionPageProps) {
    const resolvedParams = typeof (params as any)?.then === 'function' ? await (params as Promise<{ section: string }>) : (params as { section: string })
    const section = String(resolvedParams?.section || '').trim().toLowerCase()
    if (section === 'resumo') {
        return <FinancePage initialSection="dashboard" />
    }
    const normalizedSection = allowedSections.has(section) ? section : 'dashboard'

    return <FinancePage initialSection={normalizedSection} />
}
