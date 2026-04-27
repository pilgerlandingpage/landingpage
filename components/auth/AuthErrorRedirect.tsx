'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthErrorRedirect() {
    const router = useRouter()

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const error = params.get('error')
        const errorCode = params.get('error_code')

        if (!error && !errorCode) return

        const nextParams = new URLSearchParams()
        nextParams.set('auth_error', errorCode || error || 'auth_error')
        router.replace(`/login?${nextParams.toString()}`)
    }, [router])

    return null
}
