'use client'

import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'

type Props = {
    phone: string
    message?: string
    slug?: string
    template?: string
    className?: string
    style?: CSSProperties
    children: ReactNode
}

export default function WhatsAppCaptureLink({
    phone,
    message = 'Olá! Quero falar com um especialista.',
    slug = 'home',
    template = 'site-global',
    className,
    style,
    children,
}: Props) {
    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        openWhatsAppWithLeadCapture({ phone, message, slug, template })
    }

    return (
        <a
            href={`https://wa.me/${phone}`}
            onClick={onClick}
            className={className}
            style={style}
        >
            {children}
        </a>
    )
}

