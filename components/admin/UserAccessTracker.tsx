'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UserAccessTracker() {
    const pathname = usePathname()
    const lastTracked = useRef<string | null>(null)
    const [supabase] = useState(() => createClient())

    useEffect(() => {
        let cancelled = false
        const query = window.location.search.replace(/^\?/, '')
        const path = query ? `${pathname}?${query}` : pathname
        const key = `${path}:${Math.floor(Date.now() / 30000)}`

        if (lastTracked.current === key) return
        lastTracked.current = key

        const track = async () => {
            const { data } = await supabase.auth.getSession()
            if (cancelled || !data.session?.user) return

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
            }).catch((err) => {
                console.error('[UserAccessTracker]', err)
            })
        }

        track()

        return () => {
            cancelled = true
        }
    }, [pathname, supabase])

    return null
}
