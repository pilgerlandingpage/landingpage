'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, Home, Menu, MessageCircle, Newspaper, Search, X } from 'lucide-react'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'

type Props = {
    title: string
    metadata?: Record<string, unknown>
}

const WHATSAPP_PHONE = '5547992528080'

export default function PropertyLandingMobileMenu({ title, metadata }: Props) {
    const [open, setOpen] = useState(false)
    const close = () => setOpen(false)

    return (
        <div className="plp-mobile-menu">
            <button
                type="button"
                className="plp-mobile-menu-button"
                aria-label={open ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={open}
                onClick={() => setOpen(current => !current)}
            >
                {open ? <X size={21} /> : <Menu size={21} />}
            </button>

            {open && (
                <div className="plp-mobile-menu-layer" onClick={close}>
                    <div className="plp-mobile-menu-panel" onClick={event => event.stopPropagation()}>
                        <div className="plp-mobile-menu-head">
                            <div>
                                <strong>Guilherme Pilger</strong>
                                <span>CRECI/SC 6772-J</span>
                            </div>
                            <button type="button" aria-label="Fechar menu" onClick={close}>
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="plp-mobile-menu-links" aria-label="Menu do imóvel">
                            <Link href="/" onClick={close}><Home size={18} /> Home</Link>
                            <Link href="/busca" onClick={close}><Search size={18} /> Vendas</Link>
                            <Link href="/noticias" onClick={close}><Newspaper size={18} /> Notícias</Link>
                            <Link href="/blog" onClick={close}><BookOpen size={18} /> Blog</Link>
                            <WhatsAppCaptureLink
                                phone={WHATSAPP_PHONE}
                                message={`Olá! Quero falar sobre o imóvel: ${title}`}
                                slug="imovel"
                                template="property-classic-mobile-menu-contato"
                                metadata={metadata}
                                className="plp-mobile-menu-contact"
                                onClick={close}
                            >
                                <MessageCircle size={18} /> Contato
                            </WhatsAppCaptureLink>
                        </nav>
                    </div>
                </div>
            )}
        </div>
    )
}
