function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function inlineMarkdown(value: string) {
    return escapeHtml(value)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
}

function imageCreditText(value: string) {
    return value
        .replace(/\s*[-–—]\s*\[ver origem\]\((https?:\/\/[^\s)]+)\)\.?/gi, '.')
        .replace(/\s*[-–—]\s*ver origem\.?/gi, '.')
        .replace(/\s+/g, ' ')
        .trim()
}

export function markdownToHtml(markdown: string) {
    const lines = String(markdown || '').split(/\r?\n/)
    const html: string[] = []
    let listOpen = false

    const closeList = () => {
        if (listOpen) {
            html.push('</ul>')
            listOpen = false
        }
    }

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
            closeList()
            continue
        }

        if (/^Fonte da imagem:/i.test(trimmed)) {
            closeList()
            html.push(`<p>${escapeHtml(imageCreditText(trimmed))}</p>`)
            continue
        }

        const image = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)$/)
        if (image) {
            closeList()
            html.push(`<figure class="blog-inline-image"><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1] || '')}" loading="lazy" /></figure>`)
            continue
        }

        const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
        if (heading) {
            closeList()
            const level = heading[1].length
            html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
            continue
        }

        if (/^[-*]\s+/.test(trimmed)) {
            if (!listOpen) {
                html.push('<ul>')
                listOpen = true
            }
            html.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</li>`)
            continue
        }

        closeList()
        html.push(`<p>${inlineMarkdown(trimmed)}</p>`)
    }

    closeList()
    return html.join('\n')
}
