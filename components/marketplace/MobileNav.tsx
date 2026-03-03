'use client'

import React from 'react'
import { Search, MessageSquare } from 'lucide-react'

export default function MobileNav() {
    const openChat = () => {
        window.dispatchEvent(new CustomEvent('open-concierge-chat'))
    }

    return (
        <div className="mobile-nav" style={{ gap: '0', justifyContent: 'space-evenly', padding: '0 8px' }}>
            <div className="nav-item active">
                <div className="nav-icon"><Search size={22} /></div>
                <span>Explorar</span>
            </div>
            <div className="nav-item">
                <div className="nav-icon"><HeartIcon /></div>
                <span>Favoritos</span>
            </div>
            <div onClick={openChat} style={{
                cursor: 'pointer',
                backgroundColor: '#b8945f',
                color: '#1a1a1a',
                padding: '10px 16px',
                borderRadius: '50px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(184, 148, 95, 0.4)',
                transform: 'translateY(-2px)'
            }}>
                <MessageSquare size={18} style={{ fill: 'currentColor' }} />
                Falar com Especialista
            </div>
        </div>
    )
}

function HeartIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
    )
}
