import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function createDevelopmentNoStoreFetch() {
    if (process.env.NODE_ENV !== 'development') return undefined

    return (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, {
            ...init,
            cache: 'no-store',
        })
}

export async function createServerSupabase() {
    const cookieStore = await cookies()
    const developmentFetch = createDevelopmentNoStoreFetch()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            ...(developmentFetch ? { global: { fetch: developmentFetch } } : {}),
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
    const developmentFetch = createDevelopmentNoStoreFetch()

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        developmentFetch ? { global: { fetch: developmentFetch } } : undefined
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
