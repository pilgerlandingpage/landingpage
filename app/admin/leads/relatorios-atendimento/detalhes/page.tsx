import AttendanceReportDetailsClient from './AttendanceReportDetailsClient'

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function AttendanceReportDetailsPage({ searchParams }: PageProps) {
    const params = await searchParams
    return (
        <AttendanceReportDetailsClient
            reportId={firstParam(params?.report_id)}
            filter={firstParam(params?.filtro) || 'todos'}
        />
    )
}
