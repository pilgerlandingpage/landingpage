import { cleanString } from './utils'

const INTERACTION_TYPES = new Set(['none', 'buttons', 'poll', 'link_buttons', 'list', 'location_request'])

function cleanId(value: unknown, fallback: string) {
    const id = String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64)
    return id || fallback
}

function cleanUrl(value: unknown) {
    const url = cleanString(value, 900)
    if (!url) return ''
    try {
        const parsed = new URL(url)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : ''
    } catch {
        return ''
    }
}

export function sanitizeEventAutomationMetadata(input: unknown) {
    const source = input && typeof input === 'object' && !Array.isArray(input)
        ? input as Record<string, any>
        : {}
    const interactionType = INTERACTION_TYPES.has(String(source.interaction_type))
        ? String(source.interaction_type)
        : 'none'

    const buttons = Array.isArray(source.buttons)
        ? source.buttons
            .map((button: any, index: number) => {
                const label = cleanString(button?.label, 42)
                if (!label) return null
                const action = cleanId(button?.action || button?.id || button?.value, `event_button_${index + 1}`)
                return {
                    id: cleanId(button?.id || action, action),
                    label,
                    action,
                    value: cleanString(button?.value || action, 120),
                    url: cleanUrl(button?.url),
                }
            })
            .filter(Boolean)
            .slice(0, interactionType === 'list' ? 10 : 3)
        : []

    const pollOptions = Array.isArray(source.poll?.options)
        ? source.poll.options
            .map((option: unknown) => cleanString(option, 48))
            .filter(Boolean)
            .slice(0, 8)
        : []

    const poll = {
        question: cleanString(source.poll?.question, 140),
        options: pollOptions,
        multi_select: source.poll?.multi_select === true,
    }

    return {
        source: cleanString(source.source, 80) || 'event-agent-office',
        interaction_type: interactionType,
        tracking_enabled: source.tracking_enabled !== false,
        tracking_tag: cleanId(source.tracking_tag, 'event_agent_interaction'),
        buttons,
        poll,
    }
}

export function appendEventInteractionLinks(content: string, metadata: Record<string, any>) {
    const buttons = Array.isArray(metadata.buttons) ? metadata.buttons : []
    const links = buttons
        .map((button: any) => ({
            label: cleanString(button?.label, 42),
            url: cleanUrl(button?.url),
        }))
        .filter(button => button.label && button.url)

    if (!links.length) return content

    return [
        content.trim(),
        '',
        ...links.map(button => `${button.label}: ${button.url}`),
    ].join('\n')
}
