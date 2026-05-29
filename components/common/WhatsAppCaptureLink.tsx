'use client'

import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'

type Props = {
    phone: string
    message?: string
    slug?: string
    template?: string
    metadata?: Record<string, unknown>
    className?: string
    style?: CSSProperties
    onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
    children: ReactNode
}

export default function WhatsAppCaptureLink({
    phone,
    message = 'Olá! Quero falar com um especialista.',
    slug = 'home',
    template = 'site-global',
    metadata,
    className,
    style,
    onClick: externalOnClick,
    children,
}: Props) {
    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        if (externalOnClick) externalOnClick(e)
        openWhatsAppWithLeadCapture({ phone, message, slug, template, metadata })
    }

    return (
        <a
            href="#whatsapp-form"
            onClick={onClick}
            className={className}
            style={style}
        >
            {children}
        </a>
    )
}
