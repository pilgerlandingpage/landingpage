import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import {
    configureWebhook,
    configurePrivacy,
    updateDelaySettings,
    editLabel,
    editQuickReply,
} from '../uazapi'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// ═══════════════════════════════════════════════════════════════
//  Setup completo de instância WhatsApp — via Inngest (sem timeout)
//  Trigger: POST /api/admin/whatsapp/setup-full → inngest.send()
// ═══════════════════════════════════════════════════════════════

export const whatsappInstanceSetup = inngest.createFunction(
    {
        id: 'whatsapp-instance-setup',
        name: 'WhatsApp Instance Setup',
        retries: 1,
    },
    { event: 'whatsapp/instance-setup' },
    async ({ event, step }) => {
        const { instanceId, instanceToken, webhookBaseUrl } = event.data
        const supabase = getSupabase()
        const log: string[] = []

        if (!instanceToken) {
            return { success: false, error: 'instanceToken missing' }
        }

        // ── Step 1: Configurar Webhook ──
        const webhookResult = await step.run('setup-webhook', async () => {
            try {
                const webhookUrl = `${webhookBaseUrl}/api/webhooks/whatsapp`
                await configureWebhook({
                    enabled: true,
                    url: webhookUrl,
                    events: ['messages', 'messages_update', 'connection', 'chats', 'labels'],
                    excludeMessages: ['wasSentByApi', 'isGroupYes'],
                    addUrlEvents: false,
                    addUrlTypesMessages: false,
                }, instanceToken)
                return { success: true, url: webhookUrl }
            } catch (e: any) {
                return { success: false, error: e?.message || String(e) }
            }
        })
        log.push(`Webhook: ${webhookResult.success ? '✅ ' + ('url' in webhookResult ? webhookResult.url : '') : '❌ ' + ('error' in webhookResult ? webhookResult.error : 'unknown')}`)

        // ── Step 2: Configurar Privacidade ──
        const privacyResult = await step.run('setup-privacy', async () => {
            try {
                await configurePrivacy({
                    groupadd: 'contacts',       // Só contatos podem adicionar em grupos
                    last: 'contacts',            // Visto por último apenas para contatos
                    status: 'contacts',          // Status apenas para contatos
                    profile: 'all',              // Foto de perfil para todos (boa para negócios)
                    readreceipts: 'all',         // Confirmação de leitura ativada
                    online: 'all',               // Online visível para todos
                }, instanceToken)
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e?.message || String(e) }
            }
        })
        log.push(`Privacidade: ${privacyResult.success ? '✅ Configurada' : '❌ ' + ('error' in privacyResult ? privacyResult.error : 'unknown')}`)

        // ── Step 3: Configurar Delay de Mensagens ──
        const delayResult = await step.run('setup-delay', async () => {
            try {
                await updateDelaySettings(1000, 3000, instanceToken) // 1-3 segundos entre msgs
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e?.message || String(e) }
            }
        })
        log.push(`Delay: ${delayResult.success ? '✅ 1-3s' : '❌ ' + ('error' in delayResult ? delayResult.error : 'unknown')}`)

        // ── Step 4: Criar Etiquetas Padrão ──
        const defaultLabels = [
            { name: '🆕 Novo Lead', color: 1 },       // Azul claro
            { name: '🔥 Qualificado', color: 2 },      // Amarelo
            { name: '📅 Agendou Visita', color: 0 },   // Verde WhatsApp
            { name: '🏠 Visitou Imóvel', color: 4 },   // Roxo
            { name: '💰 Negociando', color: 5 },        // Laranja
            { name: '✅ Fechou', color: 0 },            // Verde WhatsApp
            { name: '❌ Perdido', color: 3 },           // Vermelho
            { name: '🤝 Parceiro', color: 8 },          // Verde claro
            { name: '⭐ VIP', color: 2 },               // Amarelo
            { name: '🔄 Recontato', color: 6 },         // Rosa
        ]

        const labelsResult = await step.run('setup-labels', async () => {
            const results: { name: string; success: boolean }[] = []
            for (const label of defaultLabels) {
                try {
                    await editLabel('new', label.name, label.color, false, instanceToken)
                    results.push({ name: label.name, success: true })
                } catch (e: any) {
                    // Label may already exist — not critical
                    results.push({ name: label.name, success: false })
                }
            }
            return results
        })
        const labelsOk = labelsResult.filter(r => r.success).length
        log.push(`Etiquetas: ✅ ${labelsOk}/${defaultLabels.length} criadas`)

        // ── Step 5: Criar Respostas Rápidas Padrão ──
        const defaultQuickReplies = [
            {
                shortCut: '/oi',
                type: 'text' as const,
                text: 'Olá! 👋 Sou corretor da Pilger Imóveis. Como posso ajudá-lo hoje?',
            },
            {
                shortCut: '/horario',
                type: 'text' as const,
                text: 'Nosso horário de atendimento é de segunda a sexta, das 9h às 18h, e sábados das 9h às 13h. Posso agendar uma visita para você! 📅',
            },
            {
                shortCut: '/visita',
                type: 'text' as const,
                text: 'Ótimo! Vou agendar uma visita para você. Qual dia e horário ficam melhores? 🏠',
            },
            {
                shortCut: '/docs',
                type: 'text' as const,
                text: 'Para dar andamento, vou precisar dos seguintes documentos:\n\n📄 RG e CPF\n📄 Comprovante de renda\n📄 Comprovante de residência\n📄 Certidão de estado civil\n\nPode enviar por aqui mesmo! 📎',
            },
            {
                shortCut: '/financiamento',
                type: 'text' as const,
                text: 'Trabalhamos com financiamento pela Caixa, Itaú, Bradesco e Santander. A simulação é gratuita e leva apenas alguns minutos! Quer que eu faça uma simulação para você? 🏦',
            },
            {
                shortCut: '/obrigado',
                type: 'text' as const,
                text: 'Foi um prazer atendê-lo! Se precisar de qualquer coisa, é só chamar. Estou à disposição! 😊🏠',
            },
            {
                shortCut: '/localizacao',
                type: 'text' as const,
                text: 'Nosso escritório fica em Balneário Camboriú. Vou enviar a localização para você! 📍',
            },
            {
                shortCut: '/preco',
                type: 'text' as const,
                text: 'Temos opções em diversas faixas de preço. Pode me dizer qual é o seu orçamento para que eu encontre as melhores opções? 💰',
            },
        ]

        const quickRepliesResult = await step.run('setup-quick-replies', async () => {
            const results: { shortCut: string; success: boolean }[] = []
            for (const qr of defaultQuickReplies) {
                try {
                    await editQuickReply(qr, instanceToken)
                    results.push({ shortCut: qr.shortCut, success: true })
                } catch (e: any) {
                    results.push({ shortCut: qr.shortCut, success: false })
                }
            }
            return results
        })
        const qrOk = quickRepliesResult.filter(r => r.success).length
        log.push(`Respostas Rápidas: ✅ ${qrOk}/${defaultQuickReplies.length} criadas`)

        // ── Step 6: Atualizar status no Supabase ──
        await step.run('update-db-status', async () => {
            await supabase
                .from('whatsapp_instances')
                .update({
                    config: {
                        setup_completed: true,
                        setup_at: new Date().toISOString(),
                        setup_log: log,
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', instanceId)
        })

        return {
            success: true,
            log,
            summary: `Setup completo: ${log.length} etapas executadas`,
        }
    }
)
