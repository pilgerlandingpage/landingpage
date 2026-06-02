'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const REFRESH_INTERVAL_SECONDS = 30

export default function AgentOrgLiveRefresh() {
    const router = useRouter()
    const [seconds, setSeconds] = useState(REFRESH_INTERVAL_SECONDS)

    useEffect(() => {
        const timer = window.setInterval(() => {
            setSeconds(current => {
                if (current <= 1) {
                    router.refresh()
                    return REFRESH_INTERVAL_SECONDS
                }
                return current - 1
            })
        }, 1000)

        return () => window.clearInterval(timer)
    }, [router])

    return (
        <div className="agent-org-refresh" aria-live="polite">
            <RefreshCw size={15} />
            <span>Atualizacao viva</span>
            <strong>{seconds}s</strong>
        </div>
    )
}
