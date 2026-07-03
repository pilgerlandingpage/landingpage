'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UserAccessTracker() {
    const pathname = usePathname()
    const lastTracked = useRef<string | null>(null)

    useEffect(() => {
        if (!pathname?.startsWith('/admin')) return

        let cancelled = false
        const query = window.location.search.replace(/^\?/, '')
        const path = query ? `${pathname}?${query}` : pathname
        const key = `${path}:${Math.floor(Date.now() / 30000)}`

        if (lastTracked.current === key) return
        lastTracked.current = key

        const track = async () => {
            try {
                const supabase = createClient()
                const { data, error } = await supabase.auth.getSession()
                if (error || cancelled || !data.session?.user) return

                await fetch('/api/admin/user-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event_type: 'page_view',
                        path,
                        referrer: document.referrer,
                        search_params: window.location.search,
                        metadata: {
                            title: document.title,
                        },
                    }),
                })
            } catch (err) {
                console.warn('[UserAccessTracker] skipped:', err)
            }
        }

        track()

        return () => {
            cancelled = true
        }
    }, [pathname])

    return null
}
