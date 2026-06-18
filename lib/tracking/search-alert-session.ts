const ALERT_MATCH_OPENED_KEY_PREFIX = 'pilger_alert_match_opened'
const ALERT_MATCH_OPENED_TTL_MS = 5 * 60 * 1000

function alertMatchOpenedKey(alertId: string, propertyId: string) {
    return `${ALERT_MATCH_OPENED_KEY_PREFIX}:${alertId}:${propertyId}`
}

export function markSearchAlertMatchOpenIfNeeded(
    alertId: string | null | undefined,
    propertyId: string | null | undefined,
    ttlMs = ALERT_MATCH_OPENED_TTL_MS
) {
    if (!alertId || !propertyId || typeof window === 'undefined') return false

    const key = alertMatchOpenedKey(alertId, propertyId)

    try {
        const now = Date.now()
        const lastTrackedAt = Number(window.sessionStorage.getItem(key) || 0)

        if (Number.isFinite(lastTrackedAt) && now - lastTrackedAt < ttlMs) {
            return false
        }

        window.sessionStorage.setItem(key, String(now))
        return true
    } catch {
        return true
    }
}
