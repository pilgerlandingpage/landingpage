const PRODUCTION_APP_URL = 'https://guilhermepilger.ai'

function normalizeUrl(value: unknown): string {
    const raw = String(value || '').trim()
    if (!raw) return ''
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return withProtocol.replace(/\/+$/, '')
}

function isLocalUrl(value: string): boolean {
    return /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(value)
}

export function getPublicAppUrl(origin?: string | null): string {
    const candidates = [
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
        process.env.VERCEL_URL,
        origin,
    ]

    for (const candidate of candidates) {
        const normalized = normalizeUrl(candidate)
        if (normalized && !isLocalUrl(normalized)) return normalized
    }

    return PRODUCTION_APP_URL
}

export function getLoginRedirectUrl(pathQuery: string, origin?: string | null): string {
    const suffix = pathQuery.startsWith('/') ? pathQuery : `/${pathQuery}`
    return `${getPublicAppUrl(origin)}${suffix}`
}

export function sanitizeAuthActionLink(actionLink: string, redirectPathQuery: string, origin?: string | null): string {
    const safeRedirectUrl = getLoginRedirectUrl(redirectPathQuery, origin)

    try {
        const url = new URL(actionLink)

        const redirectTo = url.searchParams.get('redirect_to') || url.searchParams.get('redirectTo')
        if (redirectTo && isLocalUrl(redirectTo)) {
            url.searchParams.set(url.searchParams.has('redirect_to') ? 'redirect_to' : 'redirectTo', safeRedirectUrl)
        }

        if (isLocalUrl(url.toString())) {
            const safeBase = new URL(getPublicAppUrl(origin))
            url.protocol = safeBase.protocol
            url.host = safeBase.host
        }

        return url.toString()
    } catch {
        return isLocalUrl(actionLink) ? safeRedirectUrl : actionLink
    }
}
