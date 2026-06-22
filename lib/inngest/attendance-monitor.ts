import { inngest } from './client'
import { syncAndGenerateAttendanceReports } from '@/lib/whatsapp/attendance-monitor'

export const whatsappAttendanceDailyReport = inngest.createFunction(
    {
        id: 'whatsapp-attendance-daily-report',
        name: 'WhatsApp Attendance Daily Report',
        retries: 1,
    },
    { cron: '10 * * * *' },
    async ({ step }) => {
        return step.run('sync-and-generate-attendance-reports', async () => {
            return syncAndGenerateAttendanceReports({
                force: false,
                respectReportHour: true,
                includeHistorySync: true,
                maxChats: 150,
                messagesPerChat: 100,
            })
        })
    }
)

export const whatsappAttendanceManualRun = inngest.createFunction(
    {
        id: 'whatsapp-attendance-manual-run',
        name: 'WhatsApp Attendance Manual Run',
        retries: 1,
    },
    { event: 'whatsapp/attendance-run' },
    async ({ event, step }) => {
        const { instanceId, date } = event.data || {}
        return step.run('manual-sync-and-report', async () => {
            return syncAndGenerateAttendanceReports({
                instanceId: instanceId || null,
                date: date || null,
                force: true,
                includeHistorySync: true,
                maxChats: 150,
                messagesPerChat: 100,
            })
        })
    }
)
