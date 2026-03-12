'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect to the new RBAC user management page
export default function NewUserPage() {
    const router = useRouter()
    useEffect(() => { router.replace('/admin/settings/users') }, [router])
    return (
        <div style={{ padding: 40, color: 'var(--text-muted)', textAlign: 'center' }}>
            Redirecionando para Gestão de Usuários...
        </div>
    )
}
