'use client'

import { Menu } from 'lucide-react'

type Props = {
    title: string
    metadata?: Record<string, unknown>
}

export default function PropertyLandingMobileMenu(_props: Props) {
    const openGlobalMenu = () => {
        window.dispatchEvent(new CustomEvent('pilger:open-global-menu'))
    }

    return (
        <div className="plp-mobile-menu">
            <button
                type="button"
                className="plp-mobile-menu-button"
                aria-label="Abrir menu"
                aria-expanded={false}
                onClick={openGlobalMenu}
            >
                <Menu size={21} />
            </button>
        </div>
    )
}
