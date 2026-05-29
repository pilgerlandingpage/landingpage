const HTML_ENTITIES: Record<string, string> = {
    amp: '&',
    apos: "'",
    bull: ' ',
    gt: '>',
    lt: '<',
    mdash: '-',
    nbsp: ' ',
    ndash: '-',
    quot: '"',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
}

function entityToChar(entity: string) {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
        const value = Number.parseInt(entity.slice(2), 16)
        if (!Number.isFinite(value)) return ' '
        try {
            return String.fromCodePoint(value)
        } catch {
            return ' '
        }
    }

    if (entity.startsWith('#')) {
        const value = Number.parseInt(entity.slice(1), 10)
        if (!Number.isFinite(value)) return ' '
        try {
            return String.fromCodePoint(value)
        } catch {
            return ' '
        }
    }

    return HTML_ENTITIES[entity.toLowerCase()] ?? `&${entity};`
}

export function decodeHtmlEntities(value?: string | null) {
    let text = String(value || '')

    for (let i = 0; i < 3; i += 1) {
        const previous = text
        text = text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => entityToChar(entity))
        if (text === previous) break
    }

    return text
}

export function cleanPropertyText(value?: string | null) {
    let text = decodeHtmlEntities(value)

    text = text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|section|article)\s*>/gi, '\n')
        .replace(/<\s*(p|div|h[1-6]|li|ul|ol|section|article)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')

    text = decodeHtmlEntities(text)

    return text
        .replace(/\bdata-(start|end)=["']?\d+["']?/gi, ' ')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
        .replace(/\s+([,.!?;:])/g, '$1')
        .replace(/([.!?])(?=\S)/g, '$1 ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n')
        .trim()
}

export function compactPropertyText(value?: string | null, fallback = '', max = 160) {
    const text = cleanPropertyText(value || fallback).replace(/\s+/g, ' ').trim()
    return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text
}
