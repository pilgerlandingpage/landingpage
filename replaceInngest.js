const fs = require('fs');
const content = fs.readFileSync('lib/inngest/ads-functions.ts', 'utf8');

const headStr = 'export const generateDailyPilgerReportCron = inngest.createFunction(';
const targetStart = content.indexOf(headStr);
if (targetStart === -1) { console.error('not found 1'); process.exit(1); }

const head = content.substring(0, targetStart);

const replacement = `export const generateDailyPilgerReportCron = inngest.createFunction(
    { id: 'pilger-daily-report', name: 'Gerar Relatório Diário Pilger AI' },
    { cron: '0 * * * *' }, // Executa a cada hora para avaliar configurações
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Verificar horário dinâmico (Padrão: 23)
        const config = await step.run('check-daily-schedule', async () => {
            const { data } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'pilger_daily_time')
                .single()
            
            const targetHours = (data?.value || '23').split(',')
            const { hour } = getCurrentTimeSP()
            
            return {
                shouldRun: targetHours.includes(hour),
                currentSlot: hour
            }
        })

        if (!config.shouldRun) {
            return { skipped: true, reason: 'hour_mismatch', current_hour: config.currentSlot }
        }

        // 2. Extra proteção contra execuções duplas no mesmo horário do mesmo dia
        const hasRunToday = await step.run('check-already-run', async () => {
             const { data } = await supabase
                .from('pilger_ai_reports')
                .select('id')
                .eq('type', 'daily')
                // Supabase doesn't easily store runId yet in the default schema, so we can just look at created_at for the last 50 minutes.
                .gte('created_at', new Date(Date.now() - 50 * 60000).toISOString())
                .limit(1)
                
             return data && data.length > 0
        })

        if (hasRunToday) {
            return { skipped: true, reason: 'already_run_this_hour' }
        }

        // 3. Executar Relatório
        const result = await step.run('generate-daily-report', async () => {
            return await generateDailyPilgerReport()
        })
        return result
    }
)

export const generateWeeklyPilgerReportCron = inngest.createFunction(
    { id: 'pilger-weekly-report', name: 'Gerar Diretriz Semanal Pilger AI' },
    { cron: '0 * * * *' }, // Executa a cada hora para avaliar configurações
    async ({ step }) => {
        const supabase = getSupabase()

        // 1. Verificar horário dinâmico (Fixo: Segunda-feira às 23:00)
        const config = await step.run('check-weekly-schedule', async () => {
            const { data: dayData } = await supabase.from('app_config').select('value').eq('key', 'pilger_weekly_day').single()
            const { data: timeData } = await supabase.from('app_config').select('value').eq('key', 'pilger_weekly_time').single()
            
            const targetDay = dayData?.value || '1'
            const targetHour = timeData?.value || '23'
            
            const { dayOfWeek, hour } = getCurrentTimeSP()
            return {
                shouldRun: dayOfWeek === targetDay && hour === targetHour,
                currentDay: dayOfWeek,
                currentHour: hour
            }
        })

        if (!config.shouldRun) {
            return { skipped: true, reason: 'schedule_mismatch', current_day: config.currentDay, current_hour: config.currentHour }
        }

        // 2. Extra proteção
        const hasRunToday = await step.run('check-already-run', async () => {
             const { data } = await supabase
                .from('pilger_ai_reports')
                .select('id')
                .eq('type', 'weekly')
                .gte('created_at', new Date(Date.now() - 50 * 60000).toISOString())
                .limit(1)
                
             return data && data.length > 0
        })

        if (hasRunToday) {
            return { skipped: true, reason: 'already_run_this_hour' }
        }

        // 3. Executar Relatório
        const result = await step.run('generate-weekly-report', async () => {
            return await generateWeeklyPilgerReport()
        })
        return result
    }
)
`

fs.writeFileSync('lib/inngest/ads-functions.ts', head + replacement);
console.log('inngest updated');
