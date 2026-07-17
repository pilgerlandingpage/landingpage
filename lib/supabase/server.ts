import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 12000
const DEVELOPMENT_SUPABASE_FETCH_RETRY_DELAYS_MS = [250, 900]

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetriableDevelopmentFetchError(error: unknown) {
    const summary = summarizeSupabaseError(error).toLowerCase()
    return (
        summary.includes('fetch failed') ||
        summary.includes('terminated') ||
        summary.includes('timeout') ||
        summary.includes('aborted') ||
        summary.includes('econnreset') ||
        summary.includes('socket') ||
        summary.includes('network')
    )
}

function createFetchTimeoutSignal(sourceSignal: AbortSignal | null | undefined, timeoutMs: number) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const abortFromSource = () => controller.abort()

    if (sourceSignal?.aborted) {
        controller.abort()
    } else {
        sourceSignal?.addEventListener('abort', abortFromSource, { once: true })
    }

    return {
        signal: controller.signal,
        cleanup() {
            clearTimeout(timeout)
            sourceSignal?.removeEventListener('abort', abortFromSource)
        },
    }
}

function resolveSupabaseFetchTimeoutMs() {
    const configured = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS)
    return Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_SUPABASE_FETCH_TIMEOUT_MS
}

export function createSupabaseFetch() {
    const timeoutMs = resolveSupabaseFetchTimeoutMs()
    const isDevelopment = process.env.NODE_ENV === 'development'
    const retryDelays = isDevelopment ? DEVELOPMENT_SUPABASE_FETCH_RETRY_DELAYS_MS : []

    return async (input: RequestInfo | URL, init?: RequestInit) => {
        for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
            const timeoutSignal = createFetchTimeoutSignal(init?.signal, timeoutMs)

            try {
                return await fetch(input, {
                    ...init,
                    ...(isDevelopment ? { cache: 'no-store' } : {}),
                    signal: timeoutSignal.signal,
                })
            } catch (error) {
                const canRetry =
                    attempt < retryDelays.length &&
                    !init?.signal?.aborted &&
                    isRetriableDevelopmentFetchError(error)

                if (!canRetry) throw error
                await wait(retryDelays[attempt])
            } finally {
                timeoutSignal.cleanup()
            }
        }

        throw new Error('Supabase fetch retry failed')
    }
}

export async function createServerSupabase() {
    const cookieStore = await cookies()
    const supabaseFetch = createSupabaseFetch()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: { fetch: supabaseFetch },
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Server Component — ignore
                    }
                },
            },
        }
    )
}

// Alias for compatibility
export const createClient = createServerSupabase

export function createAdminClient() {
    const { createClient } = require('@supabase/supabase-js')
    const supabaseFetch = createSupabaseFetch()

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { global: { fetch: supabaseFetch } }
    )
}

export function createSupabaseAbortSignal(timeoutMs = 12000) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(timeoutMs)
    }

    const controller = new AbortController()
    setTimeout(() => controller.abort(), timeoutMs)
    return controller.signal
}

export function summarizeSupabaseError(error: unknown) {
    const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : String(error || '')

    const cleaned = message
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (!cleaned) return 'Erro desconhecido'
    return cleaned.length > 260 ? `${cleaned.slice(0, 260).trim()}...` : cleaned
}
