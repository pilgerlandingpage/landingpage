import {
    interpolateTemplate,
    sendDocumentMessage,
    sendCarousel,
    sendContactMessage,
    sendAudioMessage,
    sendImageMessage,
    sendLocationRequest,
    sendMenuMessage,
    sendVideoMessage,
    sendWhatsAppMessage,
} from '@/lib/connectyhub/whatsapp'
import { generateWorkflowElevenLabsAudioUrl } from '@/lib/workflows/tts-audio'
import { buildTrackedWhatsAppLink } from '@/lib/tracking/whatsapp-links'

export type WorkflowActionType =
    | 'wait_only'
    | 'text'
    | 'url_buttons'
    | 'reply_buttons'
    | 'list'
    | 'poll'
    | 'audio_tts'
    | 'image'
    | 'video'
    | 'document'
    | 'location_request'
    | 'contact'
    | 'carousel'

export type WorkflowActionPayload = Record<string, any>

export type WorkflowActionStep = {
    id: string
    action_type?: WorkflowActionType
    action_payload?: WorkflowActionPayload | null
    message_template: string
}

type SendWorkflowStepParams = {
    phone: string
    instanceToken: string
    step: WorkflowActionStep
    variables: Record<string, string>
}

function interpolateValue(value: unknown, variables: Record<string, string>) {
    return interpolateTemplate(String(value || '').trim(), variables)
}

function parseLines(value: unknown) {
    return String(value || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
}

function getWorkflowTrackingPhone(variables: Record<string, string>) {
    return variables.phone || variables.telefone || variables.lead_phone || variables.whatsapp_phone || ''
}

function parseUrlButtonChoices(value: unknown, variables: Record<string, string>, title?: string) {
    return parseLines(value)
        .map(line => interpolateTemplate(line, variables))
        .map(line => {
            const separator = line.includes('=>') ? '=>' : '|'
            const [rawLabel, ...rest] = line.split(separator)
            const label = String(rawLabel || '').trim()
            const url = rest.join(separator).trim()
            if (!label || !/^https?:\/\//i.test(url)) return ''
            const trackedUrl = buildTrackedWhatsAppLink({
                url,
                leadPhone: getWorkflowTrackingPhone(variables),
                label,
                title,
                type: 'workflow',
                campaign: 'workflow_button',
                content: variables.workflow_id || variables.workflowId || '',
            })
            return `${label.slice(0, 24)}|url:${trackedUrl}`
        })
        .filter(Boolean)
        .slice(0, 3)
}

function parseReplyChoices(value: unknown, variables: Record<string, string>) {
    return parseLines(value)
        .map(line => interpolateTemplate(line, variables).slice(0, 24))
        .filter(Boolean)
        .slice(0, 3)
}

function parseListChoices(value: unknown, variables: Record<string, string>) {
    return parseLines(value)
        .map(line => interpolateTemplate(line, variables))
        .filter(Boolean)
        .slice(0, 30)
}

function parsePollChoices(value: unknown, variables: Record<string, string>) {
    return parseLines(value)
        .map(line => interpolateTemplate(line, variables).slice(0, 80))
        .filter(Boolean)
        .slice(0, 12)
}

async function sendOptionalMediaButtons(params: {
    phone: string
    instanceToken: string
    payload: WorkflowActionPayload
    variables: Record<string, string>
}) {
    const choices = parseUrlButtonChoices(params.payload.media_url_buttons_text, params.variables, params.payload.media_button_text || 'Mídia')
    if (!choices.length) return

    await sendMenuMessage({
        phone: params.phone,
        text: interpolateValue(params.payload.media_button_text || 'Acesse abaixo:', params.variables),
        type: 'button',
        choices,
        footerText: interpolateValue(params.payload.media_button_footer, params.variables) || undefined,
        instanceToken: params.instanceToken,
    })
}

export function workflowStepHasSendableContent(step: Partial<WorkflowActionStep>) {
    const type = step.action_type || 'text'
    const payload = step.action_payload || {}
    const message = String(step.message_template || '').trim()

    if (type === 'wait_only') return true
    if (type === 'text') return !!message
    if (type === 'url_buttons') return !!parseUrlButtonChoices(payload.url_buttons_text, {}).length
    if (type === 'reply_buttons') return !!parseReplyChoices(payload.reply_options_text, {}).length
    if (type === 'list') return !!parseListChoices(payload.list_choices_text, {}).length
    if (type === 'poll') return parsePollChoices(payload.poll_options_text, {}).length >= 2
    if (type === 'audio_tts') return !!String(payload.audio_text || message).trim()
    if (type === 'image') return !!String(payload.image_url || '').trim()
    if (type === 'video') return !!String(payload.video_url || '').trim()
    if (type === 'document') return !!String(payload.document_url || '').trim()
    if (type === 'location_request') return !!message
    if (type === 'contact') return !!String(payload.contact_name || '').trim() && !!String(payload.contact_phone || '').trim()
    if (type === 'carousel') return !!String(payload.carousel_cards_json || '').trim()

    return !!message
}

export async function sendWorkflowWhatsAppAction(params: SendWorkflowStepParams) {
    const { phone, instanceToken, step, variables } = params
    const actionType = step.action_type || 'text'
    const payload = step.action_payload || {}
    const message = interpolateValue(step.message_template, variables)

    if (actionType === 'wait_only') {
        return { type: actionType, message: 'Espera concluida sem envio.', preview: 'Espera sem envio' }
    }

    if (actionType === 'url_buttons') {
        const choices = parseUrlButtonChoices(payload.url_buttons_text, variables, payload.title || message || 'Workflow')
        if (!choices.length) throw new Error('Bloco de botao URL sem botoes validos.')
        await sendMenuMessage({
            phone,
            text: message || interpolateValue(payload.title || 'Acesse o link abaixo:', variables),
            type: 'button',
            choices,
            footerText: interpolateValue(payload.footer_text, variables) || undefined,
            imageButton: interpolateValue(payload.image_url, variables) || undefined,
            instanceToken,
        })
        return { type: actionType, message: message || choices.join('\n'), preview: choices.join(' | ') }
    }

    if (actionType === 'reply_buttons') {
        const choices = parseReplyChoices(payload.reply_options_text, variables)
        if (!choices.length) throw new Error('Bloco de botoes rapidos sem opcoes.')
        await sendMenuMessage({
            phone,
            text: message || interpolateValue(payload.title || 'Escolha uma opcao:', variables),
            type: 'button',
            choices,
            footerText: interpolateValue(payload.footer_text, variables) || undefined,
            instanceToken,
        })
        return { type: actionType, message: message || choices.join('\n'), preview: choices.join(' | ') }
    }

    if (actionType === 'list') {
        const choices = parseListChoices(payload.list_choices_text, variables)
        if (!choices.length) throw new Error('Bloco de lista sem itens.')
        await sendMenuMessage({
            phone,
            text: message || interpolateValue(payload.title || 'Separei algumas opcoes:', variables),
            type: 'list',
            choices,
            listButton: interpolateValue(payload.list_button || 'Ver opcoes', variables),
            footerText: interpolateValue(payload.footer_text, variables) || undefined,
            instanceToken,
        })
        return { type: actionType, message: message || choices.join('\n'), preview: choices.slice(0, 4).join(' | ') }
    }

    if (actionType === 'poll') {
        const choices = parsePollChoices(payload.poll_options_text, variables)
        if (choices.length < 2) throw new Error('Enquete precisa de pelo menos duas opcoes.')
        await sendMenuMessage({
            phone,
            text: message || interpolateValue(payload.title || 'Qual opcao faz mais sentido para voce?', variables),
            type: 'poll',
            choices,
            selectableCount: payload.poll_multi ? choices.length : 1,
            instanceToken,
        })
        return { type: actionType, message: message || choices.join('\n'), preview: choices.join(' | ') }
    }

    if (actionType === 'image') {
        const imageUrl = interpolateValue(payload.image_url, variables)
        if (!imageUrl) throw new Error('Bloco de imagem sem URL.')
        await sendImageMessage({ phone, imageUrl, caption: message || undefined, instanceToken })
        await sendOptionalMediaButtons({ phone, instanceToken, payload, variables })
        return { type: actionType, message: message || imageUrl, preview: imageUrl }
    }

    if (actionType === 'video') {
        const videoUrl = interpolateValue(payload.video_url, variables)
        if (!videoUrl) throw new Error('Bloco de video sem URL.')
        await sendVideoMessage({
            phone,
            videoUrl,
            caption: message || undefined,
            thumbnail: interpolateValue(payload.thumbnail_url, variables) || undefined,
            instanceToken,
        })
        await sendOptionalMediaButtons({ phone, instanceToken, payload, variables })
        return { type: actionType, message: message || videoUrl, preview: videoUrl }
    }

    if (actionType === 'audio_tts') {
        const audioText = interpolateValue(payload.audio_text || message, variables)
        if (!audioText) throw new Error('Bloco de audio IA sem texto.')
        const audioUrl = await generateWorkflowElevenLabsAudioUrl(audioText, interpolateValue(payload.voice_id, variables))
        await sendAudioMessage({
            phone,
            audioUrl,
            ptt: payload.ptt !== false,
            instanceToken,
        })
        return { type: actionType, message: audioText, preview: audioText }
    }

    if (actionType === 'document') {
        const documentUrl = interpolateValue(payload.document_url, variables)
        if (!documentUrl) throw new Error('Bloco de documento sem URL.')
        await sendDocumentMessage({
            phone,
            documentUrl,
            fileName: interpolateValue(payload.file_name, variables) || undefined,
            caption: message || undefined,
            instanceToken,
        })
        await sendOptionalMediaButtons({ phone, instanceToken, payload, variables })
        return { type: actionType, message: message || documentUrl, preview: documentUrl }
    }

    if (actionType === 'location_request') {
        if (!message) throw new Error('Pedido de localizacao precisa de texto.')
        await sendLocationRequest(phone, message, instanceToken)
        return { type: actionType, message, preview: message }
    }

    if (actionType === 'contact') {
        const contactName = interpolateValue(payload.contact_name, variables)
        const contactPhone = interpolateValue(payload.contact_phone, variables)
        if (!contactName || !contactPhone) throw new Error('Contato precisa de nome e telefone.')
        await sendContactMessage({ phone, contactName, contactPhone, instanceToken })
        return { type: actionType, message: message || `${contactName} - ${contactPhone}`, preview: contactName }
    }

    if (actionType === 'carousel') {
        let cards: any[] = []
        try {
            cards = JSON.parse(interpolateTemplate(String(payload.carousel_cards_json || '[]'), variables))
        } catch {
            throw new Error('Carrossel precisa de JSON valido.')
        }
        if (!Array.isArray(cards) || cards.length === 0) throw new Error('Carrossel precisa de pelo menos um card.')
        const trackedCards = cards.slice(0, 10).map(card => ({
            ...card,
            buttons: Array.isArray(card?.buttons)
                ? card.buttons.map((button: any) => {
                    if (String(button?.type || '').toUpperCase() !== 'URL' || !/^https?:\/\//i.test(String(button?.id || ''))) return button
                    return {
                        ...button,
                        id: buildTrackedWhatsAppLink({
                            url: String(button.id),
                            leadPhone: getWorkflowTrackingPhone(variables),
                            label: String(button?.text || 'Abrir'),
                            title: 'Carrossel workflow',
                            type: 'workflow_carousel',
                            campaign: 'workflow_carousel_button',
                            content: variables.workflow_id || variables.workflowId || '',
                        }),
                    }
                })
                : card?.buttons,
        }))
        await sendCarousel(
            phone,
            message || interpolateValue(payload.carousel_text || 'Separei algumas opcoes para voce:', variables),
            trackedCards,
            instanceToken
        )
        return { type: actionType, message: message || `Carrossel com ${cards.length} cards`, preview: `Carrossel: ${cards.length} cards` }
    }

    if (!message) throw new Error('Mensagem vazia.')
    await sendWhatsAppMessage({ phone, message, instanceToken })
    return { type: 'text', message, preview: message }
}
