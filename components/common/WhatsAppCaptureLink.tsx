'use client'

import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'
import { trackEvent } from '@/lib/tracking/client'

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
        const trackingEventType = typeof metadata?.tracking_event_type === 'string'
            ? metadata.tracking_event_type
            : ''

        if (trackingEventType) {
            void trackEvent(trackingEventType, {
                ...(metadata || {}),
                template,
                channel: 'whatsapp',
                capture_before_whatsapp: true,
            })
        }
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
